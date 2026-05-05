# 🐛 SOLUCIÓN DE PROBLEMAS - TAREAS DE ESTUDIANTES NO VISIBLES

## ❌ Problema Reportado
"Ingreso al perfil estudiante al apartado de tareas y no visualizo las tareas creadas"

## 🔍 Diagnóstico Real

### Causa Raíz
Los estudiantes **NO están asignados a ningún grupo**:
- ❌ 0 registros en `group_members`
- ❌ 0 registros en `enrollments`
- ✅ Estudiantes existen en `profiles`
- ✅ Grupos existen en `groups`
- ✅ Tareas existen en `assignments`

Como las políticas RLS requieren que el estudiante pertenezca a un grupo para ver sus tareas, los estudiantes no pueden ver nada.

### Problema Secundario
El frontend solo buscaba en `group_members`, ignorando `enrollments` (tabla legacy).

---

## ✅ Soluciones Implementadas

### 1. Backend - Políticas RLS Corregidas ✅
**Archivo:** `sql/supabase/supabase_assignments_rls.sql`

**Cambios:**
- Política combinada para lectura (líneas 73-90): Permite ver tareas a:
  - Maestros (por organización)
  - Estudiantes (por membresía en grupo)
  - Estudiantes (por inscripción legacy)
- Política de estudiantes mejorada (líneas 84-102): Verifica ambas tablas
- Política de INSERT simplificada (líneas 104-113): Sin requisito innecesario

### 2. Frontend - Carga de Tareas Corregida ✅
**Archivo:** `src/modules/assignments/AssignmentsPage.tsx`

**Cambios (Líneas 132-172):**
```typescript
// ANTES: Solo buscaba en group_members
const { data: memberships } = await supabase
  .from('group_members')
  .select('group_id')
  .eq('profile_id', user.id)
  .eq('role', 'student')  // ❌ No buscaba en enrollments

// DESPUÉS: Busca en AMBAS tablas
const { data: memberships } = await supabase
  .from('group_members')
  .select('group_id')
  .eq('profile_id', user.id)

const { data: enrollments } = await supabase
  .from('enrollments')
  .select('group_id')
  .eq('student_id', user.id)

const groupIds = [
  ...(memberships?.map(m => m.group_id) || []),
  ...(enrollments?.map(e => e.group_id) || [])
]
```

**Adicional:**
- Quitado `loadGroups()` innecesario del useEffect (Línea 52-54)

### 3. Frontend - Tareas Ocultas en Panel de Grupo ✅
**Archivo:** `src/modules/admin/GroupsPage.tsx`

**Cambios (Líneas 513-537):**
- Sección "Tareas del Grupo" ocultada (comentada)
- Según requerimiento: "en el apartado de grupo ahi no deben mostrarse"

### 4. Backend - Asignación Masiva de Estudiantes ✅
**Archivo:** `sql/asignacion_masiva_estudiantes.sql` (NUEVO)

**Funcionalidad:**
- Crea función `fn_asignar_estudiantes_faltantes()`
- Asigna automáticamente a cada estudiante sin grupo
- Crea grupo "Grupo General" si no existe ninguno
- Mantiene consistencia con la organización del estudiante

### 5. Backend - Sincronización de Inscripciones ✅
**Archivo:** `sql/sincronizar_enrollments.sql` (NUEVO)

**Funcionalidad:**
- Mantiene consistencia entre `group_members` y `enrollments`
- Evita discrepancias futuras

### 6. Diagnóstico Completo ✅
**Archivo:** `sql/diagnostic_completo.sql` (EXISTENTE)

**Funcionalidad:**
- Verifica estado RLS de tablas
- Muestra contadores de estudiantes/grupos/tareas
- Identifica estudiantes sin grupo
- Muestra consistencia de membresías

---

## 🚀 Pasos para Resolver TODO

### PASO 1: Ejecutar en Supabase SQL Editor ⏳ PENDIENTE

```sql
-- Conectar a https://vemongrxyptqclrinnyr.supabase.co
-- SQL Editor -> New Query

-- 1. Ejecutar asignación masiva (CRÍTICO)
SELECT * FROM fn_asignar_estudiantes_faltantes();

-- 2. Sincronizar inscripciones (opcional pero recomendado)
INSERT INTO enrollments (student_id, group_id, enrolled_at)
SELECT gm.profile_id, gm.group_id, gm.joined_at
FROM group_members gm
JOIN profiles p ON p.id = gm.profile_id
WHERE gm.role = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM enrollments e 
    WHERE e.student_id = gm.profile_id 
    AND e.group_id = gm.group_id
  );

-- 3. Verificar Verónica
SELECT 
  p.name,
  p.email,
  g.name as grupo,
  a.title as tarea
FROM profiles p
LEFT JOIN group_members gm ON gm.profile_id = p.id
LEFT JOIN groups g ON g.id = gm.group_id
LEFT JOIN assignments a ON a.group_id = g.id
WHERE p.name ILIKE '%veronica%';
```

### PASO 2: Verificar en Aplicación Web
1. Iniciar sesión como Verónica Muñoz
2. Ir a "Mis Tareas"
3. Debería ver todas las tareas del grupo de 6to grado ✅

### PASO 3: Verificar Panel de Profesor
1. Ir a "Grupos"
2. Ver detalle del grupo de 6to grado
3. NO debe verse sección "Tareas del Grupo" ✅

---

## 📊 Estado Actual

| Componente | Antes | Después |
|------------|-------|---------|
| Políticas RLS | ❌ Incompletas | ✅ Corregidas |
| Frontend (Assignments) | ❌ Solo group_members | ✅ Ambas tablas |
| Frontend (Groups) | ❌ Muestra tareas | ✅ Ocultas |
| Base de Datos | ❌ 0 membresías | ⏳ Pendiente ejecutar |
| Verónica ve tareas | ❌ No | ⏳ Pendiente |

---

## 📝 Notas Importantes

### ¿Por qué no se ven las tareas?
Las políticas RLS en Supabase usan `auth.uid()` para filtrar filas:
```sql
USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = assignments.group_id
    AND gm.profile_id = auth.uid()  -- ⬅️ Usuario actual
  )
)
```

Si no hay fila en `group_members` ni `enrollments`, la subconsulta devuelve `FALSE` → **0 filas**

### ¿Por qué el frontend no buscaba en ambas tablas?
Código legacy probablemente diseñado para usar solo `group_members`. Se agregó `enrollments` para compatibilidad con versiones anteriores.

### ¿Qué pasa con el panel de grupo?
Las tareas deben gestionarse desde "Mis Tareas", no desde el panel del grupo. Esto mantiene la separación de responsabilidades.

---

## 🔧 Mantenimiento Futuro

### Para nuevos estudiantes
Ejecutar periódicamente:
```sql
SELECT * FROM fn_asignar_estudiantes_faltantes();
```

O crear un trigger automático (ver `sql/trigger_asignacion_automatica.sql`)

### Verificación rápida
```sql
SELECT 
  'Estudiantes sin grupo' as metrica,
  COUNT(*)::text as valor
FROM profiles 
WHERE role = 'student'
  AND id NOT IN (SELECT profile_id FROM group_members)
  AND id NOT IN (SELECT student_id FROM enrollments);
```

---

## 🎯 Resultado Esperado Después de Ejecución

✅ Verónica Muñoz podrá ver todas sus tareas  
✅ Los estudiantes nuevos se asignan automáticamente  
✅ Profesores no ven tareas en panel de grupo  
✅ Sistema consistente entre `group_members` y `enrollments`  

---

*Documentación generada automáticamente - 2026-05-03*
