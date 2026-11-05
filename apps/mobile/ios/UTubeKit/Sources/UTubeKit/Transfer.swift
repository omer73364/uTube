import Foundation

// A download task streams directly to disk. An ephemeral session permits validating
// each redirect; iOS background URLSessions bypass that delegate and are not used.
public final class Transfer: NSObject, URLSessionDownloadDelegate, @unchecked Sendable {
  private let videoId: String
  private let destination: URL
  private let progress: @Sendable (Int64, Int64) -> Void
  private var continuation: CheckedContinuation<URL, Error>?
  private var outcome: Result<URL, Error>?
  private var redirects = 0
  private var lastProgress: TimeInterval = 0
  private var session: URLSession?
  private let token: Cancellation
  public init(videoId: String, destination: URL, token: Cancellation, progress: @escaping @Sendable (Int64, Int64) -> Void) {
    self.videoId = videoId; self.destination = destination; self.token = token; self.progress = progress
  }
  public static func stagingFile(in directory: URL, index: Int) -> URL {
    directory.appendingPathComponent("stream-\(index).mp4")
  }
  public func run(_ stream: Stream) async throws -> URL {
    let url = try Policy.media(stream.url, videoId: videoId)
    try token.check()
    return try await withCheckedThrowingContinuation { continuation in
      self.continuation = continuation
      let config = URLSessionConfiguration.ephemeral
      config.httpCookieStorage = nil; config.urlCache = nil
      config.timeoutIntervalForRequest = 30; config.timeoutIntervalForResource = 21600
      let session = URLSession(configuration: config, delegate: self, delegateQueue: nil); self.session = session
      var request = URLRequest(url: url)
      request.setValue("bytes=0-", forHTTPHeaderField: "Range")
      request.setValue("identity", forHTTPHeaderField: "Accept-Encoding")
      let task = session.downloadTask(with: request)
      task.resume()
      Task { [token] in
        while task.state == .running || task.state == .suspended {
          if token.cancelled { task.cancel(); return }
          try? await Task.sleep(nanoseconds: 100_000_000)
        }
      }
    }
  }
  public func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                         newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    redirects += 1
    guard redirects <= 4, let url = request.url, (try? Policy.media(url.absoluteString, videoId: videoId)) != nil else {
      completionHandler(nil); return
    }
    completionHandler(request)
  }
  public func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64,
                         totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
    let now = Date.timeIntervalSinceReferenceDate
    guard now - lastProgress >= 0.25 || totalBytesWritten == totalBytesExpectedToWrite else { return }
    lastProgress = now; progress(totalBytesWritten, totalBytesExpectedToWrite)
  }
  public func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
    do {
      try token.check()
      guard let response = downloadTask.response as? HTTPURLResponse, [200, 206].contains(response.statusCode) else { throw Failure("TRANSFER_HTTP") }
      if response.statusCode == 206 {
        guard let range = response.value(forHTTPHeaderField: "Content-Range"),
              Policy.matches(range, "^bytes 0-[0-9]+/[0-9]+$") else { throw Failure("TRANSFER_RANGE") }
        let components = range.replacingOccurrences(of: "bytes ", with: "").split(whereSeparator: { $0 == "-" || $0 == "/" })
        guard components.count == 3, let end = Int64(components[1]), let total = Int64(components[2]), end + 1 == total else { throw Failure("INCOMPLETE_TRANSFER") }
      }
      let bytes = try location.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
      guard bytes > 0, response.expectedContentLength < 0 || Int64(bytes) == response.expectedContentLength else { throw Failure("INCOMPLETE_TRANSFER") }
      try FileManager.default.moveItem(at: location, to: destination)
      outcome = .success(destination)
    } catch { outcome = .failure(error) }
  }
  public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    let result = error.map { Result<URL, Error>.failure($0) } ?? outcome ?? .failure(Failure("TRANSFER_FAILED"))
    continuation?.resume(with: result); continuation = nil
    session.finishTasksAndInvalidate(); self.session = nil
  }
}
