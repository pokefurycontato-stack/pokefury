-- ============================================================
-- EVENT SYSTEM TABLES
-- ============================================================

-- Tracks active events and their state
CREATE TABLE IF NOT EXISTS game_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL,          -- 'alpha' or 'raid'
    status TEXT NOT NULL DEFAULT 'inactive',  -- 'inactive', 'active', 'ended'
    started_by UUID,                   -- admin who started it
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    config JSONB DEFAULT '{}',         -- event-specific config
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alpha event: per-player alpha encounters
CREATE TABLE IF NOT EXISTS alpha_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    character_id UUID NOT NULL,
    event_id UUID REFERENCES game_events(id),
    pokemon_id INTEGER NOT NULL,
    pokemon_name TEXT NOT NULL,
    pokemon_level INTEGER NOT NULL,
    defeated BOOLEAN DEFAULT false,
    reward_claimed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raid event: shared boss HP and player damage
CREATE TABLE IF NOT EXISTS raid_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES game_events(id),
    boss_pokemon_id INTEGER NOT NULL,
    boss_name TEXT NOT NULL,
    boss_level INTEGER NOT NULL DEFAULT 100,
    boss_max_hp BIGINT NOT NULL DEFAULT 50000,
    boss_current_hp BIGINT NOT NULL DEFAULT 50000,
    reward_claimed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raid damage log per player
CREATE TABLE IF NOT EXISTS raid_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    raid_id UUID REFERENCES raid_events(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    character_id UUID NOT NULL,
    character_name TEXT,
    total_damage BIGINT DEFAULT 0,
    attacks_count INTEGER DEFAULT 0,
    last_attack_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(raid_id, character_id)
);

-- Player event rewards tracking
CREATE TABLE IF NOT EXISTS event_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    character_id UUID NOT NULL,
    event_id UUID REFERENCES game_events(id),
    event_type TEXT NOT NULL,
    reward_type TEXT NOT NULL,         -- 'alpha_defeat', 'raid_participation', 'raid_ranking'
    reward_data JSONB DEFAULT '{}',
    claimed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alpha_events_user ON alpha_events(user_id, character_id);
CREATE INDEX IF NOT EXISTS idx_raid_participants_raid ON raid_participants(raid_id);
CREATE INDEX IF NOT EXISTS idx_event_rewards_user ON event_rewards(user_id, character_id);
CREATE INDEX IF NOT EXISTS idx_game_events_status ON game_events(status);

-- RLS
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alpha_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rewards ENABLE ROW LEVEL SECURITY;

-- Policies: everyone can read events, only admin can write
CREATE POLICY "events_select" ON game_events FOR SELECT USING (true);
CREATE POLICY "events_insert" ON game_events FOR INSERT WITH CHECK (true);
CREATE POLICY "events_update" ON game_events FOR UPDATE USING (true);

CREATE POLICY "alpha_select" ON alpha_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "alpha_insert" ON alpha_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alpha_update" ON alpha_events FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "raid_select" ON raid_events FOR SELECT USING (true);
CREATE POLICY "raid_insert" ON raid_events FOR INSERT WITH CHECK (true);
CREATE POLICY "raid_update" ON raid_events FOR UPDATE USING (true);

CREATE POLICY "raid_part_select" ON raid_participants FOR SELECT USING (true);
CREATE POLICY "raid_part_insert" ON raid_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "raid_part_update" ON raid_participants FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "rewards_select" ON event_rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "rewards_insert" ON event_rewards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rewards_update" ON event_rewards FOR UPDATE USING (auth.uid() = user_id);
