package com.utubemobile

import android.app.DownloadManager
import android.content.*
import android.net.Uri
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.security.MessageDigest
import org.json.JSONArray
import org.json.JSONObject

class DownloadModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {
  private val metadata = MetadataHttp()
  private val player = PlayerRuntime(context.applicationContext)
  private val store = JobStore(context)
  private val prefs = context.getSharedPreferences("utube-mobile", Context.MODE_PRIVATE)
  private val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

  override fun getName() = "UTubeDownloads"

  override fun invalidate() {
    metadata.close()
    player.close()
    super.invalidate()
  }

  private fun updateResult(promise: Promise): (String?, Exception?) -> Unit = { value, error ->
    if (error == null) promise.resolve(value) else promise.reject("UPDATE_FAILED", error.message, error)
  }
  @ReactMethod fun updates(promise: Promise) { promise.resolve(UpdateCenter.get(context).snapshot()) }
  @ReactMethod fun checkUpdates(promise: Promise) = UpdateCenter.get(context).check(updateResult(promise))
  @ReactMethod fun downloadUpdate(promise: Promise) = UpdateCenter.get(context).download(updateResult(promise))
  @ReactMethod fun cancelUpdate(promise: Promise) { UpdateCenter.get(context).cancel(); promise.resolve(null) }
  @ReactMethod fun installUpdate(interrupt: Boolean, promise: Promise) = UpdateCenter.get(context).install(interrupt, updateResult(promise))
  @ReactMethod fun assertService(id: String, promise: Promise) {
    try { UpdateCenter.get(context).assertAvailable(id); promise.resolve(null) }
    catch (e: Exception) { promise.reject("SERVICE_UNAVAILABLE", e.message, e) }
  }

  @ReactMethod
  fun http(
    id: String,
    url: String,
    method: String,
    headers: ReadableMap,
    body: String?,
    promise: Promise,
  ) = metadata.request(id, url, method, headers, body, promise)

  @ReactMethod fun cancelHttp(id: String) = metadata.cancel(id)

  @ReactMethod fun evaluate(script: String, promise: Promise) = player.evaluate(script, promise)

  @ReactMethod
  fun sha1(input: String, promise: Promise) {
    try {
      promise.resolve(
        MessageDigest.getInstance("SHA-1").digest(input.toByteArray(Charsets.UTF_8)).joinToString(
          ""
        ) {
          "%02x".format(it.toInt() and 255)
        }
      )
    } catch (e: Exception) {
      promise.reject("HASH_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun enqueue(json: String, promise: Promise) {
    try {
      require(json.length <= 2 * 1024 * 1024)
      val requests = JSONArray(json)
      for (i in 0 until requests.length()) {
        UpdateCenter.get(context).assertAvailable(requests.getJSONObject(i).getString("videoId"))
        val retry = requests.getJSONObject(i).optString("retryId")
        check(retry.isBlank() || !DownloadService.isActive(retry)) { "DOWNLOAD_BUSY" }
      }
      val old = store.all().associateBy { it.getString("id") }
      val ids = store.enqueueBatch(requests)
      for (i in 0 until requests.length()) requests
        .getJSONObject(i)
        .optString("retryId")
        .takeIf { it.isNotBlank() }
        ?.let {
          old[it]
            ?.optLong("legacyId", -1)
            ?.takeIf { legacy -> legacy >= 0 }
            ?.let { legacy -> manager.remove(legacy) }
        }
      try {
        DownloadService.start(context)
      } catch (e: Exception) {
        for (i in 0 until ids.length()) {
          val id = ids.getString(i)
          if (store.get(id).optString("status") == "queued")
            store.terminal(id, "interrupted", "START_INTERRUPTED")
        }
        throw e
      }
      promise.resolve(ids.toString())
    } catch (e: Exception) {
      promise.reject("QUEUE_START", e.message, e)
    }
  }

  @ReactMethod
  fun prepared(id: String, plan: String?, error: String?, promise: Promise) {
    try {
      PreparationService.complete(id, plan?.let { JSONObject(it) }, error?.take(180))
      promise.resolve(null)
    } catch (e: Exception) {
      PreparationService.complete(id, null, "INVALID_PLAN")
      promise.reject("PLAN_INVALID", e.message, e)
    }
  }

  @ReactMethod
  fun list(promise: Promise) {
    try {
      promise.resolve(store.snapshot().toString())
    } catch (e: Exception) {
      promise.reject("HISTORY_READ", e.message, e)
    }
  }

  @ReactMethod
  fun resume(promise: Promise) {
    try {
      DownloadService.start(context)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("QUEUE_START", e.message, e)
    }
  }

  private fun cancelJob(id: String) {
    val job = store.get(id)
    if (job.has("legacyId")) {
      manager.query(DownloadManager.Query().setFilterById(job.getLong("legacyId"))).use { cursor ->
        if (cursor != null && cursor.moveToFirst())
          require(
            cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) !=
              DownloadManager.STATUS_SUCCESSFUL
          ) {
            "Completed files cannot be cancelled."
          }
      }
      manager.remove(job.getLong("legacyId"))
    } else
      require(
        job.getString("status") in JobStore.activeStates || job.getString("status") == "interrupted"
      ) {
        "Download is not active."
      }
    store.terminal(id, "cancelled")
    DownloadService.cancel(id)
    if (context.hasActiveReactInstance())
      context
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("utubeCancelPreparation", id)
  }

  @ReactMethod
  fun cancel(id: String, promise: Promise) {
    try {
      cancelJob(id)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("DOWNLOAD_CANCEL", e.message, e)
    }
  }

  @ReactMethod
  fun cancelAll(promise: Promise) {
    try {
      val jobs = store.snapshot()
      for (i in 0 until jobs.length()) {
        val job = jobs.getJSONObject(i)
        if (
          job.getString("status") in JobStore.activeStates ||
            job.getString("status") == "interrupted"
        )
          runCatching { cancelJob(job.getString("id")) }
      }
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("DOWNLOAD_CANCEL", e.message, e)
    }
  }

  private fun file(id: String): Pair<Uri, String> {
    val job = store.get(id)
    val uri =
      if (job.has("legacyId")) manager.getUriForDownloadedFile(job.getLong("legacyId"))
      else job.optString("fileUri").takeIf { it.startsWith("content://") }?.let { Uri.parse(it) }
    try {
      check(uri != null)
      context.contentResolver.openFileDescriptor(uri, "r")?.use {} ?: error("MISSING_FILE")
    } catch (e: Exception) {
      store.terminal(id, "missing", "MISSING_FILE")
      throw IllegalStateException("MISSING_FILE")
    }
    return Pair(uri!!, if (job.optString("mode") == "mp3") "audio/mpeg" else "video/mp4")
  }

  @ReactMethod
  fun open(id: String, promise: Promise) {
    try {
      val (uri, mime) = file(id)
      context.startActivity(
        Intent(Intent.ACTION_VIEW)
          .setDataAndType(uri, mime)
          .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("FILE_OPEN", e.message, e)
    }
  }

  @ReactMethod
  fun share(id: String, promise: Promise) {
    try {
      val (uri, mime) = file(id)
      val send =
        Intent(Intent.ACTION_SEND)
          .setType(mime)
          .putExtra(Intent.EXTRA_STREAM, uri)
          .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      send.clipData = ClipData.newUri(context.contentResolver, "uTube", uri)
      context.startActivity(
        Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("FILE_SHARE", e.message, e)
    }
  }

  @ReactMethod
  fun clearFinished(promise: Promise) {
    try {
      store.clearFinished()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("HISTORY_CLEAR", e.message, e)
    }
  }

  @ReactMethod
  fun remove(id: String, promise: Promise) {
    try {
      check(!DownloadService.isActive(id)) { "DOWNLOAD_BUSY" }
      val visible = store.snapshot()
      val job =
        (0 until visible.length())
          .map { visible.getJSONObject(it) }
          .first { it.getString("id") == id }
      require(job.getString("status") !in JobStore.activeStates) { "DOWNLOAD_BUSY" }
      store.remove(id)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("HISTORY_REMOVE", e.message, e)
    }
  }

  @ReactMethod
  fun settings(promise: Promise) {
    promise.resolve(
      Arguments.createMap().apply {
        putString("language", prefs.getString("language", "en"))
        putString("theme", prefs.getString("theme", "system"))
      }
    )
  }

  @ReactMethod
  fun saveSettings(language: String, theme: String, promise: Promise) {
    try {
      require(language in listOf("en", "ar") && theme in listOf("light", "dark", "system"))
      check(prefs.edit().putString("language", language).putString("theme", theme).commit())
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("SETTINGS_SAVE", e.message, e)
    }
  }

  @ReactMethod
  fun closeShare() {
    context.runOnUiQueueThread {
      (context.currentActivity as? ShareActivity)?.finish()
    }
  }

  @ReactMethod
  fun consumeSharedLink(promise: Promise) {
    val value = prefs.getString("shared-link", null)
    prefs.edit().remove("shared-link").apply()
    promise.resolve(value)
  }

  @ReactMethod
  fun licenses(promise: Promise) {
    try {
      val names =
        listOf(
          "utube_license",
          "gpl_v3",
          "license",
          "license_lame",
          "license_cpu_features",
          "license_libiconv",
          "license_libilbc",
          "license_libogg",
          "license_libsndfile",
          "license_libvorbis",
          "license_opencore_amr",
          "license_opus",
          "license_shine",
          "license_soxr",
          "license_speex",
          "license_twolame",
          "license_vo_amrwbenc",
        )
      val text =
        names
          .mapNotNull { name ->
            val id = context.resources.getIdentifier(name, "raw", context.packageName)
            if (id == 0) null
            else
              name +
                "\n\n" +
                context.resources.openRawResource(id).bufferedReader().use { it.readText() }
          }
          .joinToString("\n\n────────────────\n\n")
      promise.resolve(
        "uTube · MIT\nFFmpegKit Audio 8.1.9 · LGPL-3.0\nSource: https://github.com/ffmpegkit-maintained/ffmpeg/tree/469e560b89a9ba4cab357d2c306c676b0c611745\n\n" +
          text
      )
    } catch (e: Exception) {
      promise.reject("LICENSES_READ", e.message, e)
    }
  }
}
