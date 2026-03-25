import Foundation

struct RezetCameraHrvSnapshot {
  let state: String
  let heartRateBpm: Double?
  let hrvRmssdMs: Double?
  let signalQuality: String
  let fingerDetected: Bool
}

final class RezetCameraHrvAnalyzer {
  var updateIntervalMs: Int = 1000

  private var lastEmitTimestamp: Double = 0
  private var firstFingerTimestamp: Double?
  private var fastAverage: Double?
  private var slowAverage: Double?
  private var previousBand: Double = 0
  private var previousDerivative: Double = 0
  private var noiseFloor: Double = 0.00025
  private var lastPeakTimestamp: Double?
  private var ibiSeries: [(timestamp: Double, ibi: Double)] = []
  private var lastState: String = "off"
  private var smoothedHeartRateBpm: Double?
  private var smoothedHrvRmssdMs: Double?
  private var isFingerLocked = false
  private var consecutiveFingerFrames = 0
  private var consecutiveMissingFrames = 0

  func reset() {
    lastEmitTimestamp = 0
    firstFingerTimestamp = nil
    fastAverage = nil
    slowAverage = nil
    previousBand = 0
    previousDerivative = 0
    noiseFloor = 0.00025
    lastPeakTimestamp = nil
    ibiSeries.removeAll(keepingCapacity: false)
    lastState = "off"
    smoothedHeartRateBpm = nil
    smoothedHrvRmssdMs = nil
    isFingerLocked = false
    consecutiveFingerFrames = 0
    consecutiveMissingFrames = 0
  }

  func process(
    timestamp: Double,
    red: Double,
    green: Double,
    blue: Double
  ) -> RezetCameraHrvSnapshot? {
    let fingerDetected = updateFingerLock(
      fingerLikeFrame: isFingerDetected(red: red, green: green, blue: blue)
    )
    guard fingerDetected else {
      resetSignalPath(keepState: "finding_signal")
      return emitIfNeeded(
        snapshot: RezetCameraHrvSnapshot(
          state: "finding_signal",
          heartRateBpm: nil,
          hrvRmssdMs: nil,
          signalQuality: "low",
          fingerDetected: false
        ),
        timestamp: timestamp
      )
    }

    if firstFingerTimestamp == nil {
      firstFingerTimestamp = timestamp
    }

    let sample = ((red * 0.6) + (green * 0.4)) / 255.0

    if fastAverage == nil || slowAverage == nil {
      fastAverage = sample
      slowAverage = sample

      return emitIfNeeded(
        snapshot: RezetCameraHrvSnapshot(
          state: "finding_signal",
          heartRateBpm: nil,
          hrvRmssdMs: nil,
          signalQuality: "low",
          fingerDetected: true
        ),
        timestamp: timestamp
      )
    }

    let fastAlpha = 0.24
    let slowAlpha = 0.018

    fastAverage = fastAverage! + fastAlpha * (sample - fastAverage!)
    slowAverage = slowAverage! + slowAlpha * (sample - slowAverage!)

    let band = fastAverage! - slowAverage!
    let derivative = band - previousBand
    noiseFloor = max(0.00015, noiseFloor * 0.975 + abs(band) * 0.025)

    let threshold = max(noiseFloor * 1.2, 0.00045)
    detectBeat(timestamp: timestamp, band: band, derivative: derivative, threshold: threshold)

    previousBand = band
    previousDerivative = derivative

    pruneSeries(now: timestamp)

    let snapshot = buildSnapshot(timestamp: timestamp, fingerDetected: true)
    return emitIfNeeded(snapshot: snapshot, timestamp: timestamp)
  }

  private func detectBeat(timestamp: Double, band: Double, derivative: Double, threshold: Double) {
    let refractoryPeriod = 0.38

    if previousDerivative > 0,
       derivative <= 0,
       band > threshold {
      if let lastPeakTimestamp,
         timestamp - lastPeakTimestamp >= refractoryPeriod {
        let ibi = timestamp - lastPeakTimestamp
        if ibi >= 0.35 && ibi <= 1.5 {
          ibiSeries.append((timestamp: timestamp, ibi: ibi))
        }
      }

      lastPeakTimestamp = timestamp
    }
  }

  private func buildSnapshot(timestamp: Double, fingerDetected: Bool) -> RezetCameraHrvSnapshot {
    let ibIs = ibiSeries.map(\.ibi)
    let captureDuration = max(0, timestamp - (firstFingerTimestamp ?? timestamp))
    let beatCount = ibIs.count

    guard captureDuration >= 4, beatCount >= 2 else {
      return RezetCameraHrvSnapshot(
        state: "finding_signal",
        heartRateBpm: nil,
        hrvRmssdMs: nil,
        signalQuality: "low",
        fingerDetected: fingerDetected
      )
    }

    let meanIbi = ibIs.reduce(0, +) / Double(ibIs.count)
    let heartRateBpm = 60 / meanIbi
    let rmssdMs = computeRmssdMs(from: ibIs)
    let standardDeviation = computeStandardDeviation(values: ibIs, mean: meanIbi)
    let coefficientOfVariation = standardDeviation / max(meanIbi, 0.001)

    if heartRateBpm < 40 || heartRateBpm > 180 {
      return RezetCameraHrvSnapshot(
        state: "low_signal",
        heartRateBpm: nil,
        hrvRmssdMs: nil,
        signalQuality: "low",
        fingerDetected: fingerDetected
      )
    }

    let quality: String
    if beatCount >= 10 && coefficientOfVariation < 0.12 {
      quality = "high"
    } else if beatCount >= 5 && coefficientOfVariation < 0.22 {
      quality = "medium"
    } else {
      quality = "low"
    }

    if rmssdMs == nil {
      return RezetCameraHrvSnapshot(
        state: "finding_signal",
        heartRateBpm: roundValue(heartRateBpm),
        hrvRmssdMs: nil,
        signalQuality: quality,
        fingerDetected: fingerDetected
      )
    }

    let smoothedHeartRate = smooth(
      value: heartRateBpm,
      previous: &smoothedHeartRateBpm,
      alpha: 0.35
    )
    let smoothedHrv = smooth(
      value: rmssdMs!,
      previous: &smoothedHrvRmssdMs,
      alpha: 0.28
    )

    return RezetCameraHrvSnapshot(
      state: "measuring",
      heartRateBpm: roundValue(smoothedHeartRate),
      hrvRmssdMs: roundValue(smoothedHrv),
      signalQuality: quality,
      fingerDetected: fingerDetected
    )
  }

  private func pruneSeries(now: Double) {
    let maxWindow = 35.0
    ibiSeries.removeAll { now - $0.timestamp > maxWindow }
  }

  private func resetSignalPath(keepState: String) {
    firstFingerTimestamp = nil
    fastAverage = nil
    slowAverage = nil
    previousBand = 0
    previousDerivative = 0
    noiseFloor = 0.00025
    lastPeakTimestamp = nil
    ibiSeries.removeAll(keepingCapacity: false)
    lastState = keepState
    smoothedHeartRateBpm = nil
    smoothedHrvRmssdMs = nil
  }

  private func updateFingerLock(fingerLikeFrame: Bool) -> Bool {
    if fingerLikeFrame {
      consecutiveFingerFrames += 1
      consecutiveMissingFrames = 0
      if isFingerLocked || consecutiveFingerFrames >= 3 {
        isFingerLocked = true
      }
    } else {
      consecutiveMissingFrames += 1
      consecutiveFingerFrames = 0
      if consecutiveMissingFrames >= 8 {
        isFingerLocked = false
      }
    }

    return isFingerLocked
  }

  private func emitIfNeeded(
    snapshot: RezetCameraHrvSnapshot,
    timestamp: Double
  ) -> RezetCameraHrvSnapshot? {
    let interval = Double(updateIntervalMs) / 1000
    let stateChanged = snapshot.state != lastState

    guard stateChanged || lastEmitTimestamp == 0 || timestamp - lastEmitTimestamp >= interval else {
      return nil
    }

    lastEmitTimestamp = timestamp
    lastState = snapshot.state
    return snapshot
  }

  private func isFingerDetected(red: Double, green: Double, blue: Double) -> Bool {
    let brightness = (red + green + blue) / 3
    let total = max(red + green + blue, 1)
    let rednessRatio = red / total
    return brightness > 60 && rednessRatio > 0.48 && red > green * 1.02 && red > blue * 1.08
  }

  private func computeRmssdMs(from ibis: [Double]) -> Double? {
    guard ibis.count >= 2 else {
      return nil
    }

    var squaredDiffs = [Double]()
    squaredDiffs.reserveCapacity(max(ibis.count - 1, 0))

    for index in 1..<ibis.count {
      let diff = ibis[index] - ibis[index - 1]
      squaredDiffs.append(diff * diff)
    }

    guard !squaredDiffs.isEmpty else {
      return nil
    }

    let meanSquaredDiff = squaredDiffs.reduce(0, +) / Double(squaredDiffs.count)
    return sqrt(meanSquaredDiff) * 1000
  }

  private func computeStandardDeviation(values: [Double], mean: Double) -> Double {
    guard !values.isEmpty else {
      return 0
    }

    let variance =
      values
        .map { pow($0 - mean, 2) }
        .reduce(0, +) / Double(values.count)

    return sqrt(variance)
  }

  private func roundValue(_ value: Double) -> Double {
    (value * 10).rounded() / 10
  }

  private func smooth(value: Double, previous: inout Double?, alpha: Double) -> Double {
    let nextValue: Double
    if let previous {
      nextValue = previous + alpha * (value - previous)
    } else {
      nextValue = value
    }

    previous = nextValue
    return nextValue
  }
}
