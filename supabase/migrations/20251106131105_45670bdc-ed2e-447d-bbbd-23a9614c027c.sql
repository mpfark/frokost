-- Add dietary preferences to profiles table
ALTER TABLE public.profiles
ADD COLUMN is_gluten_free BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN is_lactose_free BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN is_vegetarian BOOLEAN NOT NULL DEFAULT false;