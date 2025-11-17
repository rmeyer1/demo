# Database Migration Notes

## Initial Migration Applied

The initial migration `20251117021612_init` has been created and applied to the database.

## Manual Step Required

The `profiles` table needs a foreign key constraint to `auth.users` which Prisma cannot manage automatically. 

**To add the foreign key manually, run this SQL in your Supabase SQL editor:**

```sql
ALTER TABLE "profiles" 
ADD CONSTRAINT "profiles_id_fkey" 
FOREIGN KEY ("id") 
REFERENCES "auth"."users"("id") 
ON DELETE CASCADE;
```

## Migration Status

✅ All tables created:
- profiles
- tables
- seats
- hands
- player_hands
- hand_actions
- chat_messages

✅ All indexes created as specified in database-schema.md

✅ All foreign keys created (except auth.users FK which needs manual addition)

## Next Steps

1. Add the auth.users foreign key manually (see above)
2. Verify all tables and indexes exist
3. Test database connections from the backend

