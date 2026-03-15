"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProjectDetail } from "@empirical/shared";
import { apiRequest } from "../lib/api";
import { formatDateTime, stepStatusMeta, workflowStepMeta } from "../lib/presentation";
import { getStoredProjects } from "../lib/storage";

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectDetail["project"][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const stored = getStoredProjects();
      const results = await Promise.allSettled(
        stored.map((item) => apiRequest<ProjectDetail>(`/projects/${item.id}`, { token: item.token }))
      );
      setProjects(
        results
          .filter((result): result is PromiseFulfilledResult<ProjectDetail> => result.status === "fulfilled")
          .map((result) => result.value.project)
          .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      );
      setLoading(false);
    };

    void load();
  }, []);

  return (
    <section className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-8 shadow-card backdrop-blur">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">项目库</p>
          <h1 className="mt-3 text-3xl">继续你已经开始的研究项目</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
            这里展示当前浏览器中保存的匿名项目。你可以继续推进 workflow，也可以回看历史消息和研究设定。
          </p>
        </div>
        <Link className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white" href="/">
          新建项目
        </Link>
      </div>

      {loading ? <p className="text-slate-600">正在加载项目...</p> : null}
      {!loading && projects.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/65 p-8 text-slate-600">
          <p className="text-lg font-semibold text-slate-800">当前浏览器还没有保存的项目。</p>
          <p className="mt-2 text-sm leading-7">回到首页输入研究主题后，系统会自动创建一个可继续编辑的项目。</p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => {
          const stepMeta = workflowStepMeta[project.currentStep];
          return (
            <Link
              className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-5 transition hover:-translate-y-0.5 hover:shadow-card"
              href={`/projects/${project.id}`}
              key={project.id}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stepStatusMeta.IN_PROGRESS.tone}`}>
                  {stepMeta.short}
                </span>
                <span className="text-xs text-slate-500">{formatDateTime(project.updatedAt)}</span>
              </div>
              <h2 className="mt-4 text-xl leading-8 text-slate-900">{project.topicNormalized || project.topicRaw}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{stepMeta.description}</p>
              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="text-rust">当前阶段：{stepMeta.label}</span>
                <span className="font-semibold text-slate-800">继续研究</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
