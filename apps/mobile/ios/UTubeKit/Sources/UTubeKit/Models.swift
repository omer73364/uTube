import Foundation

public struct Failure: LocalizedError {
  public let message: String
  public init(_ message: String) { self.message = message }
  public var errorDescription: String? { message }
}
public struct DownloadRequest: Codable, Sendable {
  public var videoId: String
  public var thumbnail: String?
  public var title: String
  public var mode: String
  public var requestedQuality: String
  public var playlistTitle: String?
  public var playlistIndex: Int?
  public var retryId: String?
}
public struct Stream: Codable, Sendable {
  public var url: String
  public var size: Int64
  public var itag: Int
}
public struct Candidate: Codable, Sendable {
  public var quality: String
  public var video: Stream?
  public var audio: Stream?
}
public struct DownloadPlan: Codable, Sendable {
  public var videoId: String
  public var title: String
  public var mode: String
  public var requestedQuality: String
  public var candidates: [Candidate]
}
public struct Job: Codable, Sendable {
  public var id: String
  public var videoId: String
  public var thumbnail: String?
  public var title: String
  public var mode: String
  public var requestedQuality: String
  public var quality: String
  public var playlistTitle: String?
  public var playlistIndex: Int?
  public var createdAt: Double
  public var status: String
  public var loaded: Int64 = 0
  public var total: Int64 = 0
  public var fraction: Double = 0
  public var holdReason: String?
  public var error: String?
  public var filePath: String?
  public var downgraded: Bool = false
}
public enum Policy {
  public static let active: Set<String> = ["queued", "preparing", "running", "merging", "converting", "publishing"]
  public static func provider(_ id: String) -> String {
    id.hasPrefix("ig-") ? "instagram" : id.hasPrefix("fb-") ? "facebook" : id.hasPrefix("x-") ? "x" : "youtube"
  }
  public static func matches(_ value: String, _ pattern: String) -> Bool {
    value.range(of: pattern, options: .regularExpression) != nil
  }
  static func cdn(_ host: String) -> Bool { host.hasSuffix(".cdninstagram.com") || host.hasSuffix(".fbcdn.net") }
  static func secure(_ value: String) throws -> URL {
    guard let url = URL(string: value), url.scheme == "https", url.user == nil, url.password == nil,
          url.port == nil || url.port == 443, url.host != nil else { throw Failure("INVALID_URL") }
    return url
  }
  public static func facebookPage(_ url: URL) -> Bool {
    guard ["facebook.com", "www.facebook.com", "m.facebook.com", "mbasic.facebook.com", "web.facebook.com", "fb.watch"].contains(url.host ?? "") else { return false }
    if url.host == "fb.watch" { return matches(url.path, "^/[A-Za-z0-9_-]{3,100}/?$") }
    if matches(url.path, "^/(?:reel/[1-9][0-9]{4,24}|(?:[A-Za-z0-9_.-]+/)?videos/(?:[^/]+/)?[1-9][0-9]{4,24}|share/[vr]/[A-Za-z0-9_-]{3,100})/?$") { return true }
    return matches(url.path, "^/(?:watch|video\\.php)/?$") &&
      URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.contains { $0.name == "v" && matches($0.value ?? "", "^[1-9][0-9]{4,24}$") } == true
  }
  public static func sizeProbe(_ url: URL) -> Bool { cdn(url.host ?? "") && url.path.hasSuffix(".mp4") }
  public static func metadataLimit(_ url: URL?) -> Int {
    if url?.host == "omer73364.github.io" { return 262144 }
    return url?.host == "cdn.syndication.twimg.com" ? 2_097_152 : 8_388_608
  }
  public static func metadata(_ value: String, method: String, body: String?) throws -> URL {
    let url = try secure(value), host = url.host!
    guard ["GET", "POST", "HEAD"].contains(method), (body?.utf8.count ?? 0) <= 1_048_576 else { throw Failure("METADATA_REQUEST") }
    if url.absoluteString == "https://omer73364.github.io/uTube/updates/manifest.json", method == "GET", body == nil { return url }
    if ["www.youtube.com", "youtube.com", "music.youtube.com", "www.youtube-nocookie.com", "youtubei.googleapis.com"].contains(host) { return url }
    if host == "cdn.syndication.twimg.com", url.path == "/tweet-result", method == "GET", body == nil { return url }
    if host == "www.instagram.com" {
      if url.path == "/api/graphql", method == "POST", body != nil { return url }
      if matches(url.path, "^/p/[A-Za-z0-9_-]{5,32}/$"), method == "GET", body == nil { return url }
    }
    if facebookPage(url), method == "GET", body == nil { return url }
    if sizeProbe(url), method == "HEAD", body == nil { return url }
    throw Failure("METADATA_URL")
  }
  public static func media(_ value: String, videoId: String) throws -> URL {
    let url = try secure(value), host = url.host!
    let allowed: Bool
    if videoId.hasPrefix("x-") { allowed = host == "video.twimg.com" && url.path.hasSuffix(".mp4") }
    else if videoId.hasPrefix("ig-") { allowed = cdn(host) && url.path.hasSuffix(".mp4") }
    else if videoId.hasPrefix("fb-") { allowed = host.hasSuffix(".fbcdn.net") && url.path.hasSuffix(".mp4") }
    else { allowed = host.hasSuffix(".googlevideo.com") }
    guard allowed else { throw Failure("INVALID_MEDIA_URL") }
    return url
  }
  public static func validate(_ request: DownloadRequest) throws {
    guard matches(request.videoId, "^(?:[A-Za-z0-9_-]{11}|x-[1-9][0-9]{14,19}-[1-4]|ig-[A-Za-z0-9_-]{5,32}-[1-9][0-9]?|fb-[1-9][0-9]{4,24}-1)$"),
          ["video", "mp3"].contains(request.mode), (1...180).contains(request.title.count),
          (request.playlistTitle?.count ?? 0) <= 180, (1...30).contains(request.requestedQuality.count),
          (1...100000).contains(request.playlistIndex ?? 1) else { throw Failure("INVALID_REQUEST") }
    if let value = request.thumbnail {
      let url = try secure(value), host = url.host!
      guard ["i.ytimg.com", "pbs.twimg.com"].contains(host) || cdn(host) else { throw Failure("INVALID_THUMBNAIL") }
    }
  }
  public static func validate(_ plan: DownloadPlan, job: Job) throws {
    guard plan.videoId == job.videoId, plan.mode == job.mode, plan.requestedQuality == job.requestedQuality,
          (1...24).contains(plan.candidates.count) else { throw Failure("INVALID_PLAN") }
    for candidate in plan.candidates {
      guard (1...30).contains(candidate.quality.count), candidate.video != nil || candidate.audio != nil,
            plan.mode != "video" || candidate.video != nil else { throw Failure("INVALID_PLAN") }
      for stream in [candidate.video, candidate.audio].compactMap({ $0 }) {
        _ = try media(stream.url, videoId: job.videoId)
        guard (0...8_000_000_000_000).contains(stream.size) else { throw Failure("INVALID_SIZE") }
      }
    }
  }
  public static func savedFile(_ path: String, directory: URL) throws -> URL {
    var relative = path
    // iOS can relocate an app container during updates/restores. Never persist
    // or depend on the old container's absolute path.
    if path.hasPrefix("/") {
      guard let marker = path.range(of: "/Documents/uTube/", options: .backwards) else { throw Failure("FILE_MISSING") }
      relative = String(path[marker.upperBound...])
    }
    let root = directory.resolvingSymlinksInPath().standardizedFileURL
    let file = root.appendingPathComponent(relative).resolvingSymlinksInPath().standardizedFileURL
    guard !relative.isEmpty, !relative.hasPrefix("/"), file.path.hasPrefix(root.path + "/") else { throw Failure("FILE_MISSING") }
    return file
  }
  public static func safeName(_ value: String) -> String {
    var name = value.replacingOccurrences(of: "[<>:\"/\\\\|?*\\p{Cntrl}]", with: "_", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: ".")))
    name = String(name.prefix(80))
    while name.utf8.count > 150 { name.removeLast() }
    return name.isEmpty ? "Video" : name
  }
}
public func json<T: Encodable>(_ value: T) throws -> String {
  String(decoding: try JSONEncoder().encode(value), as: UTF8.self)
}
public func decode<T: Decodable>(_ type: T.Type, _ value: String) throws -> T {
  try JSONDecoder().decode(type, from: Data(value.utf8))
}
