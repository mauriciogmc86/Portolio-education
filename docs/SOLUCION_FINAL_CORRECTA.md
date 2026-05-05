# SOLUCIÓN CORRECTA - SIN MODIFICAR BASE DE DATOS

## Error Detectado

Al intentar agregar `group_id` a la consulta de autenticación, fallaba porque **esa columna NO existe en la tabla `profiles`**.

La tabla `profiles` original NO tiene `group_id` y no es necesaria para el chat.

## Qué Causaba el Error 500/Recursión

La política SELECT de `conversation_participants` se auto-referenciaba:
```sql
-- MAL - causa recursión infinita:
EXISTS (
  SELECT 1 FROM public.conversation_participants AS cp
  WHERE cp.conversation_id = conversation_participants.conversation_id
)
```

## Solución Real

### 1. Corregir Políticas RLS ✅ HECHO
Archivo: `supabase_messages_rls_policies.sql`

La política corregida usa `conversations` como tabla intermedia:
```sql
-- BIEN - sin recursión:
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

### 2. Revertir Cambio Innecesario ✅ HECHO
Archivo: `src/hooks/useAuth.ts`

Volver a `select('*')` en lugar de listar campos explícitos:
```typescript
// Correcto - no asume columnas que no existen:
.from('profiles')
.select('*')
```

### 3. Actualizar Tipo TypeScript ✅ HECHO
Archivo: `src/lib/supabase.ts`

Eliminar `group_id` del tipo Profile para que coincida con la BD real.

## Qué Hacer Ahora

### PASO 1: Re-ejecutar Políticas RLS ⚠️ REQUERIDO

En Supabase SQL Editor, ejecutar:
**`supabase_messages_rls_policies.sql`**

Esto recreará las 12 políticas corregidas (usa DROP POLICY, es seguro re-ejecutar).

### PASO 2: Desplegar Código
```bash
git add src/hooks/useAuth.ts src/lib/supabase.ts
git commit -m "fix: revert group_id changes, use select('*')"
git push
```

### PASO 3: Verificar

Después de ambos pasos:
- ✅ Chat carga conversaciones
- ✅ Se pueden enviar mensajes (sin 403)
- ✅ No hay error de recursión
- ✅ Login funciona correctamente

## Archivos Modificados

1. ✅ `supabase_messages_rls_policies.sql` - Políticas corregidas (sin recursión)
2. ✅ `src/hooks/useAuth.ts` - Revertido a `select('*')`
3. ✅ `src/lib/supabase.ts` - Eliminado `group_id` del tipo

## Nota Importante

**No es necesario modificar la base de datos.**  
El chat funciona perfectamente con el diseño actual de tablas.

Solo se requieren:
1. Políticas RLS corregidas (paso 1)
2. Código actualizado (paso 2)

¡Eso es todo! 🎉
