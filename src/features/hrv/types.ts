export type HrvMeasurementState =
  | "off"
  | "requesting_permission"
  | "finding_signal"
  | "measuring"
  | "low_signal"
  | "unavailable"
  | "error";

export type HrvSignalQuality = "low" | "medium" | "high";

export type HrvStatusEvent = {
  state: HrvMeasurementState;
  heartRateBpm?: number;
  hrvRmssdMs?: number;
  signalQuality: HrvSignalQuality;
  fingerDetected: boolean;
};

export type SessionHrvSample = {
  timestampMs: number;
  heartRateBpm: number;
  hrvRmssdMs: number;
  signalQuality: HrvSignalQuality;
};

export type SessionHrvSummary = {
  startedAtMs: number;
  endedAtMs: number;
  startHeartRateBpm: number;
  endHeartRateBpm: number;
  startHrvRmssdMs: number;
  endHrvRmssdMs: number;
  deltaHeartRateBpm: number;
  deltaHrvRmssdMs: number;
  quality: HrvSignalQuality;
  sufficientSignal: boolean;
};

export type VitalsMeasurementResult = {
  averageHeartRateBpm: number;
  averageHrvRmssdMs: number;
  estimatedBreathsPerMin?: number;
  durationSec: number;
  acceptedBeatCount: number;
  quality: HrvSignalQuality;
};
