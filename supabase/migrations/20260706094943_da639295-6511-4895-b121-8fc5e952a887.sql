
-- Restrict realtime.messages so authenticated users can only read/write topics scoped to their own auth.uid()
DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can write realtime messages" ON realtime.messages;

CREATE POLICY "Users can read own-scoped realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
  OR realtime.topic() LIKE '%:' || auth.uid()::text
  OR realtime.topic() = 'user:' || auth.uid()::text
);

CREATE POLICY "Users can send own-scoped realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
  OR realtime.topic() LIKE '%:' || auth.uid()::text
  OR realtime.topic() = 'user:' || auth.uid()::text
);
