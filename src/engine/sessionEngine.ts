import { Protocol } from "./protocols";

export const calculateNextDuration = (
  protocol: Protocol,
  phase: "inhale" | "exhale",
  currentInhale: number,
  currentExhale: number,
): number => {
  // Base duration
  let duration = phase === "inhale" ? currentInhale : currentExhale;

  // Micro-variation
  if (protocol.microVariation?.enabled) {
    // Only apply variance on specific checks or cycles?
    // Spec: "each cycle randomly adds ±0.3s distributed across I/E"
    // "pick delta in {-0.3, 0, +0.3}"
    // "I = 4.0 + delta, E = 4.0 - delta"
    // Logic: If inhale, pick delta, apply. If exhale, use stored delta?
    // Actually simplicity: Just calc fresh for each phase?
    // Spec says "keep total cycle ~8s" -> implying (I+delta) + (E-delta) = I+E.
    // So we pick delta ONCE per cycle (at inhale start).
    // We'll need state for this in the component, or we can just randomize independently if acceptable.
    // Spec: "pick delta... each cycle".
    // So calculateNextDuration needs to know if we are starting a cycle.
    // Ideally this logic lives in the component or a hook where state is managed.
    // This function can be a pure helper for just the math if provided the delta.
  }

  return duration;
};

export const applyAdjustment = (
  currentInhale: number,
  currentExhale: number,
): { newInhale: number; newExhale: number } => {
  // Spec:
  // E = min(E + 0.5, 7.0)
  // I = max(I - 0.3, 1.8)

  const newExhale = Math.min(currentExhale + 0.5, 7.0);
  const newInhale = Math.max(currentInhale - 0.3, 1.8);

  return { newInhale, newExhale };
};
