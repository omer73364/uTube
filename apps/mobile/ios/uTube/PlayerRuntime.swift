import Foundation
import WebKit
import UTubeKit

@MainActor final class PlayerRuntime: NSObject, WKNavigationDelegate {
  private struct Pending {
    let webView: WKWebView
    let script: String
    let completion: (Result<String, Error>) -> Void
    var timeout: Task<Void, Never>?
  }
  private var pending: [ObjectIdentifier: Pending] = [:]
  func evaluate(_ script: String, completion: @escaping (Result<String, Error>) -> Void) {
    guard script.utf8.count <= 1_048_576, pending.count < 4 else { completion(.failure(Failure("PLAYER_SCRIPT_LIMIT"))); return }
    let config = WKWebViewConfiguration()
    config.websiteDataStore = .nonPersistent()
    config.preferences.javaScriptCanOpenWindowsAutomatically = false
    let view = WKWebView(frame: .zero, configuration: config)
    view.navigationDelegate = self
    let id = ObjectIdentifier(view)
    pending[id] = Pending(webView: view, script: script, completion: completion)
    pending[id]?.timeout = Task { [weak self] in
      try? await Task.sleep(nanoseconds: 15_000_000_000)
      guard !Task.isCancelled else { return }
      self?.finish(id, .failure(Failure("PLAYER_TIMEOUT")))
    }
    view.loadHTMLString("<!doctype html><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-eval' 'unsafe-inline'; connect-src 'none'; frame-src 'none'; img-src 'none'; media-src 'none'; base-uri 'none'; form-action 'none'\">", baseURL: nil)
  }
  func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    decisionHandler(navigationAction.request.url?.absoluteString == "about:blank" ? .allow : .cancel)
  }
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    let id = ObjectIdentifier(webView)
    guard let item = pending[id], let quoted = try? json(item.script) else { return }
    webView.evaluateJavaScript("JSON.stringify((new Function(\(quoted)))())") { [weak self] value, error in
      do {
        if let error { throw error }
        guard let text = value as? String, text.utf8.count <= 32768,
              let dictionary = try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any],
              dictionary.allSatisfy({ ["sig", "n"].contains($0.key) && ($0.value as? String).map { $0.count <= 8192 } == true }) else { throw Failure("INVALID_PLAYER_RESULT") }
        self?.finish(id, .success(text))
      } catch { self?.finish(id, .failure(Failure("PLAYER_SCRIPT_FAILED"))) }
    }
  }
  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { finish(ObjectIdentifier(webView), .failure(Failure("PLAYER_PROCESS_STOPPED"))) }
  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { finish(ObjectIdentifier(webView), .failure(error)) }
  private func finish(_ id: ObjectIdentifier, _ result: Result<String, Error>) {
    guard let item = pending.removeValue(forKey: id) else { return }
    item.timeout?.cancel(); item.webView.stopLoading(); item.webView.navigationDelegate = nil
    item.completion(result)
  }
}
