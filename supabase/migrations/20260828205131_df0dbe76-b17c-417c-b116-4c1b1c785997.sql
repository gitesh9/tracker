ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS target_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS frequency_days integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS is_sent boolean NOT NULL DEFAULT false;

ALTER TABLE public.subtasks
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();