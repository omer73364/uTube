package com.utubemobile

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import com.facebook.react.bridge.*
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class DownloadModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
  private val prefs = context.getSharedPreferences("utube-mobile", Context.MODE_PRIVATE)
  private val probes = Executors.newSingleThreadExecutor()
  private fun mediaUri(url: String): Uri {
    val uri = Uri.parse(url)
    require(uri.scheme == "https" && uri.host?.lowercase()?.endsWith(".googlevideo.com") == true && uri.userInfo == null) { "Invalid media URL." }
    return uri
  }
  @ReactMethod fun probe(url: String, promise: Promise) {
    try { mediaUri(url) } catch (error: Exception) { promise.reject("MEDIA_URL", error.message); return }
    probes.execute {
      var connection: HttpURLConnection? = null
      try {
        connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 10000
        connection.readTimeout = 10000
        connection.instanceFollowRedirects = false
        connection.setRequestProperty("Range", "bytes=0-0")
        // Read headers only. React Native fetch would buffer the whole video.
        promise.resolve(connection.responseCode in 200..299)
      } catch (error: Exception) { promise.resolve(false) }
      finally { connection?.disconnect() }
    }
  }
  override fun invalidate() { probes.shutdownNow(); super.invalidate() }
  override fun getName() = "UTubeDownloads"
  private fun records(): JSONArray = JSONArray(prefs.getString("history", "[]") ?: "[]")
  private fun write(records: JSONArray) {
    check(prefs.edit().putString("history", records.toString()).commit()) { "Could not save download history." }
  }
  private fun owned(id: Long): JSONObject {
    val all = records()
    for (index in 0 until all.length()) if (all.getJSONObject(index).getLong("id") == id) return all.getJSONObject(index)
    throw IllegalArgumentException("Unknown download.")
  }
  @ReactMethod fun sha1(input: String, promise: Promise) {
    val digest = MessageDigest.getInstance("SHA-1").digest(input.toByteArray(Charsets.UTF_8))
    promise.resolve(digest.joinToString("") { "%02x".format(it.toInt() and 255) })
  }
  @ReactMethod @Synchronized fun start(url: String, videoId: String, title: String, quality: String, promise: Promise) {
    try {
      val uri = mediaUri(url)
      require(Regex("^[A-Za-z0-9_-]{11}$").matches(videoId)) { "Invalid video ID." }
      var safeTitle = title.replace(Regex("[<>:\"/\\\\|?*\\p{Cntrl}]"), "_").trim().trimEnd('.').take(80).ifBlank { "Video" }
      if (safeTitle.isNotEmpty() && Character.isHighSurrogate(safeTitle.last())) safeTitle = safeTitle.dropLast(1)
      while (safeTitle.toByteArray(Charsets.UTF_8).size > 150) {
        safeTitle = safeTitle.dropLast(if (Character.isLowSurrogate(safeTitle.last())) 2 else 1)
      }
      val name = "$safeTitle [$videoId]-${System.currentTimeMillis()}.mp4"
      val request = DownloadManager.Request(uri)
        .setTitle(title.take(180))
        .setDescription("uTube · $quality · MP4")
        .setMimeType("video/mp4")
        .setAllowedOverMetered(true)
        .setAllowedOverRoaming(false)
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "uTube/$name")
      val id = manager.enqueue(request)
      try {
        val all = records()
        all.put(JSONObject().put("id", id).put("videoId", videoId).put("title", title.take(180)).put("quality", quality).put("createdAt", System.currentTimeMillis()))
        write(all)
      } catch (error: Exception) { manager.remove(id); throw error }
      promise.resolve(id.toDouble())
    } catch (error: Exception) { promise.reject("DOWNLOAD_START", error.message, error) }
  }
  @ReactMethod @Synchronized fun list(promise: Promise) {
    try {
      val result = Arguments.createArray()
      val all = records()
      for (index in all.length() - 1 downTo 0) {
        val record = all.getJSONObject(index)
        val item = Arguments.createMap()
        item.putDouble("id", record.getLong("id").toDouble())
        item.putString("title", record.getString("title"))
        item.putString("quality", record.getString("quality"))
        item.putDouble("createdAt", record.getLong("createdAt").toDouble())
        manager.query(DownloadManager.Query().setFilterById(record.getLong("id"))).use { cursor ->
          if (cursor != null && cursor.moveToFirst()) {
            val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            item.putString("status", when (status) {
              DownloadManager.STATUS_PENDING -> "queued"
              DownloadManager.STATUS_RUNNING -> "running"
              DownloadManager.STATUS_PAUSED -> "paused"
              DownloadManager.STATUS_SUCCESSFUL -> "saved"
              else -> "failed"
            })
            item.putDouble("loaded", cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)).toDouble())
            item.putDouble("total", cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)).toDouble())
            if (status == DownloadManager.STATUS_FAILED) item.putInt("reason", cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)))
          } else { item.putString("status", if (record.optBoolean("cancelled")) "cancelled" else "missing") }
        }
        result.pushMap(item)
      }
      promise.resolve(result)
    } catch (error: Exception) { promise.reject("DOWNLOAD_HISTORY", error.message, error) }
  }
  @ReactMethod @Synchronized fun cancel(id: Double, promise: Promise) {
    try {
      require(id.isFinite() && id == id.toLong().toDouble()) { "Invalid download ID." }
      owned(id.toLong())
      manager.query(DownloadManager.Query().setFilterById(id.toLong())).use { cursor ->
        require(cursor != null && cursor.moveToFirst()) { "Download no longer exists." }
        val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
        require(status != DownloadManager.STATUS_SUCCESSFUL) { "Completed downloads cannot be cancelled." }
      }
      val all = records()
      for (index in 0 until all.length()) if (all.getJSONObject(index).getLong("id") == id.toLong()) all.getJSONObject(index).put("cancelled", true)
      write(all)
      manager.remove(id.toLong())
      promise.resolve(null)
    } catch (error: Exception) { promise.reject("DOWNLOAD_CANCEL", error.message, error) }
  }
  @ReactMethod fun open(id: Double, promise: Promise) {
    try {
      require(id.isFinite() && id == id.toLong().toDouble()) { "Invalid download ID." }
      owned(id.toLong())
      val uri = manager.getUriForDownloadedFile(id.toLong()) ?: throw IllegalStateException("The file is not available.")
      context.contentResolver.openFileDescriptor(uri, "r")?.use { }
        ?: throw IllegalStateException("The file is not available.")
      val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, "video/mp4")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) { promise.reject("DOWNLOAD_OPEN", error.message, error) }
  }
  @ReactMethod fun settings(promise: Promise) {
    promise.resolve(Arguments.createMap().apply {
      putString("language", prefs.getString("language", "en"))
      putString("theme", prefs.getString("theme", "system"))
    })
  }
  @ReactMethod fun saveSettings(language: String, theme: String, promise: Promise) {
    try {
      require(language in listOf("en", "ar") && theme in listOf("light", "dark", "system")) { "Invalid preference." }
      check(prefs.edit().putString("language", language).putString("theme", theme).commit())
      promise.resolve(null)
    } catch (error: Exception) { promise.reject("SETTINGS_SAVE", error.message, error) }
  }
}
