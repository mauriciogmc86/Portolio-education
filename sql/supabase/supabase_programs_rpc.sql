-- RPC: crear programa y relaciones de forma atómica
CREATE OR REPLACE FUNCTION public.create_program_with_relations(
  p_name text,
  p_code text,
  p_description text,
  p_organization_id uuid,
  p_duration_months int,
  p_cover_url text,
  p_is_active boolean,
  p_teacher_ids uuid[],
  p_student_ids uuid[]
) RETURNS SETOF programs
LANGUAGE plpgsql AS $$
DECLARE
  created programs%ROWTYPE;
BEGIN
  INSERT INTO programs(name, code, description, organization_id, duration_months, cover_url, is_active)
  VALUES (p_name, p_code, p_description, p_organization_id, p_duration_months, p_cover_url, coalesce(p_is_active, true))
  RETURNING * INTO created;

  IF p_teacher_ids IS NOT NULL THEN
    INSERT INTO program_teachers(program_id, profile_id)
    SELECT created.id, unnest(p_teacher_ids);
  END IF;

  IF p_student_ids IS NOT NULL THEN
    INSERT INTO program_students(program_id, profile_id)
    SELECT created.id, unnest(p_student_ids);
  END IF;

  RETURN QUERY SELECT created.*;
END;
$$;

-- RPC: actualizar programa y relaciones de forma atómica
CREATE OR REPLACE FUNCTION public.update_program_with_relations(
  p_program_id uuid,
  p_name text,
  p_code text,
  p_description text,
  p_duration_months int,
  p_cover_url text,
  p_is_active boolean,
  p_teacher_ids uuid[],
  p_student_ids uuid[]
) RETURNS SETOF programs
LANGUAGE plpgsql AS $$
DECLARE
  updated programs%ROWTYPE;
BEGIN
  UPDATE programs
  SET name = COALESCE(p_name, name),
      code = COALESCE(p_code, code),
      description = COALESCE(p_description, description),
      duration_months = COALESCE(p_duration_months, duration_months),
      cover_url = COALESCE(p_cover_url, cover_url),
      is_active = COALESCE(p_is_active, is_active),
      updated_at = now()
  WHERE id = p_program_id
  RETURNING * INTO updated;

  IF p_teacher_ids IS NOT NULL THEN
    DELETE FROM program_teachers WHERE program_id = p_program_id;
    IF array_length(p_teacher_ids,1) > 0 THEN
      INSERT INTO program_teachers(program_id, profile_id)
      SELECT p_program_id, unnest(p_teacher_ids);
    END IF;
  END IF;

  IF p_student_ids IS NOT NULL THEN
    DELETE FROM program_students WHERE program_id = p_program_id;
    IF array_length(p_student_ids,1) > 0 THEN
      INSERT INTO program_students(program_id, profile_id)
      SELECT p_program_id, unnest(p_student_ids);
    END IF;
  END IF;

  RETURN QUERY SELECT updated.*;
END;
$$;

-- RPC: obtener miembros de un programa (students + teachers) con SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.rpc_get_program_members(p_program_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'students', COALESCE((SELECT jsonb_agg(row_to_json(p)) FROM profiles p WHERE p.id IN (SELECT profile_id FROM program_students WHERE program_id = p_program_id)), '[]'::jsonb),
    'teachers', COALESCE((SELECT jsonb_agg(row_to_json(p)) FROM profiles p WHERE p.id IN (SELECT profile_id FROM program_teachers WHERE program_id = p_program_id)), '[]'::jsonb)
  );
$$;
