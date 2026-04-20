import React from "react";
import { View, ViewStyle } from "react-native";
import { useTheme } from "../context/ThemeContext";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function ThemedScreen({ children, style }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.lightBg }, style]}>
      {children}
    </View>
  );
}
