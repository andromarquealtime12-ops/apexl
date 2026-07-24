
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type = ANY (ARRAY[
    'deposit','withdrawal','payment','refund','transfer','conversion',
    'delivery_fee','commission','bonus','adjustment','exchange','fee'
  ]));
