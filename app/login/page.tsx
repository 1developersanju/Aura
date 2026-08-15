"use client";

import Link from "next/link";
import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { useAuth } from "@/components/providers/AuthProvider";

function LoginForm() {
  const { signInDonor, mode } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/donate";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInDonor(email, password);
      router.push(next.startsWith("/admin") ? "/donate" : next);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Sign in failed";
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
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">Donor</p>
      <h1 className="mt-1 font-display text-3xl text-foreground">Sign in</h1>
      <p className="mt-2 text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Create a donor account
        </Link>
      </p>
      {mode === "firebase" ? (
        <p className="mt-3 text-xs text-accent">Connected to Firebase (Live)</p>
      ) : (
        <p className="mt-3 text-xs text-muted">Demo mode — data stays in this browser</p>
      )}

      <div className="panel mt-8 space-y-4">
        <GoogleSignInButton
          portal="donor"
          label="Continue with Google"
          onSuccess={() => router.push(next.startsWith("/admin") ? "/donate" : next)}
          onError={setError}
        />

        <div className="relative py-1 text-center text-xs text-muted">
          <span className="relative z-10 bg-[color:var(--panel)] px-2">or email</span>
          <span className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Email</span>
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
            autoComplete="current-password"
            required
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button type="submit" className="btn-ghost w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in as donor"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Aura staff?{" "}
        <Link href="/admin/login" className="text-accent hover:underline">
          Admin sign-in
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
