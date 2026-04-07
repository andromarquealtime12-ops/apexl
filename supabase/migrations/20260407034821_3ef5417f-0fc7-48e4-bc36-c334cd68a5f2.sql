-- Add 'conversion' to allowed types in wallet_transactions
ALTER TABLE public.wallet_transactions DROP CONSTRAINT wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK (type = ANY (ARRAY['deposit','withdrawal','payment','refund','transfer','conversion']));
