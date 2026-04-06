// API base URL — change this per environment
// For local dev with Expo Go on same WiFi, use your machine's LAN IP
const DEV_API_URL = "http://192.168.68.90:3000";
const PROD_API_URL = "https://api.taxirecanati.it";

export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
