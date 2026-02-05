import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

interface AdaptiveOverlayProps {
  onStillIntense: () => void;
  onThisHelps: () => void;
  visible: boolean;
}

export const AdaptiveOverlay: React.FC<AdaptiveOverlayProps> = ({
  onStillIntense,
  onThisHelps,
  visible,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.button} onPress={onStillIntense}>
          <Text style={typography.buttonLarge}>Still intense</Text>
        </TouchableOpacity>

        <View style={styles.spacer} />

        <TouchableOpacity style={styles.button} onPress={onThisHelps}>
          <Text style={typography.buttonLarge}>This helps</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  container: {
    width: "80%",
  },
  button: {
    backgroundColor: "#333",
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444",
  },
  spacer: {
    height: 20,
  },
});
