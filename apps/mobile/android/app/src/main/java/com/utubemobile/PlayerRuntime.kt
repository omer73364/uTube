package com.utubemobile

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.*
import com.facebook.react.bridge.Promise
import java.io.ByteArrayInputStream
import java.util.UUID
import org.json.JSONObject
import org.json.JSONTokener

// Isolated browser runtime: no native JS bridge, files, storage, or network access.
class PlayerRuntime(private val context: Context) {
  private val handler = Handler(Looper.getMainLooper())
  private var browser: WebView? = null
  private var ready = false
  private val waiting = linkedMapOf<String, Pair<Promise, String>>()
  private val timers = mutableMapOf<String, Runnable>()

  @SuppressLint("SetJavaScriptEnabled")
  private fun create() {
    if (browser != null) return
    browser =
      WebView(context).apply {
        setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
        settings.javaScriptEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.domStorageEnabled = false
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.setSupportMultipleWindows(false)
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        webViewClient =
          object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) =
              request.url.toString() != "about:blank"

            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
              WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))

            override fun onPageFinished(view: WebView, url: String) {
              ready = true
              waiting.keys.toList().forEach { run(it) }
            }

            override fun onRenderProcessGone(
              view: WebView,
              detail: RenderProcessGoneDetail,
            ): Boolean {
              reset("PLAYER_PROCESS_STOPPED")
              return true
            }
          }
        loadDataWithBaseURL(
          "about:blank",
          "<!doctype html><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-eval' 'unsafe-inline'; connect-src 'none'; frame-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'\">",
          "text/html",
          "utf-8",
          null,
        )
      }
  }

  fun evaluate(script: String, promise: Promise) {
    if (script.length > 1024 * 1024) {
      promise.reject("PLAYER_SCRIPT", "Player script is too large.")
      return
    }
    handler.post {
      try {
        val id = UUID.randomUUID().toString()
        waiting[id] = Pair(promise, script)
        val timeout = Runnable { reset("PLAYER_TIMEOUT") }
        timers[id] = timeout
        handler.postDelayed(timeout, 15000)
        create()
        if (ready) run(id)
      } catch (e: Exception) {
        reset("PLAYER_UNAVAILABLE")
      }
    }
  }

  private fun run(id: String) {
    val request = waiting[id] ?: return
    val code =
      "(function(){try{var result=(new Function(" +
        JSONObject.quote(request.second) +
        "))();return JSON.stringify({value:result});}catch(e){return JSON.stringify({error:true});}})();"
    browser?.evaluateJavascript(code) { encoded ->
      val active = waiting.remove(id) ?: return@evaluateJavascript
      timers.remove(id)?.let { handler.removeCallbacks(it) }
      try {
        val text = JSONTokener(encoded).nextValue() as? String ?: error("Invalid player result")
        require(text.length <= 32768)
        val message = JSONObject(text)
        require(!message.has("error"))
        val value = message.getJSONObject("value")
        for (key in value.keys()) require(
          key in listOf("sig", "n") &&
            value.get(key) is String &&
            value.getString(key).length <= 8192
        )
        active.first.resolve(value.toString())
      } catch (e: Exception) {
        active.first.reject("PLAYER_SCRIPT_FAILED", "The player script could not be processed.")
      }
    }
  }

  private fun reset(reason: String) {
    ready = false
    timers.values.forEach { handler.removeCallbacks(it) }
    timers.clear()
    val requests = waiting.values.toList()
    waiting.clear()
    browser?.destroy()
    browser = null
    requests.forEach { it.first.reject(reason, reason) }
  }

  fun close() {
    handler.post { reset("PLAYER_CLOSED") }
  }
}
