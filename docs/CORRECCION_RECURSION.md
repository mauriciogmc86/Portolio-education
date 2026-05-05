# 🚨 CORRECCIÓN URGENTE - Error de Recursión Infinita

## Problema Detectado

Error 42P17: `infinite recursion detected in policy for relation "conversation_participants"`

**Causa:** La política SELECT de `conversation_participants` se auto-referenciaba, creando un bucle infinito:
```sql
-- INCORRECTO (causa recursión):
EXISTS (
  SELECT 1 FROM public.conversation_participants AS cp
  WHERE cp.conversation_id = conversation_participants.conversation_id
  AND cp.profile_id = auth.uid()
)
```

## Solución Aplicada ✅

**Archivo:** `supabase_messages_rls_policies.sql` (líneas 144-160 actualizadas)

La política corregida usa `conversations` como tabla intermedia para evitar la recursión:
```sql
-- CORREGIDO (sin recursión):
EXISTS (
  SELECT 1 FROM public.conversations c
  WHERE c.id = conversation_participants.conversation_id
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants cp2
    WHERE cp2.conversation_id = c.id
    AND cp2.profile_id = auth.uid()
  )
)
```

## Qué Hacer Ahora

### Paso 1: Re-ejecutar SQL Corregido ⚠️ REQUERIDO

En Supabase SQL Editor, ejecuta nuevamente el contenido de:
**`supabase_messages_rls_policies.sql`**

Esto recreará las políticas corregidas (usa `DROP POLICY IF EXISTS`, por lo que es seguro re-ejecutar).

### Paso 2: Verificar ✅

Después de re-ejecutar:
- [ ] El chat carga conversaciones
- [ ] Aparecen los usuarios
- [ ] No hay errores 42P17 en consola
- [ ] El menú lateral muestra mensajes no leídos

### Paso 3: Completar instalación ⏳

Aún pendientes:
1. ✓ Políticas RLS corregidas - RE-EJECUTAR
2. ⚠️ Columna `group_id` - EJECUTAR `add_group_id_to_profiles.sql`
3. ⏳ Código `useAuth.ts` - DESPLEGAR con `git push`

## Verificación Rápida

```sql
-- Deberías ver la política corregida
SELECT policyname, qual
FROM pg_policies
WHERE tablename = 'conversation_participants'
  AND policyname = 'users_read_conversation_participants';
```

---

**¡EJECUTAR `supabase_messages_rls_policies.sql` CORREGIDO PARA ARREGLAR EL CHAT!** 🚀
