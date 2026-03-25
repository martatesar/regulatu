import {
  EventSubscription,
  requireOptionalNativeModule,
} from "expo-modules-core";
import { Platform } from "react-native";
import {
  HrvStatusEvent,
  VitalsMeasurementResult,
} from "../features/hrv/types";

type PermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "restricted";

type NativeRezetCameraHrvModule = {
  isAvailable(): Promise<boolean>;
  getPermissionStatus(): Promise<PermissionStatus>;
  requestPermission(): Promise<PermissionStatus>;
  start(torchPreferred?: boolean, updateIntervalMs?: number): Promise<void>;
  resetMeasurementWindow(): Promise<void>;
  finishMeasurement(): Promise<VitalsMeasurementResult | null>;
  stop(): Promise<void>;
  addListener(
    eventName: "hrvStatus",
    listener: (event: HrvStatusEvent) => void,
  ): EventSubscription;
};

const nativeModule =
  requireOptionalNativeModule<NativeRezetCameraHrvModule>("RezetCameraHrv");

export const isHrvModuleAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== "ios" || !nativeModule) {
    return false;
  }

  try {
    return await nativeModule.isAvailable();
  } catch {
    return false;
  }
};

export const getHrvPermissionStatus = async (): Promise<PermissionStatus> => {
  if (Platform.OS !== "ios" || !nativeModule) {
    return "restricted";
  }
  return nativeModule.getPermissionStatus();
};

export const requestHrvPermission = async (): Promise<PermissionStatus> => {
  if (Platform.OS !== "ios" || !nativeModule) {
    return "restricted";
  }
  return nativeModule.requestPermission();
};

export const startHrvCapture = async ({
  torchPreferred = true,
  updateIntervalMs = 1000,
}: {
  torchPreferred?: boolean;
  updateIntervalMs?: number;
} = {}): Promise<boolean> => {
  if (Platform.OS !== "ios" || !nativeModule) {
    return false;
  }

  await nativeModule.start(torchPreferred, updateIntervalMs);
  return true;
};

export const stopHrvCapture = async (): Promise<void> => {
  if (!nativeModule) {
    return;
  }
  await nativeModule.stop();
};

export const resetVitalsMeasurementWindow = async (): Promise<void> => {
  if (!nativeModule) {
    return;
  }
  await nativeModule.resetMeasurementWindow();
};

export const finishVitalsMeasurement = async (): Promise<
  VitalsMeasurementResult | undefined
> => {
  if (!nativeModule) {
    return undefined;
  }

  const result = await nativeModule.finishMeasurement();
  return result ?? undefined;
};

export const addHrvStatusListener = (
  listener: (event: HrvStatusEvent) => void,
): EventSubscription | undefined => {
  if (!nativeModule) {
    return undefined;
  }

  return nativeModule.addListener("hrvStatus", listener);
};
