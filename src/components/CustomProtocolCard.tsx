import React from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { BreathPatternPreview } from "./BreathPatternPreview";
import {
  CustomProtocol,
  formatSecondsLabel,
  formatTargetLabel,
  getCustomProtocolCycleDurationSec,
} from "../features/customProtocols/model";

type CustomProtocolCardProps = {
  protocol: CustomProtocol;
  onPress: () => void;
  onEdit: () => void;
};

const renderChips = (protocol: CustomProtocol) => {
  const chips = [
    `In ${formatSecondsLabel(protocol.inhaleSec)}`,
    `Out ${formatSecondsLabel(protocol.exhaleSec)}`,
  ];

  if (protocol.holdAfterInhaleSec > 0) {
    chips.push(`Hold in ${formatSecondsLabel(protocol.holdAfterInhaleSec)}`);
  }

  if (protocol.holdAfterExhaleSec > 0) {
    chips.push(`Hold out ${formatSecondsLabel(protocol.holdAfterExhaleSec)}`);
  }

  return [...chips.slice(0, 3), formatTargetLabel(protocol.target)];
};

export const CustomProtocolCard = ({
  protocol,
  onPress,
  onEdit,
}: CustomProtocolCardProps) => {
  const cycleDurationSec = getCustomProtocolCycleDurationSec(protocol);
  const chips = renderChips(protocol);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.outer, pressed && styles.outerPressed]}>
      <LinearGradient
        colors={["#12333C", "#0A161C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text style={styles.kicker}>Custom</Text>
            <Text numberOfLines={1} style={styles.title}>
              {protocol.name}
            </Text>
          </View>

          <TouchableOpacity
            onPress={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            style={styles.editButton}
          >
            <Feather name="edit-3" size={16} color="#D9F6F1" />
          </TouchableOpacity>
        </View>

        <BreathPatternPreview
          compact
          inhaleSec={protocol.inhaleSec}
          holdAfterInhaleSec={protocol.holdAfterInhaleSec}
          exhaleSec={protocol.exhaleSec}
          holdAfterExhaleSec={protocol.holdAfterExhaleSec}
        />

        <View style={styles.chips}>
          {chips.slice(0, 4).map((chip) => (
            <View key={chip} style={styles.chip}>
              <Text style={styles.chipText}>{chip}</Text>
            </View>
          ))}
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{formatSecondsLabel(cycleDurationSec)} cycle</Text>
          <Feather name="play-circle" size={18} color="#D9F6F1" />
        </View>
      </LinearGradient>
    </Pressable>
  );
};

type CreateProtocolCardProps = {
  onPress: () => void;
};

export const CreateProtocolCard = ({ onPress }: CreateProtocolCardProps) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.outer, pressed && styles.outerPressed]}>
    <LinearGradient
      colors={["#2A193A", "#130D1E"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, styles.createCard]}
    >
      <View style={styles.createIcon}>
        <Feather name="plus" size={20} color="#F9E7FF" />
      </View>
      <Text style={styles.createTitle}>Create custom protocol</Text>
      <Text style={styles.createBody}>
        Set your own inhale, hold, exhale, and session target.
      </Text>
    </LinearGradient>
  </Pressable>
);

const styles = StyleSheet.create({
  outer: {
    width: 244,
    borderRadius: 24,
  },
  outerPressed: {
    transform: [{ scale: 0.985 }],
  },
  card: {
    minHeight: 206,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    justifyContent: "space-between",
  },
  createCard: {
    borderColor: "rgba(255,255,255,0.12)",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    color: "#8FD2C9",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  chipText: {
    color: "#ECFFFC",
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  metaRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaText: {
    color: "#9EC4CC",
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  createIcon: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  createTitle: {
    marginTop: 18,
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },
  createBody: {
    marginTop: 10,
    color: "#CFC6DA",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
});
