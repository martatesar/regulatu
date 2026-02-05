# REZET — COMPLETE MVP SPEC (React Native)

## Single source of truth for LLM-based app generation

**Build target:** React Native (Expo-first recommended)  
**Platforms:** iOS + Android  
**Offline-first:** yes  
**Accounts:** none  
**Sensors / AI:** none  
**Default mode:** dark  
**Primary promise:** regulate dysregulated states in **≤ 90 seconds** with ultra-low cognitive load.

---

## 1) Product definition

### Product name

**REZET** (working name)

### Category

Nervous system regulation tool (not meditation, not therapy, not habit/gamification)

### Use moment

User is already dysregulated (panic/anxiety spike, intrusive loop, overstimulation, ADHD restlessness) and needs **immediate** relief.

### Non-negotiable principles

1. **Immediate start** (tap → breathing starts; no onboarding)
2. **State-based** (felt state) not diagnosis-based
3. **Ultra-low cognitive load** (no text while breathing)
4. **OCD-safe + panic-safe** language and protocols
5. **Eyes-open, real-world usable** (public/work)
6. **No habit framing** (no streaks, reminders, goals)
7. **Neutral copy only** (instructional; no reassurance/motivation)

---

## 2) Primary entry states

User selects what they feel **right now**:

1. **Heart racing**
2. **Chest tight / short breath**
3. **Mind looping**
4. **Too much input**
5. **Frozen / numb**
6. **Restless / can’t focus**

Each state maps to **one exact breathing protocol** (Section 5).

---

## 3) App flow

```text
Launch
 → Home (felt-state list)
 → Breathing Session (full-screen)
   → (45s) Adaptive Checkpoint overlay (optional interaction)
 → Session End (neutral)
 → Continue (back to session) OR Stop (back to home)
Settings is accessible from Home.
```

No accounts. No onboarding. No analytics UI.

---

## 4) Screens (UX + behavior + required copy)

### Screen 1 — Home

**Purpose:** pick felt-state and start instantly.

**UI**

- Header (small): **“How does your body feel right now?”**
- 6 large buttons (felt-states)
- Settings icon (top-right)

**Behavior**

- Tap a felt-state → navigate immediately to Breathing Session
- Default session length auto-selected per protocol; user can optionally change duration on session screen (Section 6.4)

---

### Screen 2 — Breathing Session (core)

**Purpose:** regulation experience.

**UI**

- Full-screen dark background
- Single central animated shape (**circle**) only
- No text during breathing
- Minimal icons:
  - Back/Close (top-left)
  - Haptics toggle (top-right, optional)
  - Audio toggle (top-right or in overflow; optional)

**Behavior**

- Starts immediately on entry (no “start” button)
- Circle expands = inhale; contracts = exhale
- Optional subtle haptic cue synced to phase transitions
- Audio cues OFF by default; if ON, speak only: “Inhale” / “Exhale”
- At **45s**: show Adaptive Checkpoint overlay (Screen 3)

---

### Screen 3 — Adaptive Checkpoint (overlay)

**Trigger:** exactly at elapsed **45 seconds** of a session.

**UI**

- Semi-transparent overlay (no blur required)
- Two buttons:
  - **“Still intense”**
  - **“This helps”**

**Behavior**

- If user does nothing for **5 seconds** → overlay fades out, session continues unchanged
- If user taps:
  - “Still intense” → apply adjustment rules (Section 6.3) immediately and continue
  - “This helps” → continue unchanged

**Copy rules**

- No additional text, no explanation

---

### Screen 4 — Session End

**UI**

- Title: **“Session complete”**
- Buttons:
  - **“Continue”**
  - **“Stop”**

**Behavior**

- Continue → resume same protocol from the beginning (reset timer)
- Stop → return Home

**Copy rules**

- Never ask “Do you feel calmer?” or any emotional prompt (OCD-safe)

---

### Screen 5 — Settings

**Purpose:** minimal configuration.

**Toggles**

- **OCD-safe mode** (default OFF)
- **Haptics** (default OFF)
- **Voice cues** (default OFF)
- **Dark mode** (default ON)

**Behavior**

- Settings persist locally

---

## 5) Exact breathing protocols (MVP)

All timings are **required**.

> Notation: Inhale = I, Exhale = E. No breath holds anywhere in MVP.

### 5.1 Heart racing (acute anxiety / panic onset)

**Goal:** fast parasympathetic activation, panic-safe (no holds)

- **I: 2.5s**
- **E: 5.5s**
- Ratio E:I ≈ 2.2
- Default duration: **90s**
- Allowed durations: 45s / 90s / 180s

---

### 5.2 Chest tight / short breath

**Goal:** restore depth without hyperventilation

- **I: 3.5s**
- **E: 4.5s**
- Default duration: **90s**
- Allowed durations: 45s / 90s / 180s

---

### 5.3 Mind looping (OCD / rumination)

**Goal:** reduce cognitive dominance without reassurance

- **I: 4.0s**
- **E: 4.0s**
- **Micro-variation:** each cycle randomly adds **±0.3s** distributed across I/E (keep total cycle ~8s)
  - Implementation suggestion: pick `delta ∈ {-0.3, 0, +0.3}` each cycle and apply:
    - I = 4.0 + delta
    - E = 4.0 - delta
- Default duration: **90s**
- Allowed durations: 45s / 90s / 180s

---

### 5.4 Too much input (overstimulation)

**Goal:** smooth downshift

- **I: 3.0s**
- **E: 6.0s**
- Default duration: **90s**
- Allowed durations: 45s / 90s / 180s

---

### 5.5 Frozen / numb (shutdown)

**Goal:** gentle activation

- **I: 4.0s**
- **E: 3.0s**
- Optional haptic on inhale start (if haptics ON)
- Default duration: **90s**
- Allowed durations: 45s / 90s / 180s

---

### 5.6 Restless / can’t focus (ADHD)

**Goal:** regulate without sedation

- **I: 3.0s**
- **E: 3.0s**
- Default duration: **60s**
- Allowed durations: 45s / 60s / 90s

---

## 6) Session engine (timing, adaptation, durations)

### 6.1 Session start

- On navigation to Breathing Session, start immediately:
  - elapsed = 0
  - phase = inhale
  - schedule animation for inhale duration then exhale duration, looping until elapsed >= sessionDuration
- If app is backgrounded:
  - pause timer and animation
  - on resume: show “Session complete” immediately OR resume (choose one; MVP recommendation: **resume**)

### 6.2 Phase transitions

- Each cycle is inhale then exhale.
- Trigger haptics (if enabled) at:
  - inhale start (optional)
  - exhale start (optional)
- Trigger voice cue (if enabled) at:
  - inhale start: “Inhale”
  - exhale start: “Exhale”
- No other spoken content.

### 6.3 Adaptive checkpoint (exact logic)

At elapsed **45s**:

- show overlay (Screen 3)
- if user taps “Still intense”, apply:
  - `E = min(E + 0.5, 7.0)`
  - `I = max(I - 0.3, 1.8)` (safety floor to prevent air hunger)
- if user taps “This helps”, no change
- if no input after 5s, hide overlay, no change

Applies for the remainder of the session.

### 6.4 Session duration selection (optional UI)

MVP may include a tiny duration selector on Breathing Session (top center), defaulting per protocol:

- Most states: 45s / 90s / 180s
- ADHD: 45s / 60s / 90s

Rules:

- Must be one-tap, no modal required
- If user changes duration mid-session, restart session with new duration

### 6.5 Session end behavior

When elapsed >= sessionDuration:

- navigate to Session End screen (Screen 4)

---

## 7) OCD-safe mode (critical constraints)

When OCD-safe mode is ON:

- Still use the same screens and protocols
- Enforce copy rules:
  - No reassurance: “you’re safe”, “it will pass”, etc.
  - No motivational: “you’ve got this”
  - No emotional prompts: “are you calmer?”
- Do not show success indicators, streaks, achievements
- Keep UI neutral (no green “success” states)

**In this MVP spec, all copy is already OCD-safe.** OCD-safe mode primarily exists to prevent future additions from violating rules and to toggle off any future “comfort copy”.

---

## 8) Copy system (allowed vs forbidden)

### Allowed copy style

- Neutral, instructional, minimal

**Approved phrases**

- “How does your body feel right now?”
- “Session complete”
- “Continue”
- “Stop”
- “Still intense”
- “This helps”
- “Inhale”
- “Exhale”

### Forbidden

- “You’re safe”
- “Calm down”
- “Relax”
- “You’re doing great”
- Therapy language, diagnoses, or reassurance
- Any countdown text during breathing

---

## 9) Design system (MVP)

### 9.1 Visual philosophy

Calm without sedation. Minimal without emptiness. Neutral without coldness.

### 9.2 Color

- Background: deep charcoal / near-black
- Primary accent: muted blue or soft teal
- Secondary: neutral gray

Rules:

- No pure white backgrounds
- Avoid high-saturation colors
- Avoid red/green semantic signaling

### 9.3 Typography

- Clean sans-serif
- Medium weights preferred
- Large tap targets, high legibility
- No playful/handwritten fonts

### 9.4 Motion

- One animated element: the breathing circle
- Smooth predictable easing (ease-in-out)
- No pulsing/glow that resembles alerts
- No sudden stops

### 9.5 Haptics

- Optional, OFF by default
- Subtle, short cues only
- Never strong or alarming patterns

### 9.6 Accessibility

- Dark mode default
- High contrast without glare
- No reliance on audio
- Tap targets >= 44px

---

## 10) React Native implementation (Expo-first)

### 10.1 Recommended stack

- **Expo** (managed workflow)
- **TypeScript**
- Navigation: `@react-navigation/native` + stack
- Animation: `react-native-reanimated` (preferred) or RN Animated
- Haptics: `expo-haptics`
- Audio / TTS: `expo-speech`
- Storage: `@react-native-async-storage/async-storage`
- State: local component state + small settings store (Context or Zustand)

### 10.2 File structure (suggested)

```text
src/
  app/
    App.tsx
    navigation.tsx
  screens/
    HomeScreen.tsx
    SessionScreen.tsx
    SessionEndScreen.tsx
    SettingsScreen.tsx
  components/
    BreathingCircle.tsx
    AdaptiveOverlay.tsx
    IconButton.tsx
  engine/
    protocols.ts
    sessionEngine.ts
    random.ts
  store/
    settingsStore.ts
  theme/
    colors.ts
    typography.ts
    spacing.ts
```

---

## 11) Data model (local only)

### 11.1 Protocol definition

```ts
type FeltState =
  | "heart_racing"
  | "chest_tight"
  | "mind_looping"
  | "too_much_input"
  | "frozen_numb"
  | "restless_focus";

type Protocol = {
  state: FeltState;
  label: string;
  inhaleSec: number;
  exhaleSec: number;
  durationOptionsSec: number[];
  defaultDurationSec: number;
  microVariation?: { enabled: boolean; deltaSec: number };
};
```

### 11.2 Settings

```ts
type Settings = {
  ocdSafeMode: boolean;
  hapticsEnabled: boolean;
  voiceCuesEnabled: boolean;
  darkMode: boolean;
  lastState?: FeltState;
  sessionCount: number;
};
```

Persist with AsyncStorage.

---

## 12) Session engine pseudocode (implementation intent)

### 12.1 Core loop

- Maintain:
  - protocol (mutable if adjusted)
  - selectedDurationSec
  - elapsedSec
  - phase: inhale | exhale
  - checkpointShown boolean

### 12.2 Pseudocode

```text
onSessionStart:
  elapsed = 0
  phase = inhale
  checkpointShown = false
  startPhase(inhale, protocol.inhaleSec)

startPhase(phase, durationSec):
  animateCircle(phase, durationSec)
  if voiceCues: speak(phase)
  if haptics: haptic(phase)
  wait durationSec
  elapsed += durationSec
  if elapsed >= selectedDuration: endSession()
  else:
    if !checkpointShown && elapsed >= 45:
      showCheckpointOverlay()
      checkpointShown = true
    phase = (phase == inhale) ? exhale : inhale
    durationSec = (phase == inhale) ? nextInhaleSec() : nextExhaleSec()
    startPhase(phase, durationSec)

nextInhaleSec / nextExhaleSec:
  if protocol.microVariation.enabled and phase cycle boundary:
    compute delta in {-deltaSec,0,+deltaSec}
    inhale = baseInhale + delta
    exhale = baseExhale - delta
  return current inhale/exhale
```

---

## 13) Breathing circle animation requirements

- Base size scale: 0.85
- Max size scale: 1.15
- Inhale: scale from base → max
- Exhale: scale from max → base
- Easing: ease-in-out
- Background remains constant
- No numeric timers visible

---

## 14) Edge cases & rules

- If user presses Back/Close during session: stop session and return Home (no confirmation)
- If incoming call / interruption: stop session and return Home on resume (acceptable MVP behavior)
- If user changes duration mid-session: restart session from beginning
- Always keep inhale >= 1.8s (safety floor)
- Never introduce breath holds in MVP

---

## 15) QA acceptance criteria (MVP)

1. Launch → breathing starts in **< 2 seconds** after selecting a state.
2. Breathing animation matches protocol timing within ±100ms.
3. At 45s, overlay appears and:
   - disappears after 5s if untouched
   - adjusts I/E correctly if “Still intense” is tapped
4. Session ends exactly at selected duration and shows Session End screen.
5. All copy matches the approved list; no extra text during breathing.
6. Settings persist across relaunch.
7. Offline works (no network needed).

---

## 16) Approved copy list (single source)

**Home**

- “How does your body feel right now?”
- “Heart racing”
- “Chest tight / short breath”
- “Mind looping”
- “Too much input”
- “Frozen / numb”
- “Restless / can’t focus”

**Checkpoint**

- “Still intense”
- “This helps”

**Session end**

- “Session complete”
- “Continue”
- “Stop”

**Voice cues**

- “Inhale”
- “Exhale”

---

## 17) Definition of Done

User can:

- Open app
- Tap a felt-state
- Immediately follow breathing guidance
- Optionally adjust via checkpoint
- End and continue/stop
- Configure minimal settings
  All without accounts, onboarding, or cognitive overhead.

---

END OF SPEC
