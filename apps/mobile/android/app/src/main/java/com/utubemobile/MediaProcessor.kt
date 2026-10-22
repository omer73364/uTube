package com.utubemobile

import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.FFmpegKitConfig
import com.arthenica.ffmpegkit.Level
import com.arthenica.ffmpegkit.ReturnCode
import java.io.File

object MediaProcessor {
  fun process(
    video: File?,
    audio: File?,
    output: File,
    mode: String,
    title: String,
    cancelled: () -> Boolean,
  ) {
    check(!cancelled()) { "CANCELLED" }
    FFmpegKitConfig.setLogLevel(Level.AV_LOG_ERROR)
    val args = mutableListOf("-nostdin", "-y")
    if (video != null) args.addAll(listOf("-i", video.absolutePath))
    if (audio != null) args.addAll(listOf("-i", audio.absolutePath))
    if (mode == "mp3")
      args.addAll(
        listOf("-map", "0:a:0", "-vn", "-c:a", "libmp3lame", "-b:a", "192k", "-id3v2_version", "3")
      )
    else if (audio != null && video != null)
      args.addAll(listOf("-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "+faststart"))
    else
      args.addAll(listOf("-map", "0:v:0", "-map", "0:a:0", "-c", "copy", "-movflags", "+faststart"))
    args.addAll(listOf("-metadata", "title=$title", output.absolutePath))
    val session = FFmpegKit.executeWithArguments(args.toTypedArray())
    if (cancelled() || ReturnCode.isCancel(session.returnCode)) {
      output.delete()
      throw InterruptedException("CANCELLED")
    }
    check(ReturnCode.isSuccess(session.returnCode) && output.isFile && output.length() > 0) {
      "MEDIA_PROCESSING_FAILED"
    }
  }

  fun cancel() = FFmpegKit.cancel()
}
