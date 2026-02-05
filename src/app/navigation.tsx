import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { HomeScreen } from "../screens/HomeScreen";
import { SessionScreen } from "../screens/SessionScreen";
import { SessionEndScreen } from "../screens/SessionEndScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { FeltState } from "../engine/protocols";

export type RootStackParamList = {
  Home: undefined;
  Session: { state: FeltState; durationSec?: number };
  SessionEnd: { state: FeltState; durationSec: number };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigation = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animation: "fade", // Or default slide
          contentStyle: { backgroundColor: "#1A1A1A" },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Session" component={SessionScreen} />
        <Stack.Screen name="SessionEnd" component={SessionEndScreen} />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
