import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, AuthTokens } from "../types";
import { api, storeTokens, clearTokens, getStoredTokens } from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";
import { unregisterPushToken } from "../services/notifications";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Try to restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const tokens = await getStoredTokens();
        if (tokens?.accessToken) {
          const res = await api.get("/api/auth/me");
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            await connectSocket();
          } else {
            await clearTokens();
          }
        }
      } catch {
        // No stored session
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/api/auth/login", { email, password });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Login failed");
    }
    const data = await res.json();
    await storeTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    await connectSocket();
  };

  const register = async (name: string, email: string, phone: string, password: string) => {
    const res = await api.post("/api/auth/register", {
      name,
      email,
      phone,
      password,
      role: "customer",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Registration failed");
    }
    const data = await res.json();
    await storeTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    await connectSocket();
  };

  const logout = async () => {
    try {
      await unregisterPushToken();
      await api.post("/api/auth/logout");
    } catch {
      // Best effort
    }
    disconnectSocket();
    await clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
