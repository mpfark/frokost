-- Create company_settings table
CREATE TABLE public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  allowed_domain text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on company_settings
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Create invitation_batches table
CREATE TABLE public.invitation_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  total_invites integer NOT NULL DEFAULT 0,
  description text
);

-- Enable RLS on invitation_batches
ALTER TABLE public.invitation_batches ENABLE ROW LEVEL SECURITY;

-- Create invitations table
CREATE TABLE public.invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  invite_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.invitation_batches(id) ON DELETE SET NULL
);

-- Enable RLS on invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_settings
CREATE POLICY "Anyone can view company settings"
  ON public.company_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert company settings"
  ON public.company_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update company settings"
  ON public.company_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for invitation_batches
CREATE POLICY "Admins can view all batches"
  ON public.invitation_batches FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create batches"
  ON public.invitation_batches FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for invitations
CREATE POLICY "Admins can view all invitations"
  ON public.invitations FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can validate invite code"
  ON public.invitations FOR SELECT
  USING (true);

CREATE POLICY "Admins can create invitations"
  ON public.invitations FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update invitations"
  ON public.invitations FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete invitations"
  ON public.invitations FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at on company_settings
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-expire invitations
CREATE OR REPLACE FUNCTION public.expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invitations
  SET status = 'expired'
  WHERE status = 'pending' 
    AND expires_at < now();
END;
$$;