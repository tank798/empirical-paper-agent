"use client";

import { startTransition, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../lib/api";
import { saveStoredProject, setPendingProjectBootstrap } from "../lib/storage";
import { ThinkingBubble } from "./thinking-bubble";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal?: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

function MicIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path
        d="M8 2.667A1.833 1.833 0 0 0 6.167 4.5v3A1.833 1.833 0 0 0 8 9.333 1.833 1.833 0 0 0 9.833 7.5v-3A1.833 1.833 0 0 0 8 2.667Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M4.833 6.833a3.167 3.167 0 1 0 6.334 0M8 10.667v2.666M5.667 13.333h4.666"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function mergeSpeechText(baseText: string, committedText: string, interimText: string) {
  return [baseText, committedText, interimText].filter(Boolean).join("\n");
}

export function HomeHero() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechBaseTextRef = useRef("");
  const speechCommittedTextRef = useRef("");
  const speechInterimTextRef = useRef("");
  const keepListeningRef = useRef(false);

  const showGhostText = !focused && !topic.trim();

  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

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
      setError(requestError instanceof Error ? requestError.message : "创建项目失败，请稍后重试。");
      setLoading(false);
    }
  };

  const handleTopicKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    void createProject();
  };

  const handleMicClick = () => {
    if (loading) {
      return;
    }

    if (listening) {
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
      return;
    }

    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructorLike;
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
    };
    const SpeechRecognitionCtor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setError("当前浏览器暂不支持语音输入。");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    speechBaseTextRef.current = topic.trim();
    speechCommittedTextRef.current = "";
    speechInterimTextRef.current = "";
    setError("");
    setListening(true);
    keepListeningRef.current = true;
    recognitionRef.current = recognition;
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let nextCommitted = speechCommittedTextRef.current;
      const interimChunks: string[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const chunk = result?.[0]?.transcript?.trim();
        if (!chunk) {
          continue;
        }

        if (result.isFinal) {
          nextCommitted = [nextCommitted, chunk].filter(Boolean).join("\n");
        } else {
          interimChunks.push(chunk);
        }
      }

      speechCommittedTextRef.current = nextCommitted;
      speechInterimTextRef.current = interimChunks.join("");
      setTopic(
        mergeSpeechText(
          speechBaseTextRef.current,
          speechCommittedTextRef.current,
          speechInterimTextRef.current
        )
      );
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
        keepListeningRef.current = false;
        setListening(false);
        recognitionRef.current = null;
      }

      if (event.error !== "aborted") {
        setError(
          event.error === "not-allowed"
            ? "请先允许浏览器使用麦克风。"
            : event.error === "service-not-allowed"
              ? "当前浏览器禁止了语音识别服务。"
              : event.error === "audio-capture"
                ? "没有检测到可用麦克风。"
                : "语音识别失败，请重试。"
        );
      }
    };

    recognition.onend = () => {
      if (keepListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          keepListeningRef.current = false;
          setError("语音识别中断，请重新开始。");
        }
      }

      setListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
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
            {"Hi，我是Tank，你的实证论文助手"}
          </h1>
        </div>

        <div className="mt-10 w-full max-w-4xl rounded-[36px] border border-white/80 bg-white/78 p-4 shadow-[0_30px_90px_rgba(31,41,69,0.12)] backdrop-blur sm:p-5">
          <div className="relative rounded-[30px] border border-slate-200/80 bg-white/90 px-4 py-4 sm:px-6 sm:py-5">
            {showGhostText ? (
              <div className="pointer-events-none absolute inset-0 z-10 px-4 py-4 sm:px-6 sm:py-5">
                <p className="max-w-3xl text-lg leading-8 text-slate-500 sm:text-[1.06rem]">
                  {
                    "请输入你的研究主题、研究对象、解释变量、被解释变量、控制变量、样本区间和固定效应。你可以写得很乱，我会先帮你整理成结构化研究设定。"
                  }
                </p>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-400 sm:text-[1rem]">
                  {
                    "例如：研究数字金融对企业创新的影响；样本是2011-2022年中国A股上市公司（剔除ST和金融股）；解释变量是数字金融指数；被解释变量是专利申请数量；控制变量包括企业规模、资产负债率、ROA；固定效应为企业和年份固定效应。"
                  }
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
              {"Enter发送，Ctrl+Enter换行"}
            </button>

            <div className="flex items-center gap-2.5">
              <button
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  listening
                    ? "border-slate-950 bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                }`}
                disabled={loading}
                onClick={handleMicClick}
                type="button"
              >
                <MicIcon />
              </button>

              <button
                className="inline-flex min-w-[132px] items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-base font-semibold text-white shadow-floating transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={loading || !topic.trim()}
                onClick={() => void createProject()}
                type="button"
              >
                {loading ? <ThinkingBubble bare className="text-white" /> : <span className="w-full text-center">确认</span>}
              </button>
            </div>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}
