import Darwin
import Foundation

let repositoryRoot = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let launcher = repositoryRoot.appendingPathComponent("Scripts/run-gem-life.sh")

guard FileManager.default.isExecutableFile(atPath: launcher.path) else {
    fputs("Gem Life launcher not found. Run this command from the GemsForgeAPI repository root.\n", stderr)
    exit(EXIT_FAILURE)
}

let process = Process()
process.executableURL = URL(fileURLWithPath: "/bin/bash")
process.arguments = [launcher.path]
process.environment = ProcessInfo.processInfo.environment

do {
    try process.run()
    process.waitUntilExit()
    exit(process.terminationStatus)
} catch {
    fputs("Unable to start Gem Life: \(error.localizedDescription)\n", stderr)
    exit(EXIT_FAILURE)
}
