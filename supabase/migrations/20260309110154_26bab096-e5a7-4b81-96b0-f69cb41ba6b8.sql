
CREATE TABLE public.graph_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.graph_subscriptions ENABLE ROW LEVEL SECURITY;

-- Only service role needs access (via edge functions)
CREATE POLICY "No direct access" ON public.graph_subscriptions FOR ALL TO authenticated USING (false);
