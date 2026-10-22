package com.utubemobile

import androidx.test.platform.app.InstrumentationRegistry
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.PromiseImpl
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class PlayerRuntimeTest {
  @Test
  fun isolatedPlayerWorksWithoutAnActivityAndRejectsNativeCommands() {
    val runtime =
      PlayerRuntime(InstrumentationRegistry.getInstrumentation().targetContext.applicationContext)
    try {
      val resolved = CountDownLatch(1)
      var result: String? = null
      var failed = false
      runtime.evaluate(
        "return {sig:'signature', n:'token'}",
        PromiseImpl(
          Callback { args ->
            result = args[0] as String
            resolved.countDown()
          },
          Callback {
            failed = true
            resolved.countDown()
          },
        ),
      )
      assertTrue(resolved.await(25, TimeUnit.SECONDS))
      assertFalse(failed)
      assertEquals("signature", JSONObject(result!!).getString("sig"))
      val rejected = CountDownLatch(1)
      var accepted = false
      runtime.evaluate(
        "return {openFile:'/secret'}",
        PromiseImpl(
          Callback {
            accepted = true
            rejected.countDown()
          },
          Callback { rejected.countDown() },
        ),
      )
      assertTrue(rejected.await(25, TimeUnit.SECONDS))
      assertFalse(accepted)
    } finally {
      runtime.close()
    }
  }
}
