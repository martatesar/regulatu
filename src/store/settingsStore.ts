import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, persist } from "zustand/middleware";
import { FeltState } from "../engine/protocols";

interface SettingsState {
  ocdSafeMode: boolean;
  hapticsEnabled: boolean;
  voiceCuesEnabled: boolean;
  darkMode: boolean; // default true
  lastState?: FeltState;

  // Actions
  setOcdSafeMode: (val: boolean) => void;
  setHapticsEnabled: (val: boolean) => void;
  setVoiceCuesEnabled: (val: boolean) => void;
  setLastState: (state: FeltState) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ocdSafeMode: false,
      hapticsEnabled: false,
      voiceCuesEnabled: false,
      darkMode: true,
      lastState: undefined,

      setOcdSafeMode: (val) => set({ ocdSafeMode: val }),
      setHapticsEnabled: (val) => set({ hapticsEnabled: val }),
      setVoiceCuesEnabled: (val) => set({ voiceCuesEnabled: val }),
      setLastState: (state) => set({ lastState: state }),
    }),
    {
      name: "rezet-settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
