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

type SessionEndScreenRouteProp = RouteProp<RootStackParamList, "SessionEnd">;
type SessionEndScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "SessionEnd"
>;

export const SessionEndScreen = () => {
  const navigation = useNavigation<SessionEndScreenNavigationProp>();
  const route = useRoute<SessionEndScreenRouteProp>();
  const { state, durationSec, hrvSummary } = route.params;

  const handleContinue = () => {
    // Resume same protocol with same duration
    navigation.replace("Session", { state, durationSec });
  };

  const handleStop = () => {
    navigation.popToTop(); // Go Home
  };

  return (
    <LinearGradient colors={["#12101F", "#030303"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={[typography.h1, styles.title]}>Session complete</Text>

          {hrvSummary?.sufficientSignal ? (
            <HrvSummaryCard summary={hrvSummary} />
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
    marginBottom: 60,
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
