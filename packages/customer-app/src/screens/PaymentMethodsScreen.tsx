import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  listPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  createSetupIntent,
  syncPaymentMethod,
  formatMethodLabel,
  iconForMethod,
  SavedPaymentMethod,
} from "../services/paymentMethods";
import { useThemeColors } from "../context/ThemeContext";
import { spacing, radii } from "../theme";

interface Props {
  /** When present, the screen acts as a picker: tapping a method returns it. */
  onPick?: (method: SavedPaymentMethod) => void;
  /** Optional "Pay without saving" item at the top when picking. */
  allowAdHoc?: boolean;
  onPickAdHoc?: () => void;
}

export default function PaymentMethodsScreen({
  onPick,
  allowAdHoc,
  onPickAdHoc,
}: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listPaymentMethods();
      setMethods(data);
    } catch (err: any) {
      // In Expo Go the Stripe native module isn't loaded — we still want the
      // screen to render cleanly with an empty list.
      console.warn("loadMethods:", err.message);
      setMethods([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  async function handleAdd() {
    setAdding(true);
    try {
      // Dynamically import to avoid crash in Expo Go where Stripe native
      // module is not present.
      const stripeRN = require("@stripe/stripe-react-native");
      const { initPaymentSheet, presentPaymentSheet } = stripeRN;

      const si = await createSetupIntent();

      const { error: initError } = await initPaymentSheet({
        setupIntentClientSecret: si.client_secret,
        customerId: si.customer,
        customerEphemeralKeySecret: si.ephemeral_key,
        merchantDisplayName: "Taxi Recanati",
        applePay: { merchantCountryCode: "IT" },
        googlePay: {
          merchantCountryCode: "IT",
          currencyCode: "EUR",
          testEnv: __DEV__,
        },
        allowsDelayedPaymentMethods: true,
        returnURL: "taxirecanati://stripe-redirect",
      });
      if (initError) {
        Alert.alert("Stripe", initError.message);
        return;
      }

      const { error: presentError, setupIntent } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== "Canceled") {
          Alert.alert("Stripe", presentError.message);
        }
        return;
      }

      // The PaymentSheet returns the confirmed SetupIntent which carries the
      // payment method id. Mirror it locally.
      const pmId =
        setupIntent?.paymentMethodId ||
        setupIntent?.paymentMethod?.id;
      if (pmId) {
        await syncPaymentMethod(pmId);
      }
      await load();
    } catch (err: any) {
      Alert.alert(t("common.error", "Errore"), err.message || "");
    } finally {
      setAdding(false);
    }
  }

  function handleDelete(m: SavedPaymentMethod) {
    Alert.alert(
      t("payment.methods.deleteTitle", "Rimuovi metodo"),
      t(
        "payment.methods.deleteConfirm",
        "Vuoi rimuovere {{label}}?",
        { label: formatMethodLabel(m) }
      ),
      [
        { text: t("common.cancel", "Annulla"), style: "cancel" },
        {
          text: t("common.delete", "Rimuovi"),
          style: "destructive",
          onPress: async () => {
            try {
              await deletePaymentMethod(m.id);
              await load();
            } catch (err: any) {
              Alert.alert(t("common.error", "Errore"), err.message || "");
            }
          },
        },
      ]
    );
  }

  async function handleSetDefault(m: SavedPaymentMethod) {
    if (m.is_default) return;
    try {
      await setDefaultPaymentMethod(m.id);
      await load();
    } catch (err: any) {
      Alert.alert(t("common.error", "Errore"), err.message || "");
    }
  }

  const renderItem = ({ item }: { item: SavedPaymentMethod }) => (
    <TouchableOpacity
      style={[
        styles.row,
        {
          backgroundColor: colors.white,
          borderColor: item.is_default ? colors.primaryBlue : colors.border,
        },
      ]}
      activeOpacity={onPick ? 0.7 : 1}
      onPress={() => {
        if (onPick) onPick(item);
      }}
      onLongPress={() => {
        if (!onPick) handleDelete(item);
      }}
    >
      <View style={[styles.iconBubble, { backgroundColor: colors.lightBg }]}>
        <Ionicons
          name={iconForMethod(item) as any}
          size={22}
          color={colors.primaryBlue}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: colors.dark }]}>
          {formatMethodLabel(item)}
        </Text>
        {item.exp_month && item.exp_year ? (
          <Text style={[styles.sublabel, { color: colors.bodyText }]}>
            {String(item.exp_month).padStart(2, "0")}/{String(item.exp_year).slice(-2)}
          </Text>
        ) : null}
      </View>

      {!onPick && (
        <TouchableOpacity
          onPress={() => handleSetDefault(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.defaultToggle}
        >
          <Ionicons
            name={item.is_default ? "star" : "star-outline"}
            size={22}
            color={item.is_default ? colors.primaryBlue : colors.bodyText}
          />
        </TouchableOpacity>
      )}

      {!onPick && (
        <TouchableOpacity
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ marginLeft: spacing.sm }}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      )}

      {onPick && item.is_default && (
        <View style={styles.defaultBadge}>
          <Text style={styles.defaultBadgeText}>
            {t("payment.methods.default", "Predefinito")}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.lightBg }]}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primaryBlue} />
        </View>
      ) : (
        <FlatList
          data={methods}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: spacing.xl,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            allowAdHoc && onPickAdHoc ? (
              <TouchableOpacity
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.white,
                    borderColor: colors.border,
                    marginBottom: spacing.sm,
                  },
                ]}
                onPress={onPickAdHoc}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconBubble,
                    { backgroundColor: colors.lightBg },
                  ]}
                >
                  <Ionicons name="add" size={22} color={colors.primaryBlue} />
                </View>
                <Text style={[styles.label, { color: colors.dark, flex: 1 }]}>
                  {t("payment.methods.payWithoutSaving", "Paga senza salvare")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.bodyText}
                />
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons
                name="card-outline"
                size={48}
                color={colors.bodyText}
              />
              <Text style={[styles.emptyText, { color: colors.bodyText }]}>
                {t(
                  "payment.methods.empty",
                  "Nessun metodo salvato. Aggiungine uno per pagare più velocemente."
                )}
              </Text>
            </View>
          }
          ListFooterComponent={
            <TouchableOpacity
              style={[
                styles.addButton,
                { backgroundColor: colors.primaryBlue },
              ]}
              onPress={handleAdd}
              disabled={adding}
              activeOpacity={0.7}
            >
              {adding ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="add" size={20} color={colors.white} />
                  <Text style={styles.addButtonText}>
                    {t("payment.methods.add", "Aggiungi metodo")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 15, fontWeight: "600" },
  sublabel: { fontSize: 12, marginTop: 2 },
  defaultToggle: { padding: 4 },
  defaultBadge: {
    backgroundColor: "#E8F4FE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  defaultBadgeText: { color: "#0B6BCB", fontSize: 11, fontWeight: "600" },
  emptyWrap: {
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: { textAlign: "center", fontSize: 14 },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  addButtonText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
});
