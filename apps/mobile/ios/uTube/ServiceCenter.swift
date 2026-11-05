import Foundation
import UTubeKit

@MainActor final class ServiceCenter {
  static let shared = ServiceCenter()
  private let http = MetadataHTTP()
  private var manifest: ServiceManifest?
  private var checking = false
  private var failed = false
  private var checkedAt: Double = 0
  private var revision: Int64 = 0
  private let keys: [String: String]
  private let cache: URL
  private var version: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0" }
  private init() {
    let config = Bundle.main.url(forResource: "update-config", withExtension: "json").flatMap { try? Data(contentsOf: $0) }
    keys = (config.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any])?["keys"] as? [String: String] ?? [:]
    cache = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("utube-service-manifest.json")
    revision = Int64(UserDefaults.standard.integer(forKey: "service-revision"))
    if let text = try? String(contentsOf: cache, encoding: .utf8), let value = try? ServicePolicy.verify(text, keys: keys, allowExpired: true), value.revision >= revision {
      manifest = value; revision = value.revision
    }
  }
  var rules: [ServiceRule] { manifest?.rules(platform: "ios", version: version) ?? [] }
  func blocked(_ id: String) -> Bool {
    let provider = Policy.provider(id)
    return rules.contains { $0.provider == provider && ["unavailable", "retired"].contains($0.state) }
  }
  func assertAvailable(_ id: String) throws { if blocked(id) { throw Failure("SERVICE_UNAVAILABLE") } }
  func snapshot() throws -> String {
    let encoded = try JSONSerialization.jsonObject(with: JSONEncoder().encode(rules))
    var value: [String: Any] = ["phase": keys.isEmpty ? "unconfigured" : checking ? "checking" : failed ? "error" : "current", "services": encoded, "statusVerified": (manifest?.expiresAt ?? 0) > Date().timeIntervalSince1970 * 1000, "loaded": 0, "total": 0, "checkedAt": checkedAt]
    if failed { value["error"] = "check" }
    return String(decoding: try JSONSerialization.data(withJSONObject: value), as: UTF8.self)
  }
  func check() async throws -> String {
    guard !checking, !keys.isEmpty else { return try snapshot() }
    checking = true; failed = false
    do {
      let response: [String: Any] = try await withCheckedThrowingContinuation { continuation in
        http.request(id: UUID().uuidString, url: "https://omer73364.github.io/uTube/updates/manifest.json", method: "GET", headers: ["Cache-Control": "no-cache"], body: nil) { continuation.resume(with: $0) }
      }
      guard response["status"] as? Int == 200, let text = response["body"] as? String else { throw Failure("MANIFEST_HTTP") }
      let value = try ServicePolicy.verify(text, keys: keys)
      guard value.revision >= revision else { throw Failure("MANIFEST_ROLLBACK") }
      try Data(text.utf8).write(to: cache, options: .atomic)
      manifest = value; revision = value.revision; UserDefaults.standard.set(revision, forKey: "service-revision")
      checkedAt = Date().timeIntervalSince1970 * 1000
    } catch { failed = true }
    checking = false; return try snapshot()
  }
}
