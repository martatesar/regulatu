import React from "react";
import { StyleSheet, Text, View } from "react-native";

type BreathPatternPreviewProps = {
  inhaleSec: number;
  holdAfterInhaleSec: number;
  exhaleSec: number;
  holdAfterExhaleSec: number;
  compact?: boolean;
};

const previewColors = {
  inhale: "#A7F3D0",
  hold: "#FDE68A",
  exhale: "#93C5FD",
  background: "rgba(255,255,255,0.08)",
};

export const BreathPatternPreview = ({
  inhaleSec,
  holdAfterInhaleSec,
  exhaleSec,
  holdAfterExhaleSec,
  compact = false,
}: BreathPatternPreviewProps) => {
  const segments = [
    { key: "inhale", value: inhaleSec, color: previewColors.inhale, label: "In" },
    {
      key: "hold-in",
      value: holdAfterInhaleSec,
      color: previewColors.hold,
      label: "Hold",
    },
    { key: "exhale", value: exhaleSec, color: previewColors.exhale, label: "Out" },
    {
      key: "hold-out",
      value: holdAfterExhaleSec,
      color: previewColors.hold,
      label: "Hold",
    },
  ].filter((segment) => segment.value > 0);

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (total <= 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.track, compact && styles.trackCompact]}>
        {segments.map((segment, index) => (
          <View
            key={segment.key}
            style={[
              styles.segment,
              {
                flex: segment.value,
                backgroundColor: segment.color,
                marginRight: index === segments.length - 1 ? 0 : 4,
              },
            ]}
          />
        ))}
      </View>

      {!compact ? (
        <View style={styles.labels}>
          {segments.map((segment) => (
            <View key={segment.key} style={styles.labelChip}>
              <Text style={styles.labelText}>{segment.label}</Text>
              <Text style={styles.valueText}>{segment.value}s</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  track: {
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderRadius: 999,
    backgroundColor: previewColors.background,
  },
  trackCompact: {
    padding: 4,
  },
  segment: {
    height: 10,
    borderRadius: 999,
  },
  labels: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  labelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  labelText: {
    color: "#9FA8BC",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  valueText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
