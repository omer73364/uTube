package com.utubemobile

import android.app.*
import android.content.*
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.*
import android.provider.MediaStore
import java.io.File
import java.net.HttpURLConnection
import java.util.concurrent.Executors
import org.json.JSONObject

class DownloadService : Service() {
  companion object {
    @Volatile private var current: DownloadService? = null
    private val cancelled = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()

    fun start(context: Context) {
      context.startForegroundService(Intent(context, DownloadService::class.java))
    }

    fun cancel(id: String) {
      cancelled.add(id)
      PreparationService.cancel(id)
      current?.let {
        if (it.activeId == id) {
          it.connection?.disconnect()
          if (it.processing) MediaProcessor.cancel()
        }
      }
    }
  }

  private val executor = Executors.newSingleThreadExecutor()
  private val main = Handler(Looper.getMainLooper())
  private lateinit var store: JobStore
  @Volatile private var stopping = false
  @Volatile private var activeId: String? = null
  @Volatile private var connection: HttpURLConnection? = null
  @Volatile private var processing = false
  private var busy = false
  private var startId = 0
  private var wake: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?) = null

  override fun onCreate() {
    super.onCreate()
    current = this
    store = JobStore(this)
    (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(
      NotificationChannel("downloads", "uTube downloads", NotificationManager.IMPORTANCE_LOW)
    )
    wake =
      (getSystemService(POWER_SERVICE) as PowerManager)
        .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "uTube:downloads")
        .apply {
          setReferenceCounted(false)
          acquire(6 * 60 * 60 * 1000L)
        }
  }

  private fun notification(title: String, stage: String, processing: Boolean = false) {
    val arabic =
      getSharedPreferences("utube-mobile", MODE_PRIVATE).getString("language", "en") == "ar"
    val translated =
      if (arabic)
        mapOf(
          "Preparing downloads" to "جارٍ تجهيز التنزيلات",
          "Preparing download" to "جارٍ تجهيز التنزيل",
          "Downloading" to "جارٍ التنزيل",
          "Converting audio" to "جارٍ تحويل الصوت",
          "Finishing video" to "جارٍ تجهيز الفيديو",
        )[stage] ?: stage
      else stage
    val pending =
      PendingIntent.getActivity(
        this,
        0,
        Intent(this, MainActivity::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
    val builder =
      Notification.Builder(this, "downloads")
        .setSmallIcon(R.drawable.ic_utube)
        .setContentTitle(title.take(120))
        .setContentText(translated)
        .setContentIntent(pending)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
    activeId?.let { id ->
      val cancel =
        PendingIntent.getService(
          this,
          1,
          Intent(this, DownloadService::class.java).setAction("cancel").putExtra("id", id),
          PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
      builder.addAction(
        Notification.Action.Builder(null, if (arabic) "إلغاء" else "Cancel", cancel).build()
      )
    }
    val value = builder.build()
    val type =
      if (processing && Build.VERSION.SDK_INT >= 35)
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING
      else ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
    startForeground(41, value, type)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, id: Int): Int {
    startId = id
    if (intent?.action == "cancel") {
      intent
        .getStringExtra("id")
        ?.takeIf { it == activeId }
        ?.let { job ->
          cancel(job)
          runCatching { store.terminal(job, "cancelled", "CANCELLED") }
        }
      return START_NOT_STICKY
    }
    notification("uTube", "Preparing downloads")
    drain()
    return START_NOT_STICKY
  }

  private fun drain() {
    if (busy || stopping) return
    busy = true
    executor.execute {
      try {
        while (!stopping) {
          val job = store.next() ?: break
          execute(job)
        }
      } finally {
        main.post {
          busy = false
          if (!stopping && store.next() != null) drain()
          else {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelfResult(startId)
          }
        }
      }
    }
  }

  private fun execute(job: JSONObject) {
    val id = job.getString("id")
    activeId = id
    val temp = File(cacheDir, "transfers/$id")
    temp.mkdirs()
    var pendingUri: Uri? = null
    fun isCancelled() = stopping || cancelled.contains(id)
    try {
      if (isCancelled()) throw InterruptedException("CANCELLED")
      store.edit(id) { it.put("status", "preparing") }
      notification(job.getString("title"), "Preparing download")
      val plan = PreparationService.prepare(this, job)
      check(
        plan.getString("videoId") == job.getString("videoId") &&
          plan.getString("mode") == job.getString("mode") &&
          plan.getString("requestedQuality") == job.getString("requestedQuality")
      ) {
        "INVALID_PLAN"
      }
      if (isCancelled()) throw InterruptedException("CANCELLED")
      val candidates = plan.getJSONArray("candidates")
      var output: File? = null
      var quality = ""
      var lastError: Exception? = null
      var highWater = 0.0
      var lastUpdate = 0L
      store.edit(id) { it.put("status", "running") }
      notification(job.getString("title"), "Downloading")
      for (index in 0 until candidates.length()) {
        if (isCancelled()) throw InterruptedException("CANCELLED")
        val candidate = candidates.getJSONObject(index)
        try {
          temp.listFiles()?.forEach { it.delete() }
          val video = if (candidate.has("video")) File(temp, "video.media") else null
          val audio = if (candidate.has("audio")) File(temp, "audio.media") else null
          val total =
            listOf("video", "audio").sumOf { candidate.optJSONObject(it)?.optLong("size", 0) ?: 0L }
          var completed = 0L
          for ((kind, target) in listOf("video" to video, "audio" to audio)) if (target != null) {
            RangedTransfer.download(
              candidate.getJSONObject(kind),
              target,
              ::isCancelled,
              { connection = it },
              { loaded, size ->
                val denominator = if (total > 0) total else size
                val fraction =
                  if (denominator > 0)
                    minOf(0.90, (completed + loaded).toDouble() / denominator * 0.9)
                  else highWater
                highWater = maxOf(highWater, fraction)
                if (SystemClock.elapsedRealtime() - lastUpdate > 500) {
                  lastUpdate = SystemClock.elapsedRealtime()
                  store.edit(id) {
                    it
                      .put("fraction", highWater)
                      .put("loaded", completed + loaded)
                      .put("total", total)
                  }
                }
              },
            )
            completed += target.length()
          }
          if (isCancelled()) throw InterruptedException("CANCELLED")
          val mode = job.getString("mode")
          val stage = if (mode == "mp3") "converting" else "merging"
          store.edit(id) { it.put("status", stage).put("fraction", maxOf(highWater, 0.94)) }
          notification(
            job.getString("title"),
            if (mode == "mp3") "Converting audio" else "Finishing video",
            true,
          )
          val result = File(temp, if (mode == "mp3") "result.mp3" else "result.mp4")
          processing = true
          try {
            MediaProcessor.process(
              video,
              audio,
              result,
              mode,
              job.getString("title"),
              ::isCancelled,
            )
          } finally {
            processing = false
          }
          output = result
          quality = candidate.getString("quality")
          break
        } catch (e: Exception) {
          if (isCancelled() || e is InterruptedException) throw InterruptedException("CANCELLED")
          lastError = e
          // Keep one job and its progress; candidate/client retries remain silent.
        }
      }
      val result = output ?: throw (lastError ?: IllegalStateException("NO_FORMATS"))
      if (isCancelled()) throw InterruptedException("CANCELLED")
      store.edit(id) { it.put("status", "publishing").put("fraction", 0.98) }
      val mode = job.getString("mode")
      val extension = if (mode == "mp3") "mp3" else "mp4"
      val group =
        job
          .optString("playlistTitle")
          .takeIf { it.isNotBlank() }
          ?.let { TransferPolicy.safeName(it) }
      val prefix = if (group != null) "#${job.optInt("playlistIndex",1)}_" else ""
      val name =
        "$prefix${TransferPolicy.safeName(job.getString("title"))} [${job.getString("videoId")}]-${id.takeLast(8)}.$extension"
      val values =
        ContentValues().apply {
          put(MediaStore.MediaColumns.DISPLAY_NAME, name)
          put(MediaStore.MediaColumns.MIME_TYPE, if (mode == "mp3") "audio/mpeg" else "video/mp4")
          put(
            MediaStore.MediaColumns.RELATIVE_PATH,
            "Download/uTube/" + (group?.let { "$it/" } ?: ""),
          )
          put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
      pendingUri =
        contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
          ?: error("FILE_CREATE_FAILED")
      store.edit(id) { it.put("pendingUri", pendingUri.toString()) }
      contentResolver.openOutputStream(pendingUri!!, "w")?.use { out ->
        result.inputStream().use { input ->
          val bytes = ByteArray(65536)
          while (true) {
            if (isCancelled()) throw InterruptedException("CANCELLED")
            val n = input.read(bytes)
            if (n < 0) break
            out.write(bytes, 0, n)
          }
        }
      } ?: error("FILE_WRITE_FAILED")
      if (isCancelled()) throw InterruptedException("CANCELLED")
      check(
        contentResolver.update(
          pendingUri!!,
          ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) },
          null,
          null,
        ) > 0
      )
      store.edit(id) {
        if (isCancelled() || it.optString("status") == "cancelled")
          throw InterruptedException("CANCELLED")
        it
          .put("status", "saved")
          .put("quality", quality)
          .put("fraction", 1)
          .put("fileUri", pendingUri.toString())
          .put(
            "downgraded",
            mode == "video" &&
              job.getString("requestedQuality") != "best" &&
              (quality.takeWhile { c -> c.isDigit() }.toIntOrNull() ?: 0) <
                (job.getString("requestedQuality").takeWhile { c -> c.isDigit() }.toIntOrNull()
                  ?: 0),
          )
        it.remove("pendingUri")
        it.remove("candidates")
      }
      pendingUri = null
    } catch (e: Exception) {
      pendingUri?.let { runCatching { contentResolver.delete(it, null, null) } }
      val status =
        if (stopping) "interrupted" else if (cancelled.contains(id)) "cancelled" else "failed"
      runCatching {
        store.terminal(id, status, if (status == "failed") safeError(e) else status.uppercase())
      }
    } finally {
      temp.deleteRecursively()
      connection = null
      activeId = null
      cancelled.remove(id)
    }
  }

  private fun safeError(error: Exception): String {
    val message = error.cause?.message ?: error.message ?: "DOWNLOAD_FAILED"
    return listOf(
        "HTTP_403",
        "HTTP_404",
        "HTTP_410",
        "REQUEST_TIMEOUT",
        "MEDIA_PROCESSING_FAILED",
        "NO_FORMATS",
        "CANCELLED",
        "ENOSPC",
      )
      .firstOrNull { message.contains(it) } ?: "DOWNLOAD_FAILED"
  }

  override fun onTimeout(id: Int, fgsType: Int) {
    stopping = true
    activeId?.let { cancel(it) }
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    stopping = true
    activeId?.let { cancel(it) }
    executor.shutdownNow()
    if (wake?.isHeld == true) wake?.release()
    if (current === this) current = null
    super.onDestroy()
  }
}
