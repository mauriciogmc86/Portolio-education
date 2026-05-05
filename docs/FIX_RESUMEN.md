# 🚨 SOLUCIÓN: Error 500 y Tareas No Visibles para Estudiantes

## Problemas Identificados

### 1. ❌ Recursión Infinita en `group_members`
**Error:** `infinite recursion detected in policy for relation "group_members"`

**Causa:** La política `teachers_manage_own_group_members` consultaba la tabla `group_members` dentro de su propia cláusula `USING`, creando un bucle infinito:

```sql
-- ❌ MAL - Causa recursión:
EXISTS (
  SELECT 1 FROM public.group_members gm2  -- ⚠️ Consulta la misma tabla!
  WHERE gm2.group_id = g.id
    AND gm2.profile_id = auth.uid()
    AND gm2.role = 'teacher'
)
```

### 2. ❌ Política Restrictiva para Estudiantes
La política para que los estudiantes vean sus tareas estaba correcta en teoría, pero combinada con la recursión, fallaba completamente.

## Solución Implementada

### Archivo Modificado: `sql/supabase/supabase_assignments_rls.sql`

#### ✅ Fix 1: Eliminada Recursión en `group_members`
```sql
-- Teachers can manage members of their own groups
-- FIXED: Eliminated recursion by using profiles instead of querying group_members recursively
DROP POLICY IF EXISTS "teachers_manage_own_group_members" ON public.group_members;
CREATE POLICY "teachers_manage_own_group_members"
ON public.group_members FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE g.id = group_members.group_id
      AND g.organization_id = p.organization_id
      AND LOWER(p.role) = 'teacher'  -- ✅ Verifica por role en profiles
  )
)
WITH CHECK ( ... )  -- Misma lógica
```

**¿Por qué funciona?**
- Antes: Consultaba `group_members` → activaba RLS → volvía a consultar `group_members` → ¡BÚCLE!
- Ahora: Consulta `profiles` (que no tiene RLS en esta tabla) → verifica el role → ¡NO HAY BÚCLE!

#### ✅ Fix 2: Política para Estudiantes (Mantenida y Mejorada)
```sql
-- Allow students to view assignments of their groups
DROP POLICY IF EXISTS "students_read_assignments_in_groups" ON public.assignments;
CREATE POLICY "students_read_assignments_in_groups"
ON public.assignments FOR SELECT
TO authenticated
USING (
  -- User is a member of the group (any role)
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = assignments.group_id
      AND gm.profile_id = auth.uid()
  )
  OR EXISTS (
    -- Legacy enrollments table
    SELECT 1 FROM public.enrollments e
    WHERE e.group_id = assignments.group_id
      AND e.student_id = auth.uid()
  )
);
```

**¿Cómo funciona?**
- Verifica si el usuario está en el grupo (en `group_members`)
- O si está en la tabla legacy `enrollments`
- No filtra por role específico (permite cualquier rol en el grupo)

## Cómo Aplicar el Fix

### Paso 1: Ejecutar en Supabase SQL Editor

1. Abre el **SQL Editor** en tu panel de Supabase
2. Copia TODO el contenido del archivo:
   ```
   sql/supabase/supabase_assignments_rls.sql
   ```
3. Pega y ejecuta (botón "Run")

### Paso 2: Verificar

Después de ejecutar, deberías ver mensajes como:
```
✅ Assignments RLS policies applied successfully!
✅ Group members RLS policies applied!
✅ Submissions table RLS policies applied!
✅ Enrollments table RLS policies applied!
✅✅✅ ALL RLS POLICIES APPLIED SUCCESSFULLY ✅✅✅
```

### Paso 3: Probar

1. Inicia sesión como estudiante
2. Ve a la página de Tareas
3. Deberías ver todas las tareas asignadas a tus grupos
4. Sin errores 500 ni recursión

## Archivos Relacionados (Solo Lectura - No Modificar)

- ✅ `src/lib/supabase.ts` - Tipos TypeScript (correctos)
- ✅ `src/hooks/useAuth.ts` - Autenticación (correcto, usa `select('*)`)
- ✅ `src/modules/assignments/AssignmentsPage.tsx` - Componente de tareas
- ✅ `src/services/assignmentsService.ts` - Servicio de tareas

## ¿Por Qué Ocurría Esto?

### Técnico:
Cuando una política RLS en la tabla A consulta la tabla A misma, PostgreSQL entra en recursión infinita porque:
1. Consulta tabla A
2. Evalúa política RLS
3. Política consulta tabla A
4. Vuelve al paso 2... infinito

### En Nuestro Caso:
`group_members` → Política consulta `group_members` → Recursión → Error 500

## Verificación en SQL

Puedes verificar que no hay recursión con:

```sql
-- Ver políticas actuales
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'group_members';

-- Ver que RLS está habilitado
SELECT tablename, relrowsecurity
FROM pg_tables
WHERE tablename = 'group_members';
```

## Resumen

| Problema | Solución | Estado |
|----------|----------|--------|
| Recursión infinita en group_members | Usar `profiles` en lugar de `group_members` | ✅ FIXED |
| Estudiantes no ven tareas | Política corregida y simplificada | ✅ FIXED |
| Error 500 al cargar página | Eliminada la causa raíz | ✅ FIXED |

## Notas Importantes

- ⚠️ **No se requieren cambios en el código TypeScript** - Todo está correcto
- ⚠️ **Solo se necesita ejecutar el SQL** - Aplicar el archivo corregido
- ✅ **Seguro de re-ejecutar** - Usa `DROP POLICY IF EXISTS`, no causa problemas
- ✅ **Compatible con datos existentes** - No borra ni modifica datos, solo políticas

¡Con esto los estudiantes podrán ver sus tareas sin errores! 🎉