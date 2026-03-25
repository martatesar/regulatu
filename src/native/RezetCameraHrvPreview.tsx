import React from "react";
import { requireNativeViewManager } from "expo-modules-core";
import { StyleProp, ViewStyle } from "react-native";

type RezetCameraHrvPreviewProps = {
  style?: StyleProp<ViewStyle>;
};

const NativePreview =
  requireNativeViewManager<RezetCameraHrvPreviewProps>("RezetCameraHrv");

export const RezetCameraHrvPreview = (props: RezetCameraHrvPreviewProps) => {
  return <NativePreview {...props} />;
};

