const { withInfoPlist, createRunOncePlugin } = require("expo/config-plugins");

const withRezetCameraHrv = (config) => {
  return withInfoPlist(config, (nextConfig) => {
    nextConfig.modResults.NSCameraUsageDescription =
      nextConfig.modResults.NSCameraUsageDescription ||
      "Camera access is used to estimate heart rate variability during breathing sessions.";

    return nextConfig;
  });
};

module.exports = createRunOncePlugin(
  withRezetCameraHrv,
  "rezet-camera-hrv",
  "1.0.0",
);

