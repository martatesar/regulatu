import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, persist } from "zustand/middleware";
import { FeltState } from "../engine/protocols";
import { CustomProtocol } from "../features/customProtocols/model";

interface SettingsState {
  hapticsEnabled: boolean;
  hrvMeasurementEnabledByDefault: boolean;
  lastState?: FeltState;
  customProtocols: CustomProtocol[];

  // Actions
  setHapticsEnabled: (val: boolean) => void;
  setHrvMeasurementEnabledByDefault: (val: boolean) => void;
  setLastState: (state: FeltState) => void;
  addCustomProtocol: (protocol: CustomProtocol) => void;
  updateCustomProtocol: (protocol: CustomProtocol) => void;
  deleteCustomProtocol: (id: string) => void;
  markCustomProtocolUsed: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      hrvMeasurementEnabledByDefault: false,
      lastState: undefined,
      customProtocols: [],

      setHapticsEnabled: (val) => set({ hapticsEnabled: val }),
      setHrvMeasurementEnabledByDefault: (val) =>
        set({ hrvMeasurementEnabledByDefault: val }),
      setLastState: (state) => set({ lastState: state }),
      addCustomProtocol: (protocol) =>
        set((state) => ({
          customProtocols: [...state.customProtocols, protocol],
        })),
      updateCustomProtocol: (protocol) =>
        set((state) => ({
          customProtocols: state.customProtocols.map((existing) =>
            existing.id === protocol.id ? protocol : existing,
          ),
        })),
      deleteCustomProtocol: (id) =>
        set((state) => ({
          customProtocols: state.customProtocols.filter(
            (protocol) => protocol.id !== id,
          ),
        })),
      markCustomProtocolUsed: (id) =>
        set((state) => ({
          customProtocols: state.customProtocols.map((protocol) =>
            protocol.id === id
              ? {
                  ...protocol,
                  lastUsedAt: new Date().toISOString(),
                }
              : protocol,
          ),
        })),
    }),
    {
      name: "rezet-settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
