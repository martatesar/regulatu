# Custom Breathing Protocol V1

## Goal

Let the user create and save their own breathing protocols with a very simple flow:

1. Create or edit the protocol
2. Pick the breathing phase durations
3. Pick session target by time or by rounds
4. Save and start it from Home in one tap

This should feel native to the current REZET app: low-friction, dark UI, minimal text, no setup complexity during the session itself.

## V1 Scope

Included:

- Multiple saved custom protocols per device
- Configurable phase durations for:
  - inhale
  - hold after inhale
  - exhale
  - hold after exhale
- Session target mode:
  - time-based
  - round-based
- Simple create/edit UX
- Start custom session from Home
- Persist locally with AsyncStorage

Excluded from V1:

- Import/export
- Sharing
- Audio guidance customization
- Per-round variable timings
- Named templates library

## Why multiple protocols in V1

The user request explicitly needs more than one configurable protocol, so the product should support a small personal protocol library from the start.

To keep that manageable in the current app:

- Home shows a compact, visually scannable list of custom protocol cards
- each card has only two actions: start and edit
- creation happens in a single reusable editor screen
- no folders, tags, import/export, or sharing

## User Experience

### Home screen

Add a new section below the built-in felt-state cards:

- Section title: `Your protocols`
- Layout: horizontally scrollable row of cards
- First tile is always the create tile

Card states:

- Empty state:
  - show one create card
  - title: `Create custom protocol`
  - subtitle: `Set your own inhale, exhale, hold, and session target`
- Saved state:
  - show one card per saved custom protocol, ordered by most recently used
  - title: protocol name
  - subtitle example: `In 4s • Hold 2s • Out 6s • 10 rounds`
  - supporting meta example: `12s cycle`
  - each card should show a compact visual breath summary instead of dense text only

Card visual design:

- medium-width rounded cards, not full-width rows
- soft glass surface with subtle border and one accent glow
- top area shows protocol name
- middle area shows 3-4 compact chips:
  - `In 4s`
  - `Hold 2s`
  - `Out 6s`
  - `10 rounds`
- trailing edit icon stays visible without competing with the start action
- optional small ring or line preview shows the rhythm shape at a glance

Card actions:

- Tap card body:
  - start that protocol immediately
- Tap small edit icon:
  - open editor for that protocol
- Tap create button or create card:
  - open empty editor

This keeps "one tap to start" for every saved custom protocol.

Better UX rules:

- do not bury create behind a plus icon only; use a full create tile
- show at least part of the next card to indicate horizontal scroll
- keep touch targets at least 44pt
- if there are many protocols, most recently used appears first

### Custom protocol editor

Add a dedicated screen presented modally from Home.

Working title:

- `CustomProtocolEditorScreen`

Primary UX rules:

- no freeform numeric text input in the default path
- use stepper controls with plus/minus
- immediate visual summary at top
- progressive disclosure for advanced controls
- primary action should be available without scrolling back up

Editor visual direction:

- top hero card with protocol name and live summary
- summary line example: `4.0 in / 6.0 out / 10 rounds`
- secondary meta line example: `10s cycle • 6 breaths/min`
- use the same dark gradient language as the rest of the app, but make the editor feel brighter and more tactile than Settings
- numeric values should be large, centered, and easy to scan

Layout:

1. Header
   - title: `Custom protocol`
   - close button
2. Name field
   - placeholder: `My breathing`
   - optional but recommended
   - if empty on save, fallback to `Custom breathing`
3. Quick-fill row
   - label: `Start from`
   - compact chips that instantly prefill values:
     - `Blank`
     - `Long exhale`
     - `Box`
     - `4-7-8`
     - `Coherent`
   - these are optional accelerators, not locked templates
4. Main breath card
   - always-visible rows in sequence:
     - inhale
     - hold after inhale
     - exhale
     - hold after exhale
   - each row has:
     - label
     - minus button
     - current value
     - plus button
   - values change in `0.5s` steps
   - hold rows are edited inline in the cycle, not in a separate holds section
   - hold rows can remain at `0` when unused
5. Session target card
   - segmented toggle:
     - `Time`
     - `Rounds`
   - if `Time` selected:
     - stepper for total duration
   - if `Rounds` selected:
     - stepper for round count
6. Sticky footer
   - primary button: `Save and start`
   - secondary button: `Save`
   - destructive text action when editing an existing protocol: `Delete`

Close behavior:

- if there are unsaved changes and user taps close, show a simple discard confirmation sheet
- no confirmation is needed if nothing changed

### Session screen

The existing session screen remains visually the same.

Changes:

- Support custom protocol source in addition to built-in felt-state source
- Built-in sessions keep the existing duration pills
- Custom sessions use a read-only target display in the header area:
  - show protocol name in the center
  - time mode: show current target label, for example `3m`
  - rounds mode: show current target label, for example `10 rounds`
- Session ends when either:
  - elapsed time reaches configured duration
  - completed rounds reaches configured round count

No additional text should appear in the breathing area.

### Session end screen

Continue behavior:

- built-in session -> current behavior unchanged
- custom session -> restart the same custom protocol by id with the same target mode and value

Custom session end UI:

- show the custom protocol name below `Session complete`
- keep the current neutral tone and do not add reflective prompts

## Configuration Rules

### Phase durations

V1 field set:

- `inhaleSec`
- `holdAfterInhaleSec`
- `exhaleSec`
- `holdAfterExhaleSec`

Rules:

- inhale minimum: `1.0s`
- exhale minimum: `1.0s`
- holds minimum: `0.0s`
- all fields step by `0.5s`
- holds set to `0.0s` are treated as disabled

Validation:

- inhale and exhale must both be greater than `0`
- save button disabled for invalid configuration
- no hard maximum values should be imposed on phase lengths in V1

### Session target

Two supported modes:

1. Time mode
   - stored as total seconds
   - step size:
     - under 5 minutes -> `30s`
     - 5 minutes and above -> `60s`
   - no hard maximum duration in V1

2. Rounds mode
   - stored as integer round count
   - step size: `1`
   - no hard maximum round count in V1

Default values for first-time creation:

- inhale: `4.0s`
- hold after inhale: `0.0s`
- exhale: `6.0s`
- hold after exhale: `0.0s`
- target mode: `time`
- duration: `180s`
- name: `Custom breathing`

## Data Model

Introduce a persistent custom protocol collection in the settings store or a dedicated store.

Suggested type:

```ts
type SessionTarget =
  | { mode: "time"; durationSec: number }
  | { mode: "rounds"; rounds: number };

type CustomProtocol = {
  id: string;
  name: string;
  inhaleSec: number;
  holdAfterInhaleSec: number;
  exhaleSec: number;
  holdAfterExhaleSec: number;
  createdAt: string;
  lastUsedAt?: string;
  target: SessionTarget;
  updatedAt: string;
};
```

Store shape suggestion:

```ts
interface SettingsState {
  ...
  customProtocols: CustomProtocol[];
  addCustomProtocol: (protocol: CustomProtocol) => void;
  updateCustomProtocol: (protocol: CustomProtocol) => void;
  deleteCustomProtocol: (id: string) => void;
  markCustomProtocolUsed: (id: string) => void;
}
```

## Navigation Changes

### New screen

- `CustomProtocolEditor`

### Session route

Current route only supports preset felt-states. It should become a union so Session can handle both built-in and custom sources cleanly.

Suggested route shape:

```ts
type SessionParams =
  | {
      source: "preset";
      state: FeltState;
      durationSec?: number;
    }
  | {
      source: "custom";
      protocolId: string;
    };
```

Notes:

- The custom session reads the protocol from persisted store using `protocolId`

### Session end route

Suggested update:

```ts
type SessionEndParams =
  | {
      source: "preset";
      state: FeltState;
      durationSec: number;
      hrvSummary?: SessionHrvSummary;
    }
  | {
      source: "custom";
      protocolId: string;
      hrvSummary?: SessionHrvSummary;
    };
```

## Session Engine Changes

The existing engine already supports:

- inhale
- exhale
- optional hold after inhale
- optional hold after exhale

That means the main engine change is not the breathing pattern itself. The main addition is stop logic for rounds.

### New runtime state

Add:

- `completedRoundsRef`
- `sessionTargetRef`

Round counting rule:

- increment completed rounds when `hold-exhale -> inhale`
- if `hold-exhale` is skipped, increment when `exhale -> inhale`
- a round is complete when the cycle returns to inhale

End condition:

- time mode: current behavior
- rounds mode: finish when completed rounds reaches target

### Duration selector area

Built-in protocols keep current duration pills.

Custom protocol behavior:

- time mode:
  - show current time target label only
- rounds mode:
  - show current rounds target label only

Recommendation for V1:

- no in-session editing for custom targets
- editing stays inside the custom protocol editor

This keeps the session screen calm and reduces implementation risk.

## UI Style Direction

Match the current visual language:

- dark gradient background
- glass-like cards
- muted borders
- minimal copy

For the editor specifically:

- use the same top-level gradient as Home and Session
- make the phase controls feel tactile
- avoid long forms
- show the live summary prominently, for example:
  - `4.0 in / 2.0 hold / 6.0 out / 10 rounds`
- use larger numeric typography for time values than for labels
- give steppers a distinct pressed state so they feel responsive
- use chip-style metadata instead of long explanatory text
- use one accent color family for custom protocol UI so it feels separate from preset state cards

Nice V1 detail:

- include a tiny non-animated cycle preview strip in the editor header
- highlight disabled holds as muted
- animate create-card entrance and editor section expansion subtly, not excessively

Accessibility and usability:

- keep all core actions reachable with one thumb on large phones
- support large text without breaking stepper rows
- use tabular numerals for duration values so they do not jump visually while editing
- avoid hiding critical actions in overflow menus
- keep contrast strong enough that values remain readable in dim light

## Copy

Keep copy neutral and operational.

Recommended labels:

- `Your protocols`
- `Start from`
- `Blank`
- `Long exhale`
- `Box`
- `4-7-8`
- `Coherent`
- `Create`
- `Create custom protocol`
- `Custom protocol`
- `Inhale`
- `Hold after inhale`
- `Exhale`
- `Hold after exhale`
- `Time`
- `Rounds`
- `Save and start`
- `Save`
- `Delete`

Avoid:

- coaching language
- medical claims
- reassurance prompts

## Edge Cases

- If user opens custom session with a missing or deleted protocol id, return to Home
- If saved protocol becomes invalid because of future schema changes, reset to defaults before rendering session
- If rounds mode is active and user backgrounds the app, current pause/resume behavior should remain consistent
- If user deletes a protocol from the editor, remove it from the list and return to Home
- If there are no custom protocols, Home shows the empty create state

## Implementation Plan

### Step 1

Add persistent custom protocol types and collection actions to store.

### Step 2

Add `CustomProtocolEditorScreen` and navigation route.

### Step 3

Add custom section to Home with create tile, horizontally scrollable saved protocol cards, and recent-first ordering.

### Step 4

Refactor Session and SessionEnd routes to support `source: "preset" | "custom"` and `protocolId` for custom sessions.

### Step 5

Update `SessionScreen` to resolve either preset protocol or custom protocol, mark custom protocols as recently used on start, and support round-based end condition.

### Step 6

Add validation, discard-confirmation flow, recent-use tracking, and UI polish.

### Step 7

Test:

- create multiple custom protocols
- edit and persist them
- start any custom session from Home
- end session by time
- end session by rounds
- continue from Session End
- delete a protocol

## Approval Decisions Needed

These are the only product choices I need from you before implementation:

1. V1 should support a list of saved custom protocols on Home.
2. Custom session target should be editable only in the editor, not on the live session screen.
3. Phase values should use steppers in `0.5s` increments, not manual numeric input.
4. Rounds mode should count one full cycle as completed when the animation returns to inhale.
5. V1 should have no hard maximum values for phase lengths, duration, or round count.
6. Home should use a horizontal card list for custom protocols rather than full-width vertical rows.
7. The editor should support quick-fill starter chips and `Save and start` as the primary action.

If you approve those seven points, implementation can start without extra product ambiguity.
