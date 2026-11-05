import XCTest
import AVFoundation
@testable import UTubeKit
final class NativeTests: XCTestCase {
  func request(_ id: String = "XIdA1AZ4zYI", retry: String? = nil) throws -> DownloadRequest {
    try decode(DownloadRequest.self, "{\"videoId\":\"\(id)\",\"title\":\"Fixture\",\"mode\":\"video\",\"requestedQuality\":\"720p\"\(retry.map { ",\"retryId\":\"\($0)\"" } ?? "")}")
  }
  func store() throws -> JobStore { try JobStore(url: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)) }
  func testAtomicBatchAndDedupe() throws {
    let db = try store(), a = try request()
    let ids = try db.enqueue([a, a]); XCTAssertEqual(ids[0], ids[1]); XCTAssertEqual(try db.all().count, 1)
    XCTAssertThrowsError(try db.enqueue([try request("abcdefghijk"), try request("invalid")]))
    XCTAssertEqual(try db.all().count, 1)
  }
  func testRetryAndRecovery() throws {
    let db = try store(), id = try db.enqueue([request()])[0]
    var job = try db.get(id); job.status = "running"; try db.put(job); try db.recover()
    XCTAssertEqual(try db.get(id).status, "interrupted")
    XCTAssertEqual(try db.enqueue([request(retry: id)])[0], id)
    XCTAssertThrowsError(try db.remove(id))
    job.status = "saved"; try db.put(job)
    XCTAssertThrowsError(try db.enqueue([request(retry: id)]))
  }
  func testQueueLimitRollsBack() throws {
    let db = try store()
    let batch = try (0..<1000).map { index in try request(String(format: "%011d", index)) }
    _ = try db.enqueue(batch)
    XCTAssertThrowsError(try db.enqueue([request()]))
    XCTAssertEqual(try db.all().count, 1000)
  }
  func testProviderBoundaries() throws {
    _ = try Policy.media("https://video.twimg.com/a.mp4", videoId: "x-1577855540407197696-1")
    for bad in ["http://video.twimg.com/a.mp4", "https://video.twimg.com.evil.test/a.mp4", "https://user@video.twimg.com/a.mp4", "https://video.twimg.com:444/a.mp4", "https://video.twimg.com/a.m3u8", "https://127.0.0.1/a.mp4"] {
      XCTAssertThrowsError(try Policy.media(bad, videoId: "x-1577855540407197696-1"))
    }
    XCTAssertThrowsError(try Policy.media("https://video.twimg.com/a.mp4", videoId: "XIdA1AZ4zYI"))
    XCTAssertThrowsError(try Policy.metadata("https://www.instagram.com/api/graphql", method: "GET", body: nil))
    XCTAssertThrowsError(try Policy.metadata("https://scontent.fbcdn.net/a.mp4", method: "GET", body: nil))
    XCTAssertNoThrow(try Policy.metadata("https://scontent.fbcdn.net/a.mp4", method: "HEAD", body: nil))
  }
  func testSafeNames() {
    XCTAssertEqual(Policy.safeName("../a/b"), "_a_b")
    XCTAssertLessThanOrEqual(Policy.safeName(String(repeating: "🎬", count: 100)).utf8.count, 150)
  }
  func fixture(_ name: String) -> URL { Bundle.module.url(forResource: name, withExtension: nil, subdirectory: "Fixtures")! }
  func testRealMux() async throws {
    let output = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".mp4")
    defer { try? FileManager.default.removeItem(at: output) }
    try await MediaProcessor.process(video: fixture("hd.mp4"), audio: fixture("audio.m4a"), output: output, mode: "video", title: "Fixture", cancellation: Cancellation())
    let asset = AVURLAsset(url: output)
    let video = try await asset.loadTracks(withMediaType: .video), audio = try await asset.loadTracks(withMediaType: .audio)
    XCTAssertEqual(video.count, 1); XCTAssertEqual(audio.count, 1)
    let size = try await video[0].load(.naturalSize); XCTAssertEqual(size.height, 1080)
  }
  func testStagedTransferInput() async throws {
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: folder) }
    let video = Transfer.stagingFile(in: folder, index: 0), audio = Transfer.stagingFile(in: folder, index: 1)
    try FileManager.default.copyItem(at: fixture("hd.mp4"), to: video)
    try FileManager.default.copyItem(at: fixture("audio.m4a"), to: audio)
    try await MediaProcessor.process(video: video, audio: audio, output: folder.appendingPathComponent("out.mp4"), mode: "video", title: "Extensionless", cancellation: Cancellation())
  }
  func testRealMP3() async throws {
    let output = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".mp3")
    defer { try? FileManager.default.removeItem(at: output) }
    try await MediaProcessor.process(video: nil, audio: fixture("audio.m4a"), output: output, mode: "mp3", title: "Fixture", cancellation: Cancellation())
    let data = try Data(contentsOf: output)
    XCTAssertGreaterThan(data.count, 1000)
    // Real MPEG frame sync, rather than renamed AAC/MP4 bytes.
    XCTAssertEqual(data[0], 0xff); XCTAssertEqual(data[1] & 0xe0, 0xe0)
    let duration = try await AVURLAsset(url: output).load(.duration)
    XCTAssertGreaterThan(CMTimeGetSeconds(duration), 0)
  }
  func testCancellationLeavesNoOutput() async throws {
    let output = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".mp3")
    let token = Cancellation(); token.cancel()
    do { try await MediaProcessor.process(video: nil, audio: fixture("audio.m4a"), output: output, mode: "mp3", title: "Fixture", cancellation: token); XCTFail("Expected cancellation") } catch {}
    XCTAssertFalse(FileManager.default.fileExists(atPath: output.path))
  }
}

extension NativeTests {
  func testSavedFilesSurviveContainerRelocationAndRejectTraversal() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    let directory = root.appendingPathComponent("Documents/uTube/Playlist")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let file = directory.appendingPathComponent("video.mp4"); try Data([1]).write(to: file)
    let base = directory.deletingLastPathComponent()
    XCTAssertEqual(try Policy.savedFile("Playlist/video.mp4", directory: base).path, file.path)
    XCTAssertEqual(try Policy.savedFile("/old-container/Documents/uTube/Playlist/video.mp4", directory: base).path, file.path)
    XCTAssertThrowsError(try Policy.savedFile("../../secret", directory: base))
    XCTAssertThrowsError(try Policy.savedFile("/etc/passwd", directory: base))
    let db = try JobStore(url: root.appendingPathComponent("test.sqlite"), filesDirectory: base)
    let id = try db.enqueue([request()])[0]; var job = try db.get(id)
    job.status = "saved"; job.filePath = "Playlist/video.mp4"; try db.put(job)
    XCTAssertThrowsError(try db.enqueue([request(retry: id)]))
    try FileManager.default.removeItem(at: file)
    XCTAssertEqual(try db.enqueue([request(retry: id)])[0], id)
  }
}
