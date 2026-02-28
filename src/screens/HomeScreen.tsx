import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

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
    <LinearGradient colors={["#12101F", "#030303"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.appName}>REZET</Text>

          {/* Settings Icon Top Right */}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate("Settings")}
          >
            <Feather name="settings" size={24} color="#8A8A9E" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[typography.h1, styles.title]}>
            What feels strongest{"\n"}right now?
          </Text>

          <View style={styles.listContainer}>
            {Object.values(PROTOCOLS).map((protocol) => (
              <TouchableOpacity
                key={protocol.state}
                style={styles.cardWrapper}
                onPress={() => handleStateSelect(protocol.state)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#1B1B2C", "#0D0D18"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.cardGradient}
                >
                  {/* Top center glow highlight */}
                  <LinearGradient
                    colors={[
                      "rgba(255, 255, 255, 0)",
                      "rgba(255, 255, 255, 0.1)",
                      "rgba(200, 220, 255, 0.9)",
                      "rgba(255, 255, 255, 0.1)",
                      "rgba(255, 255, 255, 0)",
                    ]}
                    locations={[0, 0.2, 0.5, 0.8, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.topHighlight}
                  />
                  <View style={styles.cardContent}>
                    <Image source={protocol.image} style={styles.icon} />
                    <View style={styles.textContainer}>
                      <Text style={styles.label}>{protocol.shortLabel}</Text>
                    </View>
                    <Feather name="chevron-right" size={24} color="#555566" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.disclaimer}>
            For wellness support only. Not medical advice.{"\n"}If you may be
            having a medical emergency, contact local emergency services.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1,
  },
  settingsButton: {
    padding: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  title: {
    marginBottom: 32,
    marginTop: 10,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "600",
    color: "#FFFFFF",
    lineHeight: 36,
  },
  listContainer: {
    gap: 12,
  },
  cardWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2A2A40",
  },
  cardGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  topHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    width: 48,
    height: 48,
    marginRight: 16,
    borderRadius: 10,
    resizeMode: "cover",
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  label: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  disclaimer: {
    marginTop: 32,
    textAlign: "center",
    fontSize: 12,
    color: "#4A4A5E",
    lineHeight: 18,
  },
});
