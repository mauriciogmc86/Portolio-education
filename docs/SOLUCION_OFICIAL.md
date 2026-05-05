# SOLUCIÓN FINAL Y CORRECTA - Chat Roto

## 🚨 Problema

El chat muestra pantalla en blanco con error 500:
```
infinite recursion detected in policy for relation "conversation_participants"
```

## 🎯 Causa Real

La política RLS SELECT de `conversation_participants` estaba mal escrita:
- Se auto-referenciaba creando bucle infinito
- La tabla `profiles` NO tiene columna `group_id`
- El código intentaba seleccionar campos que no existen

## ✅ SOLUCIÓN (2 Pasos)

### Paso 1: Ejecutar en Supabase SQL Editor ⚠️ **OBLIGATORIO**

```sql
-- Archivo: supabase_messages_rls_policies.sql
-- Copiar y ejecutar completo
```

**Qué hace:**
- Elimina la política recursiva
- Crea política correcta usando `conversations` como tabla intermedia
- Crea 11 políticas más (SELECT, INSERT, UPDATE, DELETE)
- Solo afecta tablas de chat (no altera otras tablas)

**Tiempo:** 30 segundos  
**Resultado:** Las políticas RLS quedarán activas y correctas

### Paso 2: Desplegar Código ✅ **LISTO PARA PUSH**

```bash
git add src/hooks/useAuth.ts src/lib/supabase.ts
git commit -m "fix: correct RLS policies, revert group_id changes"
git push
```

**Qué cambia:**
- `useAuth.ts`: Vuelve a `select('*')` (no lista campos explícitos)
- `supabase.ts`: Elimina `group_id` del tipo Profile
- El chat funciona sin modificar la BD

## 📊 Verificación

Después de ejecutar el Paso 1:

```sql
-- Verificar políticas (deberían mostrarse 12)
SELECT policyname, cmd
FROM pg_policies
WHERE tablename IN ('messages', 'conversations', 'conversation_participants');
```

## 🔍 ¿Por qué Funciona?

**Antes (Roto):**
```sql
-- Se auto-referencia → Bucle infinito
EXISTS (
  SELECT 1 FROM conversation_participants cp
  WHERE cp.conversation_id = conversation_participants.conversation_id
)
```

**Después (Funcionando):**
```sql
-- Usa conversations como intermediaria → Sin recursión
EXISTS (
  SELECT 1 FROM conversations c
  WHERE c.id = conversation_participants.conversation_id
  AND EXISTS (
    SELECT 1 FROM conversation_participants cp2
    WHERE cp2.conversation_id = c.id
    AND cp2.profile_id = auth.uid()
  )
)
```

## ✅ Estado Actual

- ✅ `supabase_messages_rls_policies.sql` - Listo para ejecutar
- ✅ `src/hooks/useAuth.ts` - Corregido a `select('*')`
- ✅ `src/lib/supabase.ts` - Sin `group_id` en Profile
- ⚠️ **PENDIENTE:** Ejecutar SQL en Supabase
- ⏳ **PENDIENTE:** Desplegar código (git push)

## 🎯 Resultado Esperado

Después de ambos pasos:
1. ✅ Login funciona sin errores
2. ✅ Chat muestra conversaciones
3. ✅ Se pueden enviar/recibir mensajes
4. ✅ Sin errores 500 ni 403
5. ✅ Contador de no leídos funciona

## 📝 Notas Importantes

- **NO** es necesario modificar la BD (tabla `profiles` está bien)
- **NO** es necesario agregar columnas
- **SÍ** es necesario ejecutar el SQL corregido
- **SÍ** es necesario desplegar el código corregido

## 🚀 ¡A EJECUTAR!

**Ejecutar en Supabase SQL Editor:**
```
supabase_messages_rls_policies.sql
```

**Desplegar:**
```bash
git push
```

¡El chat volverá a funcionar! 🎉
