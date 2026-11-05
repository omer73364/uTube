// swift-tools-version: 6.1
import PackageDescription
let package = Package(
  name: "UTubeKit", platforms: [.iOS(.v16), .macOS(.v13)],
  products: [.library(name: "UTubeKit", targets: ["UTubeKit"])],
  dependencies: [.package(url: "https://github.com/Phisto/swift-lame.git", revision: "727f4ad56195e062560e71468eeb6bd244b9167d")],
  targets: [
    .systemLibrary(name: "CSQLite"),
    .target(name: "UTubeKit", dependencies: ["CSQLite", .product(name: "lame", package: "swift-lame")]),
    .testTarget(name: "UTubeKitTests", dependencies: ["UTubeKit"], resources: [.copy("Fixtures")])
  ], swiftLanguageModes: [.v5])
