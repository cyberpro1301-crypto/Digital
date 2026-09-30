import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null as unknown as ReturnType<typeof createClient>;

export type Product = {
  id: string;
  name_en: string;
  name_ru: string;
  description_en: string;
  description_ru: string;
  category: string;
  price: number;
  badge: string | null;
  is_unlimited: boolean;
  created_at: string;
  has_file: boolean;
  stock: number;
};

export type CartItem = {
  product_id: string;
  name_en: string;
  name_ru: string;
  price: number;
  qty: number;
  stock: number;
  has_file: boolean;
  is_unlimited: boolean;
};

export type Profile = {
  id: string;
  public_uid: string;
  role: string;
  balance: number;
};

export type Order = {
  id: string;
  user_id: string;
  total: number;
  status: string;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  qty: number;
  price: number;
  delivered_payload: string | null;
  products?: { name_en: string; name_ru: string; file_path: string | null };
};

export type Transaction = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  pay_address: string | null;
  pay_amount: number | null;
  np_payment_id: string | null;
  credited: boolean;
  created_at: string;
};
