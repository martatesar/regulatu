import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import {
  HrvMeasurementState,
  HrvSignalQuality,
  HrvStatusEvent,
} from "../features/hrv/types";

type HrvLiveCardProps = {
  status: HrvStatusEvent;
  deltaMs?: number;
};

const qualityColor: Record<HrvSignalQuality, string> = {
  low: "#8A8A9E",
  medium: "#7AA2C0",
  high: "#8FD2C9",
};

const statusCopy: Record<Exclude<HrvMeasurementState, "measuring">, string> = {
  off: "HRV off",
  requesting_permission: "Waiting for camera access",
  finding_signal: "Cover the rear camera with your finger",
  low_signal: "Low signal",
  unavailable: "HRV unavailable on this device",
  error: "HRV unavailable right now",
};

export const HrvLiveCard = ({ status, deltaMs }: HrvLiveCardProps) => {
  const isLive =
    status.state === "measuring" && typeof status.hrvRmssdMs === "number";
  const liveHrvValue = isLive ? status.hrvRmssdMs ?? 0 : 0;
  const liveHeartRate = isLive ? status.heartRateBpm : undefined;
  const statusMessage =
    status.state === "finding_signal"
      ? status.fingerDetected
        ? "Finding pulse signal"
        : "Cover the rear camera with your finger"
      : status.state === "low_signal"
        ? status.fingerDetected
          ? "Hold still for a clearer signal"
          : "Cover the rear camera with your finger"
        : status.state === "measuring"
          ? "Measuring"
          : statusCopy[status.state];

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.label}>Live HRV</Text>
        <View
          style={[
            styles.qualityBadge,
            { borderColor: qualityColor[status.signalQuality] },
          ]}
        >
          <Text
            style={[
              styles.qualityText,
              { color: qualityColor[status.signalQuality] },
            ]}
          >
            {status.signalQuality}
          </Text>
        </View>
      </View>

      {isLive ? (
        <>
          <View style={styles.metricsRow}>
            <View>
              <Text style={styles.primaryValue}>{Math.round(liveHrvValue)} ms</Text>
              <Text style={styles.caption}>RMSSD estimate</Text>
            </View>

            <View style={styles.secondaryMetric}>
              <Text style={styles.secondaryValue}>
                {typeof deltaMs === "number"
                  ? `${deltaMs >= 0 ? "+" : ""}${Math.round(deltaMs)}`
                  : "0"}
              </Text>
              <Text style={styles.caption}>Change</Text>
            </View>
          </View>

          <Text style={styles.supportingText}>
            {typeof liveHeartRate === "number"
              ? `${Math.round(liveHeartRate)} bpm`
              : "Pulse stabilizing"}
          </Text>
        </>
      ) : (
        <Text style={styles.statusText}>{statusMessage}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 24,
    backgroundColor: "rgba(7, 12, 22, 0.86)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  qualityBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  qualityText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  primaryValue: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "700",
  },
  secondaryMetric: {
    alignItems: "flex-end",
  },
  secondaryValue: {
    color: "#8FD2C9",
    fontSize: 24,
    fontWeight: "700",
  },
  caption: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  supportingText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 14,
  },
  statusText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
});
