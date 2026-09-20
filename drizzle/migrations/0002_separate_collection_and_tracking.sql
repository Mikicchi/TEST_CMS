ALTER TABLE public.tracked_cards
  ADD COLUMN IF NOT EXISTS in_collection boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_tracked boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS tracked_cards_user_collection_idx ON public.tracked_cards (user_id, in_collection);
CREATE INDEX IF NOT EXISTS tracked_cards_user_tracked_idx ON public.tracked_cards (user_id, is_tracked);