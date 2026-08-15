"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProduct } from "@/components/providers/ProductProvider";

export default function HomePage() {
  const { user } = useAuth();
  const { isSupermarket, nouns, ready } = useProduct();

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%233dd6a5' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <section className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16 md:py-24">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-display text-5xl tracking-tight text-accent sm:text-7xl md:text-8xl"
        >
          Aura
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="mt-4 max-w-xl font-display text-2xl leading-snug text-foreground sm:text-3xl"
        >
          {!ready
            ? "…"
            : isSupermarket
              ? "Shop. Pool. Grow together."
              : "Give once. We allocate with care."}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.16 }}
          className="mt-4 max-w-md text-base leading-relaxed text-muted"
        >
          {!ready
            ? ""
            : isSupermarket
              ? "Record purchases into the loyalty pool. Reinvestment stays in your wallet; referral earn becomes claimable credit. Charity stays private."
              : "A blind donation system — you support Aura, and Aura routes funds to purpose wallets and partner charities behind the scenes."}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.24 }}
          className="mt-8 flex flex-wrap gap-3"
        >
          <Link href={user ? "/donate" : "/signup"} className="btn-primary">
            {user ? nouns.action : isSupermarket ? "Join the pool" : "Start giving"}
          </Link>
          <Link href="/invite" className="btn-ghost">
            Invite someone
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
