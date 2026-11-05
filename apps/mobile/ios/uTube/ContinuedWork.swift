import BackgroundTasks
import UIKit

// iOS 26+ grants CPU/network time for a visible, user-initiated download.
// Older systems and rejected requests use UIKit's finite background allowance.
@MainActor final class ContinuedWork {
  private let identifier = "io.github.omer73364.utube.mobile.downloads.queue"
  private var task: BGTask?
  private var requested = false
  private var running = false
  var expired: (() -> Void)?
  var active: Bool { task != nil }
  init() {
    if #available(iOS 26.0, *) {
      BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: .main) { [weak self] task in
        MainActor.assumeIsolated {
          guard let self, self.running, let continued = task as? BGContinuedProcessingTask else { task.setTaskCompleted(success: false); return }
          self.task = continued; continued.progress.totalUnitCount = 1000
          continued.expirationHandler = { [weak self] in
            Task { @MainActor in self?.complete(false); self?.expired?() }
          }
        }
      }
    }
  }
  func start(_ title: String) {
    running = true
    guard !requested, UIApplication.shared.applicationState == .active else { return }
    if #available(iOS 26.0, *) {
      let arabic = UserDefaults.standard.string(forKey: "language") == "ar"
      let request = BGContinuedProcessingTaskRequest(identifier: identifier, title: arabic ? "تنزيل uTube" : "uTube download", subtitle: title)
      request.strategy = .fail
      do { try BGTaskScheduler.shared.submit(request); requested = true } catch { requested = false }
    }
  }
  func update(_ fraction: Double) {
    if #available(iOS 26.0, *), let task = task as? BGContinuedProcessingTask {
      task.progress.completedUnitCount = max(task.progress.completedUnitCount, Int64(min(1, max(0, fraction)) * 1000))
    }
  }
  func complete(_ success: Bool) {
    running = false
    if #available(iOS 26.0, *) {
      task?.setTaskCompleted(success: success); task = nil
      if requested { BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: identifier) }
    }
    requested = false
  }
}
