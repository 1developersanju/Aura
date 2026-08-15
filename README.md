# Aura

Blind personal donation app: donors give to **Aura**; Aura admin allocates demo funds across purpose wallets and partner charities.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

With `.env.local` Firebase keys present, the nav shows **Live**. Without them, it runs in browser **Demo** mode (localStorage).

### Admin bootstrap

Go to **`/admin/login`** (not the donor login). Create an admin with email `admin@aura.demo` (or your `NEXT_PUBLIC_AURA_ADMIN_EMAIL`), or promote a user later under `/admin/settings`.

Donors use **`/login`** and **`/signup`**. Admin accounts are rejected on the donor portal and vice versa.

## Firebase console checklist

For project `fooddb-53cd7` (or your own):

1. **Authentication → Sign-in method** → enable **Email/Password**
2. **Firestore Database** → create database (start in test mode, then paste [`firestore.rules`](firestore.rules))
3. Restart `npm run dev` after editing `.env.local`

On first signed-in session the app seeds Education / Food relief / Partner Charity with a 40/35/25 split if destinations are empty.

## Routes

| Path | Role |
|------|------|
| `/`, `/donate`, `/donations`, `/invite` | Donor |
| `/login`, `/signup` | Auth (`?ref=CODE` on signup) |
| `/admin/*` | Aura admin only |
# Aura
