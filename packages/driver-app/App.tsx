import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { DriverProvider } from "./src/context/DriverContext";
import AppNavigator from "./src/navigation/AppNavigator";
import "./src/i18n";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DriverProvider>
          <AppNavigator />
        </DriverProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
