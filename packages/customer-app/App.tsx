import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { usePushNotifications } from "./src/services/notifications";
import "./src/i18n";

function AppInner() {
  usePushNotifications();
  return <AppNavigator />;
}

// In production builds (EAS), wrap with StripeProvider.
// In dev (Expo Go), Stripe native module isn't available, so skip it.
function MaybeStripeProvider({ children }: { children: React.ReactNode }) {
  if (__DEV__) {
    return <>{children}</>;
  }

  // Dynamic import only in production to avoid crash in Expo Go
  try {
    const { StripeProvider } = require("@stripe/stripe-react-native");
    const { STRIPE_PUBLISHABLE_KEY } = require("./src/services/config");
    return (
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        {children}
      </StripeProvider>
    );
  } catch {
    return <>{children}</>;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MaybeStripeProvider>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </MaybeStripeProvider>
    </SafeAreaProvider>
  );
}
