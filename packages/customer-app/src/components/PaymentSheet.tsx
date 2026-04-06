import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import {
  createPaymentIntent,
  confirmPaymentOnServer,
} from "../services/payment";
import { colors, spacing, radii } from "../theme";
import { useTranslation } from "react-i18next";

interface PaymentSheetProps {
  rideId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PaymentSheet({
  rideId,
  onSuccess,
  onCancel,
}: PaymentSheetProps) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  useEffect(() => {
    initializePayment();
  }, [rideId]);

  async function initializePayment() {
    setLoading(true);
    setError(null);

    try {
      // 1. Create the payment intent on the server
      const payment = await createPaymentIntent(rideId);
      setPaymentId(payment.id);

      // 2. Initialize the Stripe PaymentSheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: payment.client_secret,
        merchantDisplayName: "Taxi Recanati",
        style: "alwaysLight",
      });

      if (initError) {
        setError(initError.message);
        setLoading(false);
        return;
      }

      setLoading(false);

      // 3. Immediately present the sheet once initialized
      await openPaymentSheet(payment.id);
    } catch (err: any) {
      setError(err.message || "Failed to initialize payment");
      setLoading(false);
    }
  }

  async function openPaymentSheet(pId?: string) {
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === "Canceled") {
        onCancel();
        return;
      }
      setError(presentError.message);
      return;
    }

    // Payment succeeded on the client — confirm authorization on server
    try {
      const id = pId || paymentId;
      if (id) {
        await confirmPaymentOnServer(id);
      }
      onSuccess();
    } catch (err: any) {
      // Payment went through on Stripe but server confirm failed.
      // The webhook will eventually sync the state, so still treat as success.
      console.warn("Server confirm failed, webhook will sync:", err.message);
      onSuccess();
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primaryBlue} />
        <Text style={styles.loadingText}>
          {t("payment.initializing", "Preparazione pagamento...")}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={initializePayment}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>
              {t("payment.retry", "Riprova")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>
              {t("common.cancel", "Annulla")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // If we reach here, payment sheet was dismissed without error
  // but the callbacks haven't fired yet — show nothing
  return null;
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 16,
    color: colors.bodyText,
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  retryButton: {
    backgroundColor: colors.primaryBlue,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radii.md,
  },
  retryButtonText: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: colors.lightBg,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.bodyText,
    fontWeight: "600",
    fontSize: 14,
  },
});
