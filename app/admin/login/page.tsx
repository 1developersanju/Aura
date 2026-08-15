"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { useAuth } from "@/components/providers/AuthProvider";
import { adminBootstrapEmail } from "@/lib/firebase";
import { InlineAlert } from "@/components/admin/ui";

export default function AdminLoginPage() {
  const { signInAdmin, signUpAdmin, mode } = useAuth();
  const router = useRouter();
  const [modeForm, setModeForm] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("Aura Admin");
  const [email, setEmail] = useState(adminBootstrapEmail() ?? "admin@aura.demo");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (modeForm === "signin") {
        await signInAdmin(email, password);
      } else {
        await signUpAdmin({ email, password, displayName });
      }
      router.push("/admin");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Failed";
      setError(
        /insufficient permissions|permission-denied/i.test(raw)
          ? "Firestore blocked the write. Publish signed-in allow rules in Firebase Console → Firestore → Rules."
          : raw
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/admin" className="inline-flex flex-col items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 ring-1 ring-accent/40">
              <span className="font-display text-2xl text-accent">A</span>
            </span>
            <span className="font-display text-2xl tracking-tight text-foreground">
              Aura Admin
            </span>
          </Link>
          <p className="mt-2 text-sm text-muted">
            {modeForm === "signin" ? "Staff sign-in" : "Create admin account"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {mode === "firebase" ? (
              <span className="text-accent">Live Firebase</span>
            ) : (
              "Demo mode"
            )}
            {" · "}separate from donor accounts
          </p>
        </div>

        <div className="panel space-y-4">
          <GoogleSignInButton
            portal="admin"
            label="Continue with Google"
            onSuccess={() => router.push("/admin")}
            onError={setError}
          />

          <div className="relative py-1 text-center text-xs text-muted">
            <span className="relative z-10 bg-[color:var(--panel)] px-2">or email</span>
            <span className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {modeForm === "signup" && (
              <label className="block space-y-1.5 text-sm">
                <span className="text-muted">Name</span>
                <input
                  className="input"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
            )}
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted">Admin email</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <PasswordField
              value={password}
              onChange={setPassword}
              autoComplete={modeForm === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
            />
            {modeForm === "signup" && (
              <p className="text-xs text-muted">
                Use bootstrap email{" "}
                <code className="text-accent">
                  {adminBootstrapEmail() || "admin@aura.demo"}
                </code>{" "}
                so the account is created with the admin role.
              </p>
            )}
            {error && <InlineAlert tone="error">{error}</InlineAlert>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading
                ? "Please wait…"
                : modeForm === "signin"
                  ? "Sign in"
                  : "Create admin"}
            </button>
          </form>

          <button
            type="button"
            className="w-full text-center text-xs text-muted hover:text-foreground"
            onClick={() => {
              setError(null);
              setModeForm((m) => (m === "signin" ? "signup" : "signin"));
            }}
          >
            {modeForm === "signin"
              ? "First time? Create admin account"
              : "Already have admin? Sign in"}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Looking to donate?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Donor sign-in
          </Link>
        </p>
      </div>
    </div>
  );
}
