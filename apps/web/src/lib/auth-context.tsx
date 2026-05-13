import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, clearTokens, setOnLogout, setTokens } from "@/lib/api-client";

interface AuthUser {
  id: string;
  org: string;
  roles: string[];
  mfa: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean; challengeId?: string }>;
  verifyMfa: (challengeId: string, totp: string) => Promise<void>;
  signup: (input: {
    email: string;
    password: string;
    fullName: string;
    organizationName: string;
    country: "GH" | "NG";
  }) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api.auth.me();
      setUser(me.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOnLogout(() => setUser(null));
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.auth.login(email, password);
      if (res.status === "mfa_required" && res.mfaChallengeId) {
        return { mfaRequired: true, challengeId: res.mfaChallengeId };
      }
      if (res.tokens) {
        setTokens(res.tokens.accessToken, res.tokens.refreshToken);
        await refresh();
      }
      return { mfaRequired: false };
    },
    [refresh],
  );

  const verifyMfa = useCallback(
    async (challengeId: string, totp: string) => {
      const res = await api.auth.verifyMfa(challengeId, totp);
      setTokens(res.tokens.accessToken, res.tokens.refreshToken);
      await refresh();
    },
    [refresh],
  );

  const signup = useCallback(
    async (input: {
      email: string;
      password: string;
      fullName: string;
      organizationName: string;
      country: "GH" | "NG";
    }) => {
      const res = await api.auth.signup({
        ...input,
        acceptedTerms: true,
        acceptedPrivacy: true,
      });
      setTokens(res.tokens.accessToken, res.tokens.refreshToken);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    } finally {
      clearTokens();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      verifyMfa,
      signup,
      logout,
      hasRole: (r) => user?.roles.includes(r) ?? false,
      hasAnyRole: (roles) => !!user && roles.some((r) => user.roles.includes(r)),
    }),
    [user, loading, login, verifyMfa, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
