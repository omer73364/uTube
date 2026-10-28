package com.utubemobile

import android.util.Base64
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class UpdatePolicyTest {
  private val now = 1800000000000L
  private val pair = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
  private val keys = JSONObject().put("test", "-----BEGIN PUBLIC KEY-----\n" + Base64.encodeToString(pair.public.encoded, Base64.NO_WRAP) + "\n-----END PUBLIC KEY-----")
  private fun manifest() = JSONObject().put("schema", 1).put("revision", 5).put("issuedAt", now - 1000).put("expiresAt", now + 100000)
    .put("releases", JSONArray()).put("services", JSONArray().put(JSONObject().put("provider", "instagram").put("state", "unavailable")
      .put("fixedVersion", "2.6.0").put("message", JSONObject().put("en", "Outage").put("ar", "توقف"))))
  private fun envelope(data: JSONObject): String {
    val bytes = data.toString().toByteArray()
    val signer = Signature.getInstance("SHA256withECDSA").apply { initSign(pair.private); update(bytes) }
    return JSONObject().put("keyId", "test").put("payload", Base64.encodeToString(bytes, Base64.NO_WRAP))
      .put("signature", Base64.encodeToString(signer.sign(), Base64.NO_WRAP)).toString()
  }
  private fun rejected(block: () -> Unit) { try { block(); fail("Expected rejection") } catch (_: Exception) {} }
  @Test fun verifiesSignatureAndRejectsTamperingUnknownKeysAndExpiry() {
    val signed = envelope(manifest())
    assertEquals(5L, UpdatePolicy.verify(signed, keys, now).getLong("revision"))
    val changed = JSONObject(signed).put("payload", Base64.encodeToString(manifest().put("revision", 6).toString().toByteArray(), Base64.NO_WRAP))
    rejected { UpdatePolicy.verify(changed.toString(), keys, now) }
    rejected { UpdatePolicy.verify(JSONObject(signed).put("keyId", "unknown").toString(), keys, now) }
    rejected { UpdatePolicy.verify(signed, keys, now + 200000) }
    assertEquals(5L, UpdatePolicy.verify(signed, keys, now + 200000, true).getLong("revision"))
  }
  @Test fun outagesApplyOnlyToAffectedVersionsAndExpireWithoutDisablingDownloads() {
    val data = manifest()
    assertEquals(1, UpdatePolicy.services(data, "2.5.0", now).length())
    assertEquals(0, UpdatePolicy.services(data, "2.6.0", now).length())
    assertEquals(0, UpdatePolicy.services(data, "2.5.0", now + 200000).length())
    assertEquals(0, UpdatePolicy.services(null, "2.5.0", now).length())
    data.getJSONArray("services").getJSONObject(0).put("platforms", JSONArray().put("linux"))
    assertEquals(0, UpdatePolicy.services(data, "2.5.0", now).length())
  }
  @Test fun comparesVersionsNumericallyAndRestrictsArtifactHosts() {
    assertTrue(UpdatePolicy.compare("2.10.0", "2.9.0") > 0)
    rejected { UpdatePolicy.compare("2.6.0-beta", "2.5.0") }
    rejected { UpdatePolicy.assetUrl("https://example.com/update.apk") }
    rejected { UpdatePolicy.assetUrl("https://github.com/other/repo/releases/download/v2.6.0/app.apk") }
    rejected { UpdatePolicy.assetUrl("https://github.com/omer73364/uTube/releases/download/v2.6.0/app.apk?x=1") }
    assertEquals("github.com", UpdatePolicy.assetUrl("https://github.com/omer73364/uTube/releases/download/v2.6.0/app.apk").host)
  }
}
