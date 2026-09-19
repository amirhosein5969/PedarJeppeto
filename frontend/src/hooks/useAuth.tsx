import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type UserRole = "admin" | "customer";

type User = { id: string; email?: string; phone?: string; role?: UserRole } | null;

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
        setUser(JSON.parse(raw));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
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
