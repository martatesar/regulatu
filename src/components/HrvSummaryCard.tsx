import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SessionHrvSummary } from "../features/hrv/types";
import { colors } from "../theme/colors";

type HrvSummaryCardProps = {
  summary: SessionHrvSummary;
};

export const HrvSummaryCard = ({ summary }: HrvSummaryCardProps) => {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Session HRV</Text>
      <View style={styles.row}>
        <Metric label="Start" value={`${Math.round(summary.startHrvRmssdMs)} ms`} />
        <Metric label="End" value={`${Math.round(summary.endHrvRmssdMs)} ms`} />
        <Metric
          label="Change"
          value={`${summary.deltaHrvRmssdMs >= 0 ? "+" : ""}${Math.round(summary.deltaHrvRmssdMs)} ms`}
          highlight
        />
      </View>
    </View>
  );
};

const Metric = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, highlight && styles.metricValueHighlight]}>
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: "100%",
    marginBottom: 24,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  metricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  metricValueHighlight: {
    color: "#8FD2C9",
  },
});

