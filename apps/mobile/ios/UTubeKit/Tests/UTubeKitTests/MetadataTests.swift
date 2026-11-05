import XCTest
import Foundation
@testable import UTubeKit
private final class FixtureProtocol: URLProtocol {
  static var payload = Data()
  static var stalled = false
  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    if Self.stalled { return }
    client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["X-Fixture": "yes"])!, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: Self.payload)
    client?.urlProtocolDidFinishLoading(self)
  }
  override func stopLoading() {}
}
final class MetadataTests: XCTestCase {
  func transport() -> MetadataHTTP {
    let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [FixtureProtocol.self]
    return MetadataHTTP(configuration: config)
  }
  func testBoundedResponseAndHeaders() async throws {
    FixtureProtocol.stalled = false; FixtureProtocol.payload = Data("{\"ok\":true}".utf8)
    let http = transport(); defer { http.close() }
    let value: [String: Any] = try await withCheckedThrowingContinuation { continuation in
      http.request(id: "fixture", url: "https://www.youtube.com/youtubei/v1/player", method: "GET", headers: [:], body: nil) { continuation.resume(with: $0) }
    }
    XCTAssertEqual(value["status"] as? Int, 200)
    XCTAssertEqual((value["headers"] as? [String: String])?["x-fixture"], "yes")
    XCTAssertEqual(value["body"] as? String, "{\"ok\":true}")
  }
  func testOversizedResponseFails() async {
    FixtureProtocol.stalled = false; FixtureProtocol.payload = Data(repeating: 65, count: 2_097_153)
    let http = transport(); defer { http.close() }
    do {
      let _: [String: Any] = try await withCheckedThrowingContinuation { continuation in
        http.request(id: "large", url: "https://cdn.syndication.twimg.com/tweet-result", method: "GET", headers: [:], body: nil) { continuation.resume(with: $0) }
      }
      XCTFail("Oversized metadata must be rejected")
    } catch {}
  }
  func testCancellationSettlesPromise() async {
    FixtureProtocol.stalled = true
    let http = transport(); defer { http.close(); FixtureProtocol.stalled = false }
    do {
      let _: [String: Any] = try await withCheckedThrowingContinuation { continuation in
        http.request(id: "cancel", url: "https://www.youtube.com/", method: "GET", headers: [:], body: nil) { continuation.resume(with: $0) }
        http.cancel("cancel")
      }
      XCTFail("Cancelled requests must reject")
    } catch {}
  }
}
