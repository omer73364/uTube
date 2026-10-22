package com.utubemobile

import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import org.json.JSONObject

// A failed range never contributes bytes to the committed output or progress.
object RangedTransfer {
  fun download(
    stream: JSONObject,
    target: File,
    cancelled: () -> Boolean,
    connectionChanged: (HttpURLConnection?) -> Unit,
    progress: (Long, Long) -> Unit,
    open: (URI) -> HttpURLConnection = { it.toURL().openConnection() as HttpURLConnection },
  ) {
    val uri = TransferPolicy.mediaUrl(stream.getString("url"))
    var total = stream.optLong("size", 0L)
    var offset = 0L
    var chunk = 1024 * 1024L
    var failures = 0
    target.outputStream().use { output ->
      while (total == 0L || offset < total) {
        if (cancelled()) throw InterruptedException("CANCELLED")
        val end = if (total > 0) minOf(total - 1, offset + chunk - 1) else offset + chunk - 1
        val connection = open(uri)
        var status = -1
        connectionChanged(connection)
        try {
          connection.connectTimeout = 15000
          connection.readTimeout = 20000
          connection.instanceFollowRedirects = false
          connection.setRequestProperty("Range", "bytes=$offset-$end")
          connection.setRequestProperty("Accept-Encoding", "identity")
          status = connection.responseCode
          if (status == 200 && offset == 0L) {
            val length = connection.contentLengthLong
            if (length > 0) total = length
            var copied = 0L
            connection.inputStream.use { input ->
              val bytes = ByteArray(65536)
              while (true) {
                if (cancelled()) throw InterruptedException("CANCELLED")
                val n = input.read(bytes)
                if (n < 0) break
                output.write(bytes, 0, n)
                copied += n
                progress(copied, total)
              }
            }
            check(copied > 0 && (total <= 0 || copied == total)) { "INCOMPLETE_STREAM" }
            return
          }
          check(status == 206) { "HTTP_$status" }
          val range =
            Regex("bytes (\\d+)-(\\d+)/(\\d+)")
              .matchEntire(connection.getHeaderField("Content-Range") ?: "")
              ?: error("INVALID_RANGE")
          val start = range.groupValues[1].toLong()
          val last = range.groupValues[2].toLong()
          val size = range.groupValues[3].toLong()
          check(start == offset && last >= start && last <= end && size > last) { "INVALID_RANGE" }
          if (total > 0) check(size == total) { "STREAM_CHANGED" }
          total = size
          val expected = (last - start + 1).toInt()
          check(expected <= chunk)
          val bytes =
            connection.inputStream.use { input ->
              val data = ByteArray(expected)
              var read = 0
              while (read < expected) {
                if (cancelled()) throw InterruptedException("CANCELLED")
                val n = input.read(data, read, expected - read)
                check(n > 0) { "INCOMPLETE_RANGE" }
                read += n
              }
              data
            }
          if (cancelled()) throw InterruptedException("CANCELLED")
          output.write(bytes)
          offset += expected
          failures = 0
          progress(offset, total)
        } catch (error: Exception) {
          if (cancelled() || error is InterruptedException) throw InterruptedException("CANCELLED")
          // An un-ranged response may already have written bytes; restart via another candidate.
          if (status == 200 || failures++ >= 4) throw error
          chunk = maxOf(65536, chunk / 2)
        } finally {
          connectionChanged(null)
          connection.disconnect()
        }
      }
    }
    check(target.length() > 0 && target.length() == total) { "INCOMPLETE_STREAM" }
  }
}
