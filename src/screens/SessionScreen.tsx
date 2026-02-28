import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  AppStateStatus,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors } from "../theme/colors";
import { PROTOCOLS, Protocol } from "../engine/protocols";
import { RootStackParamList } from "../app/navigation";
import { useSettingsStore } from "../store/settingsStore";
import { BreathingCircle } from "../components/BreathingCircle";
import { AdaptiveOverlay } from "../components/AdaptiveOverlay";
import { applyAdjustment } from "../engine/sessionEngine";

type SessionScreenRouteProp = RouteProp<RootStackParamList, "Session">;
type SessionScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Session"
>;

type Phase = "inhale" | "hold-inhale" | "exhale" | "hold-exhale";

export const SessionScreen = () => {
  const navigation = useNavigation<SessionScreenNavigationProp>();
  const route = useRoute<SessionScreenRouteProp>();

  const { state: feltState, durationSec: paramDuration } = route.params;
  const protocol = PROTOCOLS[feltState];

  const { hapticsEnabled } = useSettingsStore();

  // Session State
  const [phase, setPhase] = useState<Phase>("inhale");
  const [isActive, setIsActive] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0); // Only for overlay check/logic
  const [phaseProgress, setPhaseProgress] = useState(0); // 0-1 progress through current phase

  // Timing Refs
  const currentInhaleRef = useRef(protocol.inhaleSec);
  const currentExhaleRef = useRef(protocol.exhaleSec);
  const currentHoldInhaleRef = useRef(protocol.holdAfterInhaleSec || 0);
  const currentHoldExhaleRef = useRef(protocol.holdAfterExhaleSec || 0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const phaseStartTimeRef = useRef<number>(0);
  const phaseDurationRef = useRef<number>(0);
  const elapsedTotalRef = useRef(0); // Logic truth
  const durationTotalRef = useRef(paramDuration || protocol.defaultDurationSec);

  // Clean up
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  // Handle App State (Pause/Resume)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        setIsActive(true);
        runPhase(phase);
      } else {
        setIsActive(false);
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [phase]);

  // Initial Start
  useEffect(() => {
    runPhase("inhale");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPhase = useCallback(
    (newPhase: Phase) => {
      if (!isActive) return;

      let duration = 0;

      // Determine Duration
      switch (newPhase) {
        case "inhale":
          duration = currentInhaleRef.current;
          if (protocol.microVariation?.enabled) {
            const delta = protocol.microVariation.deltaSec;
            const r = Math.random();
            const variation = r < 0.33 ? -delta : r < 0.66 ? 0 : delta;
            duration += variation;
            (runPhase as any).nextExhaleVariation = -variation;
          }
          break;
        case "hold-inhale":
          duration = currentHoldInhaleRef.current;
          break;
        case "exhale":
          duration = currentExhaleRef.current;
          if ((runPhase as any).nextExhaleVariation !== undefined) {
            duration += (runPhase as any).nextExhaleVariation;
          }
          break;
        case "hold-exhale":
          duration = currentHoldExhaleRef.current;
          break;
      }

      // Skip almost-zero duration phases
      if (duration <= 0.05) {
        // If duration is effectively zero, just proceed to finishPhase immediately
        // We use 0 ms timeout to allow Stack unwind
        finishPhase(newPhase, 0);
        return;
      }

      setPhase(newPhase);

      if (hapticsEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const ms = duration * 1000;
      phaseStartTimeRef.current = Date.now();
      phaseDurationRef.current = duration;
      setPhaseProgress(0);

      // Start progress tracking interval
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - phaseStartTimeRef.current) / 1000;
        const progress = Math.min(elapsed / phaseDurationRef.current, 1);
        setPhaseProgress(progress);
      }, 50); // Update every 50ms for smooth animation

      timerRef.current = setTimeout(() => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setPhaseProgress(1);
        finishPhase(newPhase, duration);
      }, ms);
    },
    [isActive, hapticsEnabled, protocol],
  );

  const getNextPhase = (current: Phase): Phase => {
    if (current === "inhale") return "hold-inhale";
    if (current === "hold-inhale") return "exhale";
    if (current === "exhale") return "hold-exhale";
    return "inhale";
  };

  // Get the next visible phase (skipping zero-duration holds)
  const getNextVisiblePhase = (current: Phase): Phase => {
    let next = getNextPhase(current);
    // Skip hold phases if they have zero duration
    if (next === "hold-inhale" && currentHoldInhaleRef.current <= 0.05) {
      next = "exhale";
    } else if (next === "hold-exhale" && currentHoldExhaleRef.current <= 0.05) {
      next = "inhale";
    }
    return next;
  };

  const finishPhase = (currentPhase: Phase, durationUsed: number) => {
    elapsedTotalRef.current += durationUsed;
    setElapsed(elapsedTotalRef.current);

    if (elapsedTotalRef.current >= durationTotalRef.current) {
      navigation.replace("SessionEnd", {
        state: feltState,
        durationSec: durationTotalRef.current,
      });
      return;
    }

    if (
      !overlayVisible &&
      elapsedTotalRef.current >= 45 &&
      !(finishPhase as any).checkpointShown
    ) {
      setOverlayVisible(true);
      (finishPhase as any).checkpointShown = true;
      setTimeout(() => {
        setOverlayVisible(false);
      }, 5000);
    }

    runPhase(getNextPhase(currentPhase));
  };

  const handleCheckpoint = (type: "intense" | "help") => {
    setOverlayVisible(false);
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
    navigation.popToTop();
  };

  const handleDurationChange = (newDuration: number) => {
    navigation.replace("Session", {
      state: feltState,
      durationSec: newDuration,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.iconButton}>
          <Feather name="x" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.durationContainer}>
          {protocol.durationOptionsSec.map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => handleDurationChange(d)}
              style={[
                styles.durationPill,
                d === durationTotalRef.current && styles.durationPillActive,
              ]}
            >
              <Text
                style={[
                  styles.durationText,
                  d === durationTotalRef.current && styles.durationTextActive,
                ]}
              >
                {d}s
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ width: 40 }} />
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

      <AdaptiveOverlay
        visible={overlayVisible}
        onStillIntense={() => handleCheckpoint("intense")}
        onThisHelps={() => handleCheckpoint("help")}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: "#333",
    borderRadius: 20,
    padding: 4,
  },
  durationPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  durationPillActive: {
    backgroundColor: "#555",
  },
  durationText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
  },
  durationTextActive: {
    color: "#fff",
  },
});
