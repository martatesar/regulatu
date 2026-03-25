import { HrvSignalQuality, SessionHrvSample, SessionHrvSummary } from "./types";

const qualityRank: Record<HrvSignalQuality, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export const buildSessionHrvSummary = (
  samples: SessionHrvSample[],
): SessionHrvSummary | undefined => {
  if (samples.length < 2) {
    return undefined;
  }

  const first = samples[0];
  const last = samples[samples.length - 1];

  const quality = samples.reduce<HrvSignalQuality>((best, sample) => {
    return qualityRank[sample.signalQuality] > qualityRank[best]
      ? sample.signalQuality
      : best;
  }, "low");

  return {
    startedAtMs: first.timestampMs,
    endedAtMs: last.timestampMs,
    startHeartRateBpm: first.heartRateBpm,
    endHeartRateBpm: last.heartRateBpm,
    startHrvRmssdMs: first.hrvRmssdMs,
    endHrvRmssdMs: last.hrvRmssdMs,
    deltaHeartRateBpm: roundValue(last.heartRateBpm - first.heartRateBpm),
    deltaHrvRmssdMs: roundValue(last.hrvRmssdMs - first.hrvRmssdMs),
    quality,
    sufficientSignal: true,
  };
};

const roundValue = (value: number) => Math.round(value * 10) / 10;

