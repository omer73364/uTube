package com.utubemobile

import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class MetadataHttp {
  private val pool = Executors.newFixedThreadPool(3)
  private val connections = ConcurrentHashMap<String, HttpURLConnection>()
  private val tokens = ConcurrentHashMap<String, AtomicBoolean>()

  fun cancel(id: String) {
    tokens[id]?.set(true)
    connections.remove(id)?.disconnect()
  }

  fun close() {
    tokens.values.forEach { it.set(true) }
    connections.values.forEach { it.disconnect() }
    pool.shutdownNow()
  }

  private fun allowed(value: String): URI {
    val uri = URI(value)
    require(
      uri.scheme == "https" &&
        uri.userInfo == null &&
        uri.port in listOf(-1, 443) &&
        uri.host in
          listOf(
            "www.youtube.com",
            "youtube.com",
            "music.youtube.com",
            "www.youtube-nocookie.com",
            "youtubei.googleapis.com",
          )
    ) {
      "Invalid metadata URL."
    }
    return uri
  }

  fun request(
    id: String,
    url: String,
    method: String,
    headers: ReadableMap,
    body: String?,
    promise: Promise,
  ) {
    try {
      allowed(url)
      require(method in listOf("GET", "POST", "HEAD"))
      require((body?.length ?: 0) <= 1024 * 1024)
    } catch (e: Exception) {
      promise.reject("METADATA_URL", e.message)
      return
    }
    val values = headers.toHashMap()
    val cancelled = AtomicBoolean(false)
    tokens[id] = cancelled
    pool.execute {
      try {
        var target = url
        var completed = false
        for (redirect in 0..4) {
          check(!cancelled.get()) { "CANCELLED" }
          val connection = allowed(target).toURL().openConnection() as HttpURLConnection
          connections[id] = connection
          try {
            check(!cancelled.get()) { "CANCELLED" }
            connection.connectTimeout = 15000
            connection.readTimeout = 20000
            connection.instanceFollowRedirects = false
            connection.requestMethod = method
            connection.setRequestProperty(
              "User-Agent",
              "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36",
            )
            values.forEach { (key, value) ->
              if (
                key.lowercase() !in
                  listOf("host", "content-length", "connection", "accept-encoding")
              )
                connection.setRequestProperty(key, value.toString())
            }
            if (body != null && method == "POST") {
              connection.doOutput = true
              connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            if (status in listOf(301, 302, 303, 307, 308)) {
              require(method != "POST") { "Unexpected metadata redirect." }
              target =
                allowed(target)
                  .resolve(connection.getHeaderField("Location") ?: error("Missing redirect"))
                  .toString()
              continue
            }
            val stream = if (status >= 400) connection.errorStream else connection.inputStream
            val bytes =
              stream?.use { input ->
                val out = ByteArrayOutputStream()
                val buffer = ByteArray(16384)
                while (true) {
                  val count = input.read(buffer)
                  if (count < 0) break
                  require(out.size() + count <= 8 * 1024 * 1024) {
                    "Metadata response is too large."
                  }
                  out.write(buffer, 0, count)
                }
                out.toByteArray()
              } ?: ByteArray(0)
            val responseHeaders = Arguments.createMap()
            connection.headerFields.forEach { (key, value) ->
              if (key != null) responseHeaders.putString(key, value.joinToString(","))
            }
            promise.resolve(
              Arguments.createMap().apply {
                putInt("status", status)
                putString("url", target)
                putString("body", bytes.toString(Charsets.UTF_8))
                putMap("headers", responseHeaders)
              }
            )
            completed = true
            break
          } finally {
            connections.remove(id)
            connection.disconnect()
          }
        }
        check(completed) { "Too many metadata redirects." }
      } catch (e: Exception) {
        promise.reject("METADATA_REQUEST", e.message, e)
      } finally {
        tokens.remove(id)
      }
    }
  }
}
