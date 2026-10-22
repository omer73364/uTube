package com.utubemobile

import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.net.Uri
import java.io.File
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

class JobStore(private val context: Context, private val scope: String = "") {
  companion object {
    private val lock = Any()
    private val databases = mutableMapOf<String, SQLiteDatabase>()
    val activeStates =
      setOf("queued", "preparing", "running", "merging", "converting", "publishing")

    private fun database(context: Context, scope: String): SQLiteDatabase =
      synchronized(lock) {
        databases[scope]
          ?: object :
              SQLiteOpenHelper(context.applicationContext, "${scope}downloads.db", null, 1) {
              override fun onCreate(db: SQLiteDatabase) {
                db.execSQL(
                  "CREATE TABLE jobs (id TEXT PRIMARY KEY,payload TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL)"
                )
                db.execSQL("CREATE INDEX queue_status ON jobs(status,created)")
                db.execSQL("CREATE TABLE meta (key TEXT PRIMARY KEY,value TEXT)")
              }

              override fun onUpgrade(db: SQLiteDatabase, old: Int, new: Int) {
                error("Unsupported download database version.")
              }
            }
            .apply { setWriteAheadLoggingEnabled(true) }
            .writableDatabase
            .also { databases[scope] = it }
      }
  }

  private val prefs = context.getSharedPreferences("${scope}utube-mobile", Context.MODE_PRIVATE)
  private val db = database(context, scope)

  private fun values(job: JSONObject) =
    ContentValues().apply {
      put("id", job.getString("id"))
      put("payload", job.toString())
      put("status", job.getString("status"))
      put("created", job.optLong("createdAt"))
    }

  private fun read(): JSONArray {
    val result = JSONArray()
    db.rawQuery("SELECT payload FROM jobs ORDER BY created,rowid", null).use { cursor ->
      while (cursor.moveToNext()) result.put(JSONObject(cursor.getString(0)))
    }
    return result
  }

  private fun write(all: JSONArray) {
    db.beginTransaction()
    try {
      db.delete("jobs", null, null)
      for (i in 0 until all.length()) db.insertOrThrow("jobs", null, values(all.getJSONObject(i)))
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
  }

  fun all(): List<JSONObject> =
    synchronized(lock) {
      val data = read()
      (0 until data.length()).map { data.getJSONObject(it) }
    }

  fun get(id: String): JSONObject =
    synchronized(lock) {
      db.rawQuery("SELECT payload FROM jobs WHERE id=?", arrayOf(id)).use { cursor ->
        check(cursor.moveToFirst()) { "UNKNOWN_DOWNLOAD" }
        JSONObject(cursor.getString(0))
      }
    }

  fun next(): JSONObject? =
    synchronized(lock) {
      db
        .rawQuery(
          "SELECT payload FROM jobs WHERE status='queued' ORDER BY created,rowid LIMIT 1",
          null,
        )
        .use { cursor -> if (cursor.moveToFirst()) JSONObject(cursor.getString(0)) else null }
    }

  fun edit(id: String, change: (JSONObject) -> Unit) =
    synchronized(lock) {
      val job = get(id)
      change(job)
      check(db.update("jobs", values(job), "id=?", arrayOf(id)) == 1) { "UNKNOWN_DOWNLOAD" }
    }

  fun enqueueBatch(requests: JSONArray): JSONArray =
    synchronized(lock) {
      require(requests.length() in 1..1000) { "QUEUE_FULL" }
      val data = read()
      val effective = snapshot()
      val states =
        (0 until effective.length()).associate {
          effective.getJSONObject(it).getString("id") to
            effective.getJSONObject(it).getString("status")
        }
      val usedRetries = mutableSetOf<String>()
      for (i in 0 until requests.length()) {
        val request = requests.getJSONObject(i)
        TransferPolicy.validateRequest(request)
        if (request.has("retryId")) {
          val retry = request.getString("retryId")
          require(usedRetries.add(retry))
          val old = get(retry)
          require(states[retry] !in activeStates && states[retry] != "saved") { "DOWNLOAD_BUSY" }
          require(
            old.getString("videoId") == request.getString("videoId") &&
              old.getString("mode") == request.getString("mode")
          )
        }
      }
      var active =
        (0 until data.length()).count { data.getJSONObject(it).optString("status") in activeStates }
      val ids = JSONArray()
      for (i in 0 until requests.length()) {
        val plan = requests.getJSONObject(i)
        val retry = plan.optString("retryId").takeIf { it.isNotBlank() }
        val duplicate =
          (0 until data.length())
            .map { data.getJSONObject(it) }
            .find {
              it.optString("status") in activeStates &&
                it.optString("videoId") == plan.getString("videoId") &&
                it.optString("mode") == plan.getString("mode") &&
                it.optString("requestedQuality") == plan.getString("requestedQuality") &&
                it.optString("playlistTitle") == plan.optString("playlistTitle")
            }
        if (retry == null && duplicate != null) {
          ids.put(duplicate.getString("id"))
          continue
        }
        require(active++ < 1000) { "QUEUE_FULL" }
        val id = retry ?: UUID.randomUUID().toString()
        val record =
          JSONObject()
            .put("videoId", plan.getString("videoId"))
            .put("title", plan.getString("title"))
            .put("mode", plan.getString("mode"))
            .put("requestedQuality", plan.getString("requestedQuality"))
            .put("playlistTitle", plan.optString("playlistTitle"))
            .put("playlistIndex", plan.optInt("playlistIndex", 1))
            .put("id", id)
            .put("status", "queued")
            .put("quality", plan.getString("requestedQuality"))
            .put("createdAt", System.currentTimeMillis())
            .put("fraction", 0)
            .put("loaded", 0)
            .put("total", 0)
        if (retry == null) data.put(record)
        else
          for (j in 0 until data.length()) if (data.getJSONObject(j).getString("id") == id)
            data.put(j, record)
        ids.put(id)
      }
      write(data)
      ids
    }

  fun terminal(id: String, status: String, message: String? = null) =
    edit(id) { job ->
      job.put("status", status)
      job.remove("candidates")
      job.remove("pendingUri")
      if (message != null) job.put("error", message)
    }

  fun recover() =
    synchronized(lock) {
      val migrated =
        db.rawQuery("SELECT value FROM meta WHERE key='migrated'", null).use { it.moveToFirst() }
      if (!migrated) {
        if (prefs.contains("jobs-v2")) write(JSONArray(prefs.getString("jobs-v2", "[]")))
        else migrate()
        db.execSQL("INSERT OR REPLACE INTO meta(key,value) VALUES('migrated','1')")
      }
      val data = read()
      for (i in 0 until data.length()) {
        val job = data.getJSONObject(i)
        if (!job.has("legacyId") && job.optString("status") in activeStates) {
          job
            .optString("pendingUri")
            .takeIf { it.startsWith("content://") }
            ?.let { runCatching { context.contentResolver.delete(Uri.parse(it), null, null) } }
          job.remove("pendingUri")
          job.remove("candidates")
          job.put("status", "interrupted")
          job.put("error", "PROCESS_INTERRUPTED")
        }
      }
      write(data)
      File(context.cacheDir, "${scope}transfers").deleteRecursively()
    }

  private fun migrate() {
    val old = JSONArray(prefs.getString("history", "[]"))
    val jobs = JSONArray()
    for (i in 0 until old.length()) {
      val item = old.getJSONObject(i)
      val legacy = item.getLong("id")
      jobs.put(
        JSONObject()
          .put("id", "legacy:$legacy")
          .put("legacyId", legacy)
          .put("videoId", item.optString("videoId"))
          .put("title", item.optString("title", "Video"))
          .put("mode", "video")
          .put("quality", item.optString("quality", "360p"))
          .put("requestedQuality", item.optString("quality", "360p"))
          .put("createdAt", item.optLong("createdAt"))
          .put("status", if (item.optBoolean("cancelled")) "cancelled" else "missing")
      )
    }
    write(jobs)
  }

  fun snapshot(): JSONArray {
    val result = JSONArray()
    val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    for (record in all().asReversed()) {
      val job = JSONObject(record.toString())
      job.remove("candidates")
      job.remove("pendingUri")
      if (job.has("legacyId") && job.optString("status") != "cancelled") {
        manager.query(DownloadManager.Query().setFilterById(job.getLong("legacyId"))).use { cursor
          ->
          if (cursor != null && cursor.moveToFirst()) {
            val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            job.put(
              "status",
              when (status) {
                DownloadManager.STATUS_SUCCESSFUL -> "saved"
                DownloadManager.STATUS_RUNNING -> "running"
                DownloadManager.STATUS_PENDING -> "queued"
                DownloadManager.STATUS_PAUSED -> "interrupted"
                else -> "failed"
              },
            )
            job.put(
              "loaded",
              cursor.getLong(
                cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
              ),
            )
            job.put(
              "total",
              cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)),
            )
          }
        }
      }
      job.remove("legacyId")
      job.remove("fileUri")
      result.put(job)
    }
    return result
  }

  fun clearFinished() =
    synchronized(lock) {
      val effective = snapshot()
      val finished =
        (0 until effective.length())
          .map { effective.getJSONObject(it) }
          .filter { it.optString("status") in setOf("saved", "failed", "cancelled", "missing") }
          .map { it.getString("id") }
          .toSet()
      val keep = JSONArray()
      all().filter { it.getString("id") !in finished }.forEach { keep.put(it) }
      write(keep)
    }
}
