-- POKEFURY FARM SYSTEM - Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS farm_data (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    level INT NOT NULL DEFAULT 1,
    xp INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_plantations (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plot_index INT NOT NULL CHECK (plot_index >= 0 AND plot_index < 12),
    color TEXT NOT NULL DEFAULT '',
    planted_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'empty' CHECK (status IN ('empty', 'growing', 'ready')),
    PRIMARY KEY (user_id, plot_index)
);

CREATE TABLE IF NOT EXISTS farm_harvest_tiers (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    color TEXT NOT NULL,
    harvest_count INT NOT NULL DEFAULT 0,
    tier INT NOT NULL DEFAULT 1 CHECK (tier >= 1 AND tier <= 3),
    PRIMARY KEY (user_id, color)
);

CREATE TABLE IF NOT EXISTS farm_inventory (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    color TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    PRIMARY KEY (user_id, color)
);

CREATE TABLE IF NOT EXISTS city_farm_plots (
    id SERIAL PRIMARY KEY,
    plot_index INT NOT NULL UNIQUE CHECK (plot_index >= 0 AND plot_index < 12),
    pos_x NUMERIC NOT NULL DEFAULT 0,
    pos_y NUMERIC NOT NULL DEFAULT 0,
    scale NUMERIC NOT NULL DEFAULT 1.0,
    color TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS city_farm_npcs (
    id SERIAL PRIMARY KEY,
    npc_role TEXT NOT NULL CHECK (npc_role IN ('city', 'farm')),
    pos_x NUMERIC NOT NULL DEFAULT 0,
    pos_y NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_farm_plantations_ready ON farm_plantations(ready_at) WHERE status = 'growing';

-- RPC: init_farm
CREATE OR REPLACE FUNCTION init_farm()
RETURNS JSON AS 
DECLARE
    uid UUID := auth.uid();
    existing INT;
BEGIN
    SELECT COUNT(*) INTO existing FROM farm_data WHERE user_id = uid;
    IF existing = 0 THEN
        INSERT INTO farm_data (user_id, level, xp) VALUES (uid, 1, 0);
        FOR i IN 0..11 LOOP
            INSERT INTO farm_plantations (user_id, plot_index, color, status)
            VALUES (uid, i, '', 'empty');
        END LOOP;
        INSERT INTO farm_harvest_tiers (user_id, color, harvest_count, tier) VALUES
            (uid, 'vermelha', 0, 1), (uid, 'branca', 0, 1), (uid, 'verde', 0, 1),
            (uid, 'azul', 0, 1), (uid, 'preta', 0, 1), (uid, 'marrom', 0, 1),
            (uid, 'rosa', 0, 1), (uid, 'laranja', 0, 1), (uid, 'roxa', 0, 1),
            (uid, 'ciano', 0, 1), (uid, 'cinza', 0, 1), (uid, 'amarela', 0, 1);
    END IF;
    RETURN json_build_object('ok', true);
END;
 LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get_farm_data
CREATE OR REPLACE FUNCTION get_farm_data()
RETURNS JSON AS 
DECLARE
    uid UUID := auth.uid();
    result JSON;
BEGIN
    SELECT json_build_object(
        'farm', (SELECT row_to_json(fd) FROM farm_data fd WHERE fd.user_id = uid),
        'plots', (SELECT json_agg(row_to_json(fp) ORDER BY fp.plot_index) FROM farm_plantations fp WHERE fp.user_id = uid),
        'tiers', (SELECT json_agg(row_to_json(fht)) FROM farm_harvest_tiers fht WHERE fht.user_id = uid),
        'inventory', (SELECT json_agg(row_to_json(fi)) FROM farm_inventory fi WHERE fi.user_id = uid AND fi.quantity > 0)
    ) INTO result;
    RETURN result;
END;
 LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: plant_berry
CREATE OR REPLACE FUNCTION plant_berry(p_plot_index INT, p_color TEXT)
RETURNS JSON AS 
DECLARE
    uid UUID := auth.uid();
    farm_rec RECORD;
    plot_rec RECORD;
    grow_time_mins INT;
    unlocked BOOLEAN := FALSE;
BEGIN
    SELECT * INTO farm_rec FROM farm_data WHERE user_id = uid;
    IF farm_rec IS NULL THEN
        RETURN json_build_object('error', 'Farm not initialized');
    END IF;
    SELECT * INTO plot_rec FROM farm_plantations WHERE user_id = uid AND plot_index = p_plot_index;
    IF plot_rec IS NULL OR plot_rec.status != 'empty' THEN
        RETURN json_build_object('error', 'Plot not available');
    END IF;
    CASE p_color
        WHEN 'vermelha', 'branca', 'verde' THEN unlocked := farm_rec.level >= 1;
        WHEN 'azul', 'preta' THEN unlocked := farm_rec.level >= 2;
        WHEN 'marrom', 'rosa' THEN unlocked := farm_rec.level >= 3;
        WHEN 'laranja', 'roxa' THEN unlocked := farm_rec.level >= 4;
        WHEN 'ciano', 'cinza' THEN unlocked := farm_rec.level >= 5;
        WHEN 'amarela' THEN unlocked := farm_rec.level >= 6;
        ELSE unlocked := FALSE;
    END CASE;
    IF NOT unlocked THEN
        RETURN json_build_object('error', 'Color locked');
    END IF;
    CASE p_color
        WHEN 'branca' THEN grow_time_mins := 3;
        WHEN 'vermelha', 'verde' THEN grow_time_mins := 5;
        ELSE grow_time_mins := 10;
    END CASE;
    UPDATE farm_plantations
    SET color = p_color, status = 'growing', planted_at = now(),
        ready_at = now() + (grow_time_mins || ' minutes')::interval
    WHERE user_id = uid AND plot_index = p_plot_index;
    RETURN json_build_object('ok', true, 'ready_at', (now() + (grow_time_mins || ' minutes')::interval));
END;
 LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: harvest_berry
CREATE OR REPLACE FUNCTION harvest_berry(p_plot_index INT)
RETURNS JSON AS 
DECLARE
    uid UUID := auth.uid();
    plot_rec RECORD;
    tier_rec RECORD;
    harvest_amount INT := 1;
    xp_gain INT := 5;
    new_tier INT;
    new_level INT;
BEGIN
    SELECT * INTO plot_rec FROM farm_plantations WHERE user_id = uid AND plot_index = p_plot_index;
    IF plot_rec IS NULL OR plot_rec.status != 'ready' THEN
        RETURN json_build_object('error', 'Nothing to harvest');
    END IF;
    SELECT * INTO tier_rec FROM farm_harvest_tiers WHERE user_id = uid AND color = plot_rec.color;
    IF tier_rec IS NULL THEN
        INSERT INTO farm_harvest_tiers (user_id, color, harvest_count, tier)
        VALUES (uid, plot_rec.color, 0, 1)
        ON CONFLICT DO NOTHING;
        SELECT * INTO tier_rec FROM farm_harvest_tiers WHERE user_id = uid AND color = plot_rec.color;
    END IF;
    CASE tier_rec.tier
        WHEN 2 THEN harvest_amount := 5;
        WHEN 3 THEN harvest_amount := 10;
        ELSE harvest_amount := 1;
    END CASE;
    CASE plot_rec.color
        WHEN 'branca' THEN xp_gain := 3;
        WHEN 'vermelha', 'verde' THEN xp_gain := 5;
        WHEN 'amarela' THEN xp_gain := 12;
        ELSE xp_gain := 8;
    END CASE;
    xp_gain := xp_gain * harvest_amount;
    INSERT INTO farm_inventory (user_id, color, quantity) VALUES (uid, plot_rec.color, harvest_amount)
    ON CONFLICT (user_id, color) DO UPDATE SET quantity = farm_inventory.quantity + harvest_amount;
    UPDATE farm_harvest_tiers SET harvest_count = harvest_count + 1 WHERE user_id = uid AND color = plot_rec.color;
    SELECT CASE WHEN harvest_count >= 100 THEN 3 WHEN harvest_count >= 30 THEN 2 ELSE 1 END INTO new_tier
    FROM farm_harvest_tiers WHERE user_id = uid AND color = plot_rec.color;
    UPDATE farm_harvest_tiers SET tier = new_tier WHERE user_id = uid AND color = plot_rec.color;
    UPDATE farm_data SET xp = xp + xp_gain WHERE user_id = uid;
    SELECT CASE WHEN xp >= 1200 THEN 6 WHEN xp >= 700 THEN 5 WHEN xp >= 350 THEN 4
        WHEN xp >= 150 THEN 3 WHEN xp >= 50 THEN 2 ELSE 1 END INTO new_level
    FROM farm_data WHERE user_id = uid;
    UPDATE farm_data SET level = new_level WHERE user_id = uid;
    UPDATE farm_plantations SET status = 'empty', color = '', planted_at = NULL, ready_at = NULL
    WHERE user_id = uid AND plot_index = p_plot_index;
    RETURN json_build_object('ok', true, 'color', plot_rec.color, 'amount', harvest_amount,
        'xp', xp_gain, 'new_level', new_level, 'new_tier', new_tier);
END;
 LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get_farm_inventory
CREATE OR REPLACE FUNCTION get_farm_inventory()
RETURNS JSON AS 
DECLARE uid UUID := auth.uid();
BEGIN
    RETURN (SELECT json_agg(row_to_json(fi)) FROM farm_inventory fi WHERE fi.user_id = uid AND fi.quantity > 0);
END;
 LANGUAGE plpgsql SECURITY DEFINER;
