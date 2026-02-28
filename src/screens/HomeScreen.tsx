import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { PROTOCOLS, FeltState } from "../engine/protocols";
import { RootStackParamList } from "../app/navigation";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;

export const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  const handleStateSelect = (state: FeltState) => {
    navigation.navigate("Session", { state });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>REZET</Text>

        {/* Settings Icon Top Right */}
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate("Settings")}
        >
          <Feather name="settings" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={[typography.h1, styles.title]}>
          What feels strongest{"\n"}right now?
        </Text>

        <View style={styles.listContainer}>
          {Object.values(PROTOCOLS).map((protocol, index, array) => (
            <TouchableOpacity
              key={protocol.state}
              style={[
                styles.row,
                index !== array.length - 1 && styles.rowBorder,
              ]}
              onPress={() => handleStateSelect(protocol.state)}
              activeOpacity={0.7}
            >
              <Image source={protocol.image} style={styles.icon} />
              <View style={styles.textContainer}>
                <Text style={styles.label}>{protocol.questionLabel}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.disclaimer}>
          For wellness support only. Not medical advice.{"\n"}If you may be
          having a medical emergency, contact local emergency services.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050505", // Very dark/black background
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between", // Space between Title and Settings
    alignItems: "center",
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800", // Bold
    letterSpacing: 1,
  },
  settingsButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  title: {
    marginBottom: 30,
    marginTop: 10,
    textAlign: "center",
    fontSize: 26,
    fontWeight: "500",
    color: "#EDEDED",
    lineHeight: 34,
  },
  listContainer: {
    backgroundColor: "#121212", // Slightly lighter than bg
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#121212",
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#252525",
  },
  icon: {
    width: 64,
    height: 64,
    marginRight: 16,
    borderRadius: 12,
    resizeMode: "cover",
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  label: {
    fontSize: 18,
    color: "#F0F0F0",
    fontWeight: "500",
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  disclaimer: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 12,
    color: "#666666",
    lineHeight: 18,
  },
});
