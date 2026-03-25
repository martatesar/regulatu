import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

type StepperFieldProps = {
  label: string;
  valueLabel: string;
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement?: boolean;
  helperText?: string;
  accentColor?: string;
};

export const StepperField = ({
  label,
  valueLabel,
  onDecrement,
  onIncrement,
  canDecrement = true,
  helperText,
  accentColor = "#8FD2C9",
}: StepperFieldProps) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
      </View>

      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          disabled={!canDecrement}
          onPress={onDecrement}
          style={({ pressed }) => [
            styles.button,
            !canDecrement && styles.buttonDisabled,
            pressed && canDecrement && styles.buttonPressed,
          ]}
        >
          <Feather name="minus" size={18} color={canDecrement ? "#FFFFFF" : "#556070"} />
        </Pressable>

        <View style={[styles.valuePill, { borderColor: `${accentColor}55` }]}>
          <Text style={styles.value}>{valueLabel}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          onPress={onIncrement}
          style={({ pressed }) => [
            styles.button,
            styles.buttonAccent,
            { borderColor: `${accentColor}66` },
            pressed && styles.buttonPressed,
          ]}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  helperText: {
    color: "#8190A8",
    fontSize: 12,
    fontWeight: "600",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  buttonAccent: {
    backgroundColor: "rgba(108, 179, 168, 0.18)",
  },
  buttonDisabled: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.04)",
  },
  buttonPressed: {
    transform: [{ scale: 0.96 }],
  },
  valuePill: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
  },
  value: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.4,
  },
});
