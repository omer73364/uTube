import Foundation

public final class MetadataHTTP: NSObject, URLSessionDataDelegate, @unchecked Sendable {
  private struct Pending {
    var data = Data()
    var response: HTTPURLResponse?
    var failure: Error?
    var redirects = 0
    let complete: (Result<[String: Any], Error>) -> Void
  }
  private let configuration: URLSessionConfiguration
  public init(configuration: URLSessionConfiguration = .ephemeral) {
    self.configuration = configuration; super.init()
  }
  private let lock = NSLock()
  private var pending: [Int: Pending] = [:]
  private var tasks: [String: URLSessionDataTask] = [:]
  private lazy var session: URLSession = {
    let config = configuration.copy() as! URLSessionConfiguration
    config.httpMaximumConnectionsPerHost = 3
    config.timeoutIntervalForRequest = 20; config.timeoutIntervalForResource = 35
    config.httpCookieStorage = nil; config.urlCache = nil
    return URLSession(configuration: config, delegate: self, delegateQueue: nil)
  }()
  public func request(id: String, url: String, method: String, headers: [String: String], body: String?,
                      complete: @escaping (Result<[String: Any], Error>) -> Void) {
    do {
      var request = URLRequest(url: try Policy.metadata(url, method: method, body: body))
      request.httpMethod = method; request.httpBody = body.map { Data($0.utf8) }
      request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", forHTTPHeaderField: "User-Agent")
      for (key, value) in headers where !["host", "content-length", "connection", "accept-encoding", "cookie", "authorization"].contains(key.lowercased()) {
        request.setValue(value, forHTTPHeaderField: key)
      }
      lock.lock(); defer { lock.unlock() }
      guard tasks[id] == nil else { throw Failure("DUPLICATE_REQUEST") }
      let task = session.dataTask(with: request)
      pending[task.taskIdentifier] = Pending(complete: complete); tasks[id] = task; task.resume()
    } catch { complete(.failure(error)) }
  }
  public func cancel(_ id: String) { lock.lock(); defer { lock.unlock() }; tasks[id]?.cancel() }
  public func close() { session.invalidateAndCancel() }
  public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                         completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    lock.lock(); defer { lock.unlock() }
    pending[dataTask.taskIdentifier]?.response = response as? HTTPURLResponse
    let limit = Policy.metadataLimit(response.url)
    // HEAD reports the media file's size, not a metadata response body.
    if dataTask.originalRequest?.httpMethod != "HEAD", response.expectedContentLength > limit { pending[dataTask.taskIdentifier]?.failure = Failure("METADATA_TOO_LARGE"); completionHandler(.cancel) }
    else { completionHandler(.allow) }
  }
  public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    lock.lock(); defer { lock.unlock() }
    let id = dataTask.taskIdentifier
    let limit = Policy.metadataLimit(dataTask.originalRequest?.url)
    guard let count = pending[id]?.data.count, count + data.count <= limit else { pending[id]?.failure = Failure("METADATA_TOO_LARGE"); dataTask.cancel(); return }
    pending[id]?.data.append(data)
  }
  public func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                         newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    lock.lock(); defer { lock.unlock() }
    let original = task.originalRequest!, url = original.url!
    guard !Policy.facebookPage(url), !Policy.sizeProbe(url),
          !["cdn.syndication.twimg.com", "www.instagram.com"].contains(url.host ?? ""),
          original.httpMethod == "GET", (pending[task.taskIdentifier]?.redirects ?? 4) < 4,
          let next = request.url, (try? Policy.metadata(next.absoluteString, method: "GET", body: nil)) != nil else {
      completionHandler(nil); return
    }
    pending[task.taskIdentifier]?.redirects += 1
    completionHandler(request)
  }
  public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    lock.lock()
    let item = pending.removeValue(forKey: task.taskIdentifier)
    tasks = tasks.filter { $0.value.taskIdentifier != task.taskIdentifier }
    lock.unlock()
    guard let item else { return }
    if let error = item.failure ?? error { item.complete(.failure(error)); return }
    guard let response = item.response else { item.complete(.failure(Failure("METADATA_RESPONSE"))); return }
    var headers: [String: String] = [:]
    for (key, value) in response.allHeaderFields { headers[String(describing: key).lowercased()] = String(describing: value) }
    item.complete(.success(["status": response.statusCode, "url": response.url!.absoluteString,
                            "body": String(decoding: item.data, as: UTF8.self), "headers": headers]))
  }
}
