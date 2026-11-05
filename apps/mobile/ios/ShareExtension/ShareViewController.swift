import UIKit
import UniformTypeIdentifiers

// Extensions cannot assume that iOS will launch their containing application.
// Save the link in the app group, and let the app consume it on its next activation.
final class ShareViewController: UIViewController {
  private let label = UILabel()
  override func viewDidLoad() {
    super.viewDidLoad(); view.backgroundColor = .systemBackground
    label.text = NSLocalizedString("Saving link…", comment: ""); label.numberOfLines = 0; label.textAlignment = .center
    label.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(label)
    let done = UIButton(type: .system); done.setTitle(NSLocalizedString("Done", comment: ""), for: .normal)
    done.addTarget(self, action: #selector(close), for: .touchUpInside); done.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(done)
    NSLayoutConstraint.activate([label.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24), label.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24), label.centerYAnchor.constraint(equalTo: view.centerYAnchor), done.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 24), done.centerXAnchor.constraint(equalTo: view.centerXAnchor), done.heightAnchor.constraint(greaterThanOrEqualToConstant: 44)])
    let attachments = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
    guard let item = attachments.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.url.identifier) || $0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) }) else { label.text = NSLocalizedString("Share a public video link.", comment: ""); return }
    let type = item.hasItemConformingToTypeIdentifier(UTType.url.identifier) ? UTType.url.identifier : UTType.plainText.identifier
    item.loadItem(forTypeIdentifier: type, options: nil) { [weak self] value, _ in
      let text = (value as? URL)?.absoluteString ?? value as? String ?? ""
      DispatchQueue.main.async { self?.save(text) }
    }
  }
  private func save(_ text: String) {
    guard text.utf8.count <= 8192,
          let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue),
          let url = detector.firstMatch(in: text, range: NSRange(text.startIndex..., in: text))?.url,
          ["https", "http"].contains(url.scheme ?? ""),
          ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "x.com", "www.x.com", "mobile.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com", "m.twitter.com", "instagram.com", "www.instagram.com", "facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "mbasic.facebook.com", "fb.watch"].contains(url.host?.lowercased() ?? ""),
          let group = Bundle.main.object(forInfoDictionaryKey: "UTubeAppGroup") as? String,
          let prefs = UserDefaults(suiteName: group) else { label.text = NSLocalizedString("Share a supported public video link.", comment: ""); return }
    prefs.set(url.absoluteString, forKey: "shared-link")
    label.text = NSLocalizedString("Link saved. Open uTube to choose quality and download.", comment: "")
  }
  @objc private func close() { extensionContext?.completeRequest(returningItems: nil) }
}
