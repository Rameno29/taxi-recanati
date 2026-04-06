import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import it from "./it";
import en from "./en";

const LANGUAGE_KEY = "@taxi_recanati_driver_language";

/**
 * Detect the best initial language:
 * 1. Saved preference in AsyncStorage
 * 2. Device locale (if English, use "en")
 * 3. Default to "it"
 */
async function getInitialLanguage(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (saved === "en" || saved === "it") return saved;
  } catch {}

  try {
    const locales = getLocales();
    if (locales?.[0]?.languageCode === "en") return "en";
  } catch {}

  return "it";
}

i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
  },
  lng: "it", // Synchronous default; overridden once async detection completes
  fallbackLng: "it",
  interpolation: { escapeValue: false },
});

// Apply detected / saved language as soon as ready
getInitialLanguage().then((lang) => {
  if (i18n.language !== lang) {
    i18n.changeLanguage(lang);
  }
});

/**
 * Persist the language choice to AsyncStorage.
 * Call this whenever the user manually switches language.
 */
export async function persistLanguage(lang: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch {}
}

export default i18n;
