-- Create webflow_sync_settings table
CREATE TABLE IF NOT EXISTS public.webflow_sync_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  sync_frequency TEXT NOT NULL DEFAULT 'manual' CHECK (sync_frequency IN ('manual', 'daily', 'weekly')),
  removal_policy TEXT NOT NULL DEFAULT 'deactivate' CHECK (removal_policy IN ('deactivate', 'soft_delete', 'full_delete')),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  field_mapping JSONB NOT NULL DEFAULT '{"name": "name", "email": "email"}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sync_logs table
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sync_completed_at TIMESTAMP WITH TIME ZONE,
  users_added INTEGER NOT NULL DEFAULT 0,
  users_updated INTEGER NOT NULL DEFAULT 0,
  users_removed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add is_active and webflow_synced columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS webflow_synced BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS webflow_id TEXT;

-- Enable RLS on new tables
ALTER TABLE public.webflow_sync_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for webflow_sync_settings
CREATE POLICY "Admins can view sync settings"
  ON public.webflow_sync_settings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sync settings"
  ON public.webflow_sync_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert sync settings"
  ON public.webflow_sync_settings
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for sync_logs
CREATE POLICY "Admins can view sync logs"
  ON public.sync_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert sync logs"
  ON public.sync_logs
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updating updated_at
CREATE TRIGGER update_webflow_sync_settings_updated_at
  BEFORE UPDATE ON public.webflow_sync_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();