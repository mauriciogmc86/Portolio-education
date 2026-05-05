-- ============================================
-- TRIGGER: Asignación automática de estudiantes
-- ============================================
-- Asigna automáticamente a los nuevos estudiantes
-- a un grupo predeterminado de su organización
-- ============================================

CREATE OR REPLACE FUNCTION fn_asignar_estudiante_grupo()
RETURNS TRIGGER AS $$
DECLARE
    grupo_predeterminado UUID;
BEGIN
    -- Solo para estudiantes nuevos
    IF NEW.role != 'student' THEN
        RETURN NEW;
    END IF;

    -- Buscar un grupo existente en la misma organización
    -- o usar el primero disponible
    SELECT id INTO grupo_predeterminado
    FROM groups
    WHERE organization_id = NEW.organization_id
    ORDER BY created_at ASC
    LIMIT 1;

    -- Si no hay grupo, crear uno por defecto
    IF grupo_predeterminado IS NULL THEN
        INSERT INTO groups (name, organization_id, description, created_at)
        VALUES (
            'Grupo General',
            NEW.organization_id,
            'Grupo predeterminado para estudiantes',
            NOW()
        )
        RETURNING id INTO grupo_predeterminado;
    END IF;

    -- Asignar el estudiante al grupo
        INSERT INTO group_members (group_id, profile_id, role)
    VALUES (grupo_predeterminado, NEW.id, 'student')
    ON CONFLICT (group_id, profile_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger
DROP TRIGGER IF EXISTS trg_asignar_estudiante_grupo ON public.profiles;
CREATE TRIGGER trg_asignar_estudiante_grupo
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION fn_asignar_estudiante_grupo();

SELECT '✅ Trigger de asignación automática creado' as status;

-- ============================================
-- NOTA: Para aplicar a estudiantes existentes:
-- ============================================
DO $$
DECLARE
    r RECORD;
    grupo_predeterminado UUID;
BEGIN
    FOR r IN SELECT id, organization_id FROM profiles WHERE role = 'student' LOOP
        -- Buscar grupo de la organización
        SELECT id INTO grupo_predeterminado
        FROM groups
        WHERE organization_id = r.organization_id
        ORDER BY created_at ASC
        LIMIT 1;

        -- Si no hay grupo, crear uno
        IF grupo_predeterminado IS NULL THEN
            INSERT INTO groups (name, organization_id, description, created_at)
            VALUES (
                'Grupo General',
                r.organization_id,
                'Grupo predeterminado',
                NOW()
            )
            RETURNING id INTO grupo_predeterminado;
        END IF;

        -- Asignar estudiante
        INSERT INTO group_members (group_id, profile_id, role)
        VALUES (grupo_predeterminado, r.id, 'student')
        ON CONFLICT (group_id, profile_id) DO NOTHING;
    END LOOP;
END $$;

SELECT '✅ Estudiantes existentes asignados a grupos' as status;
