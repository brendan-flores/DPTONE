# DPT ONE

## Description

DPT ONE is a Cebu-based streetwear brand offering curated collections and exclusive drops. This repository powers the full online shopping experience — from browsing and cart to checkout and delivery — plus a separate admin panel for managing products, orders, and store operations.

**Storefront**

- Browse products by brand, search, and featured collections
- Email OTP sign-in and persistent cart
- Checkout via cash on delivery (COD) or personal QR Ph payment
- Order tracking, receipts, ratings, and returns

**Admin** (`/admin`)

- Separate admin authentication
- Product catalog management
- Order fulfillment and status updates
- Activity log and sales analytics

---

## Tech Stack

### Frontend

- **Next.js 16** (App Router) with **React 18** and **TypeScript**
- **Tailwind CSS** and **shadcn/ui** (Radix UI)
- **Chart.js** / **Recharts** for admin analytics
- Deployed on **Vercel** (`dptone.vercel.app` storefront, `dptone-admin.vercel.app` admin)

### Backend

- **Next.js** server components and API routes
- **Supabase JavaScript client** for auth, data access, storage, and realtime subscriptions
- Separate customer and admin Supabase sessions (`lib/supabase.ts`, `lib/supabase-admin.ts`)

### Database

- **Supabase** (hosted **PostgreSQL**)
- Row Level Security (RLS), RPCs (`complete_customer_order`, `update_order_status`), and realtime on orders and cart
- **Supabase Auth** (email magic link / OTP)
- **Supabase Storage** — public `product-images` bucket for logos, product photos, and hero slider assets

---

## Installation Guide

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Supabase](https://supabase.com/) project

### 1. Clone and install

```bash
git clone <repository-url>
cd DPTONE
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server-only; local admin scripts only — never expose to the client |

### 3. Database and storage

1. Open the **Supabase SQL Editor** and run the full script in [`supabase/schema.sql`](supabase/schema.sql) (idempotent — safe to re-run).
2. Create a public storage bucket named **`product-images`**.
3. Upload brand assets as needed (see `lib/assets.ts`):
   - Logo: `DPT ONE LOGO/dpt-one-logo.png`
   - Hero slider: `product-images/Image Sliders/`
4. Create an admin account in **Supabase Auth**, then add their user ID to the `admin_users` table.

### 4. Auth redirect URLs

In **Supabase → Authentication → URL Configuration**, add your app URLs:

- `http://localhost:3000/**` (local dev)
- `https://dptone.vercel.app/**`
- `https://dptone-admin.vercel.app/**`

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the storefront and [http://localhost:3000/admin](http://localhost:3000/admin) for the admin panel.

On production, `dptone-admin.vercel.app` automatically redirects to `/admin` via middleware (both domains point to the same Vercel project).

### 6. Production build

```bash
npm run build
npm start
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your Vercel project environment variables, then deploy.
