import XCTest
final class SmokeTests: XCTestCase {
  func testReleaseStartsWithoutMetroAndNavigates() {
    let app = XCUIApplication(); app.launch()
    let field = app.textFields["YouTube, X, Instagram, or Facebook link"]
    XCTAssertTrue(field.waitForExistence(timeout: 30), app.debugDescription)
    let settings = app.buttons["Settings"]
    XCTAssertTrue(settings.exists); settings.tap()
    XCTAssertTrue(app.staticTexts["Download folder"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts["Files / On My iPhone / uTube"].exists)
    XCTAssertFalse(app.buttons["Check for updates"].exists)
    app.buttons["Back"].tap()
    XCTAssertTrue(field.waitForExistence(timeout: 5))
    app.terminate(); app.launch()
    XCTAssertTrue(field.waitForExistence(timeout: 15))
  }
}
