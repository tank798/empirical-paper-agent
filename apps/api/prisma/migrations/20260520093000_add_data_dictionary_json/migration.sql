ALTER TABLE "research_profiles"
  ADD COLUMN IF NOT EXISTS "data_dictionary_json" JSONB NOT NULL DEFAULT '[]'::JSONB;
