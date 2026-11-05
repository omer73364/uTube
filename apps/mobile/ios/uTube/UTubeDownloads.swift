import Foundation
import UIKit
import CryptoKit
import React
import UTubeKit

@objc(UTubeDownloads) final class UTubeDownloads: RCTEventEmitter, UIDocumentInteractionControllerDelegate {
  private let metadata = MetadataHTTP()
  @MainActor private lazy var player = PlayerRuntime()
  private var preview: UIDocumentInteractionController?
  override static func requiresMainQueueSetup() -> Bool { true }
  override func supportedEvents() -> [String]! { ["utubePrepare", "utubeCancelPreparation", "utubeLink"] }
  override init() {
    super.init()
    Task { @MainActor [weak self] in
      DownloadCoordinator.shared.emit = { [weak self] event, body in self?.sendEvent(withName: event, body: body) }
    }
  }
  deinit { metadata.close() }
  private func perform(_ resolve: @escaping RCTPromiseResolveBlock, _ reject: @escaping RCTPromiseRejectBlock,
                       _ action: @escaping @MainActor () throws -> Any?) {
    Task { @MainActor in
      do { resolve(try action()) } catch { reject("UTUBE_ERROR", error.localizedDescription, error) }
    }
  }
  @objc func http(_ id: String, url: String, method: String, headers: [String: String], body: String?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    metadata.request(id: id, url: url, method: method, headers: headers, body: body) { result in
      switch result { case .success(let value): resolve(value); case .failure(let error): reject("METADATA_REQUEST", error.localizedDescription, error) }
    }
  }
  @objc func cancelHttp(_ id: String) { metadata.cancel(id) }
  @objc func sha1(_ input: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(Insecure.SHA1.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined())
  }
  @objc func evaluate(_ script: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task { @MainActor in player.evaluate(script) { result in
      switch result { case .success(let value): resolve(value); case .failure(let error): reject("PLAYER_SCRIPT_FAILED", error.localizedDescription, error) }
    } }
  }
  @objc func enqueue(_ input: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    perform(resolve, reject) {
      guard input.utf8.count <= 2_097_152 else { throw Failure("QUEUE_FULL") }
      return try json(DownloadCoordinator.shared.enqueue(decode([DownloadRequest].self, input)))
    }
  }
  @objc func prepared(_ id: String, plan: String?, error: String?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    perform(resolve, reject) {
      do {
        guard (plan?.utf8.count ?? 0) <= 2_097_152 else { throw Failure("INVALID_PLAN") }
        let value = try plan.map { try decode(DownloadPlan.self, $0) }
        DownloadCoordinator.shared.finishPreparation(id, plan: value, error: error); return nil
      } catch { DownloadCoordinator.shared.finishPreparation(id, plan: nil, error: "INVALID_PLAN"); throw error }
    }
  }
  @objc func list(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task { @MainActor in
      do { resolve(try await DownloadCoordinator.shared.snapshot()) }
      catch { reject("HISTORY_READ", error.localizedDescription, error) }
    }
  }
  @objc func resume(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    perform(resolve, reject) { DownloadCoordinator.shared.resume(); return nil }
  }
  @objc func cancel(_ id: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    perform(resolve, reject) { try DownloadCoordinator.shared.cancel(id); return nil }
  }
  @objc func cancelAll(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    perform(resolve, reject) {
      for job in try DownloadCoordinator.shared.list() where Policy.active.contains(job.status) || job.status == "interrupted" { try DownloadCoordinator.shared.cancel(job.id) }; return nil
    }
  }
  @objc func clearFinished(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    perform(resolve, reject) { try DownloadCoordinator.shared.clearFinished(); return nil }
  }
  @objc func remove(_ id: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    perform(resolve, reject) { try DownloadCoordinator.shared.store.remove(id); return nil }
  }
  @MainActor private func host() throws -> UIViewController {
    guard let root = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).flatMap(\.windows).first(where: \.isKeyWindow)?.rootViewController else { throw Failure("NO_WINDOW") }
    var top = root; while let next = top.presentedViewController { top = next }; return top
  }
  @objc func open(_ id: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    perform(resolve, reject) {
      _ = try self.host()
      let controller = UIDocumentInteractionController(url: try DownloadCoordinator.shared.file(id))
      controller.delegate = self; self.preview = controller
      guard controller.presentPreview(animated: true) else { throw Failure("PREVIEW_UNAVAILABLE") }; return nil
    }
  }
  func documentInteractionControllerViewControllerForPreview(_ controller: UIDocumentInteractionController) -> UIViewController {
    MainActor.assumeIsolated { (try? host()) ?? UIViewController() }
  }
  @objc func share(_ id: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    perform(resolve, reject) {
      let host = try self.host(), file = try DownloadCoordinator.shared.file(id)
      let controller = UIActivityViewController(activityItems: [file], applicationActivities: nil)
      controller.popoverPresentationController?.sourceView = host.view
      controller.popoverPresentationController?.sourceRect = CGRect(x: host.view.bounds.midX, y: host.view.bounds.midY, width: 1, height: 1)
      host.present(controller, animated: true); return nil
    }
  }
  @objc func settings(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let prefs = UserDefaults.standard
    resolve(["language": prefs.string(forKey: "language") ?? "en", "theme": prefs.string(forKey: "theme") ?? "system"])
  }
  @objc func saveSettings(_ language: String, theme: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    guard ["en", "ar"].contains(language), ["light", "dark", "system"].contains(theme) else { reject("SETTINGS_SAVE", "Invalid settings", nil); return }
    UserDefaults.standard.set(language, forKey: "language"); UserDefaults.standard.set(theme, forKey: "theme"); resolve(nil)
  }
  @objc func consumeSharedLink(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let prefs = UserDefaults(suiteName: Bundle.main.object(forInfoDictionaryKey: "UTubeAppGroup") as? String ?? "")
    let value = prefs?.string(forKey: "shared-link"); prefs?.removeObject(forKey: "shared-link"); resolve(value)
  }
  @objc func closeShare() {}
  @objc func licenses(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve((Bundle.main.url(forResource: "ThirdPartyNotices", withExtension: "txt").flatMap { try? String(contentsOf: $0, encoding: .utf8) }) ?? "uTube · MIT\nLAME 3.100 · LGPL-3.0\nhttps://github.com/Phisto/swift-lame")
  }
  // iOS uses signed Apple distribution; the Android APK updater is never exposed.
  @objc func updates(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    perform(resolve, reject) { try ServiceCenter.shared.snapshot() }
  }
  @objc func checkUpdates(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task { @MainActor in
      do { resolve(try await ServiceCenter.shared.check()); DownloadCoordinator.shared.resume() }
      catch { reject("STATUS_CHECK", error.localizedDescription, error) }
    }
  }
  @objc func downloadUpdate(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) { reject("APPLE_DISTRIBUTION", "Updates are delivered through Apple distribution.", nil) }
  @objc func cancelUpdate(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) { resolve(nil) }
  @objc func installUpdate(_ interrupt: Bool, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) { downloadUpdate(resolve, rejecter: reject) }
  @objc func assertService(_ id: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    perform(resolve, reject) { try ServiceCenter.shared.assertAvailable(id); return nil }
  }
}
