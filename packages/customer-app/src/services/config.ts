// API base URL — change this per environment
// For local dev with Expo Go on same WiFi, use your machine's LAN IP
const DEV_API_URL = "http://192.168.68.91:3000";
const PROD_API_URL = "https://api.taxirecanati.it";

export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;

// Stripe publishable key — replace with your real key
export const STRIPE_PUBLISHABLE_KEY = "pk_test_51TPKsmV05yniWv27F5v9dqiSknfYaiymbENon1dSG4fN3L7NoKlATd9SN9MReX8NvxXfl2AQMs5pXaBA3UhiLB1800deeNnrhS";
