import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  Easing,
  interpolate,
  SharedValue,
} from "react-native-reanimated";

type Phase = "inhale" | "hold-inhale" | "exhale" | "hold-exhale";

interface BreathingCircleProps {
  phase: Phase;
  durationSec: number;
  isActive: boolean;
  nextPhase?: Phase;
  progress?: number;
}

const { width } = Dimensions.get("window");
const SIZE = Math.min(width * 0.82, 320);
const PETAL_COUNT = 6;
const PETAL_SIZE = SIZE * 0.48;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// White shades palette
const petalColors = [
  { inner: "#FFFFFF", outer: "#FFFFFF" },
  { inner: "#FFFFFF", outer: "#FFFFFF" },
  { inner: "#FFFFFF", outer: "#FFFFFF" },
  { inner: "#FFFFFF", outer: "#FFFFFF" },
  { inner: "#FFFFFF", outer: "#FFFFFF" },
  { inner: "#FFFFFF", outer: "#FFFFFF" },
];

export const BreathingCircle: React.FC<BreathingCircleProps> = ({
  phase,
  durationSec,
  isActive,
  nextPhase,
  progress = 0,
}) => {
  const breath = useSharedValue(0);
  const progressValue = useSharedValue(progress);

  useEffect(() => {
    progressValue.value = progress;
  }, [progress]);

  useEffect(() => {
    if (!isActive) return;

    const duration = durationSec * 1000;
    const easing = Easing.bezier(0.4, 0.0, 0.2, 1.0);

    if (phase === "inhale") {
      breath.value = withTiming(1, { duration, easing });
    } else if (phase === "exhale") {
      breath.value = withTiming(0, { duration, easing });
    }
  }, [phase, durationSec, isActive]);

  // Main container animation
  const containerStyle = useAnimatedStyle(() => {
    const scale = interpolate(breath.value, [0, 1], [0.55, 1]);
    const rotate = interpolate(breath.value, [0, 1], [-30, 30]);
    return {
      transform: [{ scale }, { rotate: `${rotate}deg` }],
    };
  });

  // Outer glow
  const outerGlowProps = useAnimatedProps(() => ({
    r: interpolate(breath.value, [0, 1], [SIZE * 0.22, SIZE * 0.52]),
    opacity: interpolate(breath.value, [0, 1], [0.1, 0.25]),
  }));

  // Inner glow
  const innerGlowProps = useAnimatedProps(() => ({
    r: interpolate(breath.value, [0, 1], [SIZE * 0.15, SIZE * 0.4]),
    opacity: interpolate(breath.value, [0, 1], [0.15, 0.35]),
  }));

  return (
    <View style={styles.container}>
      {/* Ambient glow layers */}
      <Svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={styles.absoluteFill}
      >
        <Defs>
          <RadialGradient id="outerGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.2} />
            <Stop offset="60%" stopColor="#FFFFFF" stopOpacity={0.05} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="innerGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.3} />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.1} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          fill="url(#outerGlow)"
          animatedProps={outerGlowProps}
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          fill="url(#innerGlow)"
          animatedProps={innerGlowProps}
        />
      </Svg>

      {/* Petals */}
      <Animated.View style={[styles.petalsContainer, containerStyle]}>
        {Array.from({ length: PETAL_COUNT }).map((_, index) => (
          <Petal
            key={index}
            index={index}
            breath={breath}
            colors={petalColors[index]}
          />
        ))}
      </Animated.View>

      {/* Center void with phase text */}
      <CenterOrb breath={breath} phase={phase} nextPhase={nextPhase} progress={progressValue} />
    </View>
  );
};

// Petal component
interface PetalProps {
  index: number;
  breath: SharedValue<number>;
  colors: { inner: string; outer: string };
}

const Petal: React.FC<PetalProps> = ({ index, breath }) => {
  const angle = (index * 360) / PETAL_COUNT - 90;

  const petalStyle = useAnimatedStyle(() => {
    const expandDistance = interpolate(
      breath.value,
      [0, 1],
      [0, PETAL_SIZE * 0.45]
    );

    const angleRad = (angle * Math.PI) / 180;
    const translateX = Math.cos(angleRad) * expandDistance;
    const translateY = Math.sin(angleRad) * expandDistance;

    const petalRotate = interpolate(breath.value, [0, 1], [0, -15]);

    return {
      transform: [
        { translateX },
        { translateY },
        { rotate: `${petalRotate}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.petal, petalStyle]}>
      <Svg width={PETAL_SIZE} height={PETAL_SIZE} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`petal${index}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.6} />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.35} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.1} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={47} fill={`url(#petal${index})`} />
      </Svg>
    </Animated.View>
  );
};

// Center orb - matches background
interface CenterOrbProps {
  breath: SharedValue<number>;
  phase: Phase;
  nextPhase?: Phase;
  progress: SharedValue<number>;
}

const getPhaseLabel = (phase: Phase): string => {
  if (phase === "inhale") return "INHALE";
  if (phase === "exhale") return "EXHALE";
  return "HOLD";
};

const ORB_SIZE = SIZE * 0.36;
const PROGRESS_ORB_SIZE = 8;
const ORBIT_RADIUS = (ORB_SIZE / 2) * 0.85; // Slightly inside the edge

const CenterOrb: React.FC<CenterOrbProps> = ({ breath, phase, nextPhase, progress }) => {
  const transition = useSharedValue(1);
  const prevPhaseRef = React.useRef(phase);
  const [labels, setLabels] = React.useState({
    current: getPhaseLabel(phase),
    next: nextPhase ? getPhaseLabel(nextPhase) : "",
    outgoing: "",
  });

  // Trigger transition animation when phase changes
  useEffect(() => {
    if (prevPhaseRef.current !== phase) {
      setLabels({
        outgoing: getPhaseLabel(prevPhaseRef.current),
        current: getPhaseLabel(phase),
        next: nextPhase ? getPhaseLabel(nextPhase) : "",
      });

      transition.value = 0;
      transition.value = withTiming(1, {
        duration: 450,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });

      prevPhaseRef.current = phase;
    } else if (nextPhase) {
      setLabels((prev) => ({ ...prev, next: getPhaseLabel(nextPhase) }));
    }
  }, [phase, nextPhase]);

  const orbStyle = useAnimatedStyle(() => {
    const scale = interpolate(breath.value, [0, 1], [0.75, 1.2]);
    return {
      transform: [{ scale }],
    };
  });

  // Progress orb - rotates around the center orb edge
  const progressOrbStyle = useAnimatedStyle(() => {
    // Progress goes from 0 to 1, map to angle from -90 (top) to 270 degrees (full circle back to top)
    const angle = interpolate(progress.value, [0, 1], [-90, 270]);
    const angleRad = (angle * Math.PI) / 180;
    const x = Math.cos(angleRad) * ORBIT_RADIUS;
    const y = Math.sin(angleRad) * ORBIT_RADIUS;

    // Fade in at start, stay visible
    const opacity = interpolate(progress.value, [0, 0.02, 0.98, 1], [0, 1, 1, 0], "clamp");

    return {
      transform: [{ translateX: x }, { translateY: y }],
      opacity,
    };
  });

  const outgoingStyle = useAnimatedStyle(() => {
    const opacity = interpolate(transition.value, [0, 0.35], [1, 0], "clamp");
    const translateY = interpolate(transition.value, [0, 0.5], [0, -18], "clamp");
    const scale = interpolate(transition.value, [0, 0.35], [1, 0.85], "clamp");
    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  const currentStyle = useAnimatedStyle(() => {
    const translateY = interpolate(transition.value, [0, 0.6], [20, 0], "clamp");
    const scale = interpolate(transition.value, [0, 0.6], [0.7, 1], "clamp");
    const opacity = interpolate(transition.value, [0, 0.5], [0.35, 1], "clamp");
    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  const nextStyle = useAnimatedStyle(() => {
    const opacity = interpolate(transition.value, [0.6, 1], [0, 0.35], "clamp");
    const translateY = interpolate(transition.value, [0.6, 1], [6, 0], "clamp");
    const breathePulse = interpolate(breath.value, [0, 0.5, 1], [1, 1.02, 1]);
    return {
      opacity,
      transform: [{ translateY }, { scale: breathePulse }],
    };
  });

  return (
    <Animated.View style={[styles.centerOrb, orbStyle]}>
      <Svg width={ORB_SIZE} height={ORB_SIZE} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="orbGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#1A1A1A" stopOpacity={1} />
            <Stop offset="80%" stopColor="#1A1A1A" stopOpacity={1} />
            <Stop offset="95%" stopColor="#333333" stopOpacity={0.8} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.15} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={46} fill="url(#orbGrad)" />
      </Svg>

      {/* Progress indicator orb */}
      <Animated.View style={[styles.progressOrb, progressOrbStyle]} />

      <View style={styles.textStack}>
        {/* Outgoing - fades up and out */}
        {labels.outgoing !== "" && (
          <Animated.Text style={[styles.phaseText, styles.absoluteText, outgoingStyle]}>
            {labels.outgoing}
          </Animated.Text>
        )}
        {/* Current - rises from below */}
        <Animated.View style={currentStyle}>
          <Animated.Text style={styles.phaseText}>
            {labels.current}
          </Animated.Text>
        </Animated.View>
        {/* Next - ghosted below */}
        {labels.next !== "" && (
          <Animated.Text style={[styles.nextPhaseText, nextStyle]}>
            {labels.next}
          </Animated.Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  absoluteFill: {
    position: "absolute",
  },
  petalsContainer: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
  },
  petal: {
    position: "absolute",
    width: PETAL_SIZE,
    height: PETAL_SIZE,
  },
  centerOrb: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  textStack: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  phaseText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  absoluteText: {
    position: "absolute",
  },
  nextPhaseText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1,
    marginTop: 6,
  },
  progressOrb: {
    position: "absolute",
    width: PROGRESS_ORB_SIZE,
    height: PROGRESS_ORB_SIZE,
    borderRadius: PROGRESS_ORB_SIZE / 2,
    backgroundColor: "#FFFFFF",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});
