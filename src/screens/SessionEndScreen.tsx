import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { RootStackParamList } from "../app/navigation";
import { HrvSummaryCard } from "../components/HrvSummaryCard";
import { getCustomProtocolDisplayName } from "../features/customProtocols/model";
import { useSettingsStore } from "../store/settingsStore";

type SessionEndScreenRouteProp = RouteProp<RootStackParamList, "SessionEnd">;
type SessionEndScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "SessionEnd"
>;

export const SessionEndScreen = () => {
  const navigation = useNavigation<SessionEndScreenNavigationProp>();
  const route = useRoute<SessionEndScreenRouteProp>();
  const customProtocols = useSettingsStore((state) => state.customProtocols);
  let customProtocolName: string | undefined;

  if (route.params.source === "custom") {
    const { protocolId } = route.params;
    customProtocolName = getCustomProtocolDisplayName(
      customProtocols.find(
        (protocol) => protocol.id === protocolId,
      ),
    );
  }

  const handleContinue = () => {
    if (route.params.source === "custom") {
      navigation.replace("Session", {
        source: "custom",
        protocolId: route.params.protocolId,
      });
      return;
    }

    navigation.replace("Session", {
      source: "preset",
      state: route.params.state,
      durationSec: route.params.durationSec,
    });
  };

  const handleStop = () => {
    navigation.popToTop(); // Go Home
  };

  return (
    <LinearGradient colors={["#12101F", "#030303"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={[typography.h1, styles.title]}>Session complete</Text>

          {customProtocolName ? (
            <Text style={styles.subtitle}>{customProtocolName}</Text>
          ) : null}

          {route.params.hrvSummary?.sufficientSignal ? (
            <HrvSummaryCard summary={route.params.hrvSummary} />
          ) : null}

          <TouchableOpacity style={styles.buttonPrimary} onPress={handleContinue}>
            <Text style={typography.buttonLarge}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.buttonSecondary} onPress={handleStop}>
            <Text
              style={[typography.buttonLarge, { color: colors.textSecondary }]}
            >
              Stop
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  safeArea: {
    flex: 1,
    justifyContent: "center",
  },
  content: {
    padding: 30,
    alignItems: "center",
  },
  title: {
    marginBottom: 12,
  },
  subtitle: {
    marginBottom: 48,
    color: "#9FB4C4",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  buttonPrimary: {
    backgroundColor: "#333",
    width: "100%",
    paddingVertical: 18,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  buttonSecondary: {
    width: "100%",
    paddingVertical: 18,
    alignItems: "center",
  },
});
