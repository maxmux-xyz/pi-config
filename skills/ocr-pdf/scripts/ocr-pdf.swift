#!/usr/bin/env swift

// OCR for scanned PDFs using macOS Vision framework.
// Usage: ocr-pdf.swift <input.pdf> [--lang fr,en] [--out output.txt]
// Requires: pdfimages (from poppler, `brew install poppler`)

import Vision
import Foundation
import CoreGraphics
import ImageIO

func ocrImage(at path: String, languages: [String]) -> String {
    let url = URL(fileURLWithPath: path)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        fputs("Error: cannot load image \(path)\n", stderr)
        return ""
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLanguages = languages
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    do {
        try handler.perform([request])
    } catch {
        fputs("Error: OCR failed on \(path): \(error)\n", stderr)
        return ""
    }

    guard let results = request.results else { return "" }
    return results.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
}

// Parse args
var pdfPath: String?
var languages = ["fr", "en"]
var outputPath: String?
var i = 1
while i < CommandLine.arguments.count {
    let arg = CommandLine.arguments[i]
    if arg == "--lang", i + 1 < CommandLine.arguments.count {
        i += 1
        languages = CommandLine.arguments[i].split(separator: ",").map(String.init)
    } else if arg == "--out", i + 1 < CommandLine.arguments.count {
        i += 1
        outputPath = CommandLine.arguments[i]
    } else if arg.hasPrefix("-") {
        fputs("Unknown option: \(arg)\n", stderr)
        exit(1)
    } else {
        pdfPath = arg
    }
    i += 1
}

guard let pdf = pdfPath else {
    fputs("Usage: ocr-pdf.swift <input.pdf> [--lang fr,en] [--out output.txt]\n", stderr)
    exit(1)
}

// Create temp dir for extracted images
let tmpDir = FileManager.default.temporaryDirectory.appendingPathComponent("ocr-\(UUID().uuidString)")
try FileManager.default.createDirectory(at: tmpDir, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: tmpDir) }

// Extract images with pdfimages
let extract = Process()
extract.executableURL = URL(fileURLWithPath: "/usr/bin/env")
extract.arguments = ["pdfimages", "-png", pdf, tmpDir.appendingPathComponent("page").path]
try extract.run()
extract.waitUntilExit()
guard extract.terminationStatus == 0 else {
    fputs("Error: pdfimages failed. Install with: brew install poppler\n", stderr)
    exit(1)
}

// Find and sort extracted images
let files = try FileManager.default.contentsOfDirectory(at: tmpDir, includingPropertiesForKeys: nil)
    .filter { $0.pathExtension == "png" }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }

if files.isEmpty {
    fputs("Error: no images extracted from PDF\n", stderr)
    exit(1)
}

// OCR each page
var output = ""
for (idx, file) in files.enumerated() {
    let pageNum = idx + 1
    let header = "--- Page \(pageNum) ---"
    let text = ocrImage(at: file.path, languages: languages)
    output += header + "\n" + text + "\n\n"
}

// Output
if let outPath = outputPath {
    try output.write(toFile: outPath, atomically: true, encoding: .utf8)
    fputs("Written to \(outPath)\n", stderr)
} else {
    print(output)
}
