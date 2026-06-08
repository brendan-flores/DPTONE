# DPT ONE E-commerce

Next.js storefront and admin panel for DPT ONE — browse products, cart, checkout (COD / QR Ph), orders, and admin management.

## Features

- Customer auth (Supabase email + OTP)
- Separate admin auth (`/admin`)
- Product catalog with realtime updates
- Persistent cart (Supabase `cart_items`)
- Checkout with COD and personal QR Ph payment
- Order history, ratings, returns
- Admin: products, orders, activities, analytics

## Tech Stack

- **Next.js 16** (App Router)
- **Supabase** — auth, PostgreSQL, storage, realtime
- **Tailwind CSS** + shadcn/ui

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional: `SUPABASE_SERVICE_ROLE_KEY` (local admin scripts only — never expose to the client).

### 3. Supabase setup

Run `supabase/schema.sql` in the Supabase SQL Editor (idempotent).

Create a public storage bucket: **`product-images`**.

Add your admin user to `admin_users` after creating them in Supabase Auth.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/                    # Next.js routes (storefront + admin + API)
components/             # UI components
  admin/                # Admin shell, analytics, login
  checkout/             # Checkout UI
context/                # Auth, cart, admin analytics providers
hooks/                  # Shared React hooks
lib/
  admin/                # Admin data layer (products, orders, analytics)
  storefront/           # Customer data layer (products, cart, orders, checkout)
  supabase.ts           # Customer Supabase client
  supabase-admin.ts     # Admin Supabase client (separate session)
  assets.ts             # Static asset URLs (logo, hero slider)
supabase/
  schema.sql            # Full database schema, RLS, RPCs, storage policies
```

## Notes

- Customer and admin use **separate Supabase auth storage keys** — you can stay logged in on both at once.
- Hero slider images: `product-images/product-images/Image Sliders/` in storage (see `lib/assets.ts`).
