# REZET — FEATURE SPEC

## In-session HRV Measurement via Camera

**Status:** proposed feature addendum  
**Applies to:** Breathing Session  
**Platforms:** iOS + Android  
**Implementation shape:** production-grade custom native module + Expo config plugin  
**Default:** OFF / optional per session  
**Network:** none  
**Data processing:** on-device only

---

## 1) Feature definition

Add an **optional HRV measurement mode** inside every breathing session. When enabled, the user can place a finger over the **rear camera** to capture a camera-based pulse signal (PPG) and estimate:

- heart rate
- HRV trend
- session start vs session end delta
- signal quality

This feature must remain **secondary** to the breathing experience. The breathing session still starts immediately and remains fully usable without camera access.

The main user value is **seeing HRV change live while breathing**. The feature is not primarily a post-session report; it is an in-session feedback layer.

The implementation is expected to be **production-ready and professional-grade** in reliability, stability, signal handling, permission flow, and lifecycle management. This refers to software quality, not medical certification.

---

## 2) Product goal

Give users an optional, low-friction physiological readout that shows in real time whether their body is shifting during a breathing session, without turning the app into a medical, diagnostic, or quantified-self product.

---

## 3) Non-goals

- No medical diagnosis
- No claim of clinical accuracy
- No ECG-grade HRV claim
- No mandatory measurement before session start
- No camera feed UI for exploration or scanning
- No cloud processing
- No account sync
- No gamification, scores, streaks, or “performance” framing

---

## 4) Core rules

1. Breathing starts immediately even if HRV is unsupported, denied, or unused.
2. HRV measurement is always optional.
3. Camera-based HRV must be clearly labeled as an **estimate**.
4. If signal quality is poor, breathing continues unchanged.
5. All raw camera processing stays on-device.
6. The feature must preserve the app’s low-cognitive-load and OCD-safe principles.

---

## 5) User experience

### 5.1 Entry point

Inside the Breathing Session header, add a small optional control:

- label/icon intent: **HRV**
- state: off / connecting / measuring / poor signal / unavailable

The control must not dominate the session UI.

### 5.2 First-time flow

When the user taps HRV for the first time:

1. Show a minimal bottom sheet or overlay
2. Explain the action in neutral language
3. Ask for camera permission only after explicit user intent

Required first-use copy:

- Title: **“Measure HRV with camera”**
- Body: **“Place a finger over the rear camera during the session. This creates an HRV estimate from pulse changes.”**
- Buttons: **“Continue”** / **“Not now”**

If permission is granted, start measurement immediately.  
If denied, keep session running and show a small non-blocking unavailable state.

### 5.3 Active measurement flow

When HRV mode is enabled:

- open rear camera
- enable torch if device supports it and thermal/battery conditions allow
- show a compact overlay near the bottom or top edge
- keep the breathing circle visually primary
- make the current HRV value visible during the session as soon as signal quality is sufficient

Minimal measurement UI:

- status line: `Measuring` / `Finding signal` / `Low signal`
- live heart rate value when stable
- live HRV value when stable
- small directional change indicator relative to session start or rolling baseline
- no raw waveform in the first release
- no dense charts during session

Realtime display requirements:

- HRV must be visible during the session, not only on Session End
- once stable, the visible HRV value should refresh regularly enough for the user to perceive change while breathing
- show movement conservatively; prefer slightly delayed stable values over noisy jitter
- if quality drops below threshold, replace the value with the low-signal state instead of showing unstable numbers

### 5.4 Session end

If enough usable signal was captured, Session End may show a small optional HRV summary card:

- Start HRV
- End HRV
- Change
- Signal quality badge: Low / Medium / High

If there is not enough valid signal, do not show fake precision. Use:

- **“HRV not available for this session”**

---

## 6) UX behavior requirements

### 6.1 Session start

- Session starts immediately as today.
- HRV initialization must never delay breathing animation.

### 6.2 Toggle behavior

- Tapping HRV ON during a session starts measurement in parallel.
- Tapping HRV OFF stops camera capture immediately.
- User can continue the session normally either way.

### 6.3 Permission states

- Not requested: show first-use explainer
- Granted: start capture
- Denied: show unavailable state with brief instruction to enable camera access in system settings
- Restricted / unavailable: show unavailable state, no retry loop

### 6.4 Backgrounding / interruption

- If app backgrounds, stop camera capture immediately
- If session resumes, breathing follows existing session behavior
- HRV must require explicit reactivation on resume in the first release

### 6.5 Device support

HRV measurement is available only when:

- rear camera exists
- camera permission can be granted
- native module reports frame access support

Torch is preferred but not strictly required. Devices without usable illumination may show lower quality or disable the feature.

---

## 7) Signal and metric definition

### 7.1 Measurement method

Use fingertip photoplethysmography (PPG) from the rear camera stream, ideally with torch illumination.

### 7.2 Metrics exposed to the JS app

- `heartRateBpm`
- `hrvRmssdMs`
- `signalQuality`
- `isFingerDetected`
- `measurementState`

### 7.3 Metric rules

- Primary HRV metric: **RMSSD estimate**
- HRV must only be surfaced when the native module has enough clean inter-beat intervals
- Values must be smoothed to avoid noisy frame-to-frame jumps
- UI refresh rate should be limited, but frequent enough to feel live
- recommended UI refresh interval: every 1 second
- use a rolling window so the displayed HRV can change during the session instead of remaining static until the end

### 7.4 Quality gating

Do not show HRV values until all are true:

- finger detected
- stable pulse present
- minimum clean capture window reached
- signal quality above threshold

Recommended initial thresholds:

- acquisition warm-up: 8-12 seconds
- rolling analysis window: 30 seconds
- minimum signal quality states: `medium` or `high`

---

## 8) Breathing-session integration rules

### 8.1 Functional relationship

HRV measurement is observational in the first release. It does **not** auto-change the breathing protocol.

Its primary purpose is realtime biofeedback:

- user breathes
- user sees HRV respond during the same session
- protocol remains manual and unchanged unless the user uses the existing checkpoint

### 8.2 Adaptive checkpoint

The existing 45-second checkpoint remains unchanged:

- “Still intense”
- “This helps”

HRV measurement continues in parallel if enabled.

### 8.3 Duration handling

- If the user changes session duration mid-session and the session restarts, HRV capture stops and must restart from zero
- If the user taps Continue on Session End, HRV defaults back to off for the new session in the first release

---

## 9) Data model

### 9.1 Settings

Add:

```ts
type Settings = {
  ...
  hrvMeasurementEnabledByDefault: boolean; // default false
};
```

### 9.2 Session-scoped measurement

```ts
type HrvMeasurementState =
  | "off"
  | "requesting_permission"
  | "finding_signal"
  | "measuring"
  | "low_signal"
  | "unavailable"
  | "error";

type SessionHrvSample = {
  timestampMs: number;
  heartRateBpm?: number;
  hrvRmssdMs?: number;
  signalQuality: "low" | "medium" | "high";
};

type SessionHrvSummary = {
  startedAtMs: number;
  endedAtMs: number;
  startHeartRateBpm?: number;
  endHeartRateBpm?: number;
  startHrvRmssdMs?: number;
  endHrvRmssdMs?: number;
  deltaHeartRateBpm?: number;
  deltaHrvRmssdMs?: number;
  quality: "low" | "medium" | "high";
  sufficientSignal: boolean;
};
```

### 9.3 Persistence

Production default:

- Persist only final per-session summary if session history exists later
- Do not persist raw frame data
- Do not persist raw PPG signal
- If no session history feature exists, keep HRV summary in memory only for Session End

---

## 10) Native module specification

### 10.1 Why a custom native module

This feature needs direct camera frame access, torch control, and native-side signal processing that should not run in JS on every frame. Use a custom native module plus Expo config plugin.

The native implementation should be engineered as a production subsystem:

- deterministic lifecycle handling
- bounded memory and CPU usage
- explicit error states
- defensive handling for permission, torch, thermal, and camera-session failures
- stable event delivery to JS without flooding the bridge

### 10.2 Module responsibilities

The native module must:

- request camera access
- start and stop rear camera capture
- enable or disable torch when available
- derive a PPG signal from fingertip-covered frames
- detect beat peaks / inter-beat intervals
- compute HR and RMSSD estimate
- score signal quality
- emit throttled measurement updates to JS

### 10.3 JS API shape

```ts
type StartHrvOptions = {
  torchPreferred?: boolean;
  updateIntervalMs?: number; // default 1000
};

type HrvStatusEvent = {
  state: HrvMeasurementState;
  heartRateBpm?: number;
  hrvRmssdMs?: number;
  signalQuality?: "low" | "medium" | "high";
  fingerDetected?: boolean;
};

interface CameraHrvModule {
  isAvailable(): Promise<boolean>;
  getPermissionStatus(): Promise<"granted" | "denied" | "undetermined" | "restricted">;
  requestPermission(): Promise<"granted" | "denied" | "restricted">;
  start(options?: StartHrvOptions): Promise<void>;
  stop(): Promise<void>;
  addListener(eventName: "hrvStatus", listener: (event: HrvStatusEvent) => void): { remove(): void };
}
```

### 10.4 Expo config plugin

The config plugin must:

- add iOS camera usage description
- add Android camera permission
- add flash/torch capability configuration if required by implementation
- register the native module cleanly for prebuild

Recommended permission copy:

- iOS `NSCameraUsageDescription`: **“Camera access is used to estimate heart rate variability during breathing sessions.”**

---

## 11) Safety, copy, and compliance

### 11.1 Copy rules

Allowed copy style:

- neutral
- technical
- non-reassuring
- non-diagnostic

Forbidden copy:

- “Your nervous system is healed”
- “Your HRV is bad”
- “You are safe now”
- “Clinical measurement”
- “Medical-grade”

### 11.2 Required disclaimer

Where HRV data is first introduced, include a short note:

- **“Camera HRV is an estimate and not a medical measurement.”**

### 11.3 Failure behavior

If quality is poor:

- do not show unstable numbers
- do not suggest something is wrong with the user
- do not interrupt breathing

---

## 12) Performance requirements

- Camera startup must not block session rendering
- Native processing should be efficient enough to avoid visible frame drops in the session UI
- CPU and thermal impact must be bounded for sessions up to 3 minutes
- Stop camera and torch immediately when feature is turned off or session exits

---

## 13) Analytics and privacy

Production default:

- no network transmission
- no third-party analytics payload with HRV values
- no storage of raw camera frames
- no storage of raw pulse signal

If product analytics are added later, only aggregate opt-in events should be considered, such as:

- HRV feature toggled on
- permission granted / denied
- sufficient signal achieved

No biometric raw data should leave the device.

---

## 14) Edge cases

- User covers lens incorrectly: remain in `finding_signal` or `low_signal`
- Torch unavailable: continue if signal can still be derived, otherwise mark unavailable
- Device overheats: stop measurement, keep breathing session active
- Permission revoked while app is open: stop measurement, show unavailable state
- Measurement never stabilizes before session ends: no summary card
- User exits session early: stop measurement and discard incomplete summary

---

## 15) QA acceptance criteria

1. Starting a breathing session never requires camera permission.
2. HRV can be activated from inside every breathing session.
3. Denying camera permission does not break the session flow.
4. Turning HRV on starts rear camera capture without interrupting breathing animation.
5. Turning HRV off stops camera and torch immediately.
6. During the session, HRV becomes visibly available in real time once signal quality threshold is met.
7. The displayed HRV value updates during the session often enough for the user to see directional change while breathing.
8. HRV values are hidden until signal quality threshold is met.
9. Session End shows HRV summary only when sufficient signal exists.
10. No raw camera frames or raw PPG data are persisted.
11. Backgrounding the app stops measurement safely.
12. Unsupported devices show a non-blocking unavailable state.

---

## 16) Definition of done

User can start any breathing session normally, optionally enable camera-based HRV measurement during that session, see a stable on-device HRV estimate update live while breathing when signal quality is sufficient, and complete the session without camera use ever becoming required.
