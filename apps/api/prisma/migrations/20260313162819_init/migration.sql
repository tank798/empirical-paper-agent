-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic_raw" TEXT NOT NULL,
    "topic_normalized" TEXT,
    "current_step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "research_summary" TEXT,
    "last_skill_name" TEXT,
    "resume_token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_steps" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "metadata_json" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "project_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "step" TEXT,
    "content_text" TEXT,
    "content_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_profiles" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "normalized_topic" TEXT NOT NULL DEFAULT '',
    "independent_variable" TEXT NOT NULL DEFAULT '',
    "dependent_variable" TEXT NOT NULL DEFAULT '',
    "research_object" TEXT NOT NULL DEFAULT '',
    "relationship" TEXT NOT NULL DEFAULT '',
    "controls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fixed_effects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cluster_var" TEXT,
    "panel_id" TEXT,
    "time_var" TEXT,
    "sample_scope" TEXT,
    "notes" TEXT,

    CONSTRAINT "research_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_runs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "skill_name" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "input_json" JSONB NOT NULL,
    "output_json" JSONB,
    "error_json" JSONB,
    "prompt_version" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_blocks" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "module_name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "explanation_json" JSONB NOT NULL,
    "export_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_export_states" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "default_export_path" TEXT NOT NULL,
    "default_export_file_name" TEXT NOT NULL,
    "has_written_regression_table" BOOLEAN NOT NULL DEFAULT false,
    "next_write_mode" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_export_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_steps_project_id_step_key" ON "project_steps"("project_id", "step");

-- CreateIndex
CREATE UNIQUE INDEX "research_profiles_project_id_key" ON "research_profiles"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_export_states_project_id_key" ON "project_export_states"("project_id");

-- AddForeignKey
ALTER TABLE "project_steps" ADD CONSTRAINT "project_steps_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_profiles" ADD CONSTRAINT "research_profiles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_runs" ADD CONSTRAINT "skill_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_blocks" ADD CONSTRAINT "code_blocks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_export_states" ADD CONSTRAINT "project_export_states_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
