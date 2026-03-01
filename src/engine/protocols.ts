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
  shortLabel: string;
  image: any;
  inhaleSec: number;
  holdAfterInhaleSec?: number;
  exhaleSec: number;
  holdAfterExhaleSec?: number;
  durationOptionsSec: number[];
  defaultDurationSec: number;
  microVariation?: { enabled: boolean; deltaSec: number };
  explanation: string;
}

export const PROTOCOLS: Record<FeltState, Protocol> = {
  heart_racing: {
    state: "heart_racing",
    label: "4-7-8 Relaxing",
    questionLabel: "I feel anxious or keyed up",
    shortLabel: "Anxious",
    image: require("../assets/images/icon_heart.jpg"),
    inhaleSec: 4.0,
    holdAfterInhaleSec: 7.0,
    exhaleSec: 8.0,
    durationOptionsSec: [60, 180, 300],
    defaultDurationSec: 180,
    explanation: "The 4-7-8 breathing technique acts as a natural tranquilizer for the nervous system. The longer exhale compared to the inhale (8 seconds vs 4 seconds) combined with the breath retention (7 seconds) stimulates the vagus nerve. This shifts your body from a 'fight or flight' state to a 'rest and digest' state, effectively lowering heart rate and quickly easing feelings of panic or anxiety.",
  },
  chest_tight: {
    state: "chest_tight",
    label: "Box Breathing",
    questionLabel: "I feel tense",
    shortLabel: "Tense",
    image: require("../assets/images/icon_chest.jpg"),
    inhaleSec: 4.0,
    holdAfterInhaleSec: 4.0,
    exhaleSec: 4.0,
    holdAfterExhaleSec: 4.0,
    durationOptionsSec: [60, 180, 300],
    defaultDurationSec: 180,
    explanation: "Box Breathing (or square breathing) is utilized by elite forces like Navy SEALs to maintain calm and focus in high-stress situations. By standardizing the breath into four equal parts, it provides an anchor for the mind and regulates the autonomic nervous system. The equal distribution prevents hyperventilation and helps release physical tension in the chest and body.",
  },
  mind_looping: {
    state: "mind_looping",
    label: "Box Focus",
    questionLabel: "My thoughts won't slow down",
    shortLabel: "Racing thoughts",
    image: require("../assets/images/icon_mind.jpg"),
    inhaleSec: 4.0,
    holdAfterInhaleSec: 4.0,
    exhaleSec: 4.0,
    holdAfterExhaleSec: 4.0,
    microVariation: { enabled: true, deltaSec: 0.3 }, // Keep variation for "looping" disruption
    durationOptionsSec: [60, 180, 300],
    defaultDurationSec: 180,
    explanation: "To break a cycle of racing thoughts, your brain needs an active anchor. This protocol demands slight cognitive effort to track the equal 4-second phases, pulling your attention away from internal loops. The subtle, unpredictable timing variations (micro-variations) keep your brain actively engaged in the present moment rather than returning to autopilot overthinking.",
  },
  too_much_input: {
    state: "too_much_input",
    label: "Extended Exhale",
    questionLabel: "Everything feels like too much",
    shortLabel: "Overwhelmed",
    image: require("../assets/images/icon_overwhelmed.jpg"),
    inhaleSec: 4.0,
    exhaleSec: 6.0,
    durationOptionsSec: [60, 180, 300],
    defaultDurationSec: 60,
    explanation: "When feeling overwhelmed by sensory input, an extended exhale is the most direct physiological shortcut to calm down. Exhaling longer than you inhale increases vagal tone and slows the heart rate down by activating the parasympathetic nervous system. This signals to your brain that you are safe, lowering sensory overload.",
  },
  frozen_numb: {
    state: "frozen_numb",
    label: "Coherent Breathing",
    questionLabel: "I feel frozen or numb",
    shortLabel: "Frozen or numb",
    image: require("../assets/images/icon_frozen.jpg"),
    inhaleSec: 6.0,
    exhaleSec: 6.0,
    durationOptionsSec: [60, 180, 300],
    defaultDurationSec: 180,
    explanation: "Coherent breathing at approximately 5 breaths per minute maximizes heart rate variability (HRV) and creates an optimal balance between the sympathetic and parasympathetic nervous systems. When you feel shut down (a dorsal vagal state), this gentle rhythm softly reawakens your nervous system without overwhelming it.",
  },
  restless_focus: {
    state: "restless_focus",
    label: "Resonant Frequency",
    questionLabel: "I feel restless and unfocused",
    shortLabel: "Restless",
    image: require("../assets/images/icon_restless.jpg"),
    inhaleSec: 5.5,
    exhaleSec: 5.5,
    durationOptionsSec: [60, 180, 300],
    defaultDurationSec: 180,
    explanation: "Resonant Frequency Breathing involves breathing at a precise rate (5.5 seconds in and out) that perfectly synchronizes your respiratory and cardiovascular systems. This synchronization maximizes your heart rate variability (HRV) and clears brain fog. It effectively transforms restless, jittery energy into smooth, sustained focus and flow.",
  },
};
