# FIX DEPLOYMENT CHECKLIST

## Issue: Chat Messaging 403 Error
```
POST /rest/v1/messages 403 (Forbidden)
{"code": "42501", "message": "new row violates row-level security policy for table \"messages\""}
```

## Root Causes Identified

### 1. Missing RLS Policies (CRITICAL)
- Tables: `messages`, `conversations`, `conversation_participants`
- RLS is enabled but no INSERT/UPDATE/DELETE/SELECT policies exist
- Result: All database operations blocked with 403 error

### 2. Missing Field in Auth Query (HIGH)
- File: `src/hooks/useAuth.ts`
- Missing field: `group_id` in Profile SELECT query
- The Profile type includes `group_id` but it's not fetched
- Added: Line 25

## Files to Deploy

### Required (Fixes the 403)
1. ✅ `supabase_messages_rls_policies.sql` - Run in Supabase SQL Editor
2. ✅ `src/hooks/useAuth.ts` - Deploy with code (already fixed)

### Recommended (Best Practice)
3. `supabase_all_rls_policies.sql` - Complete RLS for all tables
4. `VERIFY_RLS_POLICIES.sql` - Verification queries

## Deployment Steps

### Database (Supabase SQL Editor)
```sql
-- Step 1: Apply RLS policies
-- Open supabase_messages_rls_policies.sql and execute

-- Step 2: Verify
-- Open VERIFY_RLS_POLICIES.sql and execute
```

### Application Code
```bash
# Commit and deploy
 git add src/hooks/useAuth.ts
 git commit -m "fix: add group_id to auth profile query"
 git push
```

## Verification

After applying RLS policies, verify:
- [ ] Messages table: RLS enabled, 4 policies (SELECT, INSERT, UPDATE, DELETE)
- [ ] Conversations table: RLS enabled, 4 policies
- [ ] Conversation participants table: RLS enabled, 4 policies
- [ ] User can send message without 403 error
- [ ] User can see conversation list
- [ ] Messages appear in real-time

After deploying code fix:
- [ ] Profile loads with `group_id` field (can be null)
- [ ] No console errors
- [ ] Auth state is correct

## What Was Fixed

### Database (supabase_messages_rls_policies.sql)
- ✅ Messages: Users can INSERT messages into conversations they participate in
- ✅ Messages: Users can SELECT messages from their conversations
- ✅ Messages: Users can UPDATE/DELETE their own messages
- ✅ Conversations: Users can CREATE/READ/UPDATE/DELETE conversations
- ✅ Participants: Users can manage conversation participants

### Application (src/hooks/useAuth.ts)
- ✅ Added `group_id` to Profile SELECT query
- ✅ Better error handling (already in modified version)
- ✅ Status code 406 handling for missing profiles

## Testing

Test the chat feature end-to-end:
1. Navigate to /chat
2. Select a user to chat with
3. Type and send a message
4. Verify no 403 error
5. Verify message appears
6. Have another user reply
7. Verify real-time updates

## Rollback

If issues occur:
- RLS policies are idempotent (safe to re-run)
- Auth query change is backward compatible
- Can revert git commit if needed

## Impact

- **Severity:** Critical (feature was completely broken)
- **Users Affected:** All chat users
- **Fix Time:** Immediate upon database deployment
- **Risk:** Low (well-tested patterns, idempotent)

## Support Files Created

| File | Lines | Purpose |
|------|-------|----------|
| supabase_messages_rls_policies.sql | 189 | Main RLS fix |
| supabase_all_rls_policies.sql | 337 | Complete RLS |
| VERIFY_RLS_POLICIES.sql | 89 | Verification |
| CHAT_RLS_FIX.md | 65 | Documentation |
| FIX_SUMMARY.md | 96 | Summary |
| CRITICAL_FIX_SUMMARY.md | 135 | Quick reference |
| RLS_POLICIES_README.md | 229 | Complete guide |
| IMPLEMENTATION_COMPLETE.md | 183 | Status report |

**Total:** 1,412 lines of fixes and documentation

---
**Status:** ✅ Ready for Deployment
**Date:** 2026-05-03
"