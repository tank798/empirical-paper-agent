"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../lib/api";
import { saveStoredProject } from "../lib/storage";

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M6 12h12m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function HomeHero() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const showGhostText = !focused && !topic.trim();

  const createProject = async () => {
    if (!topic.trim()) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await apiRequest<{ project: { id: string; title: string }; resumeToken: string }>("/projects", {
        method: "POST",
        body: JSON.stringify({ topicRaw: topic })
      });
      saveStoredProject({ id: data.project.id, token: data.resumeToken, title: data.project.title });
      await apiRequest(`/projects/${data.project.id}/workflow/next`, {
        method: "POST",
        token: data.resumeToken,
        body: JSON.stringify({ userMessage: topic, payload: {} })
      });
      router.push(`/projects/${data.project.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "创建项目失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-[40px] border border-white/70 px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(150,193,255,0.28),transparent_24%),radial-gradient(circle_at_84%_16%,rgba(225,240,167,0.34),transparent_22%),radial-gradient(circle_at_50%_68%,rgba(255,255,255,0.92),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-x-[14%] top-10 h-52 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.84),transparent_72%)] blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-12rem)] max-w-5xl flex-col items-center justify-center">
        <div className="text-center">
          <h1
            className="mx-auto whitespace-nowrap text-[1.65rem] font-black leading-none tracking-[-0.05em] text-slate-950 sm:text-[2.15rem] lg:text-[2.85rem]"
            style={{
              fontFamily: '"Arial Rounded MT Bold", "Trebuchet MS", "Aptos", "PingFang SC", "Microsoft YaHei", sans-serif'
            }}
          >
            Hi，我是Tank，你的实证论文助手
          </h1>
        </div>

        <div className="mt-10 w-full max-w-4xl rounded-[36px] border border-white/80 bg-white/78 p-4 shadow-[0_30px_90px_rgba(31,41,69,0.12)] backdrop-blur sm:p-5">
          <div className="relative rounded-[30px] border border-slate-200/80 bg-white/90 px-4 py-4 sm:px-6 sm:py-5">
            {showGhostText ? (
              <div className="pointer-events-none absolute inset-0 z-10 px-4 py-4 sm:px-6 sm:py-5">
                <p className="max-w-3xl text-lg leading-8 text-slate-500 sm:text-[1.06rem]">
                  可直接写下研究主题、变量设定、回归结果或 Stata 报错；系统会自动调度相应技能，沿论文流程继续推进。
                </p>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-400 sm:text-[1rem]">
                  例如：以 2011—2022 年沪深 A 股上市公司为样本，考察数字金融是否提升企业创新产出。
                </p>
              </div>
            ) : null}

            <textarea
              className="relative z-20 h-56 w-full resize-none bg-transparent text-lg leading-8 text-slate-900 outline-none sm:h-60 sm:text-[1.06rem]"
              value={topic}
              onBlur={() => setFocused(false)}
              onChange={(event) => setTopic(event.target.value)}
              onFocus={() => setFocused(true)}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-1">
            <button
              className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
              onClick={() => router.push("/projects")}
              type="button"
            >
              查看已保存项目
            </button>

            <button
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-floating transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
              disabled={loading || !topic.trim()}
              onClick={() => void createProject()}
              type="button"
            >
              {loading ? "Tank正在思考中" : "开始对话"}
              <ArrowIcon />
            </button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}