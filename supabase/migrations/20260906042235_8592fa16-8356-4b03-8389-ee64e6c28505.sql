-- Subtasks can belong to a task (checklist steps) as well as to a goal
ALTER TABLE public.subtasks ALTER COLUMN goal_id DROP NOT NULL;
ALTER TABLE public.subtasks
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE public.subtasks
  ADD CONSTRAINT subtasks_parent_present CHECK (goal_id IS NOT NULL OR task_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS subtasks_task_id_idx ON public.subtasks(task_id);
CREATE INDEX IF NOT EXISTS subtasks_goal_id_idx ON public.subtasks(goal_id);

-- Tasks can be linked to one or many other tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS linked_task_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];