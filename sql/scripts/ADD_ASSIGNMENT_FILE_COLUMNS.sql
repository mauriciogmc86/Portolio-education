-- Migration: Añadir columnas para archivo adjunto en assignments
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_type text;

-- Opcional: actualizar RLS/policies si existen políticas que restringen columnas
-- Revisa tus políticas RLS para permitir que los profesores inserten/actualicen estos campos.

-- Ejemplo: permitir INSERT/UPDATE por role teacher (ajusta según tus políticas actuales):
-- CREATE POLICY "assignments_insert_teacher" ON public.assignments FOR INSERT TO authenticated USING (true) WITH CHECK (auth.role() = 'teacher');

-- Verificación
SELECT 'columns_added' as status;
