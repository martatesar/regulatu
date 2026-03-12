import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";

import { RootStackParamList } from "../app/navigation";
import { BreathingCircle } from "../components/BreathingCircle";
import { useSettingsStore } from "../store/settingsStore";
import { typography } from "../theme/typography";

type CO2BaselineNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "CO2Baseline"
>;

type AssessmentStage = "intro" | "prep" | "hold" | "result";
type CirclePhase = "inhale" | "hold-inhale" | "exhale" | "hold-exhale";

const PREP_INHALE_SEC = 4;
const PREP_EXHALE_SEC = 6;
const PREP_CYCLES = 3;
const TOTAL_MEASUREMENTS = 3;
const MAX_HOLD_SEC = 60;
const GRAPH_MARKERS = [0, 10, 25, 35, 45, 55, 60] as const;

const REFERENCE_BANDS = [
  {
    min: 0,
    max: 10,
    label: "Very low",
    shortLabel: "<10s",
    color: "#FF6B6B",
    detail:
      "Markedly below common adult reference ranges reported for comfortable post-exhale breath-hold timing.",
  },
  {
    min: 10,
    max: 25,
    label: "Below healthy reference",
    shortLabel: "10-24s",
    color: "#8E6CFF",
    detail:
      "Below the lower end of healthy adult reference values reported in published cohorts.",
  },
  {
    min: 25,
    max: 35,
    label: "Lower healthy reference",
    shortLabel: "25-34s",
    color: "#568BFF",
    detail:
      "Aligned with lower healthy-adult reference values, including cohorts with average times around 30 seconds.",
  },
  {
    min: 35,
    max: 45,
    label: "Mid healthy reference",
    shortLabel: "35-44s",
    color: "#1CB5A3",
    detail:
      "Within the middle of published healthy-adult reference ranges for post-exhale breath-hold timing.",
  },
  {
    min: 45,
    max: 55,
    label: "Upper healthy reference",
    shortLabel: "45-54s",
    color: "#5ED36A",
    detail:
      "Aligned with the upper end of published healthy-adult reference values, including non-obese healthy cohorts.",
  },
  {
    min: 55,
    max: Number.POSITIVE_INFINITY,
    label: "Above reference range",
    shortLabel: "55s+",
    color: "#F5B94C",
    detail:
      "Above the most commonly reported healthy-adult reference values in the studies used for this scale.",
  },
] as const;

const getResultBand = (seconds: number) =>
  REFERENCE_BANDS.find((band) => seconds >= band.min && seconds < band.max) ?? REFERENCE_BANDS[0];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const CO2ReferenceGraph = ({ seconds }: { seconds: number }) => {
  const markerLeft = `${(clamp(seconds, 0, MAX_HOLD_SEC) / MAX_HOLD_SEC) * 100}%` as const;
  const resultBand = getResultBand(seconds);

  return (
    <View style={styles.graphCard}>
      <Text style={styles.graphTitle}>CO2 tolerance reference graph</Text>
      <Text style={styles.graphSubtitle}>
        Based on published healthy-adult cohorts. Reference values vary by protocol and population.
      </Text>

      <View style={styles.graphTrackWrap}>
        <View style={styles.graphTrack}>
          {REFERENCE_BANDS.map((band) => (
            <View
              key={band.label}
              style={[
                styles.graphSegment,
                {
                  backgroundColor: band.color,
                  opacity: band.label === resultBand.label ? 1 : 0.45,
                  flex:
                    clamp(
                      (Number.isFinite(band.max) ? band.max : MAX_HOLD_SEC) - band.min,
                      0,
                      MAX_HOLD_SEC,
                    ) || 1,
                },
              ]}
            />
          ))}
        </View>

        <View style={[styles.graphMarkerWrap, { left: markerLeft }]}>
          <View style={styles.graphMarkerLine} />
          <View style={styles.graphMarkerDot} />
        </View>
      </View>

      <View style={styles.graphScale}>
        {GRAPH_MARKERS.map((marker) => (
          <Text
            key={marker}
            style={[
              styles.graphScaleText,
              {
                left: `${(marker / MAX_HOLD_SEC) * 100}%` as const,
                transform:
                  marker === 0
                    ? [{ translateX: 0 }]
                    : marker === MAX_HOLD_SEC
                      ? [{ translateX: -18 }]
                      : [{ translateX: -12 }],
              },
            ]}
          >
            {marker}s
          </Text>
        ))}
      </View>

      <View style={styles.graphLegend}>
        {REFERENCE_BANDS.map((band) => (
          <View key={band.label} style={styles.graphLegendRow}>
            <View style={[styles.graphLegendSwatch, { backgroundColor: band.color }]} />
            <Text style={styles.graphLegendText}>
              {band.shortLabel} {band.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export const CO2BaselineScreen = () => {
  useKeepAwake();

  const navigation = useNavigation<CO2BaselineNavigationProp>();
  const { hapticsEnabled } = useSettingsStore();

  const [stage, setStage] = useState<AssessmentStage>("intro");
  const [circlePhase, setCirclePhase] = useState<CirclePhase>("inhale");
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [prepCycleIndex, setPrepCycleIndex] = useState(0);
  const [measurementIndex, setMeasurementIndex] = useState(0);
  const [holdResults, setHoldResults] = useState<number[]>([]);
  const [resultSeconds, setResultSeconds] = useState<number | null>(null);

  const holdStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" && (stage === "prep" || stage === "hold")) {
        setStage("intro");
        setCirclePhase("inhale");
        setPhaseProgress(0);
        setHoldSeconds(0);
        setPrepCycleIndex(0);
        setMeasurementIndex(0);
        setHoldResults([]);
        setResultSeconds(null);
        holdStartedAtRef.current = null;
      }
    });

    return () => {
      subscription.remove();
    };
  }, [stage]);

  useEffect(() => {
    if (hapticsEnabled) {
      if (stage === "prep" && circlePhase === "inhale") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (stage === "prep" && circlePhase === "exhale") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 200);
      } else if (stage === "hold") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 200);
      }
    }
  }, [circlePhase, hapticsEnabled, stage]);

  const resetToPrep = (nextMeasurementIndex: number) => {
    setMeasurementIndex(nextMeasurementIndex);
    setPrepCycleIndex(0);
    setCirclePhase("inhale");
    setHoldSeconds(0);
    setPhaseProgress(0);
    setStage("prep");
  };

  const completeMeasurement = (seconds: number) => {
    const rounded = Math.max(0, Number(seconds.toFixed(1)));
    const nextResults = [...holdResults, rounded];

    setHoldResults(nextResults);
    setHoldSeconds(0);
    setPhaseProgress(0);
    holdStartedAtRef.current = null;

    if (nextResults.length >= TOTAL_MEASUREMENTS) {
      const average =
        nextResults.reduce((sum, value) => sum + value, 0) / nextResults.length;
      setResultSeconds(Number(average.toFixed(1)));
      setStage("result");
      return;
    }

    resetToPrep(nextResults.length);
  };

  useEffect(() => {
    if (stage !== "prep" && stage !== "hold") {
      return;
    }

    if (stage === "hold") {
      setCirclePhase("hold-exhale");
      holdStartedAtRef.current = Date.now();
      setHoldSeconds(0);
    }

    const phaseDuration =
      stage === "prep"
        ? circlePhase === "inhale"
          ? PREP_INHALE_SEC
          : PREP_EXHALE_SEC
        : MAX_HOLD_SEC;

    const interval = setInterval(() => {
      if (stage === "hold" && holdStartedAtRef.current) {
        const elapsed = (Date.now() - holdStartedAtRef.current) / 1000;
        setHoldSeconds(elapsed);
        setPhaseProgress(Math.min(elapsed / MAX_HOLD_SEC, 1));
        return;
      }

      const now = Date.now();
      const elapsed = (now - phaseStartedAt) / 1000;
      setPhaseProgress(Math.min(elapsed / phaseDuration, 1));
    }, 50);

    const phaseStartedAt = Date.now();

    const timeout =
      stage === "hold"
        ? setTimeout(() => {
            completeMeasurement(MAX_HOLD_SEC);
          }, MAX_HOLD_SEC * 1000)
        : setTimeout(() => {
            setPhaseProgress(1);
            if (circlePhase === "inhale") {
              setCirclePhase("exhale");
              return;
            }

            if (prepCycleIndex + 1 >= PREP_CYCLES) {
              setStage("hold");
              return;
            }

            setPrepCycleIndex((current) => current + 1);
            setCirclePhase("inhale");
          }, phaseDuration * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [circlePhase, prepCycleIndex, stage, holdResults]);

  const resultBand = useMemo(
    () => (resultSeconds === null ? null : getResultBand(resultSeconds)),
    [resultSeconds],
  );

  const hasConsistencyWarning = useMemo(() => {
    if (holdResults.length < TOTAL_MEASUREMENTS) {
      return false;
    }

    const average =
      holdResults.reduce((sum, value) => sum + value, 0) / holdResults.length;

    if (average <= 0) {
      return false;
    }

    const min = Math.min(...holdResults);
    const max = Math.max(...holdResults);

    return (max - min) / average > 0.1;
  }, [holdResults]);

  const startAssessment = () => {
    setResultSeconds(null);
    setHoldResults([]);
    resetToPrep(0);
  };

  const stopAtImpulse = () => {
    if (stage !== "hold" || holdStartedAtRef.current === null) {
      return;
    }

    const elapsed = (Date.now() - holdStartedAtRef.current) / 1000;
    completeMeasurement(elapsed);
  };

  const getTitle = () => {
    if (stage === "result") return "CO2 Tolerance Baseline";
    if (stage === "hold") return "Tap at the first impulse to breathe";
    return "CO2 Tolerance Baseline";
  };

  const getDescription = () => {
    if (stage === "intro") {
      return "Each round uses 3 guided breath cycles followed by 1 post-exhale hold. Your result is the average of 3 measurements.";
    }

    if (stage === "prep" && circlePhase === "inhale") {
      return "Inhale gently through the nose.";
    }

    if (stage === "prep" && circlePhase === "exhale") {
      return "Exhale softly through the nose. Do not force the air out.";
    }

    if (stage === "hold") {
      return "Hold after the exhale. Stop at the first impulse to breathe. Do not push past it.";
    }

    return "Measured from the end of the exhale to the first breathing impulse. Baseline only, not a medical measurement.";
  };

  const getNextPhase = (): CirclePhase | undefined => {
    if (stage === "prep" && circlePhase === "inhale") return "exhale";
    if (stage === "prep" && circlePhase === "exhale") {
      return prepCycleIndex + 1 >= PREP_CYCLES ? "hold-exhale" : "inhale";
    }
    return undefined;
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <LinearGradient colors={["#12101F", "#030303"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.iconButton}>
            <Feather name="x" size={24} color="#8A8A9E" />
          </TouchableOpacity>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>Assessment</Text>
          </View>
          <View style={styles.iconSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={stage === "result"}
        >
          <View style={styles.content}>
            <Text style={[typography.h1, styles.title]}>{getTitle()}</Text>
            <Text style={styles.description}>{getDescription()}</Text>

            {stage !== "intro" && stage !== "result" && (
              <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>
                  Test {measurementIndex + 1} of {TOTAL_MEASUREMENTS}
                </Text>
                <Text style={styles.statusValue}>
                  {stage === "hold"
                    ? `Hold after ${PREP_CYCLES} guided breath cycles`
                    : `Breath cycle ${prepCycleIndex + 1} of ${PREP_CYCLES}`}
                </Text>
              </View>
            )}

            {stage !== "result" ? (
              <View style={styles.circleWrap}>
                <BreathingCircle
                  phase={circlePhase}
                  durationSec={
                    stage === "prep" && circlePhase === "inhale"
                      ? PREP_INHALE_SEC
                      : stage === "prep" && circlePhase === "exhale"
                        ? PREP_EXHALE_SEC
                        : MAX_HOLD_SEC
                  }
                  isActive={stage === "prep"}
                  nextPhase={getNextPhase()}
                  progress={phaseProgress}
                />
              </View>
            ) : (
              <View style={styles.resultCenterWrap}>
                {resultSeconds !== null && <CO2ReferenceGraph seconds={resultSeconds} />}
              </View>
            )}

            {stage === "hold" && (
              <View style={styles.liveReadout}>
                <Text style={styles.liveLabel}>Measure to the first breathing impulse</Text>
              </View>
            )}

            {stage === "result" && resultSeconds !== null && resultBand && (
              <View style={styles.resultCard}>
                <Text style={styles.resultEyebrow}>Average CO2 tolerance</Text>
                <Text style={styles.resultValue}>{resultSeconds.toFixed(1)}s</Text>
                <Text style={styles.resultBand}>{resultBand.label}</Text>
                <Text style={styles.resultDetail}>{resultBand.detail}</Text>
                <View style={styles.measurementList}>
                  {holdResults.map((value, index) => (
                    <View key={`${value}-${index}`} style={styles.measurementRow}>
                      <Text style={styles.measurementLabel}>Test {index + 1}</Text>
                      <Text style={styles.measurementValue}>{value.toFixed(1)}s</Text>
                    </View>
                  ))}
                </View>
                {hasConsistencyWarning && (
                  <View style={styles.warningCard}>
                    <Text style={styles.warningTitle}>Repeat recommended</Text>
                    <Text style={styles.warningText}>
                      Your 3 measurements differed by more than 10%. These values
                      should stay fairly close. This usually means one or more
                      holds went past the first breathing impulse or the test was
                      not performed consistently.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {stage === "intro" && (
              <View style={styles.footerBlock}>
                <View style={styles.noteCard}>
                  <Text style={styles.noteTitle}>Measurement rule</Text>
                  <Text style={styles.noteText}>
                    This is not a maximum breath hold. Each test begins after 3 calm breath cycles. Stop every hold at the first clear impulse to breathe.
                  </Text>
                </View>

                <TouchableOpacity style={styles.primaryButton} onPress={startAssessment}>
                  <Text style={styles.primaryButtonText}>Start baseline</Text>
                </TouchableOpacity>
              </View>
            )}

            {stage === "hold" && (
              <TouchableOpacity style={styles.primaryButton} onPress={stopAtImpulse}>
                <Text style={styles.primaryButtonText}>First breathing impulse</Text>
              </TouchableOpacity>
            )}

            {stage === "result" && (
              <View style={styles.footerBlock}>
                <TouchableOpacity style={styles.primaryButton} onPress={startAssessment}>
                  <Text style={styles.primaryButtonText}>Measure again</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryButton} onPress={handleClose}>
                  <Text style={styles.secondaryButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconSpacer: {
    width: 40,
  },
  headerBadge: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerBadgeText: {
    color: "#8A8A9E",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  title: {
    textAlign: "center",
    marginTop: 8,
  },
  description: {
    marginTop: 14,
    maxWidth: 320,
    textAlign: "center",
    color: "#A8A8B8",
    fontSize: 15,
    lineHeight: 23,
  },
  statusCard: {
    width: "100%",
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statusLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  statusValue: {
    marginTop: 4,
    color: "#8A8A9E",
    fontSize: 12,
    letterSpacing: 0.3,
  },
  circleWrap: {
    flex: 1,
    minHeight: 360,
    alignItems: "center",
    justifyContent: "center",
  },
  resultCenterWrap: {
    flex: 1,
    width: "100%",
    minHeight: 360,
    alignItems: "center",
    justifyContent: "center",
  },
  liveReadout: {
    marginTop: -12,
    marginBottom: 18,
    alignItems: "center",
  },
  liveValue: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  liveLabel: {
    marginTop: 6,
    color: "#8A8A9E",
    fontSize: 13,
    letterSpacing: 0.3,
  },
  graphCard: {
    width: "100%",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  graphTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  graphSubtitle: {
    marginTop: 8,
    color: "#8A8A9E",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  graphTrackWrap: {
    marginTop: 22,
    position: "relative",
  },
  graphTrack: {
    height: 16,
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  graphSegment: {
    flex: 1,
    height: "100%",
  },
  graphMarkerWrap: {
    position: "absolute",
    top: -14,
    marginLeft: -7,
    alignItems: "center",
  },
  graphMarkerLine: {
    width: 2,
    height: 44,
    backgroundColor: "#FFFFFF",
    opacity: 0.9,
  },
  graphMarkerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: -2,
    backgroundColor: "#FFFFFF",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  graphScale: {
    marginTop: 8,
    position: "relative",
    height: 16,
  },
  graphScaleText: {
    position: "absolute",
    color: "#78788E",
    fontSize: 11,
    fontWeight: "600",
  },
  graphLegend: {
    marginTop: 18,
    gap: 8,
  },
  graphLegendRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  graphLegendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  graphLegendText: {
    color: "#C4C4D2",
    fontSize: 13,
    lineHeight: 18,
  },
  resultCard: {
    width: "100%",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 24,
    marginTop: 16,
    marginBottom: 20,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  resultEyebrow: {
    color: "#8A8A9E",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  resultValue: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  resultBand: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
  },
  resultDetail: {
    marginTop: 10,
    textAlign: "center",
    color: "#A8A8B8",
    fontSize: 14,
    lineHeight: 21,
  },
  measurementList: {
    width: "100%",
    marginTop: 18,
    paddingTop: 8,
    gap: 10,
  },
  measurementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  measurementLabel: {
    color: "#C4C4D2",
    fontSize: 14,
    fontWeight: "500",
  },
  measurementValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  warningCard: {
    width: "100%",
    marginTop: 20,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255, 107, 107, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.22)",
  },
  warningTitle: {
    color: "#FFD7D7",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  warningText: {
    color: "#F1C9C9",
    fontSize: 13,
    lineHeight: 19,
  },
  footerBlock: {
    width: "100%",
  },
  noteCard: {
    width: "100%",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  noteTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  noteText: {
    color: "#A8A8B8",
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  secondaryButton: {
    width: "100%",
    paddingVertical: 18,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#8A8A9E",
    fontSize: 16,
    fontWeight: "600",
  },
});
