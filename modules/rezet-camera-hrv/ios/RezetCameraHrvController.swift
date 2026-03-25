import AVFoundation
import CoreVideo
import Foundation

private struct RezetPpgFrame {
  let timestamp: Double
  let sample: Double
  let red: Double
  let green: Double
  let blue: Double
}

private struct RezetProcessedSample {
  let timestamp: Double
  let value: Double
}

private struct RezetBeat {
  let timestamp: Double
  let amplitude: Double
}

private struct RezetBeatInterval {
  let timestamp: Double
  let interval: Double
}

private struct RezetSignalAnalysis {
  let intervals: [RezetBeatInterval]
  let rawIntervalCount: Int
  let score: Double
}

struct RezetVitalsMeasurementSummary {
  let averageHeartRateBpm: Double
  let averageHrvRmssdMs: Double
  let estimatedBreathsPerMin: Double?
  let durationSec: Double
  let acceptedBeatCount: Int
  let quality: String

  func asDictionary() -> [String: Any] {
    var payload: [String: Any] = [
      "averageHeartRateBpm": averageHeartRateBpm,
      "averageHrvRmssdMs": averageHrvRmssdMs,
      "durationSec": durationSec,
      "acceptedBeatCount": acceptedBeatCount,
      "quality": quality,
    ]

    if let estimatedBreathsPerMin {
      payload["estimatedBreathsPerMin"] = estimatedBreathsPerMin
    }

    return payload
  }
}

final class RezetCameraHrvController: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
  let captureSession = AVCaptureSession()
  private let sessionQueue = DispatchQueue(label: "com.rezet.camera-hrv.session")
  private let outputQueue = DispatchQueue(
    label: "com.rezet.camera-hrv.output",
    qos: .userInitiated
  )
  var eventSink: ((RezetCameraHrvSnapshot) -> Void)?
  private let analyzer = RezetCameraHrvAnalyzer()

  private var videoDevice: AVCaptureDevice?
  private var videoInput: AVCaptureDeviceInput?
  private var videoOutput: AVCaptureVideoDataOutput?
  private var isConfigured = false
  private var measurementFrames: [RezetPpgFrame] = []
  private var isMeasurementActive = false
  private var measurementStableFrameCount = 0
  private var measurementLockPending = false
  private var measurementDeviceLocked = false
  private var torchPreferredWhileRunning = false
  private var torchAssertPending = false
  private var lastTorchAssertTimestamp = 0.0

  func start(torchPreferred: Bool, updateIntervalMs: Int) throws {
    analyzer.updateIntervalMs = max(250, updateIntervalMs)
    analyzer.reset()

    outputQueue.sync {
      measurementStableFrameCount = 0
      measurementLockPending = false
      measurementDeviceLocked = false
      torchPreferredWhileRunning = torchPreferred
      torchAssertPending = false
      lastTorchAssertTimestamp = 0
    }

    var startError: Error?

    sessionQueue.sync {
      do {
        if !isConfigured {
          try configureSession()
        }

        if !captureSession.isRunning {
          captureSession.startRunning()
        }

        try configureDeviceForPpg()
        try setTorch(enabled: torchPreferred)
      } catch {
        startError = error
      }
    }

    if let startError {
      throw startError
    }
  }

  func stop() {
    sessionQueue.sync {
      if captureSession.isRunning {
        captureSession.stopRunning()
      }

      try? setTorch(enabled: false)
      analyzer.reset()
    }

    outputQueue.sync {
      measurementFrames.removeAll(keepingCapacity: false)
      isMeasurementActive = false
      measurementStableFrameCount = 0
      measurementLockPending = false
      measurementDeviceLocked = false
      torchPreferredWhileRunning = false
      torchAssertPending = false
      lastTorchAssertTimestamp = 0
    }
  }

  func resetMeasurementWindow() {
    outputQueue.sync {
      measurementFrames.removeAll(keepingCapacity: true)
      isMeasurementActive = true
      measurementStableFrameCount = 0
      measurementLockPending = false
      measurementDeviceLocked = false
    }
  }

  func finishMeasurement() -> RezetVitalsMeasurementSummary? {
    let capturedFrames = outputQueue.sync { () -> [RezetPpgFrame] in
      isMeasurementActive = false
      measurementStableFrameCount = 0
      measurementLockPending = false
      let frames = measurementFrames
      measurementFrames.removeAll(keepingCapacity: false)
      return frames
    }

    return computeMeasurementSummary(from: capturedFrames)
  }

  private func configureSession() throws {
    guard let camera = AVCaptureDevice.default(
      .builtInWideAngleCamera,
      for: .video,
      position: .back
    ) else {
      throw NSError(
        domain: "RezetCameraHrv",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Rear camera is unavailable."]
      )
    }

    let input = try AVCaptureDeviceInput(device: camera)
    let output = AVCaptureVideoDataOutput()
    output.alwaysDiscardsLateVideoFrames = true
    output.videoSettings = [
      kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
    ]
    output.setSampleBufferDelegate(self, queue: outputQueue)

    captureSession.beginConfiguration()
    captureSession.sessionPreset = .vga640x480

    guard captureSession.canAddInput(input) else {
      captureSession.commitConfiguration()
      throw NSError(
        domain: "RezetCameraHrv",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Unable to add the camera input."]
      )
    }

    guard captureSession.canAddOutput(output) else {
      captureSession.commitConfiguration()
      throw NSError(
        domain: "RezetCameraHrv",
        code: 3,
        userInfo: [NSLocalizedDescriptionKey: "Unable to add the camera output."]
      )
    }

    captureSession.addInput(input)
    captureSession.addOutput(output)
    captureSession.commitConfiguration()

    if let connection = output.connection(with: .video),
       connection.isVideoOrientationSupported {
      connection.videoOrientation = .portrait
    }

    videoDevice = camera
    videoInput = input
    videoOutput = output
    isConfigured = true
  }

  private func configureDeviceForPpg() throws {
    guard let videoDevice else {
      return
    }

    try videoDevice.lockForConfiguration()
    defer { videoDevice.unlockForConfiguration() }

    if videoDevice.isFocusModeSupported(.locked) {
      videoDevice.setFocusModeLocked(lensPosition: 1.0)
    }

    if videoDevice.isExposureModeSupported(.continuousAutoExposure) {
      videoDevice.exposureMode = .continuousAutoExposure
    }

    if videoDevice.isWhiteBalanceModeSupported(.continuousAutoWhiteBalance) {
      videoDevice.whiteBalanceMode = .continuousAutoWhiteBalance
    }

    if videoDevice.isSmoothAutoFocusSupported {
      videoDevice.isSmoothAutoFocusEnabled = false
    }

    let preferredFrameRate = videoDevice.activeFormat.videoSupportedFrameRateRanges.contains(where: {
      $0.minFrameRate <= 60 && $0.maxFrameRate >= 60
    }) ? 60 : 30

    if videoDevice.activeFormat.videoSupportedFrameRateRanges.contains(where: {
      $0.minFrameRate <= Double(preferredFrameRate) && $0.maxFrameRate >= Double(preferredFrameRate)
    }) {
      videoDevice.activeVideoMinFrameDuration = CMTime(value: 1, timescale: CMTimeScale(preferredFrameRate))
      videoDevice.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: CMTimeScale(preferredFrameRate))
    }
  }

  private func setTorch(enabled: Bool) throws {
    guard let videoDevice, videoDevice.hasTorch else {
      return
    }

    try videoDevice.lockForConfiguration()
    defer { videoDevice.unlockForConfiguration() }

    if enabled {
      let preferredLevel = min(AVCaptureDevice.maxAvailableTorchLevel, 0.6)
      try videoDevice.setTorchModeOn(level: preferredLevel)
    } else {
      videoDevice.torchMode = .off
    }
  }

  func captureOutput(
    _ output: AVCaptureOutput,
    didOutput sampleBuffer: CMSampleBuffer,
    from connection: AVCaptureConnection
  ) {
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
      return
    }

    let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer).seconds
    guard let channels = averageChannels(from: pixelBuffer) else {
      return
    }

    let sample = ((channels.red * 0.6) + (channels.green * 0.4)) / 255.0
    let frame = RezetPpgFrame(
      timestamp: timestamp,
      sample: sample,
      red: channels.red,
      green: channels.green,
      blue: channels.blue
    )

    updateTorchAssertionIfNeeded(with: frame)

    if isMeasurementActive {
      measurementFrames.append(frame)
      updateMeasurementStability(with: frame)
    }

    if let snapshot = analyzer.process(
      timestamp: timestamp,
      red: channels.red,
      green: channels.green,
      blue: channels.blue
    ) {
      eventSink?(snapshot)
    }
  }

  private func averageChannels(
    from pixelBuffer: CVPixelBuffer
  ) -> (red: Double, green: Double, blue: Double)? {
    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

    guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
      return nil
    }

    let width = CVPixelBufferGetWidth(pixelBuffer)
    let height = CVPixelBufferGetHeight(pixelBuffer)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
    let pixelStride = 4
    let sampleStride = 6
    let xStart = width / 4
    let xEnd = width - xStart
    let yStart = height / 4
    let yEnd = height - yStart

    let pointer = baseAddress.assumingMemoryBound(to: UInt8.self)

    var redTotal = 0.0
    var greenTotal = 0.0
    var blueTotal = 0.0
    var sampleCount = 0.0

    for y in stride(from: yStart, to: yEnd, by: sampleStride) {
      let row = pointer.advanced(by: y * bytesPerRow)
      for x in stride(from: xStart, to: xEnd, by: sampleStride) {
        let pixel = row.advanced(by: x * pixelStride)
        blueTotal += Double(pixel[0])
        greenTotal += Double(pixel[1])
        redTotal += Double(pixel[2])
        sampleCount += 1
      }
    }

    guard sampleCount > 0 else {
      return nil
    }

    return (
      red: redTotal / sampleCount,
      green: greenTotal / sampleCount,
      blue: blueTotal / sampleCount
    )
  }

  private func computeMeasurementSummary(
    from frames: [RezetPpgFrame]
  ) -> RezetVitalsMeasurementSummary? {
    guard frames.count >= 500 else {
      return nil
    }

    let usableFrames = longestUsableSegment(in: frames)
    guard usableFrames.count >= 600,
          let usableStart = usableFrames.first?.timestamp,
          let usableEnd = usableFrames.last?.timestamp else {
      return nil
    }

    let usableDuration = usableEnd - usableStart
    guard usableDuration >= 25 else {
      return nil
    }

    let sampleRate = preferredSampleRate(for: usableFrames)
    let signalCandidates = buildSignalCandidates(from: usableFrames, targetRate: sampleRate)

    var selectedAnalysis: RezetSignalAnalysis?
    for candidate in signalCandidates {
      guard candidate.count >= Int(sampleRate * 20.0) else {
        continue
      }

      let signal = preprocess(samples: candidate)
      guard signal.count >= Int(sampleRate * 20.0),
            let analysis = analyzeSignal(signal, sampleRate: sampleRate) else {
        continue
      }

      if let currentSelectedAnalysis = selectedAnalysis {
        if analysis.score > currentSelectedAnalysis.score {
          selectedAnalysis = analysis
        }
      } else {
        selectedAnalysis = analysis
      }
    }

    guard let selectedAnalysis,
          selectedAnalysis.intervals.count >= 10 else {
      return nil
    }

    let selectedIntervals = selectedAnalysis.intervals
    let intervalValues = selectedIntervals.map(\.interval)
    let meanInterval = intervalValues.reduce(0, +) / Double(intervalValues.count)
    let averageHeartRateBpm = 60.0 / meanInterval
    guard averageHeartRateBpm >= 40, averageHeartRateBpm <= 180 else {
      return nil
    }

    guard let averageHrvRmssdMs = computeRobustRmssdMs(from: intervalValues) else {
      return nil
    }

    let estimatedBreathsPerMin = estimateBreathingRate(from: selectedIntervals)
    let coverageRatio = Double(usableFrames.count) / Double(max(frames.count, 1))
    let acceptanceRatio = Double(selectedIntervals.count) / Double(max(selectedAnalysis.rawIntervalCount, 1))
    let quality = measurementQuality(
      usableDuration: usableDuration,
      coverageRatio: coverageRatio,
      acceptanceRatio: acceptanceRatio,
      acceptedIntervalCount: selectedIntervals.count
    )

    return RezetVitalsMeasurementSummary(
      averageHeartRateBpm: roundValue(averageHeartRateBpm),
      averageHrvRmssdMs: roundValue(averageHrvRmssdMs),
      estimatedBreathsPerMin: estimatedBreathsPerMin.map(roundValue),
      durationSec: roundValue(usableDuration),
      acceptedBeatCount: selectedIntervals.count + 1,
      quality: quality
    )
  }

  private func longestUsableSegment(in frames: [RezetPpgFrame]) -> [RezetPpgFrame] {
    let coverageThreshold = 0.52
    let allowedGapDuration = 0.45

    var bestRange: ClosedRange<Int>?
    var currentStart: Int?
    var lastUsableIndex: Int?
    var gapStartTimestamp: Double?

    func commitCurrentRange() {
      guard let currentStart, let lastUsableIndex, lastUsableIndex >= currentStart else {
        return
      }

      if let existingBestRange = bestRange {
        let bestDuration =
          frames[existingBestRange.upperBound].timestamp
          - frames[existingBestRange.lowerBound].timestamp
        let currentDuration = frames[lastUsableIndex].timestamp - frames[currentStart].timestamp
        if currentDuration > bestDuration {
          bestRange = currentStart...lastUsableIndex
        }
      } else {
        bestRange = currentStart...lastUsableIndex
      }
    }

    for index in frames.indices {
      let isUsable = fingerCoverageScore(for: frames[index]) >= coverageThreshold

      if isUsable {
        if currentStart == nil {
          currentStart = index
        }

        lastUsableIndex = index
        gapStartTimestamp = nil
        continue
      }

      guard currentStart != nil else {
        continue
      }

      if gapStartTimestamp == nil {
        gapStartTimestamp = frames[index].timestamp
      }

      if frames[index].timestamp - (gapStartTimestamp ?? frames[index].timestamp) > allowedGapDuration {
        commitCurrentRange()
        currentStart = nil
        lastUsableIndex = nil
        gapStartTimestamp = nil
      }
    }

    commitCurrentRange()

    guard let bestRange else {
      return []
    }

    return Array(frames[bestRange]).filter {
      fingerCoverageScore(for: $0) >= coverageThreshold
    }
  }

  private func fingerCoverageScore(for frame: RezetPpgFrame) -> Double {
    let total = max(frame.red + frame.green + frame.blue, 1.0)
    let brightness = (frame.red + frame.green + frame.blue) / 3.0
    let rednessRatio = frame.red / total
    let redGreenRatio = frame.red / max(frame.green, 1.0)
    let redBlueRatio = frame.red / max(frame.blue, 1.0)

    let brightnessScore = normalized(brightness, min: 70.0, max: 235.0)
    let rednessScore = normalized(rednessRatio, min: 0.44, max: 0.68)
    let redGreenScore = normalized(redGreenRatio, min: 1.0, max: 1.5)
    let redBlueScore = normalized(redBlueRatio, min: 1.02, max: 1.8)

    return brightnessScore * 0.2
      + rednessScore * 0.4
      + redGreenScore * 0.2
      + redBlueScore * 0.2
  }

  private func resample(
    frames: [RezetPpgFrame],
    targetRate: Double
  ) -> [RezetProcessedSample] {
    resample(frames: frames, targetRate: targetRate) { frame in
      frame.sample
    }
  }

  private func resample(
    frames: [RezetPpgFrame],
    targetRate: Double,
    value: (RezetPpgFrame) -> Double
  ) -> [RezetProcessedSample] {
    guard frames.count >= 2,
          let start = frames.first?.timestamp,
          let end = frames.last?.timestamp,
          end > start else {
      return []
    }

    let step = 1.0 / targetRate
    var resampled: [RezetProcessedSample] = []
    resampled.reserveCapacity(Int((end - start) / step) + 1)

    var index = 0
    var nextTimestamp = start
    while nextTimestamp <= end {
      while index + 1 < frames.count && frames[index + 1].timestamp < nextTimestamp {
        index += 1
      }

      guard index + 1 < frames.count else {
        break
      }

      let left = frames[index]
      let right = frames[index + 1]
      let span = max(right.timestamp - left.timestamp, 0.0001)
      let weight = min(max((nextTimestamp - left.timestamp) / span, 0.0), 1.0)
      let leftValue = value(left)
      let rightValue = value(right)
      let interpolatedValue = leftValue + (rightValue - leftValue) * weight

      resampled.append(RezetProcessedSample(timestamp: nextTimestamp, value: interpolatedValue))
      nextTimestamp += step
    }

    return resampled
  }

  private func preferredSampleRate(for frames: [RezetPpgFrame]) -> Double {
    guard frames.count >= 3 else {
      return 30.0
    }

    var intervals: [Double] = []
    intervals.reserveCapacity(frames.count - 1)
    for index in 1..<frames.count {
      let delta = frames[index].timestamp - frames[index - 1].timestamp
      if delta > 0 {
        intervals.append(delta)
      }
    }

    let medianFrameInterval = median(intervals)
    guard medianFrameInterval > 0 else {
      return 30.0
    }

    return min(max(1.0 / medianFrameInterval, 24.0), 60.0)
  }

  private func buildSignalCandidates(
    from frames: [RezetPpgFrame],
    targetRate: Double
  ) -> [[RezetProcessedSample]] {
    let redSignal = normalizeAcComponent(
      resample(frames: frames, targetRate: targetRate) { frame in
        frame.red / 255.0
      }
    )
    let greenSignal = normalizeAcComponent(
      resample(frames: frames, targetRate: targetRate) { frame in
        frame.green / 255.0
      }
    )
    let compositeSignal = normalizeAcComponent(
      resample(frames: frames, targetRate: targetRate) { frame in
        ((frame.red * 0.72) + (frame.green * 0.28)) / 255.0
      }
    )
    let chromaSignal = normalizeAcComponent(
      resample(frames: frames, targetRate: targetRate) { frame in
        ((frame.red - frame.green * 0.55) / 255.0) + 0.5
      }
    )
    let adaptiveBlend = combineSignals(
      greenSignal,
      redSignal,
      leftWeight: 0.58,
      rightWeight: 0.42
    )

    return [
      greenSignal,
      redSignal,
      adaptiveBlend,
      compositeSignal,
      chromaSignal,
    ].filter { !$0.isEmpty }
  }

  private func normalizeAcComponent(
    _ samples: [RezetProcessedSample]
  ) -> [RezetProcessedSample] {
    guard !samples.isEmpty else {
      return []
    }

    let values = samples.map(\.value)
    let baseline = movingAverage(values, windowSize: 45)
    return zip(samples, baseline).map { pair in
      let normalizedValue = abs(pair.1) > 1e-6 ? (pair.0.value - pair.1) / pair.1 : 0
      return RezetProcessedSample(timestamp: pair.0.timestamp, value: normalizedValue)
    }
  }

  private func combineSignals(
    _ left: [RezetProcessedSample],
    _ right: [RezetProcessedSample],
    leftWeight: Double,
    rightWeight: Double
  ) -> [RezetProcessedSample] {
    guard left.count == right.count else {
      return []
    }

    return zip(left, right).map { pair in
      RezetProcessedSample(
        timestamp: pair.0.timestamp,
        value: pair.0.value * leftWeight + pair.1.value * rightWeight
      )
    }
  }

  private func preprocess(samples: [RezetProcessedSample]) -> [RezetProcessedSample] {
    let values = samples.map(\.value)
    let smoothed = movingAverage(values, windowSize: 5)
    let baseline = movingAverage(smoothed, windowSize: 61)
    let bandPassed = zip(smoothed, baseline).map { pair in
      pair.0 - pair.1
    }
    let stabilized = movingAverage(bandPassed, windowSize: 9)

    return zip(samples, stabilized).map { pair in
      RezetProcessedSample(timestamp: pair.0.timestamp, value: pair.1)
    }
  }

  private func analyzeSignal(
    _ signal: [RezetProcessedSample],
    sampleRate: Double
  ) -> RezetSignalAnalysis? {
    let positiveBeats = detectBeats(in: signal, sampleRate: sampleRate, invert: false)
    let negativeBeats = detectBeats(in: signal, sampleRate: sampleRate, invert: true)

    let positiveRawIntervals = buildIntervals(from: positiveBeats)
    let negativeRawIntervals = buildIntervals(from: negativeBeats)
    let positiveIntervals = correctPossibleBeatDoubling(filterIntervals(positiveRawIntervals))
    let negativeIntervals = correctPossibleBeatDoubling(filterIntervals(negativeRawIntervals))

    let positiveScore = score(intervals: positiveIntervals, rawIntervals: positiveRawIntervals)
    let negativeScore = score(intervals: negativeIntervals, rawIntervals: negativeRawIntervals)

    if negativeScore > positiveScore {
      guard !negativeIntervals.isEmpty else {
        return nil
      }

      return RezetSignalAnalysis(
        intervals: negativeIntervals,
        rawIntervalCount: negativeRawIntervals.count,
        score: negativeScore
      )
    }

    guard !positiveIntervals.isEmpty else {
      return nil
    }

    return RezetSignalAnalysis(
      intervals: positiveIntervals,
      rawIntervalCount: positiveRawIntervals.count,
      score: positiveScore
    )
  }

  private func detectBeats(
    in samples: [RezetProcessedSample],
    sampleRate: Double,
    invert: Bool
  ) -> [RezetBeat] {
    guard samples.count >= 5 else {
      return []
    }

    let transformedValues = samples.map { invert ? -$0.value : $0.value }
    let meanValue = transformedValues.reduce(0, +) / Double(transformedValues.count)
    let centeredValues = transformedValues.map { $0 - meanValue }
    let standardDeviation = computeStandardDeviation(values: centeredValues, mean: 0)
    let threshold = max(standardDeviation * 0.45, 0.00025)
    let prominenceThreshold = max(standardDeviation * 0.2, 0.00012)
    let refractorySamples = max(Int(sampleRate * 0.38), 8)

    var beats: [RezetBeat] = []
    var lastAcceptedIndex = -refractorySamples

    for index in 1..<(centeredValues.count - 1) {
      let current = centeredValues[index]
      guard current > threshold,
            current >= centeredValues[index - 1],
            current > centeredValues[index + 1] else {
        continue
      }

      let leftStart = max(0, index - refractorySamples / 2)
      let rightEnd = min(centeredValues.count - 1, index + refractorySamples / 2)
      let leftFloor = centeredValues[leftStart..<index].min() ?? centeredValues[index]
      let rightFloor = centeredValues[(index + 1)...rightEnd].min() ?? centeredValues[index]
      let prominence = current - max(leftFloor, rightFloor)
      guard prominence >= prominenceThreshold else {
        continue
      }

      if index - lastAcceptedIndex < refractorySamples {
        if let lastBeat = beats.last, current > lastBeat.amplitude {
          beats[beats.count - 1] = buildBeat(
            samples: samples,
            transformedValues: centeredValues,
            index: index,
            amplitude: current,
            sampleRate: sampleRate
          )
          lastAcceptedIndex = index
        }
        continue
      }

      beats.append(
        buildBeat(
          samples: samples,
          transformedValues: centeredValues,
          index: index,
          amplitude: current,
          sampleRate: sampleRate
        )
      )
      lastAcceptedIndex = index
    }

    return beats
  }

  private func buildBeat(
    samples: [RezetProcessedSample],
    transformedValues: [Double],
    index: Int,
    amplitude: Double,
    sampleRate: Double
  ) -> RezetBeat {
    guard index > 0, index + 1 < transformedValues.count else {
      return RezetBeat(timestamp: samples[index].timestamp, amplitude: amplitude)
    }

    let left = transformedValues[index - 1]
    let center = transformedValues[index]
    let right = transformedValues[index + 1]
    let denominator = left - (2 * center) + right

    guard abs(denominator) > 1e-9 else {
      return RezetBeat(timestamp: samples[index].timestamp, amplitude: amplitude)
    }

    let offset = max(min(0.5 * (left - right) / denominator, 1.0), -1.0)
    return RezetBeat(
      timestamp: samples[index].timestamp + offset / sampleRate,
      amplitude: amplitude
    )
  }

  private func buildIntervals(from beats: [RezetBeat]) -> [RezetBeatInterval] {
    guard beats.count >= 2 else {
      return []
    }

    var intervals: [RezetBeatInterval] = []
    intervals.reserveCapacity(beats.count - 1)

    for index in 1..<beats.count {
      let interval = beats[index].timestamp - beats[index - 1].timestamp
      guard interval >= 0.35, interval <= 1.5 else {
        continue
      }

      intervals.append(
        RezetBeatInterval(timestamp: beats[index].timestamp, interval: interval)
      )
    }

    return intervals
  }

  private func filterIntervals(
    _ intervals: [RezetBeatInterval]
  ) -> [RezetBeatInterval] {
    guard intervals.count >= 5 else {
      return intervals
    }

    let values = intervals.map(\.interval)
    let medianValue = median(values)
    let deviations = values.map { abs($0 - medianValue) }
    let medianAbsoluteDeviation = median(deviations)
    let globalTolerance = max(0.12, max(medianAbsoluteDeviation * 3.2, medianValue * 0.22))
    let globallyFiltered = intervals.filter { abs($0.interval - medianValue) <= globalTolerance }

    guard globallyFiltered.count >= 5 else {
      return globallyFiltered
    }

    var cleaned: [RezetBeatInterval] = []
    cleaned.reserveCapacity(globallyFiltered.count)

    for index in globallyFiltered.indices {
      let current = globallyFiltered[index]
      let windowStart = max(0, index - 2)
      let windowEnd = min(globallyFiltered.count - 1, index + 2)
      let localMedian = median(
        Array(globallyFiltered[windowStart...windowEnd].map(\.interval))
      )
      let localTolerance = max(0.10, localMedian * 0.18)

      guard abs(current.interval - localMedian) <= localTolerance else {
        continue
      }

      if let previousAccepted = cleaned.last {
        let successiveTolerance = max(0.10, min(previousAccepted.interval, current.interval) * 0.20)
        guard abs(current.interval - previousAccepted.interval) <= successiveTolerance else {
          continue
        }
      }

      cleaned.append(current)
    }

    return cleaned.count >= 4 ? cleaned : globallyFiltered
  }

  private func correctPossibleBeatDoubling(
    _ intervals: [RezetBeatInterval]
  ) -> [RezetBeatInterval] {
    guard intervals.count >= 8 else {
      return intervals
    }

    let originalValues = intervals.map(\.interval)
    let originalMean = originalValues.reduce(0, +) / Double(originalValues.count)
    let originalSpread = computeStandardDeviation(values: originalValues, mean: originalMean)
    let originalCoefficientOfVariation = originalSpread / max(originalMean, 0.001)
    guard originalMean < 0.78 else {
      return intervals
    }

    var bestCandidate = intervals
    var bestCandidateScore = originalCoefficientOfVariation

    for offset in 0...1 {
      let merged = mergeAdjacentIntervals(intervals, offset: offset)
      guard merged.count >= 4 else {
        continue
      }

      let mergedValues = merged.map(\.interval)
      let mergedMean = mergedValues.reduce(0, +) / Double(mergedValues.count)
      let mergedHeartRate = 60.0 / max(mergedMean, 0.001)
      guard mergedMean > originalMean * 1.45,
            mergedMean < originalMean * 2.35,
            mergedHeartRate >= 40,
            mergedHeartRate <= 120 else {
        continue
      }

      let mergedSpread = computeStandardDeviation(values: mergedValues, mean: mergedMean)
      let mergedCoefficientOfVariation = mergedSpread / max(mergedMean, 0.001)

      let shouldPromote =
        mergedCoefficientOfVariation < bestCandidateScore * 0.84
        || (
          originalCoefficientOfVariation > 0.14
          && mergedCoefficientOfVariation < bestCandidateScore * 0.93
          && mergedHeartRate <= 105
        )

      if shouldPromote {
        bestCandidate = merged
        bestCandidateScore = mergedCoefficientOfVariation
      }
    }

    return bestCandidate
  }

  private func mergeAdjacentIntervals(
    _ intervals: [RezetBeatInterval],
    offset: Int
  ) -> [RezetBeatInterval] {
    guard offset < intervals.count - 1 else {
      return []
    }

    var merged: [RezetBeatInterval] = []
    merged.reserveCapacity(intervals.count / 2)

    var index = offset
    while index + 1 < intervals.count {
      let left = intervals[index]
      let right = intervals[index + 1]
      merged.append(
        RezetBeatInterval(
          timestamp: right.timestamp,
          interval: left.interval + right.interval
        )
      )
      index += 2
    }

    return merged
  }

  private func estimateBreathingRate(
    from intervals: [RezetBeatInterval]
  ) -> Double? {
    guard intervals.count >= 8,
          let firstTimestamp = intervals.first?.timestamp,
          let lastTimestamp = intervals.last?.timestamp,
          lastTimestamp - firstTimestamp >= 18 else {
      return nil
    }

    let resampled = resample(intervals: intervals, targetRate: 4.0)
    guard resampled.count >= 48 else {
      return nil
    }

    let heartRateSeries = resampled.map { sample in
      RezetProcessedSample(
        timestamp: sample.timestamp,
        value: 60.0 / max(sample.value, 0.35)
      )
    }
    let values = heartRateSeries.map(\.value)
    let centeredValues = zip(values, movingAverage(values, windowSize: 17)).map { pair in
      pair.0 - pair.1
    }
    let stabilizedValues = movingAverage(centeredValues, windowSize: 5)

    let totalEnergy = stabilizedValues.reduce(0) { $0 + ($1 * $1) }
    guard totalEnergy > 1e-7 else {
      return nil
    }

    var bestFrequency = 0.0
    var bestPower = 0.0
    var secondBestPower = 0.0

    for frequency in stride(from: 0.08, through: 0.5, by: 0.005) {
      var cosine = 0.0
      var sine = 0.0

      for (sample, value) in zip(heartRateSeries, stabilizedValues) {
        let phase = 2.0 * Double.pi * frequency * (sample.timestamp - firstTimestamp)
        cosine += value * cos(phase)
        sine += value * sin(phase)
      }

      let power = cosine * cosine + sine * sine
      if power > bestPower {
        secondBestPower = bestPower
        bestPower = power
        bestFrequency = frequency
      } else if power > secondBestPower {
        secondBestPower = power
      }
    }

    guard bestFrequency > 0 else {
      return estimateBreathingRateByAutocorrelation(
        values: stabilizedValues,
        sampleRate: 4.0
      )
    }

    let dominance = bestPower / max(secondBestPower, 1e-9)
    let normalizedPower = bestPower / totalEnergy
    let spectralBreathingRate = bestFrequency * 60.0
    guard spectralBreathingRate >= 6.0, spectralBreathingRate <= 30.0 else {
      return estimateBreathingRateByAutocorrelation(
        values: stabilizedValues,
        sampleRate: 4.0
      )
    }

    if dominance >= 1.04, normalizedPower >= 0.08 {
      return spectralBreathingRate
    }

    let autocorrelationBreathingRate = estimateBreathingRateByAutocorrelation(
      values: stabilizedValues,
      sampleRate: 4.0
    )

    if let autocorrelationBreathingRate {
      if abs(autocorrelationBreathingRate - spectralBreathingRate) <= 3.0 {
        return (autocorrelationBreathingRate + spectralBreathingRate) / 2.0
      }

      if dominance >= 1.01, normalizedPower >= 0.05 {
        return spectralBreathingRate
      }

      return autocorrelationBreathingRate
    }

    guard dominance >= 1.01, normalizedPower >= 0.05 else {
      return nil
    }

    return spectralBreathingRate
  }

  private func estimateBreathingRateByAutocorrelation(
    values: [Double],
    sampleRate: Double
  ) -> Double? {
    guard values.count >= Int(sampleRate * 12.0) else {
      return nil
    }

    let minLag = max(Int(sampleRate * 2.0), 1)
    let maxLag = min(Int(sampleRate * 10.0), values.count / 2)
    guard maxLag > minLag else {
      return nil
    }

    var bestLag = 0
    var bestCorrelation = 0.0

    for lag in minLag...maxLag {
      var numerator = 0.0
      var leftEnergy = 0.0
      var rightEnergy = 0.0

      for index in 0..<(values.count - lag) {
        let left = values[index]
        let right = values[index + lag]
        numerator += left * right
        leftEnergy += left * left
        rightEnergy += right * right
      }

      let denominator = sqrt(leftEnergy * rightEnergy)
      guard denominator > 1e-9 else {
        continue
      }

      let correlation = numerator / denominator
      if correlation > bestCorrelation {
        bestCorrelation = correlation
        bestLag = lag
      }
    }

    guard bestLag > 0, bestCorrelation >= 0.22 else {
      return nil
    }

    let breathsPerMinute = 60.0 / (Double(bestLag) / sampleRate)
    guard breathsPerMinute >= 6.0, breathsPerMinute <= 30.0 else {
      return nil
    }

    return breathsPerMinute
  }

  private func computeRobustRmssdMs(from intervals: [Double]) -> Double? {
    guard intervals.count >= 5 else {
      return nil
    }

    let intervalMedian = median(intervals)
    let intervalDeviations = intervals.map { abs($0 - intervalMedian) }
    let intervalMad = median(intervalDeviations)
    let intervalTolerance = max(0.08, max(intervalMad * 3.0, intervalMedian * 0.16))

    var cleanedIntervals: [Double] = []
    cleanedIntervals.reserveCapacity(intervals.count)

    for interval in intervals {
      guard abs(interval - intervalMedian) <= intervalTolerance else {
        continue
      }
      cleanedIntervals.append(interval)
    }

    guard cleanedIntervals.count >= 5 else {
      return nil
    }

    var successiveDiffs: [Double] = []
    successiveDiffs.reserveCapacity(cleanedIntervals.count - 1)

    for index in 1..<cleanedIntervals.count {
      successiveDiffs.append(cleanedIntervals[index] - cleanedIntervals[index - 1])
    }

    let absoluteDiffs = successiveDiffs.map(abs)
    let diffMedian = median(absoluteDiffs)
    let diffMad = median(absoluteDiffs.map { abs($0 - diffMedian) })
    let diffTolerance = max(0.025, max(diffMedian + diffMad * 3.5, intervalMedian * 0.12))

    let filteredSquaredDiffs = successiveDiffs.compactMap { diff -> Double? in
      guard abs(diff) <= diffTolerance else {
        return nil
      }
      return diff * diff
    }

    guard filteredSquaredDiffs.count >= 4 else {
      return nil
    }

    let meanSquaredDifference = filteredSquaredDiffs.reduce(0, +) / Double(filteredSquaredDiffs.count)
    let rmssdMs = sqrt(meanSquaredDifference) * 1000.0
    let maxReasonableRmssdMs = intervalMedian * 1000.0 * 0.35

    guard rmssdMs <= maxReasonableRmssdMs else {
      return nil
    }

    return rmssdMs
  }

  private func resample(
    intervals: [RezetBeatInterval],
    targetRate: Double
  ) -> [RezetProcessedSample] {
    guard intervals.count >= 2,
          let start = intervals.first?.timestamp,
          let end = intervals.last?.timestamp,
          end > start else {
      return []
    }

    let step = 1.0 / targetRate
    var resampled: [RezetProcessedSample] = []
    resampled.reserveCapacity(Int((end - start) / step) + 1)

    var index = 0
    var nextTimestamp = start
    while nextTimestamp <= end {
      while index + 1 < intervals.count && intervals[index + 1].timestamp < nextTimestamp {
        index += 1
      }

      guard index + 1 < intervals.count else {
        break
      }

      let left = intervals[index]
      let right = intervals[index + 1]
      let span = max(right.timestamp - left.timestamp, 0.0001)
      let weight = min(max((nextTimestamp - left.timestamp) / span, 0.0), 1.0)
      let value = left.interval + (right.interval - left.interval) * weight

      resampled.append(RezetProcessedSample(timestamp: nextTimestamp, value: value))
      nextTimestamp += step
    }

    return resampled
  }

  private func measurementQuality(
    usableDuration: Double,
    coverageRatio: Double,
    acceptanceRatio: Double,
    acceptedIntervalCount: Int
  ) -> String {
    if usableDuration >= 48,
       coverageRatio >= 0.8,
       acceptanceRatio >= 0.7,
       acceptedIntervalCount >= 28 {
      return "high"
    }

    if usableDuration >= 32,
       coverageRatio >= 0.6,
       acceptanceRatio >= 0.5,
       acceptedIntervalCount >= 14 {
      return "medium"
    }

    return "low"
  }

  private func updateTorchAssertionIfNeeded(with frame: RezetPpgFrame) {
    guard torchPreferredWhileRunning,
          !torchAssertPending else {
      return
    }

    let contactDetected = fingerCoverageScore(for: frame) >= 0.42
    guard contactDetected || isMeasurementActive else {
      return
    }

    guard frame.timestamp - lastTorchAssertTimestamp >= 1.0 else {
      return
    }

    torchAssertPending = true
    lastTorchAssertTimestamp = frame.timestamp

    sessionQueue.async { [weak self] in
      guard let self else {
        return
      }

      _ = try? self.setTorch(enabled: true)
      self.outputQueue.async {
        self.torchAssertPending = false
      }
    }
  }

  private func updateMeasurementStability(with frame: RezetPpgFrame) {
    let isStableFrame = fingerCoverageScore(for: frame) >= 0.62
    if isStableFrame {
      measurementStableFrameCount += 1
    } else {
      measurementStableFrameCount = max(measurementStableFrameCount - 2, 0)
    }

    guard !measurementDeviceLocked,
          !measurementLockPending,
          measurementStableFrameCount >= 45 else {
      return
    }

    measurementLockPending = true
    sessionQueue.async { [weak self] in
      guard let self else {
        return
      }

      let didLock = self.lockDeviceForMeasurementStability()
      self.outputQueue.async {
        self.measurementDeviceLocked = didLock
        self.measurementLockPending = false
      }
    }
  }

  private func lockDeviceForMeasurementStability() -> Bool {
    guard let videoDevice else {
      return false
    }

    do {
      try videoDevice.lockForConfiguration()
      defer { videoDevice.unlockForConfiguration() }

      if videoDevice.isExposureModeSupported(.locked) {
        videoDevice.exposureMode = .locked
      }

      if videoDevice.isWhiteBalanceModeSupported(.locked) {
        videoDevice.whiteBalanceMode = .locked
      }

      return true
    } catch {
      return false
    }
  }

  private func movingAverage(_ values: [Double], windowSize: Int) -> [Double] {
    guard !values.isEmpty else {
      return []
    }

    let normalizedWindowSize = max(1, windowSize)
    if normalizedWindowSize == 1 {
      return values
    }

    var prefixSums = [Double](repeating: 0, count: values.count + 1)
    for index in values.indices {
      prefixSums[index + 1] = prefixSums[index] + values[index]
    }

    let halfWindow = normalizedWindowSize / 2
    return values.indices.map { index in
      let lowerBound = max(0, index - halfWindow)
      let upperBound = min(values.count - 1, index + halfWindow)
      let sum = prefixSums[upperBound + 1] - prefixSums[lowerBound]
      return sum / Double(upperBound - lowerBound + 1)
    }
  }

  private func normalized(_ value: Double, min: Double, max: Double) -> Double {
    guard max > min else {
      return 0
    }

    return Swift.max(0.0, Swift.min(1.0, (value - min) / (max - min)))
  }

  private func median(_ values: [Double]) -> Double {
    guard !values.isEmpty else {
      return 0
    }

    let sortedValues = values.sorted()
    let middle = sortedValues.count / 2
    if sortedValues.count.isMultiple(of: 2) {
      return (sortedValues[middle - 1] + sortedValues[middle]) / 2.0
    }

    return sortedValues[middle]
  }

  private func computeRmssdMs(from intervals: [Double]) -> Double? {
    guard intervals.count >= 2 else {
      return nil
    }

    var squaredDifferences: [Double] = []
    squaredDifferences.reserveCapacity(intervals.count - 1)

    for index in 1..<intervals.count {
      let difference = intervals[index] - intervals[index - 1]
      squaredDifferences.append(difference * difference)
    }

    guard !squaredDifferences.isEmpty else {
      return nil
    }

    let meanSquaredDifference = squaredDifferences.reduce(0, +) / Double(squaredDifferences.count)
    return sqrt(meanSquaredDifference) * 1000.0
  }

  private func computeStandardDeviation(values: [Double], mean: Double) -> Double {
    guard !values.isEmpty else {
      return 0
    }

    let variance = values.reduce(0) { partialResult, value in
      partialResult + pow(value - mean, 2)
    } / Double(values.count)

    return sqrt(variance)
  }

  private func score(
    intervals: [RezetBeatInterval],
    rawIntervals: [RezetBeatInterval]
  ) -> Double {
    guard !intervals.isEmpty else {
      return 0
    }

    let acceptanceRatio = Double(intervals.count) / Double(max(rawIntervals.count, 1))
    let meanInterval = intervals.map(\.interval).reduce(0, +) / Double(intervals.count)
    let spread = computeStandardDeviation(values: intervals.map(\.interval), mean: meanInterval)
    let coefficientOfVariation = spread / max(meanInterval, 0.001)

    return Double(intervals.count) * 1.2 + acceptanceRatio * 10.0 - coefficientOfVariation * 24.0
  }

  private func roundValue(_ value: Double) -> Double {
    (value * 10.0).rounded() / 10.0
  }
}
