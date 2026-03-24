"use client";

import { startTransition, type ClipboardEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type AssistantMessageEnvelope, type ProjectDetail } from "@empirical/shared";
import { apiRequest, streamApiRequest } from "../lib/api";
import { buildPastedImageText, ensureNamedImageFile, extractImageText } from "../lib/image-ocr";
import { appendCommittedSpeech, buildSpeechText, finalizeSpeechText } from "../lib/speech";
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

async function fetchHydratedProjectSnapshot(projectId: string, token: string) {
  let lastDetail: ProjectDetail | null = null;
  let lastMessages: AssistantMessageEnvelope[] = [];

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const [detail, messages] = await Promise.all([
      apiRequest<ProjectDetail>(`/projects/${projectId}`, { token }),
      apiRequest<AssistantMessageEnvelope[]>(`/projects/${projectId}/messages`, { token })
    ]);

    lastDetail = detail;
    lastMessages = messages;

    const hasRenderableSetup = messages.some(
      (message) =>
        message.role !== "user" &&
        (message.messageType === "topic_confirm" || message.messageType === "system_notice")
    );

    if (hasRenderableSetup) {
      return { detail, messages };
    }

    await new Promise((resolve) => window.setTimeout(resolve, 180));
  }

  return {
    detail: lastDetail as ProjectDetail,
    messages: lastMessages
  };
}

export function HomeHero() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [handoffReady, setHandoffReady] = useState(false);
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
    if (!nextTopic || imageProcessing) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setHandoffReady(false);

      const data = await apiRequest<{ project: { id: string; title: string }; resumeToken: string }>("/projects", {
        method: "POST",
        body: JSON.stringify({ topicRaw: nextTopic })
      });

      saveStoredProject({ id: data.project.id, token: data.resumeToken, title: data.project.title });
      router.prefetch(`/projects/${data.project.id}`);

      await streamApiRequest(`/projects/${data.project.id}/workflow/stream`, {
        token: data.resumeToken,
        body: {
          userMessage: nextTopic
        },
        onEvent: (event) => {
          if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      });

      const { detail, messages } = await fetchHydratedProjectSnapshot(data.project.id, data.resumeToken);

      setPendingProjectBootstrap({
        projectId: data.project.id,
        topic: nextTopic,
        createdAt: Date.now(),
        detail,
        messages
      });

      setHandoffReady(true);
      window.setTimeout(() => {
        startTransition(() => {
          router.push(`/projects/${data.project.id}`);
        });
      }, 180);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "\u521b\u5efa\u9879\u76ee\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002");
      setLoading(false);
      setHandoffReady(false);
    }
  };

  const handleTopicKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (imageProcessing || event.key !== "Enter" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    void createProject();
  };

  const handleTopicPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));

    if (!imageItem) {
      return;
    }

    const file = imageItem.getAsFile();
    if (!file) {
      return;
    }

    event.preventDefault();

    void (async () => {
      try {
        setError("");
        setImageProcessing(true);
        setStatusText("\u6b63\u5728\u8bc6\u522b\u622a\u56fe\u6587\u5b57...");
        const normalizedFile = ensureNamedImageFile(file);
        const extractedText = await extractImageText(normalizedFile, (status) => setStatusText(status.text));
        setTopic((current) => buildPastedImageText(current, extractedText));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "\u622a\u56fe\u8bc6\u522b\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002");
      } finally {
        setImageProcessing(false);
        setStatusText("");
      }
    })();
  };

  const handleMicClick = () => {
    if (loading || imageProcessing) {
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
      setError("\u5f53\u524d\u6d4f\u89c8\u5668\u6682\u4e0d\u652f\u6301\u8bed\u97f3\u8f93\u5165\u3002");
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
          nextCommitted = appendCommittedSpeech(nextCommitted, chunk);
        } else {
          interimChunks.push(chunk);
        }
      }

      speechCommittedTextRef.current = nextCommitted;
      speechInterimTextRef.current = interimChunks.join("");
      setTopic(
        buildSpeechText(
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
            ? "\u8bf7\u5148\u5141\u8bb8\u6d4f\u89c8\u5668\u4f7f\u7528\u9ea6\u514b\u98ce\u3002"
            : event.error === "service-not-allowed"
              ? "\u5f53\u524d\u6d4f\u89c8\u5668\u7981\u6b62\u4e86\u8bed\u97f3\u8bc6\u522b\u670d\u52a1\u3002"
              : event.error === "audio-capture"
                ? "\u6ca1\u6709\u68c0\u6d4b\u5230\u53ef\u7528\u9ea6\u514b\u98ce\u3002"
                : "\u8bed\u97f3\u8bc6\u522b\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002"
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
          setError("\u8bed\u97f3\u8bc6\u522b\u4e2d\u65ad\uff0c\u8bf7\u91cd\u65b0\u5f00\u59cb\u3002");
        }
      }

      setTopic(
        finalizeSpeechText(
          speechBaseTextRef.current,
          speechCommittedTextRef.current,
          speechInterimTextRef.current
        )
      );
      speechCommittedTextRef.current = "";
      speechInterimTextRef.current = "";
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  };

  return (
    <section
      className={`relative overflow-hidden rounded-[40px] border border-white/70 px-5 py-8 transition-[opacity,transform,filter] duration-200 sm:px-8 sm:py-10 lg:px-12 lg:py-12 ${
        handoffReady ? "translate-y-1 scale-[0.995] opacity-0 blur-[2px]" : "translate-y-0 scale-100 opacity-100 blur-0"
      }`}
    >
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
                  {
                    "\u8bf7\u8f93\u5165\u4f60\u7684\u7814\u7a76\u4e3b\u9898\u3001\u7814\u7a76\u5bf9\u8c61\u3001\u89e3\u91ca\u53d8\u91cf\u3001\u88ab\u89e3\u91ca\u53d8\u91cf\u3001\u63a7\u5236\u53d8\u91cf\u3001\u6837\u672c\u533a\u95f4\u548c\u56fa\u5b9a\u6548\u5e94\u3002\u4f60\u53ef\u4ee5\u5199\u5f97\u5f88\u4e71\uff0c\u6211\u4f1a\u5148\u5e2e\u4f60\u6574\u7406\u6210\u7ed3\u6784\u5316\u7814\u7a76\u8bbe\u5b9a\u3002"
                  }
                </p>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-400 sm:text-[1rem]">
                  {
                    "\u4f8b\u5982\uff1a\u7814\u7a76\u6570\u5b57\u91d1\u878d\u5bf9\u4f01\u4e1a\u521b\u65b0\u7684\u5f71\u54cd\uff1b\u6837\u672c\u662f2011-2022\u5e74\u4e2d\u56fdA\u80a1\u4e0a\u5e02\u516c\u53f8\uff08\u5254\u9664ST\u548c\u91d1\u878d\u80a1\uff09\uff1b\u89e3\u91ca\u53d8\u91cf\u662f\u6570\u5b57\u91d1\u878d\u6307\u6570\uff1b\u88ab\u89e3\u91ca\u53d8\u91cf\u662f\u4e13\u5229\u7533\u8bf7\u6570\u91cf\uff1b\u63a7\u5236\u53d8\u91cf\u5305\u62ec\u4f01\u4e1a\u89c4\u6a21\u3001\u8d44\u4ea7\u8d1f\u503a\u7387\u3001ROA\uff1b\u56fa\u5b9a\u6548\u5e94\u4e3a\u4f01\u4e1a\u548c\u5e74\u4efd\u56fa\u5b9a\u6548\u5e94\u3002"
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
              onPaste={handleTopicPaste}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-1">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500 transition">
                {imageProcessing ? statusText || "\u6b63\u5728\u8bc6\u522b\u622a\u56fe\u6587\u5b57..." : "Enter\u53d1\u9001\uff0cCtrl+Enter\u6362\u884c"}
              </p>
              <p className="mt-1 text-xs text-slate-400">{"\u652f\u6301\u76f4\u63a5 Ctrl+V \u7c98\u8d34\u622a\u56fe\uff0cTank \u4f1a\u81ea\u52a8\u8bc6\u522b\u56fe\u7247\u91cc\u7684\u6587\u5b57\u3002"}</p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  listening
                    ? "border-slate-950 bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                }`}
                disabled={loading || imageProcessing}
                onClick={handleMicClick}
                type="button"
              >
                <MicIcon />
              </button>

              <button
                className="inline-flex min-w-[132px] items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-base font-semibold text-white shadow-floating transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={loading || imageProcessing || !topic.trim()}
                onClick={() => void createProject()}
                type="button"
              >
                {loading ? <ThinkingBubble bare className="text-white" /> : <span className="w-full text-center">{"\u786e\u8ba4"}</span>}
              </button>
            </div>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}
