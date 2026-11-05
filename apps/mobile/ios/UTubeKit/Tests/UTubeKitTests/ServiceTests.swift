import XCTest
import CryptoKit
@testable import UTubeKit
final class ServiceTests: XCTestCase {
  func envelope(_ payload: [String: Any], key: P256.Signing.PrivateKey) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: payload)
    return String(decoding: try JSONSerialization.data(withJSONObject: ["keyId": "test", "payload": data.base64EncodedString(), "signature": try key.signature(for: data).derRepresentation.base64EncodedString()]), as: UTF8.self)
  }
  func payload() -> [String: Any] {
    ["schema": 1, "revision": 1, "issuedAt": 1000000, "expiresAt": 2000000,
     "services": [["provider": "youtube", "state": "unavailable", "platforms": ["ios"], "message": ["en": "Unavailable", "ar": "غير متاح"], "fixedVersion": "3.0.0"]], "releases": []]
  }
  func testSignedIOSNoticesAndVersionFiltering() throws {
    let key = P256.Signing.PrivateKey(), text = try envelope(payload(), key: key)
    let value = try ServicePolicy.verify(text, keys: ["test": key.publicKey.pemRepresentation], now: 1500000)
    XCTAssertEqual(value.rules(platform: "ios", version: "2.6.0", now: 1500000).count, 1)
    XCTAssertTrue(value.rules(platform: "android", version: "2.6.0", now: 1500000).isEmpty)
    XCTAssertTrue(value.rules(platform: "ios", version: "3.0.0", now: 1500000).isEmpty)
    XCTAssertTrue(value.rules(platform: "ios", version: "2.6.0", now: 2000001).isEmpty)
    XCTAssertThrowsError(try ServicePolicy.verify(text, keys: ["test": P256.Signing.PrivateKey().publicKey.pemRepresentation], now: 1500000))
    XCTAssertThrowsError(try ServicePolicy.verify(text, keys: ["test": key.publicKey.pemRepresentation], now: 2000001))
  }
  func testMalformedSignedNoticeIsRejected() throws {
    let key = P256.Signing.PrivateKey(); var data = payload()
    data["services"] = [["provider": "unknown", "state": "unavailable", "message": ["en": "", "ar": ""]]]
    XCTAssertThrowsError(try ServicePolicy.verify(envelope(data, key: key), keys: ["test": key.publicKey.pemRepresentation], now: 1500000))
  }
}
