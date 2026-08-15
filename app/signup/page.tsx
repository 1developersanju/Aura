"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { useAuth } from "@/components/providers/AuthProvider";
import { MAX_DIRECTS } from "@/lib/placement";

function SignupForm() {
  const { signUpDonor, mode } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState(params.get("ref") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signUpDonor({
        email,
        password,
        displayName,
        referralCode: referralCode.trim() || undefined,
      });
      router.push("/donate");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Sign up failed";
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
      <h1 className="mt-1 font-display text-3xl text-foreground">Join Aura</h1>
      <p className="mt-2 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Donor sign-in
        </Link>
      </p>
      <p className="mt-3 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent ring-1 ring-accent/25">
        Placement is automatic: each member can hold {MAX_DIRECTS} directs, then
        new joiners spill over deeper in the tree (grows without a hard depth
        cap). An invite code only prefers that sponsor if they still have an open
        slot.
      </p>
      {mode === "demo" && (
        <p className="mt-2 text-xs text-muted">Demo mode — data stays in this browser.</p>
      )}

      <div className="panel mt-8 space-y-4">
        <GoogleSignInButton
          portal="donor"
          label="Sign up with Google"
          referralCode={referralCode}
          onSuccess={() => router.push("/donate")}
          onError={setError}
        />

        <div className="relative py-1 text-center text-xs text-muted">
          <span className="relative z-10 bg-[color:var(--panel)] px-2">or email</span>
          <span className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Name</span>
            <input
              className="input"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
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
            autoComplete="new-password"
            required
            minLength={6}
          />
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Invite code (optional preference)</span>
            <input
              className="input"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="Leave blank for auto-placement"
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button type="submit" className="btn-ghost w-full" disabled={loading}>
            {loading ? "Creating…" : "Create donor account"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Aura staff?{" "}
        <Link href="/admin/login" className="text-accent hover:underline">
          Admin portal
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted">Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}
