import Foundation
import AVFoundation
import lame

public final class Cancellation: @unchecked Sendable {
  private let lock = NSLock()
  private var value = false
  public init() {}
  public var cancelled: Bool { lock.lock(); defer { lock.unlock() }; return value }
  public func cancel() { lock.lock(); value = true; lock.unlock() }
  public func check() throws { if cancelled { throw Failure("CANCELLED") } }
}
public enum MediaProcessor {
  public static func process(video: URL?, audio: URL?, output: URL, mode: String, title: String,
                             cancellation: Cancellation) async throws {
    try cancellation.check()
    do {
      if mode == "mp3" {
        guard let input = audio ?? video else { throw Failure("NO_AUDIO") }
        try await Task.detached(priority: .utility) { try encodeMP3(input, output, cancellation) }.value
      } else {
        guard let video else { throw Failure("NO_VIDEO") }
        let source = AVURLAsset(url: video), composition = AVMutableComposition()
        guard let sourceVideo = try await source.loadTracks(withMediaType: .video).first,
              let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw Failure("NO_VIDEO") }
        let videoDuration = try await source.load(.duration)
        try videoTrack.insertTimeRange(CMTimeRange(start: .zero, duration: videoDuration), of: sourceVideo, at: .zero)
        videoTrack.preferredTransform = try await sourceVideo.load(.preferredTransform)
        let sound = audio.map { AVURLAsset(url: $0) } ?? source
        guard let sourceAudio = try await sound.loadTracks(withMediaType: .audio).first,
              let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw Failure("NO_AUDIO") }
        let audioDuration = try await sound.load(.duration)
        try audioTrack.insertTimeRange(CMTimeRange(start: .zero, duration: CMTimeMinimum(videoDuration, audioDuration)), of: sourceAudio, at: .zero)
        guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough) else { throw Failure("UNSUPPORTED_MEDIA") }
        exporter.shouldOptimizeForNetworkUse = true
        let metadata = AVMutableMetadataItem(); metadata.identifier = .commonIdentifierTitle; metadata.value = title as NSString
        exporter.metadata = [metadata]
        let monitor = Task {
          while !Task.isCancelled {
            if cancellation.cancelled { exporter.cancelExport(); return }
            try? await Task.sleep(nanoseconds: 100_000_000)
          }
        }
        defer { monitor.cancel() }
        exporter.outputURL = output; exporter.outputFileType = .mp4
        await exporter.export()
        guard exporter.status == .completed else { throw exporter.error ?? Failure("MEDIA_PROCESSING_FAILED") }
      }
      try cancellation.check()
      let bytes = try output.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
      guard bytes > 0 else { throw Failure("EMPTY_OUTPUT") }
    } catch { try? FileManager.default.removeItem(at: output); throw error }
  }
  private static func encodeMP3(_ input: URL, _ output: URL, _ token: Cancellation) throws {
    let asset = AVURLAsset(url: input)
    // Reader APIs are synchronous here, confined to a utility worker.
    guard let track = asset.tracks(withMediaType: .audio).first else { throw Failure("NO_AUDIO") }
    let reader = try AVAssetReader(asset: asset)
    let pcm = AVAssetReaderTrackOutput(track: track, outputSettings: [
      AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 44100, AVNumberOfChannelsKey: 2,
      AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false,
      AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false])
    pcm.alwaysCopiesSampleData = false
    guard reader.canAdd(pcm) else { throw Failure("UNSUPPORTED_AUDIO") }; reader.add(pcm)
    guard let encoder = lame_init() else { throw Failure("MP3_ENCODER") }
    defer { lame_close(encoder); reader.cancelReading() }
    lame_set_in_samplerate(encoder, 44100); lame_set_num_channels(encoder, 2)
    lame_set_brate(encoder, 192); lame_set_quality(encoder, 2)
    guard lame_init_params(encoder) >= 0, reader.startReading() else { throw Failure("MP3_ENCODER") }
    guard FileManager.default.createFile(atPath: output.path, contents: nil) else { throw Failure("OUTPUT_CREATE") }
    let file = try FileHandle(forWritingTo: output); defer { try? file.close() }
    var encoded = [UInt8](repeating: 0, count: 131072)
    while let sample = pcm.copyNextSampleBuffer() {
      try token.check()
      guard let block = CMSampleBufferGetDataBuffer(sample) else { throw Failure("PCM_BUFFER") }
      let count = CMBlockBufferGetDataLength(block)
      var samples = [Int16](repeating: 0, count: count / 2)
      let copied = samples.withUnsafeMutableBytes { CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: count, destination: $0.baseAddress!) }
      guard copied == kCMBlockBufferNoErr, samples.count % 2 == 0 else { throw Failure("PCM_BUFFER") }
      let frameCount = Int32(samples.count / 2), capacity = Int32(encoded.count)
      let size = samples.withUnsafeMutableBufferPointer { buffer in
        lame_encode_buffer_interleaved(encoder, buffer.baseAddress!, frameCount, &encoded, capacity)
      }
      guard size >= 0 else { throw Failure("MP3_ENCODE") }
      try file.write(contentsOf: Data(encoded.prefix(Int(size))))
    }
    guard reader.status == .completed else { throw reader.error ?? Failure("AUDIO_DECODE") }
    let size = lame_encode_flush(encoder, &encoded, Int32(encoded.count))
    guard size >= 0 else { throw Failure("MP3_ENCODE") }
    try file.write(contentsOf: Data(encoded.prefix(Int(size))))
  }
}
