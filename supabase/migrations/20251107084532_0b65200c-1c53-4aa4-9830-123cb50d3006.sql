-- Create guests table to store individual guest dietary restrictions
CREATE TABLE public.guests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signup_id UUID NOT NULL REFERENCES public.lunch_signups(id) ON DELETE CASCADE,
  is_gluten_free BOOLEAN NOT NULL DEFAULT false,
  is_lactose_free BOOLEAN NOT NULL DEFAULT false,
  is_vegetarian BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

-- Anyone can view guests
CREATE POLICY "Anyone can view guests"
ON public.guests
FOR SELECT
USING (true);

-- Users can insert guests for their own signups
CREATE POLICY "Users can insert guests for own signups"
ON public.guests
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lunch_signups
    WHERE lunch_signups.id = signup_id
    AND lunch_signups.user_id = auth.uid()
  )
);

-- Users can delete guests from their own signups
CREATE POLICY "Users can delete guests from own signups"
ON public.guests
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.lunch_signups
    WHERE lunch_signups.id = signup_id
    AND lunch_signups.user_id = auth.uid()
  )
);

-- Users can update guests for their own signups
CREATE POLICY "Users can update guests for own signups"
ON public.guests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.lunch_signups
    WHERE lunch_signups.id = signup_id
    AND lunch_signups.user_id = auth.uid()
  )
);

-- Create function to automatically update guest_count
CREATE OR REPLACE FUNCTION public.update_guest_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.lunch_signups
  SET guest_count = (
    SELECT COUNT(*) FROM public.guests WHERE signup_id = COALESCE(NEW.signup_id, OLD.signup_id)
  )
  WHERE id = COALESCE(NEW.signup_id, OLD.signup_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to update guest_count on insert/delete
CREATE TRIGGER update_lunch_signup_guest_count
AFTER INSERT OR DELETE ON public.guests
FOR EACH ROW
EXECUTE FUNCTION public.update_guest_count();