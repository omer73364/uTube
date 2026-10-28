package com.utubemobile

import java.net.URI
import org.json.JSONObject

object TransferPolicy {
  private fun instagramHost(host: String?) = host?.let { it.endsWith(".cdninstagram.com") || it.endsWith(".fbcdn.net") } == true
  fun facebookPage(uri: URI): Boolean {
    if (uri.host !in listOf("facebook.com", "www.facebook.com", "m.facebook.com", "mbasic.facebook.com", "web.facebook.com", "fb.watch")) return false
    if (uri.host == "fb.watch") return Regex("^/[A-Za-z0-9_-]{3,100}/?$").matches(uri.path)
    val video = Regex("^/(?:reel/[1-9][0-9]{4,24}|(?:[A-Za-z0-9_.-]+/)?videos/(?:[^/]+/)?[1-9][0-9]{4,24}|share/[vr]/[A-Za-z0-9_-]{3,100})/?$").matches(uri.path)
    val watch = Regex("^/(?:watch|video\\.php)/?$").matches(uri.path) && uri.rawQuery?.split("&")?.any { Regex("^v=[1-9][0-9]{4,24}$").matches(it) } == true
    return video || watch
  }
  private fun provider(id: String) = if (id.startsWith("ig-") && Regex("^ig-[A-Za-z0-9_-]{5,32}-[1-9][0-9]?$").matches(id)) "instagram" else if (Regex("^x-[1-9][0-9]{14,19}-[1-4]$").matches(id)) "x" else if (Regex("^fb-[1-9][0-9]{4,24}-1$").matches(id)) "facebook" else "youtube"

  fun mediaUrl(value: String): URI {
    val uri = URI(value)
    require(
      uri.scheme == "https" &&
        (uri.host?.lowercase()?.endsWith(".googlevideo.com") == true ||
          ((uri.host == "video.twimg.com" || instagramHost(uri.host)) && uri.path.endsWith(".mp4"))) &&
        uri.userInfo == null &&
        uri.port in listOf(-1, 443)
    ) {
      "Invalid media URL."
    }
    return uri
  }

  fun sizeProbeUrl(uri: URI): Boolean = uri.scheme == "https" && uri.userInfo == null &&
    uri.port == -1 && instagramHost(uri.host) && uri.path.endsWith(".mp4")

  fun metadataUrl(value: String): URI {
    val uri = URI(value)
    require(
      uri.scheme == "https" && uri.userInfo == null && uri.port in listOf(-1, 443) &&
        (uri.host in listOf("www.youtube.com", "youtube.com", "music.youtube.com",
          "www.youtube-nocookie.com", "youtubei.googleapis.com") ||
          (uri.host == "cdn.syndication.twimg.com" && uri.path == "/tweet-result") ||
          (uri.host == "www.instagram.com" && (Regex("^/p/[A-Za-z0-9_-]{5,32}/$").matches(uri.path) || uri.path == "/api/graphql")) || facebookPage(uri) || sizeProbeUrl(uri))
    ) { "Invalid metadata URL." }
    return uri
  }

  fun validThumbnail(value: String): Boolean = runCatching {
    val uri = URI(value)
    uri.scheme == "https" && uri.userInfo == null && uri.port in listOf(-1, 443) &&
      (uri.host in listOf("i.ytimg.com", "pbs.twimg.com") || instagramHost(uri.host))
  }.getOrDefault(false)

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
    require(Regex("^(?:[A-Za-z0-9_-]{11}|x-[1-9][0-9]{14,19}-[1-4]|ig-[A-Za-z0-9_-]{5,32}-[1-9][0-9]?|fb-[1-9][0-9]{4,24}-1)$").matches(plan.getString("videoId"))) { "Invalid video ID." }
    if (plan.has("thumbnail")) require(validThumbnail(plan.getString("thumbnail"))) { "Invalid thumbnail." }
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
        val uri = mediaUrl(stream.getString("url"))
        val source = provider(plan.getString("videoId"))
        val matches = when (source) {
          "facebook" -> uri.host?.endsWith(".fbcdn.net") == true
          "instagram" -> instagramHost(uri.host)
          "x" -> uri.host == "video.twimg.com"
          else -> uri.host?.endsWith(".googlevideo.com") == true
        }
        require(matches) { "Media source does not match the request." }
        require(stream.optLong("size", 0) in 0..8_000_000_000_000L) { "Invalid stream size." }
      }
    }
  }
}
