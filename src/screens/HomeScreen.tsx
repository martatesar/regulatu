import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Dimensions, Modal } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedSensor,
  SensorType,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  SharedValue
} from "react-native-reanimated";

import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { PROTOCOLS, FeltState, Protocol } from "../engine/protocols";
import { RootStackParamList } from "../app/navigation";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Subcomponent to handle the gyro-based animated highlight
const AnimatedHighlight = ({ sensor }: { sensor: any }) => {
  const animatedStyle = useAnimatedStyle(() => {
    // When tilted right (right side down), x is positive, so we want the highlight to move left (negative X).
    // When tilted left (left side down), x is negative, highlight moves right.
    const maxTranslate = SCREEN_WIDTH * 0.4;
    const translateX = interpolate(
      sensor.value.x,
      [-5, 5], // roughly half of gravity's max pull for high sensitivity
      [maxTranslate, -maxTranslate],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateX }],
    };
  });

  return (
    <Animated.View style={[styles.topHighlightWrapper, animatedStyle]}>
      <LinearGradient
        colors={[
          "rgba(255, 255, 255, 0)",
          "rgba(255, 255, 255, 0.1)",
          "rgba(200, 220, 255, 0.9)",
          "rgba(255, 255, 255, 0.1)",
          "rgba(255, 255, 255, 0)",
        ]}
        locations={[0, 0.3, 0.5, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topHighlight}
      />
    </Animated.View>
  );
};

export const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  
  // High refresh rate sensor (60Hz = ~16ms)
  const gravitySensor = useAnimatedSensor(SensorType.GRAVITY, { interval: 16 });

  const [selectedInfo, setSelectedInfo] = useState<Protocol | null>(null);

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
                  <AnimatedHighlight sensor={gravitySensor.sensor} />
                  
                  <View style={styles.cardContent}>
                    <Image source={protocol.image} style={styles.icon} />
                    <View style={styles.textContainer}>
                      <Text style={styles.label}>{protocol.shortLabel}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.infoButton}
                      onPress={() => setSelectedInfo(protocol)}
                    >
                      <Feather name="info" size={24} color="#8A8A9E" />
                    </TouchableOpacity>
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

      <Modal
        visible={!!selectedInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedInfo(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedInfo(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContentWrapper}>
            <LinearGradient
              colors={["#2A2A40", "#141424"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.modalContent}
            >
              <AnimatedHighlight sensor={gravitySensor.sensor} />
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <Feather name="info" size={20} color="#6B6B8A" style={styles.modalTitleIcon} />
                  <Text style={styles.modalTitle}>{selectedInfo?.label}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedInfo(null)} style={styles.closeButton}>
                  <Feather name="x" size={24} color="#8A8A9E" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
                <Text style={styles.modalDescription}>{selectedInfo?.explanation}</Text>
              </ScrollView>
            </LinearGradient>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  topHighlightWrapper: {
    position: "absolute",
    top: 0,
    left: "-50%",
    width: "200%",
    height: 2,
    zIndex: 1,
  },
  topHighlight: {
    width: "100%",
    height: "100%",
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
  infoButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContentWrapper: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  modalContent: {
    width: "100%",
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalTitleIcon: {
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 22,
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
  },
  modalScrollContent: {
    paddingBottom: 8,
  },
  modalDescription: {
    fontSize: 16,
    color: "#D0D0E0",
    lineHeight: 26,
    fontWeight: "400",
  },
});
