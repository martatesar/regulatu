export type FeltState =
  | "heart_racing"
  | "chest_tight"
  | "mind_looping"
  | "too_much_input"
  | "frozen_numb"
  | "restless_focus";

export interface Protocol {
  state: FeltState;
  label: string;
  questionLabel: string;
  image: any;
  inhaleSec: number;
  holdAfterInhaleSec?: number;
  exhaleSec: number;
  holdAfterExhaleSec?: number;
  durationOptionsSec: number[];
  defaultDurationSec: number;
  microVariation?: { enabled: boolean; deltaSec: number };
}

export const PROTOCOLS: Record<FeltState, Protocol> = {
  heart_racing: {
    state: "heart_racing",
    label: "4-7-8 Relaxing",
    questionLabel: "My heart is racing",
    image: require("../assets/images/icon_heart.jpg"),
    inhaleSec: 4.0,
    holdAfterInhaleSec: 7.0,
    exhaleSec: 8.0,
    durationOptionsSec: [60, 120, 180],
    defaultDurationSec: 120,
  },
  chest_tight: {
    state: "chest_tight",
    label: "Box Breathing",
    questionLabel: "My chest feels tight",
    image: require("../assets/images/icon_chest.jpg"),
    inhaleSec: 4.0,
    holdAfterInhaleSec: 4.0,
    exhaleSec: 4.0,
    holdAfterExhaleSec: 4.0,
    durationOptionsSec: [60, 120, 180],
    defaultDurationSec: 120,
  },
  mind_looping: {
    state: "mind_looping",
    label: "Box Focus",
    questionLabel: "My thoughts won't slow down",
    image: require("../assets/images/icon_mind.jpg"),
    inhaleSec: 4.0,
    holdAfterInhaleSec: 4.0,
    exhaleSec: 4.0,
    holdAfterExhaleSec: 4.0,
    microVariation: { enabled: true, deltaSec: 0.3 }, // Keep variation for "looping" disruption
    durationOptionsSec: [60, 120, 180],
    defaultDurationSec: 120,
  },
  too_much_input: {
    state: "too_much_input",
    label: "Extended Exhale",
    questionLabel: "Everything feels like too much",
    image: require("../assets/images/icon_overwhelmed.jpg"),
    inhaleSec: 4.0,
    exhaleSec: 6.0,
    durationOptionsSec: [60, 120, 180],
    defaultDurationSec: 60,
  },
  frozen_numb: {
    state: "frozen_numb",
    label: "Coherent Breathing",
    questionLabel: "I feel frozen or numb",
    image: require("../assets/images/icon_frozen.jpg"),
    inhaleSec: 6.0,
    exhaleSec: 6.0,
    durationOptionsSec: [60, 120, 180],
    defaultDurationSec: 120,
  },
  restless_focus: {
    state: "restless_focus",
    label: "Resonant Frequency",
    questionLabel: "I feel restless and unfocused",
    image: require("../assets/images/icon_restless.jpg"),
    inhaleSec: 5.5,
    exhaleSec: 5.5,
    durationOptionsSec: [60, 120, 180],
    defaultDurationSec: 60,
  },
};
