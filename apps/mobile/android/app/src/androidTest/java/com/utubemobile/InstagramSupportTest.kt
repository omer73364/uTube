package com.utubemobile

import android.content.Intent
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class InstagramSupportTest {
  private val id = "ig-DemPo6-NFZK-1"
  private val media = "https://instagram.example.fna.fbcdn.net/video.mp4?token=temporary"
  @Test fun acceptsReelsAndPostsFromShareAndViewIntents() {
    for (host in listOf("instagram.com", "www.instagram.com", "m.instagram.com")) {
      val url = "https://$host/reel/DemPo6-NFZK/?igsh=share"
      assertEquals(url, SharedLinks.parse(Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_TEXT, "Watch $url")))
      assertEquals(url, SharedLinks.parse(Intent(Intent.ACTION_VIEW, Uri.parse(url))))
    }
    for (url in listOf("https://instagram.com.evil.test/reel/abcdef/", "https://instagram.com/stories/user/123/", "https://instagram.com:444/p/abcdef/"))
      assertNull(SharedLinks.parse(Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_TEXT, url)))
  }
  @Test fun restrictsMetadataAndMediaToInstagramOrigins() {
    TransferPolicy.metadataUrl("https://www.instagram.com/p/DemPo6-NFZK/")
    TransferPolicy.metadataUrl("https://www.instagram.com/api/graphql")
    TransferPolicy.mediaUrl(media)
    assertTrue(TransferPolicy.validThumbnail("https://scontent.cdninstagram.com/image.jpg"))
    for (url in listOf("https://fbcdn.net.evil.test/video.mp4", "https://user@cdn.cdninstagram.com/video.mp4", "https://cdn.cdninstagram.com/video.m3u8"))
      assertTrue(runCatching { TransferPolicy.mediaUrl(url) }.isFailure)
    assertTrue(runCatching { TransferPolicy.metadataUrl("https://www.instagram.com/accounts/login/") }.isFailure)
    val request = JSONObject().put("videoId", id).put("title", "Instagram video").put("mode", "video").put("requestedQuality", "720p")
      .put("candidates", JSONArray().put(JSONObject().put("quality", "720p").put("video", JSONObject().put("url", media).put("size", 0))))
    TransferPolicy.validate(request)
    request.put("videoId", "jNQXAC9IVRw")
    assertTrue(runCatching { TransferPolicy.validate(request) }.isFailure)
    request.put("videoId", id)
    request.getJSONArray("candidates").getJSONObject(0).getJSONObject("video").put("url", "https://video.twimg.com/video.mp4")
    assertTrue(runCatching { TransferPolicy.validate(request) }.isFailure)
  }
}
