
-- Dynamic deposit methods table
CREATE TABLE public.deposit_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  method_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  method_type TEXT NOT NULL DEFAULT 'bank',
  account_number TEXT,
  account_name TEXT,
  instructions TEXT,
  country TEXT NOT NULL DEFAULT 'both',
  icon TEXT DEFAULT 'building',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deposit_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active deposit methods"
ON public.deposit_methods FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage deposit methods"
ON public.deposit_methods FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Currency conversion rates table
CREATE TABLE public.currency_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(from_currency, to_currency)
);

ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read currency rates"
ON public.currency_rates FOR SELECT
USING (true);

CREATE POLICY "Admins can manage currency rates"
ON public.currency_rates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default deposit methods from existing hardcoded data
INSERT INTO public.deposit_methods (method_key, label, method_type, account_number, account_name, instructions, country, icon, sort_order) VALUES
('banreservas', 'Banreservas', 'bank', '9607842951', 'Santo Josefa', 'Effectuez un dépôt sur ce compte, puis entrez le numéro de transaction et téléchargez la photo du reçu.', 'DO', 'building', 1),
('moncash', 'Moncash', 'mobile_money', '39297720', 'Ayiti Market', 'Envoyez le montant via Moncash, puis entrez le numéro de transaction et téléchargez la capture d''écran.', 'HT', 'smartphone', 2),
('orange_money', 'Orange Money', 'mobile_money', '', 'Ayiti Market', 'Envoyez le montant via Orange Money, puis entrez le numéro de transaction et téléchargez la capture d''écran.', 'HT', 'smartphone', 3),
('wise', 'Wise', 'digital', 'andromarquealtime455@gmail.com', 'Ayiti Market', 'Envoyez le montant via Wise à l''adresse email indiquée, puis entrez la référence de transaction.', 'both', 'globe', 4),
('paypal', 'PayPal', 'digital', 'payments@ayitimarket.com', 'Ayiti Market', 'Envoyez le paiement à notre compte PayPal, puis entrez l''ID de transaction.', 'both', 'globe', 5),
('bhd', 'BHD León', 'bank', '', 'Ayiti Market', 'Effectuez un virement sur ce compte BHD León, puis entrez le numéro de transaction.', 'DO', 'building', 6),
('popular', 'Banco Popular', 'bank', '', 'Ayiti Market', 'Effectuez un virement sur ce compte Banco Popular, puis entrez le numéro de transaction.', 'DO', 'building', 7),
('bank_transfer_do', 'Virement Bancaire (RD)', 'bank', '', 'Ayiti Market', 'Effectuez un virement bancaire, puis entrez le numéro de transaction.', 'DO', 'landmark', 8),
('bank_transfer_ht', 'Virement Bancaire (HT)', 'bank', '', 'Ayiti Market', 'Effectuez un virement bancaire, puis entrez le numéro de transaction.', 'HT', 'landmark', 9);

-- Seed default currency rates
INSERT INTO public.currency_rates (from_currency, to_currency, rate) VALUES
('USD', 'DOP', 58.50),
('USD', 'HTG', 132.50),
('DOP', 'USD', 0.0171),
('DOP', 'HTG', 2.265),
('HTG', 'USD', 0.00755),
('HTG', 'DOP', 0.4415);
