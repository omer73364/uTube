package com.utubemobile

import android.content.Context
import android.content.Intent
import java.net.URI

object SharedLinks {
  fun parse(intent: Intent?): String? {
    val text =
      when (intent?.action) {
        Intent.ACTION_SEND -> intent.getStringExtra(Intent.EXTRA_TEXT)
        Intent.ACTION_VIEW -> intent.dataString
        else -> null
      } ?: return null
    val match =
      Regex(
          "https?://(?:www\\.|m\\.|music\\.|mobile\\.)?(?:youtube\\.com|youtu\\.be|x\\.com|twitter\\.com)/[^\\s<>]+",
          RegexOption.IGNORE_CASE,
        )
        .find(text.take(16000))
        ?.value
        ?.trimEnd(')', ']', '.', ',', '\"', '\'') ?: return null
    val uri = runCatching { URI(match) }.getOrNull() ?: return null
    if (
      uri.userInfo != null || uri.port !in listOf(-1, 443) ||
        uri.host?.lowercase() !in
          listOf("youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "x.com", "www.x.com", "mobile.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com", "m.twitter.com")
    )
      return null
    if (uri.host?.lowercase()?.let { it.endsWith("x.com") || it.endsWith("twitter.com") } == true &&
      !Regex("^/(?:(?:[A-Za-z0-9_]{1,15}|i/web)/status|i/status|statuses)/[1-9][0-9]{14,19}(?:/video/[1-4])?/?$").matches(uri.path)) return null
    return match
  }

  fun accept(context: Context, intent: Intent?): String? {
    val match = parse(intent) ?: return null
    context
      .getSharedPreferences("utube-mobile", Context.MODE_PRIVATE)
      .edit()
      .putString("shared-link", match)
      .apply()
    return match
  }
}
