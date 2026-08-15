"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getApi, getDataMode, watchDemoSession, type DataMode } from "@/lib/api";
import { firebaseApi } from "@/lib/firebase-api";
import type { AuraUser } from "@/lib/types";

type AuthContextValue = {
  user: AuraUser | null;
  ready: boolean;
  mode: DataMode;
  isAdmin: boolean;
  signUpDonor: (input: {
    email: string;
    password: string;
    displayName: string;
    referralCode?: string;
  }) => Promise<void>;
  signInDonor: (email: string, password: string) => Promise<void>;
  signInDonorGoogle: (referralCode?: string) => Promise<void>;
  signInAdmin: (email: string, password: string) => Promise<void>;
  signInAdminGoogle: () => Promise<void>;
  signUpAdmin: (input: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function assertDonor(profile: AuraUser): Promise<AuraUser> {
  if (profile.role === "admin") {
    await getApi().signOut();
    throw new Error("This is an admin account. Use Admin sign-in instead.");
  }
  return profile;
}

async function assertAdmin(profile: AuraUser): Promise<AuraUser> {
  if (profile.role !== "admin") {
    await getApi().signOut();
    throw new Error("This account is not an admin. Use the donor sign-in.");
  }
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuraUser | null>(null);
  const [ready, setReady] = useState(false);
  const mode = getDataMode();

  useEffect(() => {
    if (mode === "firebase") {
      const unsub = firebaseApi.watchAuth((profile) => {
        setUser(profile);
        setReady(true);
      });
      return unsub;
    }
    const unsub = watchDemoSession((profile) => {
      setUser(profile);
      setReady(true);
    });
    return unsub;
  }, [mode]);

  const refreshUser = useCallback(async () => {
    if (!user) return;
    const fresh = await getApi().getUser(user.uid);
    setUser(fresh);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      mode,
      isAdmin: user?.role === "admin",
      async signUpDonor(input) {
        const profile = await assertDonor(await getApi().signUp(input));
        setUser(profile);
      },
      async signInDonor(email, password) {
        const profile = await assertDonor(await getApi().signIn(email, password));
        setUser(profile);
      },
      async signInDonorGoogle(referralCode) {
        if (mode !== "firebase" || !firebaseApi.signInWithGoogle) {
          throw new Error("Google sign-in is only available in Live mode.");
        }
        const profile = await assertDonor(
          await firebaseApi.signInWithGoogle(referralCode)
        );
        setUser(profile);
      },
      async signInAdmin(email, password) {
        const profile = await assertAdmin(await getApi().signIn(email, password));
        setUser(profile);
      },
      async signInAdminGoogle() {
        if (mode !== "firebase" || !firebaseApi.signInWithGoogle) {
          throw new Error("Google sign-in is only available in Live mode.");
        }
        const profile = await assertAdmin(await firebaseApi.signInWithGoogle());
        setUser(profile);
      },
      async signUpAdmin(input) {
        const profile = await assertAdmin(await getApi().signUp(input));
        setUser(profile);
      },
      async signOut() {
        await getApi().signOut();
        setUser(null);
      },
      refreshUser,
    }),
    [user, ready, mode, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
