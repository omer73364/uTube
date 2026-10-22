package com.utubemobile

import android.media.MediaExtractor
import android.media.MediaFormat
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayInputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class MediaEngineTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()

  private fun fixture(name: String, directory: File): File =
    File(directory, name).also { output ->
      instrumentation.context.assets.open(name).use { input ->
        output.outputStream().use { input.copyTo(it) }
      }
    }

  @Test
  fun muxes1080pWithAudioAndConvertsMp3() {
    val directory =
      File(instrumentation.targetContext.cacheDir, "media-engine-test").apply { mkdirs() }
    try {
      val video = fixture("hd.mp4", directory)
      val audio = fixture("audio.m4a", directory)
      val output = File(directory, "finished.mp4")
      MediaProcessor.process(video, audio, output, "video", "Arabic العربية", { false })
      val extractor = MediaExtractor()
      try {
        extractor.setDataSource(output.absolutePath)
        assertEquals(2, extractor.trackCount)
        val tracks = (0 until extractor.trackCount).map { extractor.getTrackFormat(it) }
        val picture = tracks.first { it.getString(MediaFormat.KEY_MIME)!!.startsWith("video/") }
        assertEquals(1920, picture.getInteger(MediaFormat.KEY_WIDTH))
        assertEquals(1080, picture.getInteger(MediaFormat.KEY_HEIGHT))
        assertTrue(tracks.any { it.getString(MediaFormat.KEY_MIME)!!.startsWith("audio/") })
      } finally {
        extractor.release()
      }
      val mp3 = File(directory, "finished.mp3")
      MediaProcessor.process(null, audio, mp3, "mp3", "Audio", { false })
      val music = MediaExtractor()
      try {
        music.setDataSource(mp3.absolutePath)
        assertEquals(1, music.trackCount)
        assertEquals("audio/mpeg", music.getTrackFormat(0).getString(MediaFormat.KEY_MIME))
      } finally {
        music.release()
      }
    } finally {
      directory.deleteRecursively()
    }
  }

  @Test
  fun incompleteRangeRetriesWithoutDuplicatingBytes() {
    val output = File(instrumentation.targetContext.cacheDir, "range-test")
    val bytes = ByteArray(200000) { (it % 127).toByte() }
    var attempt = 0
    val progress = mutableListOf<Long>()
    try {
      RangedTransfer.download(
        JSONObject().put("url", "https://rr1.googlevideo.com/test").put("size", bytes.size),
        output,
        { false },
        {},
        { done, _ -> progress.add(done) },
        {
          object : HttpURLConnection(URL("https://rr1.googlevideo.com/test")) {
            override fun connect() {}

            override fun disconnect() {}

            override fun usingProxy() = false

            override fun getResponseCode() = 206

            override fun getHeaderField(name: String?): String? =
              if (name == "Content-Range") "bytes 0-${bytes.lastIndex}/${bytes.size}" else null

            override fun getInputStream() =
              ByteArrayInputStream(if (attempt++ == 0) bytes.copyOf(100) else bytes)
          }
        },
      )
      assertArrayEquals(bytes, output.readBytes())
      assertEquals(listOf(bytes.size.toLong()), progress)
      assertEquals(2, attempt)
    } finally {
      output.delete()
    }
  }

  @Test
  fun rejectsUntrustedHostsAndCancelledTransfers() {
    for (url in
      listOf(
        "http://rr1.googlevideo.com/a",
        "https://googlevideo.com.evil.example/a",
        "https://rr1.googlevideo.com:444/a",
      )) {
      assertTrue(runCatching { TransferPolicy.mediaUrl(url) }.isFailure)
    }
    val output = File(instrumentation.targetContext.cacheDir, "cancel-test")
    try {
      val failure = runCatching {
        RangedTransfer.download(
          JSONObject().put("url", "https://rr1.googlevideo.com/a"),
          output,
          { true },
          {},
          { _, _ -> },
        )
      }
        .exceptionOrNull()
      assertTrue(failure is InterruptedException)
      assertEquals(0L, output.length())
    } finally {
      output.delete()
    }
  }
}
