import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

class SceneDelegate: RCTDefaultReactNativeFactoryDelegate, UIWindowSceneDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?
  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let scene = scene as? UIWindowScene else { return }
    dependencyProvider = RCTAppDependencyProvider()
    reactNativeFactory = RCTReactNativeFactory(delegate: self)
    window = UIWindow(windowScene: scene)
    reactNativeFactory?.startReactNative(withModuleName: "uTubeMobile", in: window, connectionOptions: connectionOptions)
    for context in connectionOptions.urlContexts { accept(context.url) }
  }
  func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) { for context in contexts { accept(context.url) } }
  func sceneDidBecomeActive(_ scene: UIScene) { DownloadCoordinator.shared.resume() }
  private func accept(_ url: URL) {
    guard url.scheme == "utube", url.host == "download",
          let value = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "url" })?.value,
          value.utf8.count <= 8192 else { return }
    let prefs = UserDefaults(suiteName: Bundle.main.object(forInfoDictionaryKey: "UTubeAppGroup") as? String ?? "")
    prefs?.set(value, forKey: "shared-link")
    DownloadCoordinator.shared.emit?("utubeLink", NSNull())
  }
  override func bundleURL() -> URL? {
    #if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }
}
