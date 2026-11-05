import Foundation
import UIKit
import UTubeKit

@MainActor final class DownloadCoordinator {
  static let shared = DownloadCoordinator()
  let store: JobStore
  let documents: URL
  let working: URL
  var emit: ((String, Any) -> Void)?
  private let continued = ContinuedWork()
  private var runner: Task<Void, Never>?
  private var token: Cancellation?
  private var current: String?
  private var preparationId: String?
  private var waiter: CheckedContinuation<DownloadPlan, Error>?
  private var preparationTimer: Task<Void, Never>?
  private var background: UIBackgroundTaskIdentifier = .invalid
  private var batchCompleted = 0
  private var batchTotal = 1
  private var progress: (id: String, loaded: Int64, total: Int64, fraction: Double)?
  private var initializationError: Error?

  private init() {
    let files = FileManager.default
    documents = files.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("uTube", isDirectory: true)
    let support = files.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("uTube", isDirectory: true)
    working = support.appendingPathComponent("Transfers", isDirectory: true)
    // A persistent-store failure must not silently replace the user's library.
    do {
      try files.createDirectory(at: support, withIntermediateDirectories: true)
      store = try JobStore(url: support.appendingPathComponent("downloads.sqlite"), filesDirectory: documents)
    } catch { fatalError("Unable to open uTube history: \(error)") }
    do {
      try store.recover()
      try? files.removeItem(at: working)
      try files.createDirectory(at: working, withIntermediateDirectories: true)
      try files.createDirectory(at: documents, withIntermediateDirectories: true)
      var excluded = working; var values = URLResourceValues(); values.isExcludedFromBackup = true
      try excluded.setResourceValues(values)
    } catch { initializationError = error }
  }
  func list() throws -> [Job] {
    if let initializationError { throw initializationError }
    return try store.all().reversed().map { record in
      var job = record
      if job.status == "queued", ServiceCenter.shared.blocked(job.videoId) { job.holdReason = "service" }
      if job.status == "saved", let path = job.filePath, !FileManager.default.fileExists(atPath: (try? Policy.savedFile(path, directory: documents).path) ?? "") { job.status = "missing" }
      if let progress, progress.id == job.id { job.loaded = progress.loaded; job.total = progress.total; job.fraction = progress.fraction }
      job.filePath = nil
      return job
    }
  }
  func snapshot() async throws -> String {
    if let initializationError { throw initializationError }
    let database = store, currentProgress = progress, directory = documents
    let blocked = Set(ServiceCenter.shared.rules.filter { ["unavailable", "retired"].contains($0.state) }.map(\.provider))
    return try await Task.detached(priority: .utility) {
      let jobs = try database.all().reversed().map { record in
        var job = record
        if job.status == "queued", blocked.contains(Policy.provider(job.videoId)) { job.holdReason = "service" }
        if job.status == "saved", let path = job.filePath, !FileManager.default.fileExists(atPath: (try? Policy.savedFile(path, directory: directory).path) ?? "") { job.status = "missing" }
        if let value = currentProgress, value.id == job.id, Policy.active.contains(job.status) {
          job.loaded = value.loaded; job.total = value.total; job.fraction = value.fraction
        }
        job.filePath = nil; return job
      }
      return try json(jobs)
    }.value
  }
  func enqueue(_ requests: [DownloadRequest]) throws -> [String] {
    if let initializationError { throw initializationError }
    guard !requests.contains(where: { $0.retryId != nil && $0.retryId == current }) else { throw Failure("DOWNLOAD_BUSY") }
    for request in requests { try ServiceCenter.shared.assertAvailable(request.videoId) }
    let ids = try store.enqueue(requests); resume(); return ids
  }
  func resume() {
    guard runner == nil, emit != nil, UIApplication.shared.applicationState == .active, initializationError == nil else { return }
    runner = Task { [weak self] in
      guard let self else { return }
      var stopped = false, successful = true
      var hadJobs = false
      defer {
        continued.complete(successful && !stopped); runner = nil
        if hadJobs && !stopped { resume() }
      }
      do {
        let jobs = try store.all().filter { $0.status == "queued" && !ServiceCenter.shared.blocked($0.videoId) }
        guard let first = jobs.first else { return }; hadJobs = true
        continued.expired = { [weak self] in stopped = true; self?.interrupt() }
        continued.start(first.title)
        for (index, initial) in jobs.enumerated() {
          guard !stopped, UIApplication.shared.applicationState == .active || continued.active else { break }
          guard let job = try? store.get(initial.id), job.status == "queued", !ServiceCenter.shared.blocked(job.videoId) else { continue }
          batchCompleted = index; batchTotal = jobs.count
          await run(job)
          if (try? store.get(job.id).status) != "saved" { successful = false }
          continued.update(Double(index + 1) / Double(jobs.count))
        }
      } catch { initializationError = error }
    }
  }

  private func phase(_ id: String, _ status: String, error: String? = nil) throws {
    var job = try store.get(id); job.status = status; job.error = error; try store.put(job)
  }
  private func run(_ original: Job) async {
    let id = original.id, cancellation = Cancellation()
    current = id; token = cancellation; progress = (id, 0, 0, 0)
    background = UIApplication.shared.beginBackgroundTask(withName: "uTube download") { [weak self] in
      Task { @MainActor in
        guard let self else { return }
        if !self.continued.active { self.interrupt() }
        if self.background != .invalid { UIApplication.shared.endBackgroundTask(self.background); self.background = .invalid }
      }
    }
    let directory = working.appendingPathComponent(id, isDirectory: true)
    defer {
      try? FileManager.default.removeItem(at: directory)
      preparationTimer?.cancel(); preparationTimer = nil
      current = nil; token = nil; progress = nil
      if background != .invalid { UIApplication.shared.endBackgroundTask(background); background = .invalid }
    }
    do {
      try phase(id, "preparing")
      let plan: DownloadPlan = try await withCheckedThrowingContinuation { continuation in
        waiter = continuation
        let attempt = UUID().uuidString; preparationId = attempt
        preparationTimer = Task { [weak self] in
          try? await Task.sleep(nanoseconds: 90_000_000_000)
          guard !Task.isCancelled else { return }
          self?.finishPreparation(attempt, plan: nil, error: "PREPARATION_TIMEOUT")
        }
        // Never persist expiring signed stream URLs. Resolve just before transfer.
        var payload = original; payload.id = attempt
        emit?("utubePrepare", ["request": (try? json(payload)) ?? "{}"])
      }
      try cancellation.check(); try Policy.validate(plan, job: original)
      var last: Error = Failure("NO_FORMATS")
      for candidate in plan.candidates {
        try cancellation.check()
        try? FileManager.default.removeItem(at: directory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        do {
          try phase(id, "running")
          let streams = [candidate.video, candidate.audio].compactMap { $0 }
          var video: URL?, audio: URL?
          for (index, stream) in streams.enumerated() {
            let path = Transfer.stagingFile(in: directory, index: index)
            let transfer = Transfer(videoId: original.videoId, destination: path, token: cancellation) { [weak self] loaded, total in
              Task { @MainActor in
                guard let self, self.current == id else { return }
                let part = total > 0 ? min(1, Double(loaded) / Double(total)) : 0
                let fraction = (Double(index) + part) / Double(streams.count) * 0.9
                self.progress = (id, loaded, max(0, total), max(self.progress?.fraction ?? 0, fraction))
                self.continued.update((Double(self.batchCompleted) + (self.progress?.fraction ?? 0)) / Double(self.batchTotal))
              }
            }
            let result = try await transfer.run(stream)
            if index == 0 && candidate.video != nil { video = result } else { audio = result }
          }
          try cancellation.check()
          try phase(id, original.mode == "mp3" ? "converting" : "merging")
          let output = directory.appendingPathComponent(original.mode == "mp3" ? "output.mp3" : "output.mp4")
          try await MediaProcessor.process(video: video, audio: audio, output: output, mode: original.mode, title: original.title, cancellation: cancellation)
          try cancellation.check(); try phase(id, "publishing")
          var folder = documents
          if let playlist = original.playlistTitle, !playlist.isEmpty { folder.appendPathComponent(Policy.safeName(playlist), isDirectory: true) }
          try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
          let prefix = original.playlistTitle?.isEmpty == false ? String(format: "%03d - ", original.playlistIndex ?? 1) : ""
          let name = prefix + Policy.safeName(original.title) + " - " + id + (original.mode == "mp3" ? ".mp3" : ".mp4")
          let destination = folder.appendingPathComponent(name)
          try FileManager.default.moveItem(at: output, to: destination)
          do {
            var job = try store.get(id); job.status = "saved"; job.filePath = String(destination.path.dropFirst(documents.path.count + 1))
            job.quality = candidate.quality; job.fraction = 1; job.error = nil
            job.downgraded = !["best", "Best available", "MP3", candidate.quality].contains(original.requestedQuality)
            try store.put(job)
          } catch { try? FileManager.default.removeItem(at: destination); throw error }
          return
        } catch { try cancellation.check(); last = error }
      }
      throw last
    } catch {
      let status = (try? store.get(id).status) ?? "failed"
      if !["cancelled", "interrupted"].contains(status) {
        try? phase(id, "failed", error: String(error.localizedDescription.prefix(180)))
      }
    }
  }
  func finishPreparation(_ id: String, plan: DownloadPlan?, error: String?) {
    guard preparationId == id, let continuation = waiter else { return }
    waiter = nil; preparationId = nil; preparationTimer?.cancel(); preparationTimer = nil
    if let plan { continuation.resume(returning: plan) }
    else { continuation.resume(throwing: Failure(error ?? "PREPARATION_FAILED")) }
  }
  private func interrupt() {
    guard let current else { return }
    token?.cancel()
    let attempt = preparationId ?? current; emit?("utubeCancelPreparation", attempt)
    finishPreparation(attempt, plan: nil, error: "BACKGROUND_INTERRUPTED")
    try? phase(current, "interrupted", error: "BACKGROUND_INTERRUPTED")
    if background != .invalid { UIApplication.shared.endBackgroundTask(background); background = .invalid }
  }
  func cancel(_ id: String) throws {
    let job = try store.get(id)
    guard Policy.active.contains(job.status) || job.status == "interrupted" else { throw Failure("DOWNLOAD_NOT_ACTIVE") }
    try phase(id, "cancelled")
    if current == id {
      token?.cancel()
      let attempt = preparationId ?? id; emit?("utubeCancelPreparation", attempt)
      finishPreparation(attempt, plan: nil, error: "CANCELLED")
    }
  }
  func clearFinished() throws {
    for job in try list() where ["saved", "missing", "failed", "cancelled"].contains(job.status) { try store.remove(job.id) }
  }
  func file(_ id: String) throws -> URL {
    let job = try store.get(id)
    guard job.status == "saved", let path = job.filePath else { throw Failure("FILE_MISSING") }
    let file = try Policy.savedFile(path, directory: documents)
    guard FileManager.default.fileExists(atPath: file.path) else { throw Failure("FILE_MISSING") }
    return file
  }
}
