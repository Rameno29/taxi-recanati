import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "./config";

const TOKEN_KEY = "driver_auth_tokens";

export async function getStoredTokens() {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as { accessToken: string; refreshToken: string };
}

export async function storeTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync(
    TOKEN_KEY,
    JSON.stringify({ accessToken, refreshToken })
  );
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  if (!tokens?.refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!res.ok) {
      await clearTokens();
      return null;
    }

    const data = await res.json();
    await storeTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const tokens = await getStoredTokens();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (tokens?.accessToken) {
    headers["Authorization"] = `Bearer ${tokens.accessToken}`;
  }

  let res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && tokens?.refreshToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    }
  }

  return res;
}

export const api = {
  get: (path: string) => apiFetch(path),
  post: (path: string, body?: unknown) =>
    apiFetch(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: (path: string, body?: unknown) =>
    apiFetch(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: (path: string, body?: unknown) =>
    apiFetch(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),
};
