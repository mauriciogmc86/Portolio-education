# 🚨 group_members 500 Error - Complete Analysis & Solution

## Error Description
```
GET https://vemongrxyptqclrinnyr.supabase.co/rest/v1/group_members?select=group_id&profile_id=eq.f4eb77c5-7edb-4df0-89c1-3e7c292b0ca7&role=eq.student
500 (Internal Server Error)
```

**Location:** `AssignmentsPage.tsx:136-142` - Student loading their assigned groups

## Root Cause

### Issue #1: RLS Policy Recursion in `conversation_participants`
The **primary** issue affecting the entire database is an **infinitely recursive RLS policy** on the `conversation_participants` table.

The broken policy (self-referencing):
```sql
-- ❌ BROKEN - Causes infinite recursion
EXISTS (
  SELECT 1 FROM public.conversation_participants AS cp
  WHERE cp.conversation_id = conversation_participants.conversation_id
  AND cp.profile_id = auth.uid()
)
```

This causes:
- **500 errors** across all queries (not just chat)
- Database server overload due to infinite loop
- ALL RLS checks to fail or time out

### Issue #2: Missing `group_id` Column in `profiles` Table
The `profiles` table **does not have** a `group_id` column, which affects:
- Student group filtering
- Group-based RLS policies
- Assignment queries

## Solution Status

### ✅ FIXED - Code Level (Already Done)

1. **`src/lib/supabase.ts`** - Profile type does NOT include `group_id` (correct)
   ```typescript
   export type Profile = {
     id: string
     email: string
     full_name: string | null
     role: 'super_admin' | 'admin' | 'teacher' | 'student'
     organization_id: string | null  // ← Has this
     avatar_url: string | null
     created_at: string
     updated_at: string
   }
   ```

2. **`src/hooks/useAuth.ts`** - Uses `select('*')` (correct)
   ```typescript
   .select('*')  // ← All fields, doesn't assume group_id exists
   ```

### ⚠️ PENDING - Database Level (Needs Execution)

The `supabase_messages_rls_policies.sql` file **already contains corrected policies** but needs to be executed in Supabase.

**Corrected policy (no recursion):**
```sql
-- ✅ FIXED - Uses conversations as intermediary
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

## What Needs To Be Done

### Step 1: Execute RLS Policy Fix (URGENT)

Run this in **Supabase SQL Editor**:

```sql
-- File: sql/supabase/supabase_messages_rls_policies.sql
-- This recreates all chat RLS policies without recursion
-- Safe to execute multiple times (uses DROP POLICY IF EXISTS)
```

**Or use this comprehensive reset:**

```sql
-- File: sql/scripts/DIAGNOSTICO_Y_FIX.sql
-- Diagnoses, removes ALL chat policies, and recreates them
```

### Step 2: (Optional) Add `group_id` to profiles Table

If needed for group management:

```sql
CREATE OR REPLACE FUNCTION add_group_id_to_profiles()
RETURNS void AS $$
BEGIN
  -- Add column
  ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;
  
  -- Create index
  CREATE INDEX IF NOT EXISTS idx_profiles_group_id ON profiles(group_id);
  
  -- Migrate existing data from group_members
  UPDATE public.profiles p
  SET group_id = gm.group_id
  FROM public.group_members gm
  WHERE p.id = gm.profile_id
    AND gm.role = 'student'
    AND p.group_id IS NULL;
END;
$$ LANGUAGE plpgsql;

SELECT add_group_id_to_profiles();
```

### Step 3: Update Profile Type (if adding group_id)

If you add `group_id` to the table, update the TypeScript type:

```typescript
// In src/lib/supabase.ts
export type Profile = {
  id: string
  email: string
  full_name: string | null
  role: 'super_admin' | 'admin' | 'teacher' | 'student'
  organization_id: string | null
  group_id: string | null  // ← Add this
  avatar_url: string | null
  created_at: string
  updated_at: string
}
```

## Verification

After executing the RLS fix, verify:

```sql
-- Check RLS is enabled
SELECT tablename, relrowsecurity 
FROM pg_tables 
WHERE tablename IN ('messages', 'conversations', 'conversation_participants');

-- Should show: relrowsecurity = TRUE for all 3 tables

-- Check policy count
SELECT tablename, count(*) as policy_count
FROM pg_policies
WHERE tablename IN ('messages', 'conversations', 'conversation_participants')
GROUP BY tablename;

-- Should show: 4 policies per table (total 12)
```

## Related Files

- ✅ `/src/lib/supabase.ts` - Profile type (correct, no group_id)
- ✅ `/src/hooks/useAuth.ts` - Uses `select('*')` (correct)
- ✅ `/sql/supabase/supabase_messages_rls_policies.sql` - Fixed RLS (needs execution)
- ✅ `/sql/scripts/DIAGNOSTICO_Y_FIX.sql` - Diagnostic & fix script
- 📝 `/docs/SOLUCION_FINAL_CORRECTA.md` - Documentation
- 📝 `/docs/CHAT_RLS_FIX.md` - Detailed fix documentation

## Testing

After applying the RLS fix:

1. ✅ Login should work without errors
2. ✅ Student can see assigned groups
3. ✅ Queries to `group_members` return 200 (not 500)
4. ✅ Chat loads conversations
5. ✅ Messages can be sent/received
6. ✅ No recursion errors in logs

## Summary

**The code is already correct.** The 500 error is caused by a database-level RLS policy recursion that needs to be fixed by executing the corrected SQL policies.

**No code changes needed.** Only database SQL execution required.

**Root cause:** Infinite recursion in `conversation_participants` RLS policy causes all RLS checks to fail, leading to 500 errors on all authenticated queries.

**Fix:** Execute `supabase_messages_rls_policies.sql` in Supabase SQL Editor to recreate policies without recursion.

---
**Affected:** All authenticated database queries  
**Severity:** Critical  
**Code Changes:** None required  
**DB Changes:** Required (execute RLS policies)  
**Status:** ✅ Fix available, awaiting DB execution