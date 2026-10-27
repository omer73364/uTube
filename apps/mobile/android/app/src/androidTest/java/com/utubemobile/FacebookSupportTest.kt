package com.utubemobile

import android.content.Intent
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class FacebookSupportTest {
  private val video = "2298871784249067"
  @Test fun acceptsPublicVideoAndShareIntents() {
    for (url in listOf("https://www.facebook.com/reel/$video/", "https://m.facebook.com/watch/?v=$video", "https://www.facebook.com/share/r/1BhmM7uP7K/", "https://fb.watch/abcDEF/")) {
      assertEquals(url, SharedLinks.parse(Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_TEXT, "Watch $url")))
      assertEquals(url, SharedLinks.parse(Intent(Intent.ACTION_VIEW, Uri.parse(url))))
      TransferPolicy.metadataUrl(url)
    }
    for (url in listOf("https://facebook.com.evil.test/reel/$video", "https://facebook.com/login/", "https://facebook.com/groups/12345", "https://user@facebook.com/reel/$video")) {
      assertNull(SharedLinks.parse(Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_TEXT, url)))
      assertTrue(runCatching { TransferPolicy.metadataUrl(url) }.isFailure)
    }
  }
  @Test fun restrictsFacebookPlansToFacebookMediaCDN() {
    val plan = JSONObject().put("videoId", "fb-$video-1").put("title", "Facebook video").put("mode", "video").put("requestedQuality", "HD")
      .put("candidates", JSONArray().put(JSONObject().put("quality", "HD").put("video", JSONObject().put("url", "https://video.test.fbcdn.net/video.mp4").put("provider", "facebook").put("size", 0))))
    TransferPolicy.validate(plan)
    for (url in listOf("https://video.twimg.com/video.mp4", "https://test.cdninstagram.com/video.mp4", "https://fbcdn.net.evil.test/video.mp4")) {
      plan.getJSONArray("candidates").getJSONObject(0).getJSONObject("video").put("url", url)
      assertTrue(runCatching { TransferPolicy.validate(plan) }.isFailure)
    }
  }
}
