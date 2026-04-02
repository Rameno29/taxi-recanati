import { api, setToken } from "./api";

export async function login(email: string, password: string) {
  const res = await api.post("/api/auth/login/email", { email, password });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Login failed");
  }
  const data = await res.json();
  if (data.user.role !== "admin") {
    throw new Error("Admin access only");
  }
  setToken(data.accessToken);
  return data.user;
}

export function logout() {
  setToken(null);
  window.location.href = "/login";
}
