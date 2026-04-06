import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StripeProvider } from "@stripe/stripe-react-native";
import { AuthProvider } from "./src/context/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { usePushNotifications } from "./src/services/notifications";
import { STRIPE_PUBLISHABLE_KEY } from "./src/services/config";
import "./src/i18n";

function AppInner() {
  usePushNotifications();
  return <AppNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
