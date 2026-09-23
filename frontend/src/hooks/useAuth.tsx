import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type UserRole = "admin" | "customer";

/**
 * The locally persisted auth record. `token` is the JWT issued by
 * `POST /auth/verify-otp` (secure OTP via the api.ir gateway); `phone`
 * mirrors the token's phone claim and is used to gate auth-only queries.
 */
export type AuthUser = {
  id: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  token?: string;
};

type User = AuthUser | null;

type AuthValue = {
  user: User;
  isLoading: boolean;
  login: (u: NonNullable<User>) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

const STORAGE_KEY = "choobkar-auth-user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as User;
        // A record without a token is a leftover from the old mock login —
        // it no longer grants anything server-side, so drop it.
        if (parsed && typeof parsed.token === "string" && parsed.token !== "") {
          setUser(parsed);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  // The axios client fires `hc:auth-expired` when a protected call returns
  // 401 (token expired/invalid) after clearing the storage record.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("hc:auth-expired", onExpired);
    return () => window.removeEventListener("hc:auth-expired", onExpired);
  }, []);

  const login = (u: NonNullable<User>) => {
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
