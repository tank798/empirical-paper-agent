"use client";

import { startTransition, type KeyboardEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../lib/api";
import { saveStoredProject, setPendingProjectBootstrap } from "../lib/storage";

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M6 12h12m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ThinkingLabel({ dots }: { dots: string }) {
  return (
    <span className="inline-flex min-w-[13ch] items-center justify-start">
      <span>{"Tank\u6b63\u5728\u601d\u8003\u4e2d"}</span>
      <span className="inline-block w-[1.75em] text-left">{dots}</span>
    </span>
  );
}

export function HomeHero() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [thinkingDots, setThinkingDots] = useState(".");

  useEffect(() => {
    if (!loading) {
      setThinkingDots(".");
      return;
    }

    const frames = [".", "..", "..."];
    let frameIndex = 0;
    const timer = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      setThinkingDots(frames[frameIndex] ?? ".");
    }, 420);

    return () => window.clearInterval(timer);
  }, [loading]);

  const showGhostText = !focused && !topic.trim();

  const createProject = async () => {
    const nextTopic = topic.trim();
    if (!nextTopic) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await apiRequest<{ project: { id: string; title: string }; resumeToken: string }>("/projects", {
        method: "POST",
        body: JSON.stringify({ topicRaw: nextTopic })
      });
      saveStoredProject({ id: data.project.id, token: data.resumeToken, title: data.project.title });
      setPendingProjectBootstrap({
        projectId: data.project.id,
        topic: nextTopic,
        createdAt: Date.now()
      });
      router.prefetch(`/projects/${data.project.id}`);
      startTransition(() => {
        router.push(`/projects/${data.project.id}`);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "\u521b\u5efa\u9879\u76ee\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002");
    } finally {
      setLoading(false);
    }
  };

  const handleTopicKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    void createProject();
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
              fontFamily: `"Arial Rounded MT Bold", "Trebuchet MS", "Aptos", "PingFang SC", "Microsoft YaHei", sans-serif`
            }}
          >
            {"Hi\uff0c\u6211\u662fTank\uff0c\u4f60\u7684\u5b9e\u8bc1\u8bba\u6587\u52a9\u624b"}
          </h1>
        </div>

        <div className="mt-10 w-full max-w-4xl rounded-[36px] border border-white/80 bg-white/78 p-4 shadow-[0_30px_90px_rgba(31,41,69,0.12)] backdrop-blur sm:p-5">
          <div className="relative rounded-[30px] border border-slate-200/80 bg-white/90 px-4 py-4 sm:px-6 sm:py-5">
            {showGhostText ? (
              <div className="pointer-events-none absolute inset-0 z-10 px-4 py-4 sm:px-6 sm:py-5">
                <p className="max-w-3xl text-lg leading-8 text-slate-500 sm:text-[1.06rem]">
                  {"\u53ef\u76f4\u63a5\u5199\u4e0b\u7814\u7a76\u4e3b\u9898\u3001\u53d8\u91cf\u8bbe\u5b9a\u3001\u56de\u5f52\u7ed3\u679c\u6216 Stata \u62a5\u9519\uff1b\u7cfb\u7edf\u4f1a\u81ea\u52a8\u8c03\u5ea6\u76f8\u5e94\u6280\u80fd\uff0c\u6cbf\u8bba\u6587\u6d41\u7a0b\u7ee7\u7eed\u63a8\u8fdb\u3002"}
                </p>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-400 sm:text-[1rem]">
                  {"\u4f8b\u5982\uff1a\u4ee5 2011\u20142022 \u5e74\u6caa\u6df1 A \u80a1\u4e0a\u5e02\u516c\u53f8\u4e3a\u6837\u672c\uff0c\u8003\u5bdf\u6570\u5b57\u91d1\u878d\u662f\u5426\u63d0\u5347\u4f01\u4e1a\u521b\u65b0\u4ea7\u51fa\u3002"}
                </p>
              </div>
            ) : null}

            <textarea
              className="relative z-20 h-56 w-full resize-none bg-transparent text-lg leading-8 text-slate-900 outline-none sm:h-60 sm:text-[1.06rem]"
              value={topic}
              onBlur={() => setFocused(false)}
              onChange={(event) => setTopic(event.target.value)}
              onFocus={() => setFocused(true)}
              onKeyDown={handleTopicKeyDown}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-1">
            <button className="text-sm font-medium text-slate-500 transition hover:text-slate-900" type="button">
              {"Enter\u53d1\u9001\uff0cCtrl+Enter\u6362\u884c"}
            </button>

            <button
              className="inline-flex min-w-[188px] items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-floating transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
              disabled={loading || !topic.trim()}
              onClick={() => void createProject()}
              type="button"
            >
              {loading ? <ThinkingLabel dots={thinkingDots} /> : <span>{"\u5f00\u59cb\u5bf9\u8bdd"}</span>}
              {loading ? null : <ArrowIcon />}
            </button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}
