-- Migration: Añadir program_id a assignments y FK a programs
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS program_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'assignments'
      AND constraint_name = 'fk_assignments_program'
  ) THEN
    ALTER TABLE public.assignments
      ADD CONSTRAINT fk_assignments_program
      FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE SET NULL;
  END IF;
END $$;

SELECT 'assignment_program_fk_added' as status;
