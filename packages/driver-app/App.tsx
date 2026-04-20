import React, { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { DriverProvider } from "./src/context/DriverContext";
import AppNavigator from "./src/navigation/AppNavigator";
import SplashScreen from "./src/components/SplashScreen";
import { usePushNotifications } from "./src/services/notifications";
import "./src/i18n";

function AppInner() {
  const [splashDone, setSplashDone] = useState(false);
  usePushNotifications();

  if (!splashDone) {
    return <SplashScreen onFinish={() => setSplashDone(true)} />;
  }

  return <AppNavigator />;
}

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <DriverProvider>
            <AppInner />
          </DriverProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
