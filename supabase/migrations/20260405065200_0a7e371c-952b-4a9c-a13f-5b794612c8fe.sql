
-- Table for deposit agents (physical deposit points)
CREATE TABLE public.deposit_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  opening_hours JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  agent_user_id UUID, -- optional: linked user account
  commission_percent NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deposit_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active verified agents" ON public.deposit_agents
  FOR SELECT USING (is_active = true AND is_verified = true);

CREATE POLICY "Admins can manage all agents" ON public.deposit_agents
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agent users can view own agent" ON public.deposit_agents
  FOR SELECT USING (auth.uid() = agent_user_id);

-- Table for deposits made at agents
CREATE TABLE public.agent_deposits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.deposit_agents(id),
  customer_user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'DOP',
  status TEXT DEFAULT 'pending',
  transaction_reference TEXT,
  proof_image_url TEXT,
  admin_notes TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all agent deposits" ON public.agent_deposits
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers can view own agent deposits" ON public.agent_deposits
  FOR SELECT USING (auth.uid() = customer_user_id);

CREATE POLICY "Customers can create agent deposits" ON public.agent_deposits
  FOR INSERT WITH CHECK (auth.uid() = customer_user_id);

CREATE POLICY "Agent users can view deposits at their agent" ON public.agent_deposits
  FOR SELECT USING (agent_id IN (SELECT id FROM deposit_agents WHERE agent_user_id = auth.uid()));
