-- Add link_sent_at column to track when magic link emails were sent
ALTER TABLE public.invitations
ADD COLUMN link_sent_at timestamp with time zone DEFAULT NULL;