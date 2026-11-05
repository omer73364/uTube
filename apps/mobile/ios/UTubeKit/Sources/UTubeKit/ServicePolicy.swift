import Foundation
import CryptoKit

public struct ServiceRule: Codable, Sendable {
  public let provider: String
  public let state: String
  public let message: [String: String]
  public let platforms: [String]?
  public let minVersion: String?
  public let maxVersion: String?
  public let fixedVersion: String?
}
public struct ServiceManifest: Sendable {
  public let revision: Int64
  public let expiresAt: Double
  public let services: [ServiceRule]
  public func rules(platform: String, version: String, now: Double = Date().timeIntervalSince1970 * 1000) -> [ServiceRule] {
    guard expiresAt > now else { return [] }
    var seen = Set<String>()
    return services.filter { rule in
      (rule.platforms == nil || rule.platforms!.contains(platform)) &&
      (rule.minVersion == nil || ServicePolicy.compare(version, rule.minVersion!) >= 0) &&
      (rule.maxVersion == nil || ServicePolicy.compare(version, rule.maxVersion!) <= 0) &&
      (rule.fixedVersion == nil || ServicePolicy.compare(version, rule.fixedVersion!) < 0) && seen.insert(rule.provider).inserted
    }
  }
}
public enum ServicePolicy {
  public static func compare(_ a: String, _ b: String) -> Int {
    let left = a.split(separator: ".").compactMap { Int($0) }, right = b.split(separator: ".").compactMap { Int($0) }
    guard left.count == 3, right.count == 3 else { return 0 }
    for index in 0..<3 where left[index] != right[index] { return left[index] < right[index] ? -1 : 1 }
    return 0
  }
  public static func verify(_ text: String, keys: [String: String], now: Double = Date().timeIntervalSince1970 * 1000, allowExpired: Bool = false) throws -> ServiceManifest {
    guard text.utf8.count <= 262144,
          let envelope = try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any],
          let keyId = envelope["keyId"] as? String, let pem = keys[keyId],
          let encoded = envelope["payload"] as? String, let payload = Data(base64Encoded: encoded),
          let signed = envelope["signature"] as? String, let signature = Data(base64Encoded: signed) else { throw Failure("INVALID_MANIFEST") }
    let key = try P256.Signing.PublicKey(pemRepresentation: pem)
    guard key.isValidSignature(try P256.Signing.ECDSASignature(derRepresentation: signature), for: payload),
          let object = try JSONSerialization.jsonObject(with: payload) as? [String: Any],
          object["schema"] as? Int == 1,
          let revision = object["revision"] as? Int64, revision > 0,
          let issued = object["issuedAt"] as? Double, let expires = object["expiresAt"] as? Double,
          issued <= now + 300000, expires > issued, expires - issued <= 7 * 86400000,
          allowExpired || expires > now, let rules = object["services"] as? [[String: Any]], rules.count <= 100,
          let releases = object["releases"] as? [Any], releases.count <= 32 else { throw Failure("INVALID_MANIFEST") }
    let services = try JSONDecoder().decode([ServiceRule].self, from: JSONSerialization.data(withJSONObject: rules))
    for rule in services {
      guard ["youtube", "x", "instagram", "facebook"].contains(rule.provider),
            ["available", "degraded", "unavailable", "retired"].contains(rule.state),
            let en = rule.message["en"], let ar = rule.message["ar"], en.count <= 4000, ar.count <= 4000,
            rule.platforms == nil || (!rule.platforms!.isEmpty && rule.platforms!.allSatisfy { ["ios", "android", "darwin", "win32", "linux"].contains($0) }) else { throw Failure("INVALID_SERVICE") }
      for version in [rule.minVersion, rule.maxVersion, rule.fixedVersion].compactMap({ $0 }) {
        guard Policy.matches(version, "^[0-9]{1,6}\\.[0-9]{1,6}\\.[0-9]{1,6}$") else { throw Failure("INVALID_VERSION") }
      }
    }
    return ServiceManifest(revision: revision, expiresAt: expires, services: services)
  }
}
