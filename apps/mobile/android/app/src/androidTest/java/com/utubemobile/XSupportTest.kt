package com.utubemobile

import android.content.Intent
import android.net.Uri
import android.media.MediaExtractor
import android.media.MediaFormat
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayInputStream
import java.io.File
import java.net.HttpURLConnection
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class XSupportTest {
  private val post = "1577855540407197696"
  private val video = "x-$post-1"
  private val media = "https://video.twimg.com/ext_tw_video/1/pu/vid/1280x720/test.mp4?tag=12"
  private val thumbnail = "https://pbs.twimg.com/media/test.jpg"
  private val context = InstrumentationRegistry.getInstrumentation().targetContext
  private fun request() = JSONObject().put("videoId", video).put("title", "X video")
    .put("mode", "video").put("requestedQuality", "720p").put("thumbnail", thumbnail)

  @Test fun acceptsPublicPostShareIntentsAndRejectsSpoofedHosts() {
    for (host in listOf("x.com", "twitter.com", "www.x.com", "mobile.twitter.com")) {
      val url = "https://$host/studio/status/$post/video/2?s=20"
      assertEquals(url, SharedLinks.parse(Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_TEXT, "Watch this: $url")))
      assertEquals(url, SharedLinks.parse(Intent(Intent.ACTION_VIEW, Uri.parse(url))))
    }
    for (url in listOf("https://x.com.evil.test/a/status/$post", "https://x.com@evil.test/a/status/$post",
      "https://x.com:8443/a/status/$post", "https://x.com/a", "https://x.com/a/status/$post/video/5")) {
      assertNull(SharedLinks.parse(Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_TEXT, url)))
    }
  }

  @Test fun nativePoliciesRestrictXMetadataMediaAndThumbnails() {
    assertEquals("video.twimg.com", TransferPolicy.mediaUrl(media).host)
    assertEquals("cdn.syndication.twimg.com", TransferPolicy.metadataUrl("https://cdn.syndication.twimg.com/tweet-result?id=$post").host)
    assertTrue(TransferPolicy.validThumbnail(thumbnail))
    for (url in listOf("https://video.twimg.com.evil.test/test.mp4", "http://video.twimg.com/test.mp4",
      "https://video.twimg.com/test.m3u8", "https://user@video.twimg.com/test.mp4", "https://video.twimg.com:444/test.mp4")) {
      assertTrue(runCatching { TransferPolicy.mediaUrl(url) }.isFailure)
    }
    for (url in listOf("https://cdn.syndication.twimg.com/other", "https://cdn.syndication.twimg.com.evil.test/tweet-result",
      "http://cdn.syndication.twimg.com/tweet-result", "https://x.com/tweet-result")) {
      assertTrue(runCatching { TransferPolicy.metadataUrl(url) }.isFailure)
    }
    assertFalse(TransferPolicy.validThumbnail("https://pbs.twimg.com.evil.test/test.jpg"))
    val candidate = JSONObject().put("quality", "720p").put("video", JSONObject().put("url", media).put("size", 0))
    TransferPolicy.validate(request().put("candidates", JSONArray().put(candidate)))
    assertTrue(runCatching { TransferPolicy.validate(request().put("videoId", "jNQXAC9IVRw").put("candidates", JSONArray().put(candidate))) }.isFailure)
  }

  @Test fun xDownloadsKeepHttpRangesAfterDiscoveringSize() {
    val output = File(context.cacheDir, "x-range-${UUID.randomUUID()}")
    val bytes = ByteArray(600000) { (it % 127).toByte() }
    val starts = mutableListOf<Int>()
    var attempts = 0
    try {
      RangedTransfer.download(JSONObject().put("url", media).put("size", 0), output, { false }, {}, { _, _ -> }, { uri ->
        assertFalse(uri.rawQuery.contains("range="))
        object : HttpURLConnection(uri.toURL()) {
          override fun connect() {}
          override fun disconnect() {}
          override fun usingProxy() = false
          override fun getResponseCode() = 206
          override fun getContentType() = "video/mp4"
          private fun range(): Pair<Int, Int> {
            val match = Regex("bytes=(\\d+)-(\\d+)").matchEntire(getRequestProperty("Range"))!!
            return match.groupValues[1].toInt() to minOf(match.groupValues[2].toInt(), bytes.size - 1)
          }
          override fun getHeaderField(name: String?): String? {
            val (start, end) = range()
            return if (name == "Content-Range") "bytes $start-$end/${bytes.size}" else null
          }
          override fun getInputStream(): ByteArrayInputStream {
            assertEquals("https://x.com", getRequestProperty("Origin"))
            val (start, end) = range()
            starts.add(start)
            return ByteArrayInputStream(if (attempts++ == 0) bytes.copyOf(50) else bytes.copyOfRange(start, end + 1))
          }
        }
      })
      assertArrayEquals(bytes, output.readBytes())
      assertEquals(listOf(0, 0, 131072, 262144, 393216, 524288), starts)
    } finally { output.delete() }
  }

  @Test fun xHistoryPersistsThumbnailsAndRetriesWithoutDuplicatingEntries() {
    val scope = "x-test-${UUID.randomUUID()}-"
    val store = JobStore(context, scope)
    store.recover()
    val id = store.enqueueBatch(JSONArray().put(request())).getString(0)
    assertEquals(video, JobStore(context, scope).get(id).getString("videoId"))
    assertEquals(thumbnail, store.get(id).getString("thumbnail"))
    store.edit(id) { it.put("status", "running") }
    store.recover()
    assertEquals("interrupted", store.get(id).getString("status"))
    assertEquals(id, store.enqueueBatch(JSONArray().put(request().put("retryId", id))).getString(0))
    assertEquals(1, store.all().size)
    assertEquals(thumbnail, store.get(id).getString("thumbnail"))
  }

  @Test fun combinedXVideoCopiesBothTracksAndExtractsMp3() {
    val directory = File(context.cacheDir, "x-media-${UUID.randomUUID()}").apply { mkdirs() }
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    fun fixture(name: String) = File(directory, name).also { output ->
      instrumentation.context.assets.open(name).use { input -> output.outputStream().use { input.copyTo(it) } }
    }
    fun tracks(file: File): List<MediaFormat> {
      val extractor = MediaExtractor()
      try {
        extractor.setDataSource(file.absolutePath)
        return (0 until extractor.trackCount).map { extractor.getTrackFormat(it) }
      } finally { extractor.release() }
    }
    try {
      val source = File(directory, "source.mp4")
      MediaProcessor.process(fixture("hd.mp4"), fixture("audio.m4a"), source, "video", "X source", { false })
      val copied = File(directory, "copied.mp4")
      MediaProcessor.process(source, null, copied, "video", "X video", { false })
      val videoTracks = tracks(copied)
      assertEquals(2, videoTracks.size)
      assertEquals(1080, videoTracks.first { it.getString(MediaFormat.KEY_MIME)!!.startsWith("video/") }.getInteger(MediaFormat.KEY_HEIGHT))
      val mp3 = File(directory, "audio.mp3")
      MediaProcessor.process(null, source, mp3, "mp3", "X audio", { false })
      assertEquals("audio/mpeg", tracks(mp3).single().getString(MediaFormat.KEY_MIME))
    } finally { directory.deleteRecursively() }
  }

}
