-- 0004 — stock counts for items.
--
-- One row per item that has a stock number (items without one are simply not
-- tracked). The item list stores items by id, so item_id is that id.
--
-- Selling lowers the count through stall_decrement_stock, which does the
-- subtraction inside the database in a single step, so two bills rung up at the
-- same moment cannot overwrite each other's change. It never goes below zero.
--
-- Run this BEFORE deploying the version of the app that tracks stock. Until it is
-- applied the till still works; stock just isn't shown or counted.
-- Safe to run again.

create table if not exists public.stall_stock (
  item_id     text primary key,
  quantity    integer not null check (quantity >= 0),
  updated_at  timestamptz not null default now()
);

alter table public.stall_stock enable row level security;

comment on table public.stall_stock is
  'Pieces in stock per item id. Service-role access only.';

create or replace function public.stall_decrement_stock(p_item text, p_qty integer)
returns void
language sql
as $$
  update public.stall_stock
     set quantity = greatest(quantity - p_qty, 0),
         updated_at = now()
   where item_id = p_item;
$$;

-- Only the server (service role) may call it.
revoke all on function public.stall_decrement_stock(text, integer) from public;
grant execute on function public.stall_decrement_stock(text, integer) to service_role;

insert into public.stall_migrations (name)
  values ('0004_add_stock')
  on conflict (name) do nothing;
