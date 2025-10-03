// src/lib/auth.js
import { apiFetch, TokenStorage } from "./api";

const API = import.meta.env.VITE_API_URL || "";

export const AuthAPI = {
  async register({ name, email, password, account_id }) {
    return apiFetch("/api/auth/register", { method: "POST", body: { name, email, password, account_id } });
  },
  async login({ email, password }, remember) {
    const data = await apiFetch("/api/auth/login", { method: "POST", body: { email, password } });
    if (data?.accessToken) TokenStorage.set(data.accessToken, remember);
    return data;
  },
  async me() {
    return apiFetch(`/api/users/me?ts=${Date.now()}`, { auth: true });
  },
  async logout() {
    TokenStorage.clear();
    await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
  },
  getToken: TokenStorage.get,
  clearToken: TokenStorage.clear
};
