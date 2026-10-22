package com.utubemobile

import android.media.MediaExtractor
import android.media.MediaFormat
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayInputStream
import java.io.File
import java.net.HttpURLConnection
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
        { uri ->
          val range = Regex("range=(\\d+)-(\\d+)").find(uri.rawQuery)!!
          val start = range.groupValues[1].toInt()
          val end = range.groupValues[2].toInt()
          object : HttpURLConnection(uri.toURL()) {
            override fun connect() {}

            override fun disconnect() {}

            override fun usingProxy() = false

            override fun getResponseCode() = 206

            override fun getHeaderField(name: String?): String? =
              if (name == "Content-Range") "bytes $start-$end/${bytes.size}" else null

            override fun getInputStream() =
              ByteArrayInputStream(
                if (attempt++ == 0) bytes.copyOf(100) else bytes.copyOfRange(start, end + 1)
              )
          }
        },
      )
      assertArrayEquals(bytes, output.readBytes())
      assertEquals(listOf(131072L, bytes.size.toLong()), progress)
      assertEquals(3, attempt)
    } finally {
      output.delete()
    }
  }

  @Test
  fun youtubeQueryRangesAcceptBoundedHttp200Responses() {
    val output = File(instrumentation.targetContext.cacheDir, "query-range-test")
    val bytes = ByteArray(600000) { (it % 117).toByte() }
    val offsets = mutableListOf<Int>()
    try {
      RangedTransfer.download(
        JSONObject()
          .put("url", "https://rr1.googlevideo.com/test?signature=abc")
          .put("size", bytes.size),
        output,
        { false },
        {},
        { _, _ -> },
        { uri ->
          val range = Regex("range=(\\d+)-(\\d+)").find(uri.rawQuery)!!
          val start = range.groupValues[1].toInt()
          val end = range.groupValues[2].toInt()
          offsets.add(start)
          object : HttpURLConnection(uri.toURL()) {
            override fun connect() {}

            override fun disconnect() {}

            override fun usingProxy() = false

            override fun getResponseCode() = 200

            override fun getContentLengthLong() = (end - start + 1).toLong()

            override fun getInputStream(): ByteArrayInputStream {
              assertNull(getRequestProperty("Range"))
              assertEquals("https://www.youtube.com", getRequestProperty("Origin"))
              return ByteArrayInputStream(bytes.copyOfRange(start, end + 1))
            }
          }
        },
      )
      assertArrayEquals(bytes, output.readBytes())
      assertEquals(listOf(0, 262144, 524288), offsets)
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
