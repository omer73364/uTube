package com.utubemobile

import java.net.URI
import org.json.JSONObject

object TransferPolicy {
  fun mediaUrl(value: String): URI {
    val uri = URI(value)
    require(
      uri.scheme == "https" &&
        uri.host?.lowercase()?.endsWith(".googlevideo.com") == true &&
        uri.userInfo == null &&
        uri.port in listOf(-1, 443)
    ) {
      "Invalid media URL."
    }
    return uri
  }

  fun safeName(value: String): String {
    var name =
      value.replace(Regex("[<>:\"/\\\\|?*\\p{Cntrl}]"), "_").trim().trim('.').take(80).ifBlank {
        "Video"
      }
    if (Character.isHighSurrogate(name.last())) name = name.dropLast(1)
    while (name.toByteArray(Charsets.UTF_8).size > 150) name =
      name.dropLast(if (Character.isLowSurrogate(name.last())) 2 else 1)
    return name.ifBlank { "Video" }
  }

  fun validateRequest(plan: JSONObject) {
    require(Regex("^[A-Za-z0-9_-]{11}$").matches(plan.getString("videoId"))) { "Invalid video ID." }
    require(plan.getString("mode") in listOf("video", "mp3")) { "Invalid output format." }
    require(
      plan.getString("title").length in 1..180 && plan.optString("playlistTitle").length <= 180
    ) {
      "Invalid title."
    }
    require(plan.getString("requestedQuality").length in 1..30)
    require(plan.optInt("playlistIndex", 1) in 1..100000)
  }

  fun validate(plan: JSONObject) {
    validateRequest(plan)
    val candidates = plan.getJSONArray("candidates")
    require(candidates.length() in 1..24) { "No downloadable formats." }
    for (index in 0 until candidates.length()) {
      val candidate = candidates.getJSONObject(index)
      require(candidate.getString("quality").length in 1..30)
      require(candidate.has("video") || candidate.has("audio"))
      if (plan.getString("mode") == "video") require(candidate.has("video"))
      for (kind in listOf("video", "audio")) if (candidate.has(kind)) {
        val stream = candidate.getJSONObject(kind)
        mediaUrl(stream.getString("url"))
        require(stream.optLong("size", 0) in 0..8_000_000_000_000L) { "Invalid stream size." }
      }
    }
  }
}
