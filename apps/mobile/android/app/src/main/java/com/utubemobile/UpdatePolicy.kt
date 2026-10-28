package com.utubemobile

import android.util.Base64
import java.net.URI
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import org.json.JSONArray
import org.json.JSONObject

/** Keep the schema aligned with packages/core/update-policy.js. No remote code is executed. */
object UpdatePolicy {
  const val MAX_MANIFEST = 262144
  private val providers = setOf("youtube", "x", "instagram", "facebook")
  fun provider(id: String) = when {
    id.startsWith("ig-") -> "instagram"
    id.startsWith("fb-") -> "facebook"
    id.startsWith("x-") -> "x"
    else -> "youtube"
  }
  fun compare(a: String, b: String): Int {
    fun parts(v: String): List<Int> {
      require(Regex("[0-9]{1,6}\\.[0-9]{1,6}\\.[0-9]{1,6}").matches(v))
      return v.split('.').map { it.toInt() }
    }
    val left = parts(a); val right = parts(b)
    for (i in 0..2) if (left[i] != right[i]) return left[i].compareTo(right[i])
    return 0
  }
  fun assetUrl(value: String): URI {
    val uri = URI(value)
    require(uri.scheme == "https" && uri.host == "github.com" && uri.userInfo == null && uri.port == -1 && uri.query == null && uri.fragment == null &&
      Regex("/omer73364/uTube/releases/download/v[0-9]+\\.[0-9]+\\.[0-9]+/[-a-zA-Z0-9_.]+").matches(uri.rawPath))
    return uri
  }
  fun verify(text: String, keys: JSONObject, now: Long = System.currentTimeMillis(), allowExpired: Boolean = false): JSONObject {
    require(text.toByteArray().size <= MAX_MANIFEST)
    val envelope = JSONObject(text)
    val pem = keys.getString(envelope.getString("keyId"))
    val der = Base64.decode(pem.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "").replace(Regex("\\s"), ""), Base64.DEFAULT)
    val key = KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(der))
    val payload = Base64.decode(envelope.getString("payload"), Base64.DEFAULT)
    val verifier = Signature.getInstance("SHA256withECDSA")
    verifier.initVerify(key); verifier.update(payload)
    require(verifier.verify(Base64.decode(envelope.getString("signature"), Base64.DEFAULT)))
    val data = JSONObject(String(payload, Charsets.UTF_8))
    require(data.getInt("schema") == 1 && data.getLong("revision") > 0)
    val issued = data.getLong("issuedAt"); val expires = data.getLong("expiresAt")
    require(issued <= now + 300000 && expires > issued && expires - issued <= 7 * 86400000L && (allowExpired || expires > now))
    val services = data.getJSONArray("services"); val releases = data.getJSONArray("releases")
    require(services.length() <= 100 && releases.length() <= 32)
    fun message(value: JSONObject) {
      require(value.getString("en").length <= 4000 && value.getString("ar").length <= 4000)
    }
    for (i in 0 until services.length()) {
      val rule = services.getJSONObject(i)
      require(rule.getString("provider") in providers && rule.getString("state") in setOf("available", "degraded", "unavailable", "retired"))
      message(rule.getJSONObject("message"))
      for (name in listOf("minVersion", "maxVersion", "fixedVersion")) if (rule.has(name)) compare(rule.getString(name), "0.0.0")
      if (rule.has("platforms")) {
        val platforms = rule.getJSONArray("platforms"); require(platforms.length() > 0)
        for (j in 0 until platforms.length()) require(platforms.getString(j) in setOf("android", "darwin", "win32", "linux"))
      }
    }
    val targets = mutableSetOf<String>()
    for (i in 0 until releases.length()) {
      val release = releases.getJSONObject(i)
      val version = release.getString("version"); compare(version, "0.0.0")
      val platform = release.getString("platform"); val kind = release.getString("kind"); val arch = release.getString("arch")
      val allowed = mapOf("android" to setOf("apk"), "darwin" to setOf("dmg"), "win32" to setOf("exe"), "linux" to setOf("deb", "AppImage"))
      require(kind in (allowed[platform] ?: emptySet()) && arch in setOf("x64", "arm64", "universal"))
      require(targets.add("$platform/$arch/$kind"))
      require(Regex("[a-f0-9]{64}").matches(release.getString("sha256")) && release.getLong("size") in 1..1073741824L)
      val url = assetUrl(release.getString("url")).toString()
      require(url.contains("/v$version/") && url.endsWith(".$kind"))
      message(release.getJSONObject("notes"))
      if (platform == "android") require(release.getLong("versionCode") > 0)
    }
    return data
  }
  fun services(data: JSONObject?, version: String, now: Long = System.currentTimeMillis()): JSONArray {
    val result = JSONArray()
    if (data == null || data.optLong("expiresAt") <= now) return result
    val rules = data.getJSONArray("services")
    val seen = mutableSetOf<String>()
    for (i in 0 until rules.length()) {
      val rule = rules.getJSONObject(i)
      val platforms = rule.optJSONArray("platforms")
      if (platforms != null && (0 until platforms.length()).none { platforms.getString(it) == "android" }) continue
      if (rule.has("minVersion") && compare(version, rule.getString("minVersion")) < 0) continue
      if (rule.has("maxVersion") && compare(version, rule.getString("maxVersion")) > 0) continue
      if (rule.has("fixedVersion") && compare(version, rule.getString("fixedVersion")) >= 0) continue
      if (seen.add(rule.getString("provider"))) result.put(rule)
    }
    return result
  }
}
