ALTER TABLE "research_profiles"
ADD COLUMN "term_mappings_json" JSONB NOT NULL DEFAULT '[]';
