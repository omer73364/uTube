package com.utubemobile

import android.content.Intent
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test

/** Opt-in network test; never runs against YouTube during the offline suite. */
class LiveDownloadTest {
  @Test
  fun downloadsThroughTheRealBackgroundQueue() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val arguments = InstrumentationRegistry.getArguments()
    val video = arguments.getString("liveVideo")
    assumeTrue("Supply -e liveVideo to run the network test", video != null)
    val context = instrumentation.targetContext
    val mode = arguments.getString("mode") ?: "video"
    val quality = if (mode == "mp3") "MP3" else arguments.getString("quality") ?: "best"
    instrumentation.startActivitySync(
      Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    )
    val store = JobStore(context)
    val request =
      JSONObject()
        .put("videoId", video)
        .put("title", "uTube integration test")
        .put("mode", mode)
        .put("requestedQuality", quality)
    arguments.getString("playlist")?.let {
      request.put("playlistTitle", it).put("playlistIndex", 1)
    }
    val id = store.enqueueBatch(JSONArray().put(request)).getString(0)
    DownloadService.start(context)
    instrumentation.uiAutomation.executeShellCommand("input keyevent 3").close()
    try {
      val deadline = System.currentTimeMillis() + 240000
      var job = store.get(id)
      while (
        job.getString("status") in JobStore.activeStates && System.currentTimeMillis() < deadline
      ) {
        Thread.sleep(500)
        job = store.get(id)
      }
      assertEquals("Download result: ${job.optString("error")}", "saved", job.getString("status"))
      arguments.getString("playlist")?.let { name ->
        context.contentResolver
          .query(
            Uri.parse(job.getString("fileUri")),
            arrayOf(MediaStore.MediaColumns.RELATIVE_PATH, MediaStore.MediaColumns.DISPLAY_NAME),
            null,
            null,
            null,
          )!!
          .use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals("Download/uTube/${TransferPolicy.safeName(name)}/", cursor.getString(0))
            assertTrue(cursor.getString(1).startsWith("#1_"))
          }
      }
      val extractor = MediaExtractor()
      try {
        extractor.setDataSource(context, Uri.parse(job.getString("fileUri")), null)
        val formats = (0 until extractor.trackCount).map { extractor.getTrackFormat(it) }
        assertTrue(formats.any { it.getString(MediaFormat.KEY_MIME)!!.startsWith("audio/") })
        val videoTrack = formats.firstOrNull {
          it.getString(MediaFormat.KEY_MIME)!!.startsWith("video/")
        }
        if (mode == "mp3") {
          assertNull(videoTrack)
          assertEquals("audio/mpeg", formats[0].getString(MediaFormat.KEY_MIME))
        } else {
          assertNotNull(videoTrack)
          val minimum = arguments.getString("minimumHeight")?.toInt() ?: 0
          assertTrue(
            "Saved height ${videoTrack!!.getInteger(MediaFormat.KEY_HEIGHT)} is below $minimum",
            videoTrack.getInteger(MediaFormat.KEY_HEIGHT) >= minimum,
          )
        }
        instrumentation.sendStatus(
          0,
          Bundle().apply {
            putString("savedQuality", job.getString("quality"))
            putString("mode", mode)
            putString("jobId", id)
          },
        )
      } finally {
        extractor.release()
      }
    } finally {
      if (store.get(id).getString("status") in JobStore.activeStates) {
        store.terminal(id, "cancelled")
        DownloadService.cancel(id)
      }
    }
  }
}
