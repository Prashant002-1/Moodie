// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MoodieCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "MoodieCore", targets: ["MoodieCore"])],
    targets: [
        .target(name: "MoodieCore"),
        .testTarget(name: "MoodieCoreTests", dependencies: ["MoodieCore"])
    ]
)
