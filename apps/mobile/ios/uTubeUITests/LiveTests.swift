import XCTest
final class LiveTests: XCTestCase {
  func testPublicVideoAndMP3() throws {
    let url = ProcessInfo.processInfo.environment["UTUBE_LIVE_URL"] ?? ""
    try XCTSkipIf(!url.hasPrefix("https://"), "Set UTUBE_LIVE_URL to run a real provider download.")
    let app = XCUIApplication(); app.launch()
    for mode in ["video", "mp3"] {
      let saved = app.buttons.matching(NSPredicate(format: "label ENDSWITH ', Saved'"))
      let failed = app.buttons.matching(NSPredicate(format: "label ENDSWITH ', Download failed'"))
      app.descendants(matching: .any).matching(identifier: "tab-queue").firstMatch.tap()
      let savedBefore = saved.count, failedBefore = failed.count
      app.descendants(matching: .any).matching(identifier: "tab-download").firstMatch.tap()
      let field = app.textFields["YouTube, X, Instagram, or Facebook link"]
      if field.exists {
        field.tap(); field.typeText(url + "\n")
      }
      let add = app.buttons["Add to downloads"]
      XCTAssertTrue(add.waitForExistence(timeout: 90), app.debugDescription)
      if mode == "mp3" {
        let audio = app.descendants(matching: .any).matching(identifier: "mode-mp3").firstMatch
        if !audio.isHittable { app.swipeUp() }; audio.tap()
      }
      if !add.isHittable { app.swipeUp() }; add.tap()
      // Queue cards expose their terminal state through the accessibility label.
      let finished = NSPredicate { _, _ in saved.count > savedBefore || failed.count > failedBefore }
      expectation(for: finished, evaluatedWith: nil)
      waitForExpectations(timeout: 180)
      XCTAssertGreaterThan(saved.count, savedBefore, app.debugDescription)
      if mode == "video" { app.descendants(matching: .any).matching(identifier: "tab-download").firstMatch.tap() }
    }
  }
}
