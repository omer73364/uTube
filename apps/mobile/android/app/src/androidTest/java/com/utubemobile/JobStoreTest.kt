package com.utubemobile

import androidx.test.platform.app.InstrumentationRegistry
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class JobStoreTest {
  private val context = InstrumentationRegistry.getInstrumentation().targetContext

  private fun request(id: String = "jNQXAC9IVRw") =
    JSONObject()
      .put("videoId", id)
      .put("title", "Video")
      .put("mode", "video")
      .put("requestedQuality", "1080p")

  @Test
  fun queuePersistsDeduplicatesAndRecoversInterruptedWork() {
    val scope = "test-${UUID.randomUUID()}-"
    val store = JobStore(context, scope)
    store.recover()
    val id = store.enqueueBatch(JSONArray().put(request()).put(request())).getString(0)
    assertEquals(1, store.all().size)
    assertEquals(id, JobStore(context, scope).next()!!.getString("id"))
    store.edit(id) { it.put("status", "running").put("fraction", .4) }
    store.recover()
    assertEquals("interrupted", store.get(id).getString("status"))
    assertNull(store.next())
    assertEquals(id, store.enqueueBatch(JSONArray().put(request().put("retryId", id))).getString(0))
    assertEquals("queued", store.get(id).getString("status"))
    assertEquals(0.0, store.get(id).getDouble("fraction"), 0.0)
    store.terminal(id, "saved")
    store.clearFinished()
    assertTrue(store.all().isEmpty())
  }

  @Test
  fun invalidBatchNeverAddsHalfAPlaylist() {
    val store = JobStore(context, "test-${UUID.randomUUID()}-")
    store.recover()
    assertTrue(
      runCatching { store.enqueueBatch(JSONArray().put(request()).put(request("invalid"))) }
        .isFailure
    )
    assertTrue(store.all().isEmpty())
    assertTrue(
      runCatching {
          store.enqueueBatch(JSONArray().put(request().put("retryId", "somebody-elses-id")))
        }
        .isFailure
    )
    assertTrue(store.all().isEmpty())
  }
}
