ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}'::text[];
UPDATE public.tasks SET categories = ARRAY[domain] WHERE cardinality(categories) = 0;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS target_date date;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress';
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS ai_split_accepted boolean NOT NULL DEFAULT false;
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS target_date date;