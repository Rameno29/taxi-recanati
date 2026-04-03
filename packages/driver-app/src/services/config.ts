const DEV_API_URL = "http://192.168.1.151:3000";
const PROD_API_URL = "https://api.taxirecanati.it";

export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
