export type SessionTarget =
  | { mode: "time"; durationSec: number }
  | { mode: "rounds"; rounds: number };

export type CustomProtocol = {
  id: string;
  name: string;
  inhaleSec: number;
  holdAfterInhaleSec: number;
  exhaleSec: number;
  holdAfterExhaleSec: number;
  target: SessionTarget;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
};

export type CustomProtocolDraft = {
  name: string;
  inhaleSec: number;
  holdAfterInhaleSec: number;
  exhaleSec: number;
  holdAfterExhaleSec: number;
  target: SessionTarget;
};

export type QuickFillPreset = {
  id: string;
  label: string;
  values: Pick<
    CustomProtocolDraft,
    "inhaleSec" | "holdAfterInhaleSec" | "exhaleSec" | "holdAfterExhaleSec"
  >;
};

export const CUSTOM_PROTOCOL_STEP_SEC = 0.5;
export const DEFAULT_CUSTOM_PROTOCOL_NAME = "Custom breathing";
export const DEFAULT_CUSTOM_PROTOCOL_DRAFT: CustomProtocolDraft = {
  name: DEFAULT_CUSTOM_PROTOCOL_NAME,
  inhaleSec: 4,
  holdAfterInhaleSec: 0,
  exhaleSec: 6,
  holdAfterExhaleSec: 0,
  target: { mode: "time", durationSec: 180 },
};

export const QUICK_FILL_PRESETS: QuickFillPreset[] = [
  {
    id: "blank",
    label: "Blank",
    values: {
      inhaleSec: 4,
      holdAfterInhaleSec: 0,
      exhaleSec: 6,
      holdAfterExhaleSec: 0,
    },
  },
  {
    id: "long-exhale",
    label: "Long exhale",
    values: {
      inhaleSec: 4,
      holdAfterInhaleSec: 0,
      exhaleSec: 6,
      holdAfterExhaleSec: 0,
    },
  },
  {
    id: "box",
    label: "Box",
    values: {
      inhaleSec: 4,
      holdAfterInhaleSec: 4,
      exhaleSec: 4,
      holdAfterExhaleSec: 4,
    },
  },
  {
    id: "4-7-8",
    label: "4-7-8",
    values: {
      inhaleSec: 4,
      holdAfterInhaleSec: 7,
      exhaleSec: 8,
      holdAfterExhaleSec: 0,
    },
  },
  {
    id: "coherent",
    label: "Coherent",
    values: {
      inhaleSec: 5.5,
      holdAfterInhaleSec: 0,
      exhaleSec: 5.5,
      holdAfterExhaleSec: 0,
    },
  },
];

export const createDefaultCustomProtocolDraft = (): CustomProtocolDraft => ({
  ...DEFAULT_CUSTOM_PROTOCOL_DRAFT,
  target: { ...DEFAULT_CUSTOM_PROTOCOL_DRAFT.target },
});

export const cloneCustomProtocolDraft = (
  draft: CustomProtocolDraft,
): CustomProtocolDraft => ({
  ...draft,
  target:
    draft.target.mode === "time"
      ? { mode: "time", durationSec: draft.target.durationSec }
      : { mode: "rounds", rounds: draft.target.rounds },
});

const sanitizeHalfStepValue = (value: number) =>
  Math.round(value / CUSTOM_PROTOCOL_STEP_SEC) * CUSTOM_PROTOCOL_STEP_SEC;

const sanitizeName = (name: string) => {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_CUSTOM_PROTOCOL_NAME;
};

export const toCustomProtocolDraft = (
  protocol: CustomProtocol,
): CustomProtocolDraft => ({
  name: protocol.name,
  inhaleSec: protocol.inhaleSec,
  holdAfterInhaleSec: protocol.holdAfterInhaleSec,
  exhaleSec: protocol.exhaleSec,
  holdAfterExhaleSec: protocol.holdAfterExhaleSec,
  target:
    protocol.target.mode === "time"
      ? { mode: "time", durationSec: protocol.target.durationSec }
      : { mode: "rounds", rounds: protocol.target.rounds },
});

export const isValidCustomProtocolDraft = (draft: CustomProtocolDraft) => {
  if (draft.inhaleSec < 1 || draft.exhaleSec < 1) {
    return false;
  }

  if (draft.holdAfterInhaleSec < 0 || draft.holdAfterExhaleSec < 0) {
    return false;
  }

  if (draft.target.mode === "time") {
    return draft.target.durationSec > 0;
  }

  return draft.target.rounds >= 1;
};

export const draftsEqual = (
  left: CustomProtocolDraft,
  right: CustomProtocolDraft,
) =>
  left.name === right.name &&
  left.inhaleSec === right.inhaleSec &&
  left.holdAfterInhaleSec === right.holdAfterInhaleSec &&
  left.exhaleSec === right.exhaleSec &&
  left.holdAfterExhaleSec === right.holdAfterExhaleSec &&
  ((left.target.mode === "time" &&
    right.target.mode === "time" &&
    left.target.durationSec === right.target.durationSec) ||
    (left.target.mode === "rounds" &&
      right.target.mode === "rounds" &&
      left.target.rounds === right.target.rounds));

export const createCustomProtocolRecord = (
  draft: CustomProtocolDraft,
  existingId?: string,
  createdAt?: string,
): CustomProtocol => {
  const now = new Date().toISOString();

  return {
    id:
      existingId ||
      `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: sanitizeName(draft.name),
    inhaleSec: sanitizeHalfStepValue(draft.inhaleSec),
    holdAfterInhaleSec: sanitizeHalfStepValue(draft.holdAfterInhaleSec),
    exhaleSec: sanitizeHalfStepValue(draft.exhaleSec),
    holdAfterExhaleSec: sanitizeHalfStepValue(draft.holdAfterExhaleSec),
    target:
      draft.target.mode === "time"
        ? {
            mode: "time",
            durationSec: Math.max(
              CUSTOM_PROTOCOL_STEP_SEC,
              sanitizeHalfStepValue(draft.target.durationSec),
            ),
          }
        : { mode: "rounds", rounds: Math.max(1, Math.round(draft.target.rounds)) },
    createdAt: createdAt || now,
    updatedAt: now,
  };
};

export const getCustomProtocolCycleDurationSec = (protocol: {
  inhaleSec: number;
  holdAfterInhaleSec: number;
  exhaleSec: number;
  holdAfterExhaleSec: number;
}) =>
  protocol.inhaleSec +
  protocol.holdAfterInhaleSec +
  protocol.exhaleSec +
  protocol.holdAfterExhaleSec;

export const getCustomProtocolBreathsPerMinute = (protocol: {
  inhaleSec: number;
  holdAfterInhaleSec: number;
  exhaleSec: number;
  holdAfterExhaleSec: number;
}) => {
  const cycleDurationSec = getCustomProtocolCycleDurationSec(protocol);
  return cycleDurationSec > 0 ? 60 / cycleDurationSec : 0;
};

export const formatSecondsLabel = (seconds: number) => {
  const rounded = Number.isInteger(seconds) ? `${seconds}` : seconds.toFixed(1);
  return `${rounded}s`;
};

export const formatTargetLabel = (target: SessionTarget) => {
  if (target.mode === "time") {
    const minutes = Math.floor(target.durationSec / 60);
    const seconds = target.durationSec % 60;

    if (minutes > 0 && seconds === 0) {
      return `${minutes}m`;
    }

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }

    return `${target.durationSec}s`;
  }

  return `${target.rounds} round${target.rounds === 1 ? "" : "s"}`;
};

export const getCustomProtocolDisplayName = (protocol?: {
  name: string;
} | null) => sanitizeName(protocol?.name || "");

export const sortCustomProtocols = (protocols: CustomProtocol[]) =>
  [...protocols].sort((left, right) => {
    const leftTimestamp = left.lastUsedAt || left.updatedAt || left.createdAt;
    const rightTimestamp = right.lastUsedAt || right.updatedAt || right.createdAt;
    return rightTimestamp.localeCompare(leftTimestamp);
  });
