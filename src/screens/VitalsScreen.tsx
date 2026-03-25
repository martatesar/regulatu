import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useKeepAwake } from "expo-keep-awake";

import { RootStackParamList } from "../app/navigation";
import {
  HrvStatusEvent,
  VitalsMeasurementResult,
} from "../features/hrv/types";
import {
  addHrvStatusListener,
  finishVitalsMeasurement,
  getHrvPermissionStatus,
  isHrvModuleAvailable,
  requestHrvPermission,
  resetVitalsMeasurementWindow,
  startHrvCapture,
  stopHrvCapture,
} from "../native/rezetCameraHrv";
import { RezetCameraHrvPreview } from "../native/RezetCameraHrvPreview";
import { colors } from "../theme/colors";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Vitals">;

type MeasurementPhase =
  | "checking"
  | "permission"
  | "ready"
  | "measuring"
  | "processing"
  | "complete"
  | "unavailable"
  | "error";

const emptyStatus: HrvStatusEvent = {
  state: "off",
  signalQuality: "low",
  fingerDetected: false,
};

const MEASUREMENT_DURATION_MS = 60_000;

export const VitalsScreen = () => {
  useKeepAwake();
  const navigation = useNavigation<NavigationProp>();

  const [phase, setPhase] = useState<MeasurementPhase>("checking");
  const [status, setStatus] = useState<HrvStatusEvent>(emptyStatus);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<VitalsMeasurementResult>();
  const [measurementNotice, setMeasurementNotice] = useState<string>();

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const measurementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measurementStartedAtRef = useRef<number | null>(null);
  const autoStartRequestedRef = useRef(false);

  const clearMeasurementTimers = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    if (measurementTimeoutRef.current) {
      clearTimeout(measurementTimeoutRef.current);
      measurementTimeoutRef.current = null;
    }
  }, []);

  const ensureCaptureRunning = useCallback(async () => {
    await startHrvCapture({
      torchPreferred: true,
      updateIntervalMs: 1000,
    });
    setStatus({
      state: "finding_signal",
      signalQuality: "low",
      fingerDetected: false,
    });
  }, []);

  const bootstrap = useCallback(async () => {
    if (!(await isHrvModuleAvailable())) {
      setPhase("unavailable");
      return;
    }

    const permission = await getHrvPermissionStatus();
    if (permission !== "granted") {
      setPhase("permission");
      return;
    }

    try {
      await ensureCaptureRunning();
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [ensureCaptureRunning]);

  const finishMeasurement = useCallback(async () => {
    clearMeasurementTimers();
    measurementStartedAtRef.current = null;
    setElapsedMs(MEASUREMENT_DURATION_MS);
    setPhase("processing");

    const nextResult = await finishVitalsMeasurement();
    await stopHrvCapture();
    setStatus(emptyStatus);
    setResult(nextResult);
    setPhase("complete");
  }, [clearMeasurementTimers]);

  const handleStartMeasurement = useCallback(async () => {
    try {
      clearMeasurementTimers();
      autoStartRequestedRef.current = true;
      setElapsedMs(0);
      setResult(undefined);
      setMeasurementNotice(undefined);
      await resetVitalsMeasurementWindow();
      measurementStartedAtRef.current = Date.now();
      setPhase("measuring");

      progressIntervalRef.current = setInterval(() => {
        if (!measurementStartedAtRef.current) {
          return;
        }

        const nextElapsed = Math.min(
          Date.now() - measurementStartedAtRef.current,
          MEASUREMENT_DURATION_MS,
        );
        setElapsedMs(nextElapsed);
      }, 250);

      measurementTimeoutRef.current = setTimeout(() => {
        void finishMeasurement();
      }, MEASUREMENT_DURATION_MS);
    } catch {
      autoStartRequestedRef.current = false;
      setPhase("error");
    }
  }, [clearMeasurementTimers, finishMeasurement]);

  const handlePrepareMeasurement = useCallback(async () => {
    clearMeasurementTimers();
    measurementStartedAtRef.current = null;
    autoStartRequestedRef.current = false;
    setElapsedMs(0);
    setResult(undefined);
    setMeasurementNotice(undefined);

    try {
      await ensureCaptureRunning();
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [clearMeasurementTimers, ensureCaptureRunning]);

  const handleEnableCamera = useCallback(async () => {
    const permission = await requestHrvPermission();
    if (permission !== "granted") {
      setPhase("permission");
      return;
    }

    await bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const subscription = addHrvStatusListener((event) => {
      setStatus(event);
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    void bootstrap();

    return () => {
      clearMeasurementTimers();
      void stopHrvCapture();
    };
  }, [bootstrap, clearMeasurementTimers]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (appState) => {
      if (appState !== "active") {
        clearMeasurementTimers();
        measurementStartedAtRef.current = null;
        autoStartRequestedRef.current = false;
        void stopHrvCapture();
        if (phase === "measuring" || phase === "processing") {
          setPhase("ready");
          setMeasurementNotice(
            "Measurement stopped because the app left the foreground.",
          );
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [clearMeasurementTimers, phase]);

  useEffect(() => {
    if (phase !== "ready") {
      autoStartRequestedRef.current = false;
      return;
    }

    if (
      autoStartRequestedRef.current ||
      status.state !== "measuring" ||
      !status.fingerDetected
    ) {
      return;
    }

    autoStartRequestedRef.current = true;
    void handleStartMeasurement();
  }, [handleStartMeasurement, phase, status.fingerDetected, status.state]);

  useEffect(() => {
    if (phase !== "measuring" || status.fingerDetected) {
      return;
    }

    clearMeasurementTimers();
    measurementStartedAtRef.current = null;
    autoStartRequestedRef.current = false;
    setElapsedMs(0);
    setPhase("ready");
    setMeasurementNotice(
      "Measurement canceled because the pulse signal was lost. Cover the camera and flash again to restart automatically.",
    );
  }, [clearMeasurementTimers, phase, status.fingerDetected]);

  const remainingSeconds = Math.max(
    0,
    Math.ceil((MEASUREMENT_DURATION_MS - elapsedMs) / 1000),
  );
  const progress = Math.min(elapsedMs / MEASUREMENT_DURATION_MS, 1);

  const overlayEyebrow = useMemo(() => {
    if (phase === "processing") {
      return "Analyzing";
    }
    if (phase === "measuring") {
      return "Measurement in progress";
    }
    if (status.state === "measuring" && status.fingerDetected) {
      return "Pulse locked";
    }
    if (status.fingerDetected) {
      return "Finding pulse";
    }
    return "Ready to measure";
  }, [phase, status.fingerDetected, status.state]);

  const statusLine = useMemo(() => {
    if (phase === "processing") {
      return "Processing results";
    }
    if (phase === "measuring") {
      return "Hold steady";
    }
    if (phase === "permission") {
      return "Camera access is required";
    }
    if (phase === "unavailable") {
      return "Vitals measurement unavailable";
    }
    if (phase === "error") {
      return "Measurement unavailable right now";
    }
    if (phase === "complete") {
      return "Measurement complete";
    }
    if (status.state === "low_signal") {
      return status.fingerDetected
        ? "Hold still for pulse lock"
        : "Cover camera and flash";
    }
    if (status.state === "finding_signal") {
      return status.fingerDetected
        ? "Hold still for pulse lock"
        : "Cover camera and flash";
    }
    if (status.state === "measuring") {
      return phase === "ready" ? "Pulse locked" : "Signal locked";
    }
    return "Cover camera and flash";
  }, [phase, status]);

  const overlayBody = useMemo(() => {
    if (phase === "processing") {
      return "Final estimate is being computed from the full 1-minute trace.";
    }
    if (phase === "measuring") {
      return "Keep your finger and phone still until the timer finishes.";
    }
    if (status.state === "measuring" && status.fingerDetected) {
      return "Measurement starts automatically.";
    }
    if (status.fingerDetected) {
      return "Stay still. Measurement starts once the pulse is stable.";
    }
    return "Cover both fully until the preview turns red and the flash stays on.";
  }, [phase, status.fingerDetected, status.state]);

  const progressCaption = useMemo(() => {
    if (phase === "measuring") {
      return `${remainingSeconds}s remaining`;
    }
    if (phase === "processing") {
      return "Finalizing estimate";
    }
    return undefined;
  }, [phase, remainingSeconds]);

  if (phase === "complete") {
    return (
      <LinearGradient colors={["#12101F", "#030303"]} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
            >
              <Feather name="x" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Measure vitals</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.resultScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {result ? (
              <ResultCard result={result} />
            ) : (
              <CalloutCard
                title="Not enough stable signal"
                body="The pulse trace was too unstable to compute vitals from the full minute window. Try covering the lens and flash more completely and holding still."
              />
            )}

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => void handlePrepareMeasurement()}
            >
              <Text style={styles.actionButtonText}>Measure again</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#12101F", "#030303"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="x" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Measure vitals</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.previewShell}>
            <RezetCameraHrvPreview style={styles.preview} />
            <LinearGradient
              colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.72)"]}
              style={styles.previewOverlay}
            >
              <View style={styles.overlayTopRow}>
                <Text style={styles.overlayLabel}>{overlayEyebrow}</Text>
              </View>

              <Text style={styles.overlayTitle}>{statusLine}</Text>
              <Text style={styles.overlayBody}>{overlayBody}</Text>

              <View style={styles.liveStatsRow}>
                <LiveStat
                  label="Pulse"
                  value={
                    typeof status.heartRateBpm === "number"
                      ? `${Math.round(status.heartRateBpm)} bpm`
                      : "--"
                  }
                />
                <LiveStat
                  label="Signal"
                  value={status.signalQuality}
                />
              </View>

              {phase === "measuring" || phase === "processing" ? (
                <>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                  </View>

                  <Text style={styles.progressCaption}>{progressCaption}</Text>
                </>
              ) : null}
            </LinearGradient>
          </View>

          {measurementNotice ? (
            <CalloutCard
              title="Measurement stopped"
              body={measurementNotice}
            />
          ) : null}

          {phase === "permission" ? (
            <CalloutCard
              title="Enable camera access"
              body="Camera access is needed to preview the lens, collect a 1-minute pulse trace, and estimate HRV, heart rate, and breathing rate."
              actionLabel="Enable camera"
              onPress={() => void handleEnableCamera()}
            />
          ) : null}

          {phase === "unavailable" ? (
            <CalloutCard
              title="Unavailable on this device"
              body="This measurement requires the rear camera and flash on iPhone."
            />
          ) : null}

          {phase === "error" ? (
            <CalloutCard
              title="Measurement failed"
              body="Try leaving the screen, reopening it, and keeping the phone still before starting again."
              actionLabel="Try again"
              onPress={() => void handlePrepareMeasurement()}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const LiveStat = ({ label, value }: { label: string; value: string }) => {
  return (
    <View style={styles.liveStat}>
      <Text style={styles.liveStatLabel}>{label}</Text>
      <Text style={styles.liveStatValue}>{value}</Text>
    </View>
  );
};

const CalloutCard = ({
  title,
  body,
  actionLabel,
  onPress,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onPress?: () => void;
}) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
      {actionLabel && onPress ? (
        <TouchableOpacity style={styles.cardAction} onPress={onPress}>
          <Text style={styles.cardActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const ResultCard = ({ result }: { result: VitalsMeasurementResult }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Vitals estimate</Text>
      <View style={styles.resultGrid}>
        <Metric label="HRV" value={`${Math.round(result.averageHrvRmssdMs)} ms`} />
        <Metric label="Heart rate" value={`${Math.round(result.averageHeartRateBpm)} bpm`} />
        <Metric
          label="Breathing"
          value={
            typeof result.estimatedBreathsPerMin === "number"
              ? `${Math.round(result.estimatedBreathsPerMin)} / min`
              : "Low confidence"
          }
        />
        <Metric label="Quality" value={result.quality} />
      </View>
      <Text style={styles.resultFootnote}>
        Estimated from a 1-minute fingertip camera trace using end-of-window
        processing. Breathing is inferred from respiratory sinus arrhythmia:
        heart rate speeds up on inhale and slows on exhale. Breathing rate
        usually changes slowly. Wellness only, not a medical measurement.
      </Text>
    </View>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metric}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

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
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 18,
  },
  resultScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 18,
  },
  previewShell: {
    height: 420,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#05070D",
  },
  preview: {
    ...StyleSheet.absoluteFillObject,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: 20,
  },
  overlayTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  overlayLabel: {
    color: "#A7B3C9",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  overlayQuality: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  overlayTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
  },
  overlayBody: {
    marginTop: 8,
    color: "#C7D0E0",
    fontSize: 15,
    lineHeight: 22,
  },
  liveStatsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  liveStat: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 14,
  },
  liveStatLabel: {
    color: "#A7B3C9",
    fontSize: 12,
    marginBottom: 6,
  },
  liveStatValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  progressTrack: {
    marginTop: 18,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#8FD2C9",
  },
  progressCaption: {
    marginTop: 10,
    color: "#C7D0E0",
    fontSize: 13,
  },
  card: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 18,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  cardBody: {
    color: "#C7D0E0",
    fontSize: 15,
    lineHeight: 22,
  },
  cardAction: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: "#27485B",
    paddingVertical: 14,
    alignItems: "center",
  },
  cardActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  resultGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metric: {
    width: "47%",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 14,
  },
  metricLabel: {
    color: "#A7B3C9",
    fontSize: 12,
    marginBottom: 6,
  },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  resultFootnote: {
    marginTop: 14,
    color: "#95A0B4",
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    borderRadius: 18,
    backgroundColor: "#8FD2C9",
    paddingVertical: 18,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#081018",
    fontSize: 16,
    fontWeight: "800",
  },
});
