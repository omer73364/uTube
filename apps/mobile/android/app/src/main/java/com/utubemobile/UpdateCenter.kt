package com.utubemobile

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import java.security.MessageDigest
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

class UpdateCenter private constructor(private val context: Context) {
  companion object {
    val queueLock = Any()
    @Volatile private var instance: UpdateCenter? = null
    fun get(context: Context): UpdateCenter = instance ?: synchronized(this) {
      instance ?: UpdateCenter(context.applicationContext).also { instance = it }
    }
  }
  private val config = JSONObject(context.assets.open("update-config.json").bufferedReader().use { it.readText() })
  private val keys = config.getJSONObject("keys")
  private val directory = File(context.filesDir, "updates")
  private val cache = File(directory, "manifest.json")
  private val executor = Executors.newSingleThreadExecutor()
  private val main = Handler(Looper.getMainLooper())
  private val installed = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
  private val version = installed.versionName!!.substringBefore('-')
  private val arch = if (Build.SUPPORTED_ABIS.first().startsWith("arm")) "arm64" else "x64"
  private var manifest: JSONObject? = null
  private var release: JSONObject? = null
  private var file: File? = null
  private var revision = 0L
  private val state = JSONObject().put("phase", if (keys.length() == 0) "unconfigured" else "idle").put("loaded", 0).put("total", 0)
  @Volatile private var cancelled = false
  @Volatile private var connection: HttpURLConnection? = null
  @Volatile var pauseQueue = false
    private set
  @Volatile private var busy = false
  init {
    runCatching {
      val cached = UpdatePolicy.verify(cache.readText(), keys, allowExpired = true)
      revision = cached.getLong("revision")
      manifest = cached
    }
  }
  @Synchronized fun snapshot(): String = JSONObject(state.toString()).apply {
    put("services", UpdatePolicy.services(manifest, version))
    put("statusVerified", (manifest?.optLong("expiresAt") ?: 0) > System.currentTimeMillis())
    if (release != null) put("release", release)
  }.toString()
  @Synchronized private fun emit(phase: String, error: String? = null) {
    state.put("phase", phase)
    if (error == null) state.remove("error") else state.put("error", error)
  }
  @Synchronized private fun progress(loaded: Long, total: Long) { state.put("loaded", loaded).put("total", total) }
  @Synchronized fun blocked(provider: String): Boolean {
    val services = UpdatePolicy.services(manifest, version)
    return (0 until services.length()).any {
      val rule = services.getJSONObject(it)
      rule.getString("provider") == provider && rule.getString("state") in setOf("unavailable", "retired")
    }
  }
  fun assertAvailable(id: String) {
    check(!pauseQueue) { "UPDATE_INSTALLING" }
    check(!blocked(UpdatePolicy.provider(id))) { "SERVICE_UNAVAILABLE" }
  }
  private fun fetch(value: String, metadata: Boolean): HttpURLConnection {
    var url = URI(value)
    for (attempt in 0..5) {
      check(!cancelled)
      val allowed = if (metadata) setOf("omer73364.github.io") else setOf("github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com")
      require(url.scheme == "https" && url.userInfo == null && url.port == -1 && url.host in allowed)
      val conn = url.toURL().openConnection() as HttpURLConnection
      connection = conn
      conn.connectTimeout = 15000; conn.readTimeout = 20000; conn.instanceFollowRedirects = false
      conn.setRequestProperty("User-Agent", "uTube-Updater")
      conn.setRequestProperty("Cache-Control", "no-cache")
      val status = conn.responseCode
      if (status in listOf(301, 302, 303, 307, 308)) {
        val location = conn.getHeaderField("Location"); conn.disconnect()
        require(location != null); url = url.resolve(location); continue
      }
      check(status in 200..299); return conn
    }
    error("UPDATE_REDIRECT")
  }
  private fun work(callback: (String?, Exception?) -> Unit, action: () -> Unit) {
    synchronized(this) {
      if (busy) { callback(null, IllegalStateException("UPDATE_BUSY")); return }
      busy = true; cancelled = false
    }
    executor.execute {
      var failure: Exception? = null
      try { action() } catch (e: Exception) { failure = e }
      finally { connection?.disconnect(); connection = null; busy = false }
      callback(snapshot(), failure)
    }
  }
  fun check(callback: (String?, Exception?) -> Unit) = work(callback) {
    if (keys.length() == 0) { emit("unconfigured"); return@work }
    emit("checking")
    try {
      val conn = fetch(config.getString("manifestURL"), true)
      val text = conn.inputStream.use {
        val output = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        while (true) {
          val count = it.read(buffer); if (count < 0) break
          require(output.size() + count <= UpdatePolicy.MAX_MANIFEST)
          output.write(buffer, 0, count)
        }
        String(output.toByteArray(), Charsets.UTF_8)
      }
      val data = UpdatePolicy.verify(text, keys)
      require(data.getLong("revision") >= revision)
      require(data.getLong("revision") != revision || manifest == null || data.toString() == manifest.toString())
      directory.mkdirs()
      val temporary = File(directory, "manifest.json.tmp"); temporary.writeText(text)
      check(temporary.renameTo(cache))
      synchronized(this) { manifest = data; revision = data.getLong("revision") }
      val releases = data.getJSONArray("releases")
      val next = (0 until releases.length()).map { releases.getJSONObject(it) }.filter {
        it.getString("platform") == "android" && it.getString("arch") in setOf(arch, "universal") &&
          UpdatePolicy.compare(it.getString("version"), version) > 0 && it.getLong("versionCode") > installed.longVersionCode
      }.sortedWith { a, b ->
        val comparison = UpdatePolicy.compare(b.getString("version"), a.getString("version"))
        if (comparison != 0) comparison else (if (b.getString("arch") == arch) 1 else 0) - (if (a.getString("arch") == arch) 1 else 0)
      }.firstOrNull()
      synchronized(this) {
        if (release?.optString("sha256") != next?.optString("sha256")) { file = null; release = next }
        state.put("checkedAt", System.currentTimeMillis())
      }
      emit(if (file != null) "ready" else if (next != null) "available" else "current")
    } catch (e: Exception) {
      emit(if (file != null) "ready" else if (release != null) "available" else "error", "check")
    }
  }
  private fun hash(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val bytes = ByteArray(65536)
      while (true) { val count = input.read(bytes); if (count < 0) break; digest.update(bytes, 0, count) }
    }
    return digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
  }
  private fun verifyApk(file: File, target: JSONObject) {
    require(file.length() == target.getLong("size") && hash(file) == target.getString("sha256"))
    val archive = context.packageManager.getPackageArchiveInfo(file.absolutePath, PackageManager.GET_SIGNING_CERTIFICATES) ?: error("INVALID_APK")
    require(archive.packageName == context.packageName && archive.longVersionCode == target.getLong("versionCode") && archive.longVersionCode > installed.longVersionCode && archive.versionName == target.getString("version"))
    val current = installed.signingInfo?.apkContentsSigners?.map { it.toCharsString() }?.toSet()
    val next = archive.signingInfo?.apkContentsSigners?.map { it.toCharsString() }?.toSet()
    require(!current.isNullOrEmpty() && current == next) { "APK_SIGNER_MISMATCH" }
  }
  fun download(callback: (String?, Exception?) -> Unit) = work(callback) {
    val target = release ?: error("UPDATE_UNAVAILABLE")
    if ((manifest?.optLong("expiresAt") ?: 0) <= System.currentTimeMillis()) { emit("available", "check"); return@work }
    directory.mkdirs()
    val temporary = File(directory, "update.apk.part")
    emit("downloading"); progress(0, target.getLong("size"))
    try {
      val size = target.getLong("size")
      require(directory.usableSpace > size * 2)
      val conn = fetch(target.getString("url"), false)
      val started = System.currentTimeMillis()
      conn.inputStream.use { input ->
        temporary.outputStream().use { output ->
          val buffer = ByteArray(65536); var loaded = 0L
          while (true) {
            check(!cancelled && System.currentTimeMillis() - started < 30 * 60000)
            val count = input.read(buffer); if (count < 0) break
            loaded += count; require(loaded <= size); output.write(buffer, 0, count); progress(loaded, size)
          }
          output.fd.sync()
        }
      }
      check(!cancelled); verifyApk(temporary, target)
      val ready = File(directory, "update.apk"); check(temporary.renameTo(ready)); file = ready
      emit("ready")
    } catch (e: Exception) {
      temporary.delete(); emit("available", if (cancelled) null else "download")
    }
  }
  fun cancel() {
    cancelled = true; connection?.disconnect()
    if (pauseQueue) { pauseQueue = false; emit("ready") }
  }
  fun install(interrupt: Boolean, callback: (String?, Exception?) -> Unit) = work(callback) {
    val target = release ?: error("UPDATE_UNAVAILABLE")
    val ready = file ?: error("UPDATE_UNAVAILABLE")
    try {
      verifyApk(ready, target)
      if (!context.packageManager.canRequestPackageInstalls()) {
        main.post {
          try { context.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
          catch (e: Exception) { emit("ready", "install") }
        }
        emit("ready", "permission"); return@work
      }
      synchronized(queueLock) { pauseQueue = true }
      emit("waiting")
      if (interrupt) DownloadService.interruptForUpdate()
      while (DownloadService.hasActive() && !cancelled) Thread.sleep(200)
      if (cancelled) { pauseQueue = false; emit("ready"); return@work }
      // Installing replaces the process. Keep pending entries as interrupted so
      // cancelling Android's confirmation does not silently restart downloads.
      val store = JobStore(context)
      store.all().filter { it.optString("status") == "queued" }.forEach { store.terminal(it.getString("id"), "interrupted", "PROCESS_INTERRUPTED") }
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", ready)
      emit("installing")
      main.post {
        try {
          context.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
          emit("ready")
        } catch (e: Exception) { emit("ready", "install") }
        finally { pauseQueue = false }
      }
    } catch (e: Exception) { pauseQueue = false; emit("ready", "install"); throw e }
  }
}
