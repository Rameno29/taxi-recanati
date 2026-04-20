import React, { createContext, useContext, useState, useMemo } from "react";
import { useColorScheme } from "react-native";
import { colors as staticColors, spacing, radii, shadows } from "../theme";

type ThemeMode = "light" | "dark" | "system";

type Colors = typeof staticColors;

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
  colors: Colors;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "system",
  isDark: false,
  setMode: () => {},
  colors: staticColors,
});

const darkOverrides: Partial<Colors> = {
  dark: "#F5F5F5",
  bodyText: "#B0B0B0",
  lightBg: "#121212",
  white: "#1E1E1E",
  border: "#333333",
  inputBg: "#2A2A2A",
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>("system");

  const isDark = mode === "system" ? systemScheme === "dark" : mode === "dark";

  const colors = useMemo<Colors>(
    () => (isDark ? { ...staticColors, ...darkOverrides } : staticColors),
    [isDark]
  );

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeColors() {
  const { colors } = useTheme();
  return colors;
}
