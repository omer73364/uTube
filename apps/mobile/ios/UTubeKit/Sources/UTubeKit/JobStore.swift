import Foundation
import CSQLite

// One connection, serialized access, WAL transactions. Progress stays in memory;
// durable writes happen at phase boundaries, never once per network packet.
public final class JobStore: @unchecked Sendable {
  private var db: OpaquePointer?
  private let lock = NSRecursiveLock()
  private let filesDirectory: URL?
  private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
  public init(url: URL, filesDirectory: URL? = nil) throws {
    self.filesDirectory = filesDirectory
    guard sqlite3_open(url.path, &db) == SQLITE_OK else { throw Failure("HISTORY_OPEN") }
    try execute("PRAGMA journal_mode=WAL")
    try execute("CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL, created REAL NOT NULL)")
    try execute("CREATE INDEX IF NOT EXISTS queue_status ON jobs(status,created)")
  }
  deinit { sqlite3_close(db) }
  private func execute(_ sql: String) throws {
    guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else { throw Failure("HISTORY_WRITE") }
  }
  public func all() throws -> [Job] {
    lock.lock(); defer { lock.unlock() }
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, "SELECT payload FROM jobs ORDER BY created,rowid", -1, &statement, nil) == SQLITE_OK else { throw Failure("HISTORY_READ") }
    defer { sqlite3_finalize(statement) }
    var result: [Job] = []
    var step = sqlite3_step(statement)
    while step == SQLITE_ROW {
      result.append(try decode(Job.self, String(cString: sqlite3_column_text(statement, 0))))
      step = sqlite3_step(statement)
    }
    guard step == SQLITE_DONE else { throw Failure("HISTORY_READ") }
    return result
  }
  public func get(_ id: String) throws -> Job {
    lock.lock(); defer { lock.unlock() }
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, "SELECT payload FROM jobs WHERE id=?", -1, &statement, nil) == SQLITE_OK else { throw Failure("HISTORY_READ") }
    defer { sqlite3_finalize(statement) }
    sqlite3_bind_text(statement, 1, id, -1, transient)
    guard sqlite3_step(statement) == SQLITE_ROW else { throw Failure("UNKNOWN_DOWNLOAD") }
    return try decode(Job.self, String(cString: sqlite3_column_text(statement, 0)))
  }
  public func put(_ job: Job) throws {
    lock.lock(); defer { lock.unlock() }
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, "INSERT INTO jobs VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,status=excluded.status,created=excluded.created", -1, &statement, nil) == SQLITE_OK else { throw Failure("HISTORY_WRITE") }
    defer { sqlite3_finalize(statement) }
    sqlite3_bind_text(statement, 1, job.id, -1, transient)
    sqlite3_bind_text(statement, 2, try json(job), -1, transient)
    sqlite3_bind_text(statement, 3, job.status, -1, transient)
    sqlite3_bind_double(statement, 4, job.createdAt)
    guard sqlite3_step(statement) == SQLITE_DONE else { throw Failure("HISTORY_WRITE") }
  }
  private func exists(_ path: String) -> Bool {
    let resolved = filesDirectory.flatMap { try? Policy.savedFile(path, directory: $0).path } ?? (filesDirectory == nil ? path : "")
    return FileManager.default.fileExists(atPath: resolved)
  }
  public func enqueue(_ requests: [DownloadRequest]) throws -> [String] {
    lock.lock(); defer { lock.unlock() }
    guard (1...1000).contains(requests.count) else { throw Failure("QUEUE_FULL") }
    // Validate every request before changing any records, including repeated retry IDs.
    var retries = Set<String>()
    for request in requests {
      try Policy.validate(request)
      if let id = request.retryId {
        let old = try get(id)
        guard retries.insert(id).inserted, !Policy.active.contains(old.status), (old.status != "saved" || old.filePath.map { !self.exists($0) } == true),
              old.videoId == request.videoId, old.mode == request.mode else { throw Failure("DOWNLOAD_BUSY") }
      }
    }
    try execute("BEGIN IMMEDIATE")
    do {
      var jobs = try all(), ids: [String] = []
      var active = jobs.filter { Policy.active.contains($0.status) }.count
      for request in requests {
        let quality = request.mode == "mp3" ? "MP3" : request.requestedQuality
        if request.retryId == nil, let old = jobs.first(where: {
          Policy.active.contains($0.status) && $0.videoId == request.videoId && $0.mode == request.mode &&
            $0.requestedQuality == quality && ($0.playlistTitle ?? "") == (request.playlistTitle ?? "")
        }) { ids.append(old.id); continue }
        guard active < 1000 else { throw Failure("QUEUE_FULL") }; active += 1
        let id = request.retryId ?? UUID().uuidString
        let job = Job(id: id, videoId: request.videoId, thumbnail: request.thumbnail, title: request.title,
                      mode: request.mode, requestedQuality: quality, quality: quality,
                      playlistTitle: request.playlistTitle, playlistIndex: request.playlistIndex,
                      createdAt: Date().timeIntervalSince1970 * 1000, status: "queued")
        try put(job)
        jobs.removeAll { $0.id == id }; jobs.append(job); ids.append(id)
      }
      try execute("COMMIT"); return ids
    } catch { try? execute("ROLLBACK"); throw error }
  }
  public func recover() throws {
    for var job in try all() where Policy.active.contains(job.status) && job.status != "queued" {
      job.status = "interrupted"; job.error = "PROCESS_INTERRUPTED"; try put(job)
    }
  }
  public func remove(_ id: String) throws {
    lock.lock(); defer { lock.unlock() }
    guard !Policy.active.contains(try get(id).status) else { throw Failure("DOWNLOAD_BUSY") }
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, "DELETE FROM jobs WHERE id=?", -1, &statement, nil) == SQLITE_OK else { throw Failure("HISTORY_WRITE") }
    defer { sqlite3_finalize(statement) }
    sqlite3_bind_text(statement, 1, id, -1, transient)
    guard sqlite3_step(statement) == SQLITE_DONE else { throw Failure("HISTORY_WRITE") }
  }
}
