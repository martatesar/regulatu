import React from "react";
import { View, Text, Switch, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { useSettingsStore } from "../store/settingsStore";

export const SettingsScreen = () => {
  const navigation = useNavigation();
  const {
    ocdSafeMode,
    setOcdSafeMode,
    hapticsEnabled,
    setHapticsEnabled,
    voiceCuesEnabled,
    setVoiceCuesEnabled,
    darkMode,
  } = useSettingsStore();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={typography.h1}>Settings</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
        >
          <Feather name="x" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.textContainer}>
            <Text style={typography.h2}>OCD-safe mode</Text>
            <Text style={typography.body}>
              Removes all emotional/reassurance language.
            </Text>
          </View>
          <Switch
            value={ocdSafeMode}
            onValueChange={setOcdSafeMode}
            trackColor={{ false: "#333", true: colors.primary }}
          />
        </View>

        <View style={styles.row}>
          <Text style={typography.h2}>Haptics</Text>
          <Switch
            value={hapticsEnabled}
            onValueChange={setHapticsEnabled}
            trackColor={{ false: "#333", true: colors.primary }}
          />
        </View>

        <View style={styles.row}>
          <Text style={typography.h2}>Voice cues</Text>
          <Switch
            value={voiceCuesEnabled}
            onValueChange={setVoiceCuesEnabled}
            trackColor={{ false: "#333", true: colors.primary }}
          />
        </View>

        {/* Dark Mode is always ON in MVP as per spec, but showing it as status */}
        <View style={styles.row}>
          <Text style={[typography.h2, { opacity: 0.5 }]}>Dark Mode</Text>
          <Switch
            value={true}
            disabled={true} // Forced ON
            trackColor={{ false: "#333", true: "#333" }}
            thumbColor={colors.secondary}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  closeButton: {
    padding: 8,
  },
  content: {
    padding: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  textContainer: {
    flex: 1,
    paddingRight: 10,
  },
});
