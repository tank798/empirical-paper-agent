-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requested_step" TEXT,
    "current_step" TEXT,
    "phase" TEXT,
    "user_message_preview" TEXT,
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "stage_label" TEXT,
    "input_json" JSONB NOT NULL DEFAULT '{}',
    "output_json" JSONB,
    "error_json" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_heartbeat_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_events" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "run_id" TEXT,
    "type" TEXT NOT NULL,
    "phase" TEXT,
    "message" TEXT,
    "progress_json" JSONB,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tool_results" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "run_id" TEXT,
    "tool_use_id" TEXT,
    "tool_name" TEXT NOT NULL,
    "step" TEXT,
    "status" TEXT NOT NULL,
    "permission_decision" TEXT NOT NULL,
    "input_json" JSONB NOT NULL DEFAULT '{}',
    "output_json" JSONB,
    "error_json" JSONB,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_tool_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_artifacts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "run_id" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "content_preview" TEXT NOT NULL DEFAULT '',
    "content_text" TEXT,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_runs_project_id_created_at_idx" ON "agent_runs"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_events_project_id_created_at_idx" ON "agent_events"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_events_run_id_created_at_idx" ON "agent_events"("run_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_tool_results_project_id_created_at_idx" ON "agent_tool_results"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_tool_results_run_id_created_at_idx" ON "agent_tool_results"("run_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_artifacts_project_id_created_at_idx" ON "agent_artifacts"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_artifacts_run_id_created_at_idx" ON "agent_artifacts"("run_id", "created_at");

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tool_results" ADD CONSTRAINT "agent_tool_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tool_results" ADD CONSTRAINT "agent_tool_results_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_artifacts" ADD CONSTRAINT "agent_artifacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_artifacts" ADD CONSTRAINT "agent_artifacts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
