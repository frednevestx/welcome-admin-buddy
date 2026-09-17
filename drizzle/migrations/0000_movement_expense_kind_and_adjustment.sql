ALTER TYPE public.movement_type ADD VALUE IF NOT EXISTS 'ajuste';

ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS expense_kind text NULL;

ALTER TABLE public.movements
  ADD CONSTRAINT movements_expense_kind_check
  CHECK (expense_kind IS NULL OR expense_kind IN ('custo', 'despesa'));
