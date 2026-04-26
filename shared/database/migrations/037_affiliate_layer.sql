-- Sprint 9 T2: affiliate tracking layer (E2).
-- Ensures schema even if EXPECTED_SCHEMAS not yet updated on this DB.
CREATE SCHEMA IF NOT EXISTS affiliate;

CREATE TABLE IF NOT EXISTS affiliate.houses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  domain        TEXT NOT NULL,
  base_url      TEXT NOT NULL,
  cpa_brl       NUMERIC(10,2) NOT NULL DEFAULT 0,
  revshare_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affiliate.campaigns (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  house_id    UUID NOT NULL REFERENCES affiliate.houses(id),
  slug        TEXT NOT NULL,
  label       TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (house_id, slug)
);

CREATE TABLE IF NOT EXISTS affiliate.clicks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  house_id      UUID NOT NULL REFERENCES affiliate.houses(id),
  campaign_id   UUID REFERENCES affiliate.campaigns(id),
  click_id      UUID NOT NULL UNIQUE,
  ip            TEXT,
  user_agent    TEXT,
  ref_cookie    TEXT,
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_term      TEXT,
  utm_content   TEXT,
  country       TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clicks_created_at
  ON affiliate.clicks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_house_created
  ON affiliate.clicks(house_id, created_at DESC);

CREATE TABLE IF NOT EXISTS affiliate.attributions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL UNIQUE REFERENCES identity.users(id),
  click_id       UUID NOT NULL REFERENCES affiliate.clicks(click_id),
  house_id       UUID NOT NULL REFERENCES affiliate.houses(id),
  attributed_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attributions_house
  ON affiliate.attributions(house_id);

-- Seed mínimo pra E2E: bet365 ativo (acceptance test usa).
-- Outras casas inseridas como inactive — operador ativa manualmente
-- após contratos comerciais (cpa_brl/revshare_pct dependem de deal).
INSERT INTO affiliate.houses (slug, name, domain, base_url, active) VALUES
  ('bet365',           'Bet365',           'bet365.com',           'https://www.bet365.com/',           true),
  ('sportingbet',      'Sportingbet',      'sportingbet.com',      'https://www.sportingbet.com/',      false),
  ('betano',           'Betano',           'betano.com',           'https://www.betano.com/',           false),
  ('pixbet',           'Pixbet',           'pixbet.com',           'https://www.pixbet.com/',           false),
  ('esportes-da-sorte','Esportes da Sorte','esportesdasorte.com',  'https://www.esportesdasorte.com/',  false)
ON CONFLICT (slug) DO NOTHING;

-- Default campaign per house pra clicks sem campaign_slug terem
-- algo pra apontar (campaign_id pode ficar NULL no clique também,
-- spec permite — só seed por conveniência).
INSERT INTO affiliate.campaigns (house_id, slug, label)
  SELECT h.id, 'default', 'Default'
    FROM affiliate.houses h
    WHERE h.slug = 'bet365'
ON CONFLICT (house_id, slug) DO NOTHING;