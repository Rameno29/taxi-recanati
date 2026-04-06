import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radii, fonts } from "../theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

type VehicleType = "standard" | "premium" | "van";

const VEHICLE_ICONS: Record<VehicleType, keyof typeof Ionicons.glyphMap> = {
  standard: "car-outline",
  premium: "car-sport-outline",
  van: "bus-outline",
};

export default function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("standard");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !phone || !password || !licensePlate) return;
    setLoading(true);
    try {
      await register(name, email, phone, password, licensePlate, vehicleType);
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    } finally {
      setLoading(false);
    }
  };

  const vehicleOptions: { key: VehicleType; label: string }[] = [
    { key: "standard", label: "Standard" },
    { key: "premium", label: "Premium" },
    { key: "van", label: "Van" },
  ];

  const renderInput = (
    icon: keyof typeof Ionicons.glyphMap,
    placeholder: string,
    value: string,
    onChangeText: (text: string) => void,
    extra?: object,
  ) => (
    <View style={styles.inputWrapper}>
      <Ionicons name={icon} size={20} color={colors.bodyText} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.bodyText}
        value={value}
        onChangeText={onChangeText}
        {...extra}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brand}>TAXI RECANATI</Text>
          <Text style={styles.title}>{t("auth.registerTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.registerSubtitle")}</Text>
        </View>

        <View style={styles.form}>
          {renderInput("person-outline", t("auth.name"), name, setName, { autoCapitalize: "words" })}
          {renderInput("mail-outline", t("auth.email"), email, setEmail, {
            keyboardType: "email-address",
            autoCapitalize: "none",
            autoCorrect: false,
          })}
          {renderInput("call-outline", t("auth.phone"), phone, setPhone, {
            keyboardType: "phone-pad",
          })}
          {renderInput("lock-closed-outline", t("auth.password"), password, setPassword, {
            secureTextEntry: true,
          })}
          {renderInput("card-outline", t("auth.licensePlate"), licensePlate, setLicensePlate, {
            autoCapitalize: "characters",
          })}

          <Text style={styles.label}>{t("auth.vehicleType")}</Text>
          <View style={styles.vehicleRow}>
            {vehicleOptions.map((v) => {
              const isActive = vehicleType === v.key;
              return (
                <TouchableOpacity
                  key={v.key}
                  style={[styles.vehicleBtn, isActive && styles.vehicleBtnActive]}
                  onPress={() => setVehicleType(v.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={VEHICLE_ICONS[v.key] as any}
                    size={24}
                    color={isActive ? colors.white : colors.bodyText}
                    style={{ marginBottom: 4 }}
                  />
                  <Text style={[styles.vehicleText, isActive && styles.vehicleTextActive]}>
                    {v.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {loading ? t("common.loading") : t("auth.register")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={styles.link}>
              {t("auth.hasAccount")}{" "}
              <Text style={styles.linkBold}>{t("auth.login")}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  header: { alignItems: "center", marginBottom: spacing.xl },
  brand: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.primaryBlue,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  title: { fontSize: fonts.title, fontWeight: "bold", color: colors.dark },
  subtitle: { fontSize: fonts.body, color: colors.bodyText, marginTop: spacing.xs },
  form: { gap: spacing.sm + 2 },
  label: {
    fontSize: fonts.label,
    color: colors.bodyText,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.md,
  },
  inputIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: fonts.body,
    color: colors.dark,
  },
  vehicleRow: { flexDirection: "row", gap: spacing.sm },
  vehicleBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  vehicleBtnActive: {
    backgroundColor: colors.primaryBlue,
    borderColor: colors.primaryBlue,
  },
  vehicleText: { fontSize: fonts.caption, color: colors.bodyText, fontWeight: "600" },
  vehicleTextActive: { color: colors.white },
  button: {
    backgroundColor: colors.primaryBlue,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 18, fontWeight: "bold", color: colors.white },
  link: {
    textAlign: "center",
    color: colors.bodyText,
    marginTop: spacing.md,
    fontSize: fonts.label,
  },
  linkBold: { color: colors.primaryBlue, fontWeight: "bold" },
});
