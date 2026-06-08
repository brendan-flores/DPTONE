-- DPT ONE — single Supabase schema (run entire file in SQL Editor).
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS where needed.
--
-- Setup checklist:
-- 1) Enable Email auth + custom SMTP in Authentication settings
-- 2) Magic link email template: use {{ .Token }} (see supabase/email-magic-link-otp.html)
-- 3) Storage bucket `product-images` (public) for product/logo uploads
-- 4) After first admin signs up in Auth, insert into admin_users (see bottom of file)

begin;

create extension if not exists pgcrypto;

-- ================
-- Auth/Profile
-- ================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  phone_number text,
  email_verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email_verified_at timestamptz;

-- Verified customers (row created only after email is confirmed)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  phone_number text,
  email_verified_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Auto-create a profiles row for every new auth.users record
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, phone_number, email_verified_at)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'displayName',
      new.raw_user_meta_data->>'display_name'
    ),
    coalesce(
      new.raw_user_meta_data->>'phoneNumber',
      new.raw_user_meta_data->>'phone_number'
    ),
    new.email_confirmed_at
  )
  on conflict (id) do update set
    email = excluded.email,
    email_verified_at = coalesce(excluded.email_verified_at, public.profiles.email_verified_at);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email_verified_at in sync when the user confirms email
create or replace function public.handle_user_email_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null
     and (old.email_confirmed_at is null or old.email_confirmed_at is distinct from new.email_confirmed_at) then
    update public.profiles
    set email_verified_at = new.email_confirmed_at
    where id = new.id;

    -- Store verified customers only (never admins)
    if not exists (
      select 1 from public.admin_users au
      where au.user_id = new.id
    ) then
      insert into public.users (id, email, display_name, phone_number, email_verified_at)
      values (
        new.id,
        coalesce(new.email, ''),
        coalesce(
          new.raw_user_meta_data->>'displayName',
          new.raw_user_meta_data->>'display_name'
        ),
        coalesce(
          new.raw_user_meta_data->>'phoneNumber',
          new.raw_user_meta_data->>'phone_number'
        ),
        new.email_confirmed_at
      )
      on conflict (id) do update set
        email = excluded.email,
        email_verified_at = excluded.email_verified_at,
        display_name = coalesce(excluded.display_name, public.users.display_name),
        phone_number = coalesce(excluded.phone_number, public.users.phone_number);
    end if;
  end if;
  return new;
end;
$$;

-- Callable from the app after OTP verification (bypasses RLS safely)
create or replace function public.save_verified_customer(
  p_email text default null,
  p_display_name text default null,
  p_phone_number text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  confirmed_at timestamptz;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.admin_users au where au.user_id = uid) then
    return false;
  end if;

  select u.email_confirmed_at into confirmed_at
  from auth.users u
  where u.id = uid;

  if confirmed_at is null then
    raise exception 'Email not verified yet';
  end if;

  insert into public.users (id, email, display_name, phone_number, email_verified_at)
  select
    u.id,
    coalesce(nullif(trim(p_email), ''), u.email, ''),
    p_display_name,
    p_phone_number,
    u.email_confirmed_at
  from auth.users u
  where u.id = uid
  on conflict (id) do update set
    email = excluded.email,
    email_verified_at = excluded.email_verified_at,
    display_name = coalesce(excluded.display_name, public.users.display_name),
    phone_number = coalesce(excluded.phone_number, public.users.phone_number);

  return true;
end;
$$;

grant execute on function public.save_verified_customer(text, text, text) to authenticated;

-- Admins table (replaces hard-coded admin credentials)
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  is_active boolean not null default true,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

-- Remove from public.users when someone is granted admin access
create or replace function public.handle_admin_user_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.users where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_verified on auth.users;
create trigger on_auth_user_email_verified
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_email_verified();

drop trigger if exists on_admin_user_added on public.admin_users;
create trigger on_admin_user_added
  after insert on public.admin_users
  for each row execute function public.handle_admin_user_added();

-- ================
-- Helpers (must run after admin_users exists)
-- ================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.is_active = true
  );
$$;

-- ================
-- Products & Inventory
-- ================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  -- UI expects stable string ids; you can optionally set id to your own values
  -- when importing. By default we use UUIDs.
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  color text,
  brand text,
  is_featured boolean not null default false,
  total_stock integer not null default 0,
  purchased_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.product_sizes (
  id bigserial primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null, -- e.g. 'S','M','L','XL','2XL'
  stock integer not null default 0
);
create index if not exists product_sizes_product_id_idx on public.product_sizes(product_id);

-- Stores image URLs (Supabase Storage holds the actual files)
create table if not exists public.product_images (
  id bigserial primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null
);
create index if not exists product_images_product_id_idx on public.product_images(product_id);

-- ================
-- Cart
-- ================

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Snapshot fields (keeps cart rendering independent of product changes)
  product_id uuid not null references public.products(id) on delete restrict,
  name text not null,
  image text,
  price numeric(10,2) not null default 0,
  quantity integer not null default 1,
  selected_size text,
  selected_color text,
  created_at timestamptz not null default now()
);
create index if not exists cart_items_user_id_idx on public.cart_items(user_id);

-- Optional uniqueness to avoid duplicates for the same selection
create unique index if not exists cart_items_unique_selection
on public.cart_items(user_id, product_id, selected_size, selected_color);

-- ================
-- Addresses
-- ================

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  is_default boolean not null default false,
  country text not null default 'Philippines',
  first_name text not null,
  last_name text not null,
  address1 text not null,
  address2 text,
  postal_code text not null,
  city text not null,
  region text not null,
  phone text not null,
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_id_idx on public.addresses(user_id);

-- ================
-- Orders
-- ================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending', -- pending, processing, shipped, delivered, completed, cancelled, returned/refunded

  -- Totals
  total numeric(10,2) not null default 0,
  subtotal numeric(10,2) not null default 0,
  shipping numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,

  payment_method text,
  payment_status text,

  -- Dates
  date_ordered timestamptz,
  date_ordered_client timestamptz,
  created_at timestamptz not null default now(),
  estimated_delivery timestamptz,
  delivered_at timestamptz,
  tracking_number text,

  -- Addresses
  shipping_address jsonb not null default '{}'::jsonb,
  billing_address jsonb not null default '{}'::jsonb,

  -- {status, timestamp}[]
  status_history jsonb not null default '[]'::jsonb,

  -- Flags used by UI
  order_received boolean not null default false,
  action_completed boolean not null default false,

  -- Admin / stock linkage
  -- (Admin can update status based on the same record; no need for separate adminProducts/global ids.)
  notes text
);
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,

  -- Snapshot fields for UI
  name text not null,
  price numeric(10,2) not null,
  quantity integer not null,
  image text,
  size text,
  color text
);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);

-- ================
-- Sales & Activities (Analytics)
-- ================

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  total numeric(10,2) not null,
  quantity integer not null default 0,
  items jsonb,
  timestamp timestamptz not null default now()
);
create index if not exists sales_timestamp_idx on public.sales(timestamp);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- 'user_created' | 'purchase'
  email text,
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  total numeric(10,2),
  items jsonb,
  status text,
  created_at timestamptz not null default now()
);
create index if not exists activities_type_idx on public.activities(type);
create index if not exists activities_created_at_idx on public.activities(created_at);

-- ================
-- Reviews / Ratings & Returns
-- ================

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  rating integer not null check (rating between 1 and 5),
  feedback text,
  product_name text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists product_reviews_product_id_idx on public.product_reviews(product_id);
create index if not exists product_reviews_created_at_idx on public.product_reviews(created_at);

create table if not exists public.product_ratings_summary (
  product_id uuid primary key references public.products(id) on delete cascade,
  product_name text not null,
  average_rating numeric(3,2) not null default 0,
  review_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  price numeric(10,2),
  reason text,
  product_name text,
  created_at timestamptz not null default now()
);
create index if not exists returns_product_id_idx on public.returns(product_id);
create index if not exists returns_created_at_idx on public.returns(created_at);

-- Receipt records (only needed for the gcash "fake" flow)
create table if not exists public.order_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  order_number text,
  receipt_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists order_receipts_user_id_idx on public.order_receipts(user_id);

-- ================
-- RLS Policies
-- ================

-- profiles
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_upsert_own"
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
on public.profiles for select
using (public.is_admin());

-- users (verified accounts only)
alter table public.users enable row level security;
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
on public.users for select
using (id = auth.uid());

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
on public.users for insert
with check (id = auth.uid() and email_verified_at is not null);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
on public.users for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "users_select_admin" on public.users;
create policy "users_select_admin"
on public.users for select
using (public.is_admin());

-- admin_users
alter table public.admin_users enable row level security;
drop policy if exists "admin_users_select_own_row" on public.admin_users;
create policy "admin_users_select_own_row"
on public.admin_users for select
using (user_id = auth.uid());

drop policy if exists "admin_users_admin_all" on public.admin_users;
create policy "admin_users_admin_all"
on public.admin_users for all
using (public.is_admin())
with check (public.is_admin());

-- products (public read, admin write)
alter table public.products enable row level security;
drop policy if exists "products_select_public" on public.products;
create policy "products_select_public"
on public.products for select
using (true);

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write"
on public.products for all
using (public.is_admin())
with check (public.is_admin());

alter table public.product_sizes enable row level security;
drop policy if exists "product_sizes_select_public" on public.product_sizes;
create policy "product_sizes_select_public"
on public.product_sizes for select using (true);
drop policy if exists "product_sizes_admin_write" on public.product_sizes;
create policy "product_sizes_admin_write"
on public.product_sizes for all
using (public.is_admin())
with check (public.is_admin());

alter table public.product_images enable row level security;
drop policy if exists "product_images_select_public" on public.product_images;
create policy "product_images_select_public"
on public.product_images for select using (true);
drop policy if exists "product_images_admin_write" on public.product_images;
create policy "product_images_admin_write"
on public.product_images for all
using (public.is_admin())
with check (public.is_admin());

-- cart_items (user only)
alter table public.cart_items enable row level security;
drop policy if exists "cart_items_select_own" on public.cart_items;
create policy "cart_items_select_own"
on public.cart_items for select
using (user_id = auth.uid());
drop policy if exists "cart_items_write_own" on public.cart_items;
create policy "cart_items_write_own"
on public.cart_items for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- addresses (user only)
alter table public.addresses enable row level security;
drop policy if exists "addresses_select_own" on public.addresses;
create policy "addresses_select_own"
on public.addresses for select using (user_id = auth.uid());
drop policy if exists "addresses_write_own" on public.addresses;
create policy "addresses_write_own"
on public.addresses for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- orders (user can read own; admin can read/write all; user can insert own and update limited fields)
alter table public.orders enable row level security;
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
on public.orders for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
on public.orders for insert
with check (user_id = auth.uid());

drop policy if exists "orders_admin_write_all" on public.orders;
create policy "orders_admin_write_all"
on public.orders for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "orders_user_update_own" on public.orders;
create policy "orders_user_update_own"
on public.orders for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

alter table public.order_items enable row level security;
drop policy if exists "order_items_select_own_via_orders" on public.order_items;
create policy "order_items_select_own_via_orders"
on public.order_items for select
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.user_id = auth.uid() or public.is_admin())
  )
);
drop policy if exists "order_items_insert_own_via_orders" on public.order_items;
create policy "order_items_insert_own_via_orders"
on public.order_items for insert
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);
drop policy if exists "order_items_update_admin" on public.order_items;
create policy "order_items_update_admin"
on public.order_items for update
using (public.is_admin())
with check (public.is_admin());

-- sales & activities (user read own; admin read all; insert by user)
alter table public.sales enable row level security;
drop policy if exists "sales_select_own" on public.sales;
create policy "sales_select_own"
on public.sales for select
using (user_id = auth.uid() or public.is_admin());
drop policy if exists "sales_insert_own" on public.sales;
create policy "sales_insert_own"
on public.sales for insert
with check (user_id = auth.uid());

alter table public.activities enable row level security;
drop policy if exists "activities_select_own" on public.activities;
create policy "activities_select_own"
on public.activities for select
using (user_id = auth.uid() or public.is_admin());
drop policy if exists "activities_insert_own" on public.activities;
create policy "activities_insert_own"
on public.activities for insert
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "activities_admin_update" on public.activities;
create policy "activities_admin_update"
on public.activities for update
using (public.is_admin())
with check (public.is_admin());

-- reviews (public read; users insert their own; admin read/update all)
alter table public.product_reviews enable row level security;
drop policy if exists "product_reviews_select_public" on public.product_reviews;
create policy "product_reviews_select_public"
on public.product_reviews for select using (true);
drop policy if exists "product_reviews_insert_own" on public.product_reviews;
create policy "product_reviews_insert_own"
on public.product_reviews for insert
with check (user_id = auth.uid());
drop policy if exists "product_reviews_admin_write" on public.product_reviews;
create policy "product_reviews_admin_write"
on public.product_reviews for all
using (public.is_admin())
with check (public.is_admin());

alter table public.product_ratings_summary enable row level security;
drop policy if exists "product_ratings_summary_select_public" on public.product_ratings_summary;
create policy "product_ratings_summary_select_public"
on public.product_ratings_summary for select using (true);
drop policy if exists "product_ratings_summary_admin_write" on public.product_ratings_summary;
create policy "product_ratings_summary_admin_write"
on public.product_ratings_summary for all
using (public.is_admin())
with check (public.is_admin());

-- returns (public read for admin analytics is okay; user can insert own)
alter table public.returns enable row level security;
drop policy if exists "returns_select_public" on public.returns;
create policy "returns_select_public"
on public.returns for select using (true);
drop policy if exists "returns_insert_own" on public.returns;
create policy "returns_insert_own"
on public.returns for insert
with check (user_id = auth.uid());
drop policy if exists "returns_admin_write" on public.returns;
create policy "returns_admin_write"
on public.returns for all
using (public.is_admin())
with check (public.is_admin());

-- Unified order status update (admin + customer); keeps activities in sync
create or replace function public.update_order_status(
  p_order_id uuid,
  p_status text,
  p_delivered_at timestamptz default null,
  p_mark_received boolean default false,
  p_payment_status text default null,
  p_action_completed boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_history jsonb;
  v_owner uuid;
  v_current_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select user_id, status, coalesce(status_history, '[]'::jsonb)
  into v_owner, v_current_status, v_history
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  if public.is_admin() then
    -- Admins may change any order from any status (e.g. reopen a cancelled order).
    null;
  elsif v_owner = auth.uid() then
    if p_status = 'cancelled' then
      if v_current_status <> 'pending' then
        raise exception 'Only pending orders can be cancelled';
      end if;
    elsif p_status not in ('delivered', 'completed', 'returned/refunded') then
      raise exception 'Customers cannot set this status';
    end if;
  else
    raise exception 'Not authorized';
  end if;

  update public.orders
  set
    status = p_status,
    status_history = v_history || jsonb_build_array(
      jsonb_build_object(
        'status', p_status,
        'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )
    ),
    delivered_at = case
      when p_status = 'delivered' then coalesce(p_delivered_at, now())
      when public.is_admin() and p_status not in ('delivered', 'completed') then null
      else delivered_at
    end,
    order_received = case when p_mark_received then true else order_received end,
    payment_status = coalesce(p_payment_status, payment_status),
    action_completed = case
      when public.is_admin()
        and v_current_status = 'cancelled'
        and p_status not in ('cancelled', 'completed', 'returned/refunded')
        then false
      when p_action_completed is not null then p_action_completed
      else action_completed
    end
  where id = p_order_id;

  update public.activities
  set status = p_status
  where order_id = p_order_id;
end;
$$;

revoke all on function public.update_order_status(uuid, text, timestamptz, boolean, text, boolean) from public;
grant execute on function public.update_order_status(uuid, text, timestamptz, boolean, text, boolean) to authenticated;

-- Checkout: create order + items + sales + activity + stock (security definer)
create or replace function public.complete_customer_order(
  p_order jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_size text;
  v_qty integer;
  v_total_qty integer := 0;
  v_email text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(p_order->>'userEmail', u.email)
  into v_email
  from auth.users u
  where u.id = v_user_id;

  insert into public.orders (
    order_number,
    user_id,
    status,
    total,
    subtotal,
    shipping,
    tax,
    payment_method,
    payment_status,
    date_ordered,
    date_ordered_client,
    shipping_address,
    billing_address,
    status_history,
    notes
  ) values (
    p_order->>'orderNumber',
    v_user_id,
    coalesce(p_order->>'status', 'pending'),
    coalesce((p_order->>'total')::numeric, 0),
    coalesce((p_order->>'subtotal')::numeric, 0),
    coalesce((p_order->>'shipping')::numeric, 0),
    coalesce((p_order->>'tax')::numeric, 0),
    p_order->>'paymentMethod',
    coalesce(p_order->>'paymentStatus', 'pending'),
    now(),
    coalesce((p_order->>'dateOrderedClient')::timestamptz, now()),
    coalesce(p_order->'shippingAddress', '{}'::jsonb),
    coalesce(p_order->'billingAddress', '{}'::jsonb),
    jsonb_build_array(
      jsonb_build_object(
        'status', coalesce(p_order->>'status', 'pending'),
        'timestamp', to_jsonb(now()::text)
      )
    ),
    nullif(p_order->>'notes', '')
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'id')::uuid;
    v_size := nullif(v_item->>'size', '');
    v_qty := coalesce((v_item->>'quantity')::integer, 1);
    v_total_qty := v_total_qty + v_qty;

    insert into public.order_items (
      order_id, product_id, name, price, quantity, image, size, color
    ) values (
      v_order_id,
      v_product_id,
      v_item->>'name',
      coalesce((v_item->>'price')::numeric, 0),
      v_qty,
      nullif(v_item->>'image', ''),
      v_size,
      nullif(v_item->>'color', '')
    );

    if v_size is not null then
      update public.product_sizes
      set stock = greatest(0, stock - v_qty)
      where product_id = v_product_id and size = v_size;
    end if;

    update public.products
    set
      purchased_count = purchased_count + v_qty,
      total_stock = (
        select coalesce(sum(ps.stock), 0)
        from public.product_sizes ps
        where ps.product_id = v_product_id
      )
    where id = v_product_id;
  end loop;

  insert into public.sales (order_id, user_id, total, quantity, items, timestamp)
  values (
    v_order_id,
    v_user_id,
    coalesce((p_order->>'total')::numeric, 0),
    v_total_qty,
    p_items,
    now()
  );

  insert into public.activities (type, email, user_id, order_id, total, items, status)
  values (
    'purchase',
    v_email,
    v_user_id,
    v_order_id,
    coalesce((p_order->>'total')::numeric, 0),
    p_items,
    coalesce(p_order->>'status', 'pending')
  );

  return v_order_id;
end;
$$;

revoke all on function public.complete_customer_order(jsonb, jsonb) from public;
grant execute on function public.complete_customer_order(jsonb, jsonb) to authenticated;

-- order_receipts
alter table public.order_receipts enable row level security;
drop policy if exists "order_receipts_select_own" on public.order_receipts;
create policy "order_receipts_select_own"
on public.order_receipts for select
using (user_id = auth.uid() or public.is_admin());
drop policy if exists "order_receipts_insert_own" on public.order_receipts;
create policy "order_receipts_insert_own"
on public.order_receipts for insert
with check (user_id = auth.uid());

-- Backfill profiles for auth users created before this schema ran
insert into public.profiles (id, email, email_verified_at)
select u.id, coalesce(u.email, ''), u.email_confirmed_at
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Backfill verified customers into public.users (exclude admins)
insert into public.users (id, email, display_name, phone_number, email_verified_at, created_at)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data->>'displayName', u.raw_user_meta_data->>'display_name'),
  coalesce(u.raw_user_meta_data->>'phoneNumber', u.raw_user_meta_data->>'phone_number'),
  u.email_confirmed_at,
  coalesce(u.email_confirmed_at, u.created_at)
from auth.users u
where u.email_confirmed_at is not null
  and not exists (select 1 from public.admin_users a where a.user_id = u.id)
  and not exists (select 1 from public.users usr where usr.id = u.id);

-- Admins must not appear in public.users
delete from public.users u
using public.admin_users a
where u.id = a.user_id;

-- ================
-- Performance indexes (admin dashboards)
-- ================

create index if not exists products_created_at_idx on public.products(created_at desc);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists users_created_at_idx on public.users(created_at desc);
create index if not exists activities_type_created_at_idx
  on public.activities(type, created_at desc);

-- ================
-- Realtime (admin live updates)
-- Run once; safe to re-run (skips tables already in publication).
-- ================

do $admin_realtime$
declare
  t text;
begin
  foreach t in array array[
    'products', 'product_sizes', 'product_images',
    'orders', 'order_items',
    'activities', 'users', 'sales',
    'product_reviews', 'returns', 'product_ratings_summary',
    'cart_items', 'addresses'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end;
$admin_realtime$;

-- ================
-- Storage (product-images bucket)
-- ================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
on storage.objects for select
using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert"
on storage.objects for insert
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update"
on storage.objects for update
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete"
on storage.objects for delete
using (bucket_id = 'product-images' and public.is_admin());

-- ================
-- First admin (run AFTER creating the user in Supabase Auth)
-- Password is stored in Auth, NOT in admin_users.
-- Dashboard: Authentication → Users → Add user (email + password)
-- Then copy that user's UUID and run:
--
-- insert into public.admin_users (user_id, email, is_active)
-- values ('00000000-0000-0000-0000-000000000000', 'you@example.com', true);

commit;

