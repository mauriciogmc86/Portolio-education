# 🚀 INSTRUCCIONES DE EJECUCIÓN PARA ARREGLAR TAREAS DE ESTUDIANTES

## Problema Detectado
Los estudiantes no ven sus tareas porque NO están asignados a ningún grupo.
No existen registros en `group_members` ni en `enrollments`.

## Solución en 3 Pasos

### PASO 1: Ejecutar verificación (Opcional)
1. Abrir **Supabase SQL Editor**
2. Pegar y ejecutar el contenido de: `sql/diagnostic_completo.sql`
3. Confirmar que muestra: "No hay membresías"

### PASO 2: ASIGNAR ESTUDIANTES A GRUPOS (CRÍTICO)
1. Abrir **Supabase SQL Editor**  
2. Pegar TODO el contenido de: `sql/asignacion_masiva_estudiantes.sql`
3. Ejecutar (F5 o botón Run)
4. Esto creará la función y asignará automáticamente a TODOS los estudiantes
5. Debería mostrar resultados como:
   ```
   estudiante_id | estudiante_nombre | grupo_id | grupo_nombre | estado
   ---------------+-------------------+----------+---------------+----------
   xxx-xxx-xxx    | Verónica Muñoz    | yyy-yyy  | 6to Grado     | ASIGNADO
   ```

### PASO 3: SINCRONIZAR INSCRIPCIONES (Recomendado)
1. En el mismo SQL Editor (nueva pestaña)
2. Pegar TODO el contenido de: `sql/sincronizar_enrollments.sql`
3. Ejecutar
4. Esto mantiene consistencia entre `group_members` y `enrollments`

### PASO 4: Verificar que Verónica vea tareas
1. Ir a la aplicación web
2. Iniciar sesión como Verónica Muñoz
3. Ir a "Mis Tareas"
4. **Debería ver:** Todas las tareas del grupo de 6to grado

## Archivos Modificados (Frontend)

### ✅ `src/modules/assignments/AssignmentsPage.tsx`
- **Líneas 132-162**: Ahora busca en AMBAS tablas (`group_members` Y `enrollments`)
- **Línea 52-54**: Quitada carga innecesaria de `loadGroups()`

### ✅ `src/modules/admin/GroupsPage.tsx`
- **Líneas 513-537**: Oculta sección de "Tareas del Grupo" (no deben mostrarse)

## Archivos Nuevos (SQL)

### `sql/asignacion_masiva_estudiantes.sql`
- Crea función PL/pgSQL para asignar estudiantes automáticamente
- Asigna cada estudiante a un grupo de su organización
- Crea grupo "Grupo General" si no existe ninguno

### `sql/sincronizar_enrollments.sql`
- Mantiene consistencia entre `group_members` y `enrollments`

## Notas Importantes

### Sobre la Política RLS
La política en `sql/supabase/supabase_assignments_rls.sql` ya está configurada
para permitir que los estudiantes vean tareas de sus grupos. No necesita cambios.

### Si algún estudiante sigue sin ver tareas
Ejecutar esta consulta en SQL Editor para verificar:

```sql
SELECT 
  p.name,
  p.email,
  gm.group_id,
  g.name as grupo_nombre,
  a.id as tarea_id,
  a.title as tarea_titulo
FROM profiles p
LEFT JOIN group_members gm ON gm.profile_id = p.id
LEFT JOIN groups g ON g.id = gm.group_id
LEFT JOIN assignments a ON a.group_id = g.id
WHERE p.role = 'student'
  AND p.name ILIKE '%nombre%';
```

### Si hay muchos estudiantes sin grupo
El script `asignacion_masiva_estudiantes.sql` crea la función `fn_asignar_estudiantes_faltantes()`
que se puede ejecutar en cualquier momento:

```sql
SELECT * FROM fn_asignar_estudiantes_faltantes();
```

## Resumen del Problema Original

| Componente | Problema | Solución |
|------------|----------|----------|
| Frontend (AssignmentsPage) | Solo buscaba en `group_members` | Busca en AMBAS tablas |
| Frontend (GroupsPage) | Mostraba tareas en panel grupo | Sección ocultada |
| Base de Datos | Sin membresías (0 registros) | Script de asignación masiva |
| RLS Policies | Correctas | Sin cambios necesarios |

