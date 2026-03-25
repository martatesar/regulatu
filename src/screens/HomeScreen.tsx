import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Dimensions, Modal, Pressable } from "react-native";
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

type InfoModalContent = {
  title: string;
  description: string;
};

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

  const [selectedInfo, setSelectedInfo] = useState<InfoModalContent | null>(null);

  const handleStateSelect = (state: FeltState) => {
    navigation.navigate("Session", { state });
  };

  const handleCO2BaselineSelect = () => {
    navigation.navigate("CO2Baseline");
  };

  const handleVitalsSelect = () => {
    navigation.navigate("Vitals");
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
                      onPress={() =>
                        setSelectedInfo({
                          title: protocol.label,
                          description: protocol.explanation,
                        })
                      }
                    >
                      <Feather name="info" size={24} color="#8A8A9E" />
                    </TouchableOpacity>
                    <Feather name="chevron-right" size={24} color="#555566" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.assessmentSection}>
            <Text style={styles.sectionLabel}>Assessment</Text>

            <TouchableOpacity
              style={styles.cardWrapper}
              onPress={handleCO2BaselineSelect}
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
                  <View style={styles.assessmentIcon}>
                    <Feather name="activity" size={22} color="#FFFFFF" />
                  </View>

                  <View style={styles.textContainer}>
                    <Text style={styles.label}>CO2 Tolerance Baseline</Text>
                    <Text style={styles.assessmentDescription}>
                      Guided post-exhale pause to first breathing impulse
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.infoButton}
                    onPress={() =>
                      setSelectedInfo({
                        title: "CO2 Tolerance Baseline",
                        description:
                          "Measure your current CO2 tolerance from a guided post-exhale pause. The timer stops at the first natural impulse to breathe.\n\nCO2 tolerance refers to how your breathing system responds as carbon dioxide gradually rises in the blood. Carbon dioxide is not just a waste gas. It is one of the main signals your brain uses to regulate breathing rhythm, breathing urgency, and airway tone. If your system is very sensitive to rising CO2, the impulse to breathe appears earlier and breathing can become faster and more reactive.\n\nOverbreathing means breathing more air than your body needs for the situation. This can lower CO2 too quickly, which may contribute to air hunger, chest tightness, lightheadedness, tingling, dizziness, and a sense that you cannot get a satisfying breath even when oxygen is normal. In some people it can also reinforce a cycle of stress, mouth breathing, and respiratory over-response.\n\nThis baseline is useful for tracking breathing consistency over time and for understanding how reactive your breathing pattern may be under stress, fatigue, or dysregulation. It is a wellness assessment only and is not intended to diagnose lung disease, oxygen levels, or any medical condition.",
                      })
                    }
                  >
                    <Feather name="info" size={24} color="#8A8A9E" />
                  </TouchableOpacity>
                  <Feather name="chevron-right" size={24} color="#555566" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cardWrapper}
              onPress={handleVitalsSelect}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#11202B", "#0B1118"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.cardGradient}
              >
                <AnimatedHighlight sensor={gravitySensor.sensor} />

                <View style={styles.cardContent}>
                  <View style={styles.vitalsIcon}>
                    <Feather name="heart" size={20} color="#FFFFFF" />
                  </View>

                  <View style={styles.textContainer}>
                    <Text style={styles.label}>Measure vitals</Text>
                    <Text style={styles.assessmentDescription}>
                      1-minute camera reading for HRV, pulse, and breathing estimate
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.infoButton}
                    onPress={() =>
                      setSelectedInfo({
                        title: "Measure vitals",
                        description:
                          "Use the rear camera and flash for a dedicated 1-minute fingertip reading. The screen shows the live camera view so you can verify lens coverage, then processes the captured window to estimate HRV, heart rate, and breathing rate.\n\nThis is a wellness measurement only and not a medical device or diagnosis.",
                      })
                    }
                  >
                    <Feather name="info" size={24} color="#8A8A9E" />
                  </TouchableOpacity>
                  <Feather name="chevron-right" size={24} color="#555566" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
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
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedInfo(null)} />
          <View style={styles.modalContentWrapper}>
            <LinearGradient
              colors={["#2A2A40", "#141424"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.modalContent}
            >
              <AnimatedHighlight sensor={gravitySensor.sensor} />
              <View style={styles.modalInner}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleContainer}>
                    <Feather name="info" size={20} color="#6B6B8A" style={styles.modalTitleIcon} />
                    <Text style={styles.modalTitle}>{selectedInfo?.title}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedInfo(null)} style={styles.closeButton}>
                    <Feather name="x" size={24} color="#8A8A9E" />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.modalScrollView}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalScrollContent}
                  nestedScrollEnabled
                >
                  <Text style={styles.modalDescription}>{selectedInfo?.description}</Text>
                </ScrollView>
              </View>
            </LinearGradient>
          </View>
        </View>
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
  assessmentSection: {
    marginTop: 28,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#6B6B8A",
    paddingHorizontal: 2,
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
  assessmentIcon: {
    width: 48,
    height: 48,
    marginRight: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  vitalsIcon: {
    width: 48,
    height: 48,
    marginRight: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(143,210,201,0.15)",
    borderWidth: 1,
    borderColor: "rgba(143,210,201,0.28)",
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
  assessmentDescription: {
    marginTop: 4,
    fontSize: 13,
    color: "#8A8A9E",
    lineHeight: 18,
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
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
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
  },
  modalInner: {
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
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
  modalScrollView: {
    maxHeight: "100%",
  },
  modalScrollContent: {
    paddingBottom: 16,
  },
  modalDescription: {
    fontSize: 16,
    color: "#D0D0E0",
    lineHeight: 26,
    fontWeight: "400",
  },
});
