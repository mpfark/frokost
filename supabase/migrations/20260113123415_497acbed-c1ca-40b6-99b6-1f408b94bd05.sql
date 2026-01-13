-- Add include_drafts setting to webflow_sync_settings
ALTER TABLE public.webflow_sync_settings 
ADD COLUMN include_drafts BOOLEAN NOT NULL DEFAULT false;