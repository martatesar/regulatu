import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";

import { RootStackParamList } from "../app/navigation";
import { AdaptiveOverlay } from "../components/AdaptiveOverlay";
import { BreathingCircle } from "../components/BreathingCircle";
import { HrvLiveCard } from "../components/HrvLiveCard";
import { applyAdjustment } from "../engine/sessionEngine";
import { PROTOCOLS } from "../engine/protocols";
import { buildSessionHrvSummary } from "../features/hrv/sessionSummary";
import {
  HrvStatusEvent,
  SessionHrvSample,
} from "../features/hrv/types";
import {
  addHrvStatusListener,
  getHrvPermissionStatus,
  isHrvModuleAvailable,
  requestHrvPermission,
  startHrvCapture,
  stopHrvCapture,
} from "../native/rezetCameraHrv";
import { useSettingsStore } from "../store/settingsStore";
import { colors } from "../theme/colors";

type SessionScreenRouteProp = RouteProp<RootStackParamList, "Session">;
type SessionScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Session"
>;

type Phase = "inhale" | "hold-inhale" | "exhale" | "hold-exhale";

const emptyHrvStatus: HrvStatusEvent = {
  state: "off",
  signalQuality: "low",
  fingerDetected: false,
};

const allowInSessionHrv = false;

export const SessionScreen = () => {
  useKeepAwake();
  const navigation = useNavigation<SessionScreenNavigationProp>();
  const route = useRoute<SessionScreenRouteProp>();
  const { state: feltState, durationSec: paramDuration } = route.params;

  const protocol = PROTOCOLS[feltState];
  const {
    hapticsEnabled,
    hrvMeasurementEnabledByDefault,
  } = useSettingsStore();

  const [phase, setPhase] = useState<Phase>("inhale");
  const [isActive, setIsActive] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [showHrvPrompt, setShowHrvPrompt] = useState(false);
  const [hrvStatus, setHrvStatus] = useState<HrvStatusEvent>(emptyHrvStatus);
  const [hrvFeatureAvailable, setHrvFeatureAvailable] = useState(false);
  const [hrvEnabled, setHrvEnabled] = useState(false);

  const currentInhaleRef = useRef(protocol.inhaleSec);
  const currentExhaleRef = useRef(protocol.exhaleSec);
  const currentHoldInhaleRef = useRef(protocol.holdAfterInhaleSec || 0);
  const currentHoldExhaleRef = useRef(protocol.holdAfterExhaleSec || 0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseStartTimeRef = useRef(0);
  const phaseDurationRef = useRef(0);
  const elapsedTotalRef = useRef(0);
  const durationTotalRef = useRef(paramDuration || protocol.defaultDurationSec);
  const checkpointShownRef = useRef(false);
  const nextExhaleVariationRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("inhale");
  const isActiveRef = useRef(true);
  const hrvSamplesRef = useRef<SessionHrvSample[]>([]);

  const resetHrvState = useCallback(() => {
    setHrvEnabled(false);
    setHrvStatus(emptyHrvStatus);
  }, []);

  const clearTimingHandles = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = null;
    }
  }, []);

  const stopHrvFlow = useCallback(
    async ({ resetSamples = false }: { resetSamples?: boolean } = {}) => {
      try {
        await stopHrvCapture();
      } catch {
        // Ignore native stop errors so session teardown remains deterministic.
      }

      if (resetSamples) {
        hrvSamplesRef.current = [];
      }

      resetHrvState();
    },
    [resetHrvState],
  );

  const markHrvUnavailable = useCallback((state: "unavailable" | "error") => {
    setHrvEnabled(false);
    setHrvStatus({
      state,
      signalQuality: "low",
      fingerDetected: false,
    });
  }, []);

  const startHrvFlow = useCallback(async () => {
    if (Platform.OS !== "ios") {
      return;
    }

    const available = await isHrvModuleAvailable();
    setHrvFeatureAvailable(available);

    if (!available) {
      markHrvUnavailable("unavailable");
      return;
    }

    const permissionStatus = await getHrvPermissionStatus();
    if (permissionStatus === "undetermined") {
      setShowHrvPrompt(true);
      setHrvStatus({
        state: "requesting_permission",
        signalQuality: "low",
        fingerDetected: false,
      });
      return;
    }

    if (permissionStatus !== "granted") {
      markHrvUnavailable("unavailable");
      return;
    }

    hrvSamplesRef.current = [];

    try {
      const started = await startHrvCapture({
        torchPreferred: true,
        updateIntervalMs: 1000,
      });

      if (!started) {
        markHrvUnavailable("unavailable");
        return;
      }

      setHrvEnabled(true);
      setHrvStatus({
        state: "finding_signal",
        signalQuality: "low",
        fingerDetected: false,
      });
    } catch {
      markHrvUnavailable("error");
    }
  }, [markHrvUnavailable]);

  const finishPhaseRef = useRef<(currentPhase: Phase, durationUsed: number) => void>(
    () => undefined,
  );

  const runPhase = useCallback(
    (nextPhase: Phase) => {
      if (!isActiveRef.current) {
        return;
      }

      let duration = 0;

      switch (nextPhase) {
        case "inhale":
          duration = currentInhaleRef.current;
          if (protocol.microVariation?.enabled) {
            const delta = protocol.microVariation.deltaSec;
            const random = Math.random();
            const variation = random < 0.33 ? -delta : random < 0.66 ? 0 : delta;
            duration += variation;
            nextExhaleVariationRef.current = -variation;
          } else {
            nextExhaleVariationRef.current = null;
          }
          break;
        case "hold-inhale":
          duration = currentHoldInhaleRef.current;
          break;
        case "exhale":
          duration = currentExhaleRef.current + (nextExhaleVariationRef.current || 0);
          nextExhaleVariationRef.current = null;
          break;
        case "hold-exhale":
          duration = currentHoldExhaleRef.current;
          break;
      }

      if (duration <= 0.05) {
        finishPhaseRef.current(nextPhase, 0);
        return;
      }

      phaseRef.current = nextPhase;
      setPhase(nextPhase);

      if (hapticsEnabled) {
        if (nextPhase === "inhale") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (nextPhase === "hold-inhale" || nextPhase === "hold-exhale") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setTimeout(
            () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
            200,
          );
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setTimeout(
            () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
            200,
          );
          setTimeout(
            () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
            400,
          );
        }
      }

      const durationMs = duration * 1000;
      phaseStartTimeRef.current = Date.now();
      phaseDurationRef.current = duration;
      setPhaseProgress(0);

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      progressIntervalRef.current = setInterval(() => {
        const phaseElapsed = (Date.now() - phaseStartTimeRef.current) / 1000;
        const progress = Math.min(phaseElapsed / phaseDurationRef.current, 1);
        setPhaseProgress(progress);
      }, 50);

      timerRef.current = setTimeout(() => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }

        setPhaseProgress(1);
        finishPhaseRef.current(nextPhase, duration);
      }, durationMs);
    },
    [hapticsEnabled, protocol.microVariation],
  );

  const getNextPhase = (current: Phase): Phase => {
    if (current === "inhale") return "hold-inhale";
    if (current === "hold-inhale") return "exhale";
    if (current === "exhale") return "hold-exhale";
    return "inhale";
  };

  const getNextVisiblePhase = (current: Phase): Phase => {
    let next = getNextPhase(current);

    if (next === "hold-inhale" && currentHoldInhaleRef.current <= 0.05) {
      next = "exhale";
    } else if (next === "hold-exhale" && currentHoldExhaleRef.current <= 0.05) {
      next = "inhale";
    }

    return next;
  };

  finishPhaseRef.current = (currentPhase: Phase, durationUsed: number) => {
    elapsedTotalRef.current += durationUsed;

    if (elapsedTotalRef.current >= durationTotalRef.current) {
      const hrvSummary = buildSessionHrvSummary(hrvSamplesRef.current);
      void stopHrvFlow();
      navigation.replace("SessionEnd", {
        state: feltState,
        durationSec: durationTotalRef.current,
        hrvSummary,
      });
      return;
    }

    if (!checkpointShownRef.current && elapsedTotalRef.current >= 45) {
      checkpointShownRef.current = true;
      setOverlayVisible(true);
      overlayTimeoutRef.current = setTimeout(() => {
        setOverlayVisible(false);
        overlayTimeoutRef.current = null;
      }, 5000);
    }

    runPhase(getNextPhase(currentPhase));
  };

  useEffect(() => {
    const subscription = addHrvStatusListener((event) => {
      setHrvStatus(event);

      if (
        event.state === "measuring" &&
        typeof event.heartRateBpm === "number" &&
        typeof event.hrvRmssdMs === "number"
      ) {
        const nextSample: SessionHrvSample = {
          timestampMs: Date.now(),
          heartRateBpm: event.heartRateBpm,
          hrvRmssdMs: event.hrvRmssdMs,
          signalQuality: event.signalQuality,
        };

        hrvSamplesRef.current = [...hrvSamplesRef.current, nextSample].slice(-180);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!allowInSessionHrv) {
        return;
      }

      if (Platform.OS !== "ios") {
        return;
      }

      const available = await isHrvModuleAvailable();
      if (cancelled) {
        return;
      }

      setHrvFeatureAvailable(available);

      if (!available) {
        return;
      }

      if (!hrvMeasurementEnabledByDefault) {
        return;
      }

      const permissionStatus = await getHrvPermissionStatus();
      if (cancelled || permissionStatus !== "granted") {
        return;
      }

      await startHrvFlow();
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [hrvMeasurementEnabledByDefault, startHrvFlow]);

  useEffect(() => {
    runPhase("inhale");

    return () => {
      clearTimingHandles();
      void stopHrvFlow();
    };
  }, [clearTimingHandles, runPhase, stopHrvFlow]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        isActiveRef.current = true;
        setIsActive(true);
        runPhase(phaseRef.current);
        return;
      }

      isActiveRef.current = false;
      setIsActive(false);
      clearTimingHandles();

      if (hrvEnabled) {
        void stopHrvFlow();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [clearTimingHandles, hrvEnabled, runPhase, stopHrvFlow]);

  const handleCheckpoint = (type: "intense" | "help") => {
    setOverlayVisible(false);
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = null;
    }

    if (type === "intense") {
      const { newInhale, newExhale } = applyAdjustment(
        currentInhaleRef.current,
        currentExhaleRef.current,
      );
      currentInhaleRef.current = newInhale;
      currentExhaleRef.current = newExhale;
    }
  };

  const handleClose = () => {
    void stopHrvFlow();
    navigation.popToTop();
  };

  const handleDurationChange = (newDuration: number) => {
    void stopHrvFlow({ resetSamples: true });
    navigation.replace("Session", {
      state: feltState,
      durationSec: newDuration,
    });
  };

  const handleHrvToggle = async () => {
    if (!allowInSessionHrv) {
      return;
    }

    if (hrvEnabled) {
      await stopHrvFlow();
      return;
    }

    await startHrvFlow();
  };

  const handleConfirmHrvPermission = async () => {
    setShowHrvPrompt(false);
    const permissionStatus = await requestHrvPermission();

    if (permissionStatus !== "granted") {
      markHrvUnavailable("unavailable");
      return;
    }

    await startHrvFlow();
  };

  const handleDismissHrvPrompt = () => {
    setShowHrvPrompt(false);
    resetHrvState();
  };

  const liveDeltaMs =
    hrvSamplesRef.current.length > 0 && typeof hrvStatus.hrvRmssdMs === "number"
      ? hrvStatus.hrvRmssdMs - hrvSamplesRef.current[0].hrvRmssdMs
      : undefined;

  const hrvButtonTone =
    hrvStatus.state === "measuring"
      ? styles.hrvButtonActive
      : hrvStatus.state === "finding_signal" ||
          hrvStatus.state === "requesting_permission"
        ? styles.hrvButtonPending
        : hrvStatus.state === "low_signal"
          ? styles.hrvButtonLowSignal
          : undefined;

  const showHrvButton =
    allowInSessionHrv && Platform.OS === "ios" && hrvFeatureAvailable;
  const showHrvCard =
    allowInSessionHrv &&
    Platform.OS === "ios" &&
    (hrvEnabled ||
      hrvStatus.state === "requesting_permission" ||
      hrvStatus.state === "low_signal" ||
      hrvStatus.state === "finding_signal" ||
      hrvStatus.state === "unavailable" ||
      hrvStatus.state === "error");

  return (
    <LinearGradient colors={["#12101F", "#030303"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.iconButton}>
            <Feather name="x" size={24} color="#8A8A9E" />
          </TouchableOpacity>

          <View style={styles.durationContainer}>
            {protocol.durationOptionsSec.map((durationOption) => (
              <TouchableOpacity
                key={durationOption}
                onPress={() => handleDurationChange(durationOption)}
                style={[
                  styles.durationPill,
                  durationOption === durationTotalRef.current &&
                    styles.durationPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.durationText,
                    durationOption === durationTotalRef.current &&
                      styles.durationTextActive,
                  ]}
                >
                  {durationOption >= 60 && durationOption % 60 === 0
                    ? `${durationOption / 60}m`
                    : `${durationOption}s`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {showHrvButton ? (
            <TouchableOpacity
              onPress={() => void handleHrvToggle()}
              style={[styles.hrvButton, hrvButtonTone]}
            >
              <Feather name="activity" size={14} color="#FFFFFF" />
              <Text style={styles.hrvButtonText}>HRV</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <View style={styles.center}>
          <BreathingCircle
            phase={phase}
            durationSec={
              phase === "inhale"
                ? currentInhaleRef.current
                : phase === "exhale"
                  ? currentExhaleRef.current
                  : phase === "hold-inhale"
                    ? currentHoldInhaleRef.current
                    : currentHoldExhaleRef.current
            }
            isActive={isActive}
            nextPhase={getNextVisiblePhase(phase)}
            progress={phaseProgress}
          />
        </View>

        {showHrvCard ? <HrvLiveCard status={hrvStatus} deltaMs={liveDeltaMs} /> : null}

        <AdaptiveOverlay
          visible={overlayVisible}
          onStillIntense={() => handleCheckpoint("intense")}
          onThisHelps={() => handleCheckpoint("help")}
        />

        <Modal
          visible={showHrvPrompt}
          transparent
          animationType="fade"
          onRequestClose={handleDismissHrvPrompt}
        >
          <View style={styles.modalScrim}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Measure HRV with camera</Text>
              <Text style={styles.modalBody}>
                Place a finger over the rear camera during the session. This
                creates an HRV estimate from pulse changes.
              </Text>
              <Text style={styles.modalFootnote}>
                Camera HRV is an estimate and not a medical measurement.
              </Text>

              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={() => void handleConfirmHrvPermission()}
              >
                <Text style={styles.modalPrimaryButtonText}>Continue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={handleDismissHrvPrompt}
              >
                <Text style={styles.modalSecondaryButtonText}>Not now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
    padding: 20,
    alignItems: "center",
    zIndex: 10,
  },
  iconButton: {
    padding: 8,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  durationContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  durationPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  durationPillActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  durationText: {
    color: "#8A8A9E",
    fontSize: 14,
    fontWeight: "600",
  },
  durationTextActive: {
    color: "#FFFFFF",
  },
  headerSpacer: {
    width: 48,
  },
  hrvButton: {
    minWidth: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  hrvButtonPending: {
    backgroundColor: "rgba(122,162,192,0.18)",
    borderColor: "rgba(122,162,192,0.4)",
  },
  hrvButtonActive: {
    backgroundColor: "rgba(143,210,201,0.18)",
    borderColor: "rgba(143,210,201,0.5)",
  },
  hrvButtonLowSignal: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.2)",
  },
  hrvButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#10131C",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 24,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalBody: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  modalFootnote: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
    marginBottom: 20,
  },
  modalPrimaryButton: {
    backgroundColor: "#27485B",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  modalPrimaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  modalSecondaryButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  modalSecondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
});
