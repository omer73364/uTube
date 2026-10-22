package com.utubemobile

import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import org.json.JSONObject

class PreparationService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val request = intent?.getStringExtra("request") ?: return null
    val data = Arguments.createMap().apply { putString("request", request) }
    return HeadlessJsTaskConfig("uTubeResolve", data, 120000, true)
  }

  companion object {
    private val pending = ConcurrentHashMap<String, CompletableFuture<JSONObject>>()

    fun prepare(context: Context, job: JSONObject): JSONObject {
      val id = job.getString("id")
      val future = CompletableFuture<JSONObject>()
      pending[id] = future
      try {
        context.startService(
          Intent(context, PreparationService::class.java).putExtra("request", job.toString())
        )
        return future.get(125, TimeUnit.SECONDS)
      } finally {
        pending.remove(id)
      }
    }

    fun complete(id: String, plan: JSONObject?, error: String?) {
      val future = pending[id] ?: return
      if (plan == null)
        future.completeExceptionally(IllegalStateException(error ?: "PREPARATION_FAILED"))
      else {
        TransferPolicy.validate(plan)
        future.complete(plan)
      }
    }

    fun cancel(id: String) {
      pending[id]?.completeExceptionally(InterruptedException("CANCELLED"))
    }
  }
}
