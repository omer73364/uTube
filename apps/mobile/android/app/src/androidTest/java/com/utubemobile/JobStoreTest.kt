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
  fun playlistBatchesStaySeparateAndRetriesKeepTheirBatch() {
    val store = JobStore(context, "test-${UUID.randomUUID()}-")
    store.recover()
    fun item(video: String) = request(video).put("playlistTitle", "My playlist")
    val ids = store.enqueueBatch(JSONArray().put(item("jNQXAC9IVRw")).put(item("XIdA1AZ4zYI")))
    val first = ids.getString(0)
    val second = ids.getString(1)
    val batch = store.get(first).getString("batchId")
    assertTrue(batch.isNotBlank())
    assertEquals(batch, store.get(second).getString("batchId"))
    store.terminal(first, "saved")
    store.terminal(second, "failed")
    store.enqueueBatch(JSONArray().put(item("XIdA1AZ4zYI").put("retryId", second)))
    assertEquals(batch, store.get(second).getString("batchId"))
    store.terminal(second, "saved")
    val later = store.enqueueBatch(JSONArray().put(item("jNQXAC9IVRw"))).getString(0)
    assertNotEquals(batch, store.get(later).getString("batchId"))
  }

  @Test
  fun audioQualityIsNormalizedForNewRequestsAndOldRetries() {
    val store = JobStore(context, "test-${UUID.randomUUID()}-")
    store.recover()
    val audioRequest = request().put("mode", "mp3").put("requestedQuality", "720p")
    val id = store.enqueueBatch(JSONArray().put(audioRequest)).getString(0)
    assertEquals("MP3", store.get(id).getString("requestedQuality"))
    assertEquals("MP3", store.get(id).getString("quality"))
    assertEquals(
      id,
      store
        .enqueueBatch(JSONArray().put(request().put("mode", "mp3").put("requestedQuality", "best")))
        .getString(0),
    )
    store.edit(id) { it.put("requestedQuality", "best").put("status", "failed") }
    store.enqueueBatch(JSONArray().put(audioRequest.put("retryId", id)))
    assertEquals("MP3", store.get(id).getString("requestedQuality"))
    assertEquals("queued", store.get(id).getString("status"))
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

  @Test
  fun removingAnEntryPersistsAndKeepsItsFile() {
    val scope = "test-${UUID.randomUUID()}-"
    val store = JobStore(context, scope)
    store.recover()
    val id = store.enqueueBatch(JSONArray().put(request())).getString(0)
    assertTrue(runCatching { store.remove(id) }.isFailure)
    val file =
      java.io.File(context.cacheDir, "remove-test-${UUID.randomUUID()}").apply {
        writeText("keep me")
      }
    try {
      store.edit(id) {
        it.put("status", "saved").put("fileUri", android.net.Uri.fromFile(file).toString())
      }
      store.remove(id)
      assertTrue(JobStore(context, scope).all().isEmpty())
      assertEquals("keep me", file.readText())
      assertTrue(runCatching { store.remove("unknown-id") }.isFailure)
    } finally {
      file.delete()
    }
  }
  @Test
  fun unavailableProviderDoesNotBlockHealthyJobsOrLoseQueuedEntries() {
    val store = JobStore(context, "test-${UUID.randomUUID()}-")
    store.recover()
    val requests = JSONArray().put(request("ig-ABCDE-1")).put(request("jNQXAC9IVRw"))
    val ids = store.enqueueBatch(requests)
    assertEquals(ids.getString(1), store.next { id -> id.startsWith("ig-") }!!.getString("id"))
    assertEquals("queued", store.get(ids.getString(0)).getString("status"))
    assertEquals(2, store.all().size)
    // Removing the restriction exposes the original queued item again.
    assertEquals(ids.getString(0), store.next { false }!!.getString("id"))
  }

}
