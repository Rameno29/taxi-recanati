import React, { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { ThemeProvider } from "./src/context/ThemeContext";
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

// Wrap with StripeProvider whenever the native module is available.
// In Expo Go the require() throws and we fall back to children only.
function MaybeStripeProvider({ children }: { children: React.ReactNode }) {
  try {
    const { StripeProvider } = require("@stripe/stripe-react-native");
    const { STRIPE_PUBLISHABLE_KEY } = require("./src/services/config");
    return (
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.it.taxirecanati.customer"
        urlScheme="taxirecanati"
      >
        {children}
      </StripeProvider>
    );
  } catch {
    return <>{children}</>;
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <MaybeStripeProvider>
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </MaybeStripeProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
