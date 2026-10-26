package com.utubemobile

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate

// A separate translucent task leaves the regular app and the sharing app in place.
class ShareActivity : ReactActivity() {
  override fun getMainComponentName() = "uTubeShare"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, mainComponentName) {
      override fun getLaunchOptions() =
        Bundle().apply {
          putString("url", SharedLinks.parse(intent) ?: "")
        }
    }
}
