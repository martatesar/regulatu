import { TextStyle } from "react-native";
import { colors } from "./colors";

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 34,
  } as TextStyle,
  h2: {
    fontSize: 22,
    fontWeight: "500",
    color: colors.text,
    lineHeight: 28,
  } as TextStyle,
  body: {
    fontSize: 16,
    fontWeight: "400",
    color: colors.textSecondary,
    lineHeight: 24,
  } as TextStyle,
  buttonLarge: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  } as TextStyle,
};
