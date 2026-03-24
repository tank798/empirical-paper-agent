export type ImageOcrStatus = {
  text: string;
  progress: number | null;
};

type TesseractLoggerMessage = {
  status?: string;
  progress?: number;
};

type TesseractModule = {
  recognize: (
    image: File,
    languages?: string,
    options?: { logger?: (message: TesseractLoggerMessage) => void }
  ) => Promise<{ data: { text: string } }>;
};

const OCR_LANGUAGES = "chi_sim+eng";

export function ensureNamedImageFile(file: File) {
  if (file.name && file.name.trim()) {
    return file;
  }

  return new File([file], `截图-${Date.now()}.png`, {
    type: file.type || "image/png",
    lastModified: Date.now()
  });
}

export function formatImageOcrStatus(message?: TesseractLoggerMessage): ImageOcrStatus {
  const status = (message?.status || "").toLowerCase();
  const progress = typeof message?.progress === "number" ? Math.min(100, Math.max(0, Math.round(message.progress * 100))) : null;

  if (status.includes("recognizing text")) {
    return {
      text: progress ? `正在识别截图文字... ${progress}%` : "正在识别截图文字...",
      progress
    };
  }

  if (status.includes("loading language")) {
    return {
      text: progress ? `正在加载识别语言包... ${progress}%` : "正在加载识别语言包...",
      progress
    };
  }

  if (status.includes("initializing tesseract") || status.includes("initializing api")) {
    return {
      text: progress ? `正在启动图片识别... ${progress}%` : "正在启动图片识别...",
      progress
    };
  }

  if (status.includes("loading") || status.includes("initializing")) {
    return {
      text: progress ? `正在准备截图解析... ${progress}%` : "正在准备截图解析...",
      progress
    };
  }

  return {
    text: "正在识别截图文字...",
    progress
  };
}

export async function extractImageText(
  file: File,
  onStatus?: (status: ImageOcrStatus) => void
) {
  const Tesseract = (await import("tesseract.js")) as TesseractModule;

  onStatus?.({ text: "正在准备截图解析...", progress: null });

  const result = await Tesseract.recognize(file, OCR_LANGUAGES, {
    logger: (message) => {
      onStatus?.(formatImageOcrStatus(message));
    }
  });

  onStatus?.({ text: "截图文字识别完成。", progress: 100 });
  return result.data.text ?? "";
}

export function buildPastedImageText(baseText: string, extractedText: string) {
  const cleanedBase = baseText.trim();
  const cleanedExtracted = extractedText.trim();

  if (!cleanedExtracted) {
    return cleanedBase;
  }

  const nextChunk = `[截图识别内容]\n${cleanedExtracted}`;
  return cleanedBase ? `${cleanedBase}\n\n${nextChunk}` : nextChunk;
}
