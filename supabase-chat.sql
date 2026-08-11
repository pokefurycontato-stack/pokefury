CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    channel TEXT NOT NULL DEFAULT 'global',
    user_id UUID REFERENCES auth.users(id),
    player_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chat" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert chat" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read last 100 messages" ON chat_messages
    FOR SELECT USING (true);

CREATE INDEX idx_chat_messages_created ON chat_messages (created_at DESC);
CREATE INDEX idx_chat_messages_channel ON chat_messages (channel, created_at DESC);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
