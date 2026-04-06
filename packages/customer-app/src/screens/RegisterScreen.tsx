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
import { colors, spacing, radii } from "../theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !phone || !password) return;
    setLoading(true);
    try {
      await register(name, email, phone, password);
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    } finally {
      setLoading(false);
    }
  };

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
          <View style={styles.logoCircle}>
            <Ionicons name="car-sport" size={48} color={colors.white} />
          </View>
          <Text style={styles.title}>TAXI RECANATI</Text>
          <Text style={styles.subtitle}>{t("auth.registerSubtitle")}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color={colors.bodyText} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t("auth.name")}
              placeholderTextColor={colors.bodyText}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color={colors.bodyText} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t("auth.email")}
              placeholderTextColor={colors.bodyText}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.inputWrapper}>
            <Ionicons name="call-outline" size={20} color={colors.bodyText} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t("auth.phone")}
              placeholderTextColor={colors.bodyText}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.bodyText} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t("auth.password")}
              placeholderTextColor={colors.bodyText}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
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
  container: { flex: 1, backgroundColor: colors.lightBg },
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  header: { alignItems: "center", marginBottom: 40 },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryBlue,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.primaryBlue,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: colors.bodyText,
    marginTop: spacing.xs,
  },
  form: { gap: spacing.md },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  inputIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.dark,
  },
  button: {
    backgroundColor: colors.primaryBlue,
    borderRadius: radii.md,
    padding: 16,
    alignItems: "center",
    marginTop: spacing.sm,
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 18, fontWeight: "bold", color: colors.white },
  link: {
    textAlign: "center",
    color: colors.bodyText,
    marginTop: spacing.md,
    fontSize: 14,
  },
  linkBold: { color: colors.primaryBlue, fontWeight: "bold" },
});
