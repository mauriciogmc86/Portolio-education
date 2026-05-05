-- Migration: Vincular content_files con assignments
ALTER TABLE public.content_files
  ADD COLUMN IF NOT EXISTS assignment_id uuid;

ALTER TABLE public.content_files
  ADD CONSTRAINT IF NOT EXISTS fk_content_files_assignment
  FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE SET NULL;

-- Verificación
SELECT 'content_files_assignment_fk_added' as status;
