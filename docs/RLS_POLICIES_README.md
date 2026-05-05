# Supabase RLS Policies Documentation

## Overview
This directory contains all Row-Level Security (RLS) policies for the LMS application's Supabase database.

## Files Description

### Core RLS Policy Files

1. **supabase_all_rls_policies.sql** ⭐ RECOMMENDED
   - Complete RLS policies for ALL tables
   - Includes: profiles, groups, programs, courses, messages, conversations, conversation_participants
   - Run this file for a complete setup
   - **Use this if you want to apply all policies at once**

2. **supabase_messages_rls_policies.sql** ⚠️ CRITICAL FIX
   - RLS policies specifically for chat/messaging tables
   - Fixes the 403 Forbidden error when sending messages
   - Tables covered: messages, conversations, conversation_participants
   - **Apply this immediately to fix the chat bug**

3. **supabase_rls_complete.sql**
   - RLS policies for: profiles, groups, programs
   - Does NOT include chat/messaging tables
   - Legacy file - use supabase_all_rls_policies.sql instead

4. **supabase_rls_policies.sql**
   - RLS policies for: profiles, groups, programs, courses
   - Does NOT include chat/messaging tables
   - Legacy file - use supabase_all_rls_policies.sql instead

5. **supabase_rls_select_policies.sql**
   - SELECT-only policies for: profiles, groups
   - Legacy file - use supabase_all_rls_policies.sql instead

### Program Management Files

6. **supabase_programs_rpc.sql**
   - RPC functions for program management
   - Functions: create_program_with_relations, update_program_with_relations, rpc_get_program_members
   - Creates program_teachers and program_students tables

7. **supabase_programs_relations.sql**
   - Creates program_teachers and program_students tables
   - Run before supabase_programs_rpc.sql

### Migration Files

8. **supabase_complete_rls_migration.sql**
   - Creates courses table with RLS policies
   - Includes profiles, groups, programs policies
   - Legacy migration file

9. **supabase_migrations_rls_profiles.sql**
   - Profile-related RLS policies
   - Legacy migration file

### Documentation Files

10. **CHAT_RLS_FIX.md**
    - Detailed documentation of the chat messaging RLS fix
    - Explains the problem and solution
    - Step-by-step application instructions

11. **FIX_SUMMARY.md**
    - Summary of the chat messaging fix
    - Quick reference for what was changed
    - Verification checklist

12. **VERIFY_RLS_POLICIES.sql**
    - SQL queries to verify RLS policies are correctly applied
    - Check if RLS is enabled on tables
    - List all policies
    - Simple functionality tests

## Quick Start

### Option 1: Apply All Policies (Recommended)
```bash
# In Supabase SQL Editor, run:
# supabase_all_rls_policies.sql
```

This will:
- Create all helper functions
- Enable RLS on all tables
- Create all necessary policies for full application functionality
- Include chat/messaging policies (fixes the 403 error)

### Option 2: Apply Critical Fix Only
```bash
# In Supabase SQL Editor, run:
# supabase_messages_rls_policies.sql
```

This will:
- Fix the immediate 403 error when sending messages
- Enable RLS on messages, conversations, conversation_participants
- Create all necessary chat policies

### Option 3: Apply Programs Setup
```bash
# In Supabase SQL Editor, run in this order:
1. supabase_programs_relations.sql
2. supabase_programs_rpc.sql
```

This will:
- Create program_teachers and program_students tables
- Create RPC functions for program management

## Verification

After applying policies, run:

```bash
# In Supabase SQL Editor:
\i VERIFY_RLS_POLICIES.sql
```

Or copy the queries from the file to check:
- RLS is enabled on all tables
- All policies are created
- Helper functions exist

## Testing the Fix

After applying `supabase_messages_rls_policies.sql`:

1. **Start a chat**
   - Navigate to the chat page
   - Select a user to chat with
   - Verify conversation is created

2. **Send a message**
   - Type a message and press Enter
   - Verify message is sent (no 403 error)
   - Verify message appears in the chat

3. **Receive messages**
   - Have another user send a message
   - Verify it appears in real-time

4. **Check conversation list**
   - Verify conversations appear in the sidebar
   - Verify last message timestamps are correct

## RLS Policy Summary

### Messages Table
| Operation | Policy | Description |
|-----------|--------|-------------|
| SELECT | users_read_messages_in_conversations | Read messages from conversations user participates in |
| INSERT | users_insert_messages_in_conversations | Insert messages into conversations user participates in |
| UPDATE | users_update_own_messages | Update own messages |
| DELETE | users_delete_own_messages | Delete own messages |

### Conversations Table
| Operation | Policy | Description |
|-----------|--------|-------------|
| SELECT | users_read_conversations | Read conversations user participates in |
| INSERT | users_create_conversations | Create new conversations |
| UPDATE | users_update_conversations | Update conversations user participates in |
| DELETE | users_delete_conversations | Delete conversations user participates in |

### Conversation Participants Table
| Operation | Policy | Description |
|-----------|--------|-------------|
| SELECT | users_read_conversation_participants | Read participants of user's conversations |
| INSERT | users_insert_conversation_participants | Add participants to conversations |
| UPDATE | users_update_conversation_participants | Update own participant record |
| DELETE | users_delete_conversation_participants | Remove self from conversations |

## Troubleshooting

### Error: "new row violates row-level security policy"
**Solution:** Run `supabase_messages_rls_policies.sql` in the SQL Editor

### Error: "function get_user_org_id() does not exist"
**Solution:** The helper functions are created automatically by the policy files. Re-run the SQL file.

### Error: "relation \"messages\" does not exist"
**Solution:** The messages table needs to be created first. Check your database schema or migrations.

### Messages not appearing for other users
**Solution:** Verify both users are in the conversation_participants table for that conversation.

## Security Notes

- All policies use `auth.uid()` to identify the current user
- INSERT policies use `WITH CHECK` to validate data
- Helper functions are `SECURITY DEFINER` for consistent permissions
- Policies are idempotent (safe to run multiple times)
- No application code changes required

## Maintenance

### Adding New Policies
1. Create policy in appropriate SQL file
2. Test in development environment
3. Update documentation
4. Deploy to production

### Modifying Existing Policies
1. Use `DROP POLICY IF EXISTS` before `CREATE POLICY`
2. Test thoroughly before deploying
3. Verify with VERIFY_RLS_POLICIES.sql

## Support

For issues or questions:
1. Check VERIFY_RLS_POLICIES.sql output
2. Review CHAT_RLS_FIX.md for common issues
3. Check Supabase logs for RLS violations
4. Verify helper functions exist

## File History

| File | Created | Last Updated | Purpose |
|------|---------|--------------|---------|
| supabase_all_rls_policies.sql | 2026-05-03 | 2026-05-03 | Complete RLS policies for all tables |
| supabase_messages_rls_policies.sql | 2026-05-03 | 2026-05-03 | Fix for chat 403 error |
| supabase_programs_rpc.sql | 2026-05-03 | 2026-05-03 | Program management RPC |
| supabase_programs_relations.sql | 2026-05-03 | 2026-05-03 | Program relation tables |
| supabase_rls_complete.sql | 2026-04-23 | 2026-04-23 | Legacy: profiles, groups, programs |
| supabase_rls_policies.sql | 2026-04-23 | 2026-04-23 | Legacy: profiles, groups, programs, courses |
| CHAT_RLS_FIX.md | 2026-05-03 | 2026-05-03 | Chat fix documentation |
| FIX_SUMMARY.md | 2026-05-03 | 2026-05-03 | Fix summary |
| VERIFY_RLS_POLICIES.sql | 2026-05-03 | 2026-05-03 | Verification queries |
