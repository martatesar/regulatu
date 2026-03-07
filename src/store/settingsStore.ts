import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, persist } from "zustand/middleware";
import { FeltState } from "../engine/protocols";

interface SettingsState {
  hapticsEnabled: boolean;
  lastState?: FeltState;

  // Actions
  setHapticsEnabled: (val: boolean) => void;
  setLastState: (state: FeltState) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      lastState: undefined,

      setHapticsEnabled: (val) => set({ hapticsEnabled: val }),
      setLastState: (state) => set({ lastState: state }),
    }),
    {
      name: "rezet-settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
