"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Google sign-in failed";
  if (/insufficient permissions|permission-denied/i.test(raw)) {
    return "Firestore blocked the write. Publish signed-in allow rules in Firebase Console → Firestore → Rules.";
  }
  if (/popup-closed-by-user/i.test(raw)) {
    return "Google popup was closed.";
  }
  if (/auth\/unauthorized-domain/i.test(raw)) {
    return "Add this domain under Firebase Authentication → Settings → Authorized domains.";
  }
  return raw;
}

export function GoogleSignInButton({
  referralCode,
  onSuccess,
  onError,
  label = "Continue with Google",
  portal = "donor",
}: {
  referralCode?: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  label?: string;
  portal?: "donor" | "admin";
}) {
  const { mode, signInDonorGoogle, signInAdminGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  if (mode !== "firebase") {
    return (
      <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-muted ring-1 ring-white/10">
        Google sign-in appears in Live mode. Restart{" "}
        <code className="text-foreground">npm run dev</code> after saving `.env.local`.
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      className="btn-primary w-full gap-2"
      onClick={async () => {
        setBusy(true);
        onError("");
        try {
          if (portal === "admin") {
            await signInAdminGoogle();
          } else {
            await signInDonorGoogle(referralCode);
          }
          onSuccess();
        } catch (err) {
          onError(friendlyAuthError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      {busy ? "Opening Google…" : label}
    </button>
  );
}
