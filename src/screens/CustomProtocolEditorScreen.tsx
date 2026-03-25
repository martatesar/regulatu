import React, { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { RootStackParamList } from "../app/navigation";
import { BreathPatternPreview } from "../components/BreathPatternPreview";
import { StepperField } from "../components/StepperField";
import {
  cloneCustomProtocolDraft,
  createCustomProtocolRecord,
  createDefaultCustomProtocolDraft,
  draftsEqual,
  formatSecondsLabel,
  formatTargetLabel,
  getCustomProtocolBreathsPerMinute,
  getCustomProtocolCycleDurationSec,
  isValidCustomProtocolDraft,
  QUICK_FILL_PRESETS,
  toCustomProtocolDraft,
} from "../features/customProtocols/model";
import { useSettingsStore } from "../store/settingsStore";

type CustomProtocolEditorRouteProp = RouteProp<
  RootStackParamList,
  "CustomProtocolEditor"
>;

type CustomProtocolEditorNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "CustomProtocolEditor"
>;

const HOLD_STEP = 0.5;
const TARGET_STEP_SHORT = 30;
const TARGET_STEP_LONG = 60;
const DEFAULT_ROUNDS = 10;
const DEFAULT_TIME_SECONDS = 180;

export const CustomProtocolEditorScreen = () => {
  const navigation = useNavigation<CustomProtocolEditorNavigationProp>();
  const route = useRoute<CustomProtocolEditorRouteProp>();
  const protocolId = route.params?.protocolId;

  const {
    customProtocols,
    addCustomProtocol,
    updateCustomProtocol,
    deleteCustomProtocol,
  } = useSettingsStore();

  const existingProtocol = customProtocols.find(
    (protocol) => protocol.id === protocolId,
  );

  const initialDraft = existingProtocol
    ? cloneCustomProtocolDraft(toCustomProtocolDraft(existingProtocol))
    : createDefaultCustomProtocolDraft();

  const initialDraftRef = useRef(initialDraft);
  const timeTargetRef = useRef(
    initialDraft.target.mode === "time"
      ? initialDraft.target.durationSec
      : DEFAULT_TIME_SECONDS,
  );
  const roundsTargetRef = useRef(
    initialDraft.target.mode === "rounds"
      ? initialDraft.target.rounds
      : DEFAULT_ROUNDS,
  );

  const [draft, setDraft] = useState(initialDraft);

  const isEditing = !!existingProtocol;
  const isDirty = !draftsEqual(draft, initialDraftRef.current);
  const isValid = isValidCustomProtocolDraft(draft);
  const cycleDurationSec = getCustomProtocolCycleDurationSec(draft);
  const breathsPerMinute = getCustomProtocolBreathsPerMinute(draft);

  const updateDraft = (
    updater: (
      current: typeof draft,
    ) => typeof draft,
  ) => {
    setDraft((current) => updater(current));
  };

  const adjustPhase = (
    key:
      | "inhaleSec"
      | "exhaleSec"
      | "holdAfterInhaleSec"
      | "holdAfterExhaleSec",
    delta: number,
    minValue: number,
  ) => {
    updateDraft((current) => ({
      ...current,
      [key]: Math.max(minValue, Number((current[key] + delta).toFixed(1))),
    }));
  };

  const adjustTimeTarget = (delta: number) => {
    const currentValue =
      draft.target.mode === "time"
        ? draft.target.durationSec
        : timeTargetRef.current;
    const currentStep = currentValue >= 300 ? TARGET_STEP_LONG : TARGET_STEP_SHORT;
    const nextValue = Math.max(TARGET_STEP_SHORT, currentValue + delta * currentStep);
    timeTargetRef.current = nextValue;

    updateDraft((current) => ({
      ...current,
      target:
        current.target.mode === "time"
          ? { mode: "time", durationSec: nextValue }
          : current.target,
    }));
  };

  const adjustRoundsTarget = (delta: number) => {
    const currentValue =
      draft.target.mode === "rounds"
        ? draft.target.rounds
        : roundsTargetRef.current;
    const nextValue = Math.max(1, currentValue + delta);
    roundsTargetRef.current = nextValue;

    updateDraft((current) => ({
      ...current,
      target:
        current.target.mode === "rounds"
          ? { mode: "rounds", rounds: nextValue }
          : current.target,
    }));
  };

  const applyQuickFill = (
    values: {
      inhaleSec: number;
      holdAfterInhaleSec: number;
      exhaleSec: number;
      holdAfterExhaleSec: number;
    },
  ) => {
    updateDraft((current) => ({
      ...current,
      ...values,
    }));
  };

  const switchTargetMode = (mode: "time" | "rounds") => {
    if (draft.target.mode === mode) {
      return;
    }

    updateDraft((current) => ({
      ...current,
      target:
        mode === "time"
          ? { mode: "time", durationSec: timeTargetRef.current }
          : { mode: "rounds", rounds: roundsTargetRef.current },
    }));
  };

  const saveProtocol = (startAfterSave: boolean) => {
    if (!isValid) {
      return;
    }

    const savedProtocol = createCustomProtocolRecord(
      draft,
      existingProtocol?.id,
      existingProtocol?.createdAt,
    );

    if (existingProtocol) {
      updateCustomProtocol({
        ...savedProtocol,
        lastUsedAt: existingProtocol.lastUsedAt,
      });
    } else {
      addCustomProtocol(savedProtocol);
    }

    if (startAfterSave) {
      navigation.replace("Session", {
        source: "custom",
        protocolId: savedProtocol.id,
      });
      return;
    }

    navigation.goBack();
  };

  const handleDelete = () => {
    if (!existingProtocol) {
      return;
    }

    Alert.alert(
      "Delete protocol?",
      `Remove "${existingProtocol.name}" from your saved protocols?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteCustomProtocol(existingProtocol.id);
            navigation.goBack();
          },
        },
      ],
    );
  };

  const handleClose = () => {
    if (!isDirty) {
      navigation.goBack();
      return;
    }

    Alert.alert("Discard changes?", "Your protocol changes have not been saved.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => navigation.goBack(),
      },
    ]);
  };

  return (
    <LinearGradient colors={["#12101F", "#05070B"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.safeArea}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Custom protocol</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Feather name="x" size={22} color="#CFD5E2" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <LinearGradient
              colors={["rgba(79,171,160,0.25)", "rgba(19,28,38,0.92)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <Text style={styles.heroEyebrow}>Your rhythm</Text>
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                placeholder="My breathing"
                placeholderTextColor="#708097"
                style={styles.nameInput}
                value={draft.name}
                onChangeText={(name) =>
                  updateDraft((current) => ({
                    ...current,
                    name,
                  }))
                }
              />

              <Text style={styles.heroSummary}>
                {formatSecondsLabel(draft.inhaleSec)} in / {formatSecondsLabel(draft.exhaleSec)} out /{" "}
                {formatTargetLabel(draft.target)}
              </Text>
              <Text style={styles.heroMeta}>
                {formatSecondsLabel(cycleDurationSec)} cycle • {breathsPerMinute.toFixed(1)} breaths/min
              </Text>

              <View style={styles.heroPreview}>
                <BreathPatternPreview
                  inhaleSec={draft.inhaleSec}
                  holdAfterInhaleSec={draft.holdAfterInhaleSec}
                  exhaleSec={draft.exhaleSec}
                  holdAfterExhaleSec={draft.holdAfterExhaleSec}
                />
              </View>
            </LinearGradient>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Start from</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickFillRow}
              >
                {QUICK_FILL_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.id}
                    style={styles.quickFillChip}
                    onPress={() => applyQuickFill(preset.values)}
                  >
                    <Text style={styles.quickFillText}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Breath cycle</Text>
                <Text style={styles.cardMeta}>Edit in sequence</Text>
              </View>

              <View style={styles.cardBody}>
                <StepperField
                  label="Inhale"
                  valueLabel={formatSecondsLabel(draft.inhaleSec)}
                  onDecrement={() => adjustPhase("inhaleSec", -HOLD_STEP, 1)}
                  onIncrement={() => adjustPhase("inhaleSec", HOLD_STEP, 1)}
                  canDecrement={draft.inhaleSec > 1}
                />

                <StepperField
                  label="Hold after inhale"
                  valueLabel={formatSecondsLabel(draft.holdAfterInhaleSec)}
                  onDecrement={() =>
                    adjustPhase("holdAfterInhaleSec", -HOLD_STEP, 0)
                  }
                  onIncrement={() =>
                    adjustPhase("holdAfterInhaleSec", HOLD_STEP, 0)
                  }
                  canDecrement={draft.holdAfterInhaleSec > 0}
                  helperText="Optional"
                />

                <StepperField
                  label="Exhale"
                  valueLabel={formatSecondsLabel(draft.exhaleSec)}
                  onDecrement={() => adjustPhase("exhaleSec", -HOLD_STEP, 1)}
                  onIncrement={() => adjustPhase("exhaleSec", HOLD_STEP, 1)}
                  canDecrement={draft.exhaleSec > 1}
                />

                <StepperField
                  label="Hold after exhale"
                  valueLabel={formatSecondsLabel(draft.holdAfterExhaleSec)}
                  onDecrement={() =>
                    adjustPhase("holdAfterExhaleSec", -HOLD_STEP, 0)
                  }
                  onIncrement={() =>
                    adjustPhase("holdAfterExhaleSec", HOLD_STEP, 0)
                  }
                  canDecrement={draft.holdAfterExhaleSec > 0}
                  helperText="Optional"
                />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Session target</Text>
                <Text style={styles.cardMeta}>Read-only during the session</Text>
              </View>

              <View style={styles.segmented}>
                <TouchableOpacity
                  onPress={() => switchTargetMode("time")}
                  style={[
                    styles.segment,
                    draft.target.mode === "time" && styles.segmentActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      draft.target.mode === "time" && styles.segmentTextActive,
                    ]}
                  >
                    Time
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => switchTargetMode("rounds")}
                  style={[
                    styles.segment,
                    draft.target.mode === "rounds" && styles.segmentActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      draft.target.mode === "rounds" && styles.segmentTextActive,
                    ]}
                  >
                    Rounds
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardBody}>
                {draft.target.mode === "time" ? (
                  <StepperField
                    label="Duration"
                    valueLabel={formatTargetLabel(draft.target)}
                    onDecrement={() => adjustTimeTarget(-1)}
                    onIncrement={() => adjustTimeTarget(1)}
                    canDecrement={draft.target.durationSec > TARGET_STEP_SHORT}
                    helperText="30s below 5m, then 60s"
                  />
                ) : (
                  <StepperField
                    label="Rounds"
                    valueLabel={`${draft.target.rounds}`}
                    onDecrement={() => adjustRoundsTarget(-1)}
                    onIncrement={() => adjustRoundsTarget(1)}
                    canDecrement={draft.target.rounds > 1}
                    helperText="One full cycle per round"
                  />
                )}
              </View>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              disabled={!isValid}
              onPress={() => saveProtocol(true)}
              style={[
                styles.primaryButton,
                !isValid && styles.buttonDisabledState,
              ]}
            >
              <Text style={styles.primaryButtonText}>Save and start</Text>
            </TouchableOpacity>

            <View style={styles.footerSecondaryRow}>
              <TouchableOpacity
                disabled={!isValid}
                onPress={() => saveProtocol(false)}
                style={[
                  styles.secondaryButton,
                  !isValid && styles.buttonDisabledState,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Save</Text>
              </TouchableOpacity>

              {isEditing ? (
                <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 18,
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  heroEyebrow: {
    color: "#8FD2C9",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  nameInput: {
    marginTop: 12,
    paddingVertical: 0,
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "700",
  },
  heroSummary: {
    marginTop: 12,
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  heroMeta: {
    marginTop: 6,
    color: "#A0B5B7",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  heroPreview: {
    marginTop: 18,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    color: "#91A7AF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  quickFillRow: {
    gap: 10,
    paddingRight: 20,
  },
  quickFillChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  quickFillText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 18,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },
  cardMeta: {
    color: "#8EA0BA",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  cardBody: {
    gap: 16,
  },
  segmented: {
    flexDirection: "row",
    gap: 10,
    padding: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 12,
  },
  segmentActive: {
    backgroundColor: "rgba(143,210,201,0.18)",
    borderWidth: 1,
    borderColor: "rgba(143,210,201,0.28)",
  },
  segmentText: {
    color: "#9CAFC3",
    fontSize: 15,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  bottomSpacer: {
    height: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(8,10,14,0.95)",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: "#2A8C81",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  footerSecondaryRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  deleteButtonText: {
    color: "#F3A5A5",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonDisabledState: {
    opacity: 0.45,
  },
});
