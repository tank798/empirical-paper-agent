import { extractImageText } from "./image-ocr";

export type ComposerAttachment = {
  name: string;
  mimeType: string;
  size: number;
  content: string;
  truncated: boolean;
  source: "file" | "image";
  file: File | null;
  processed: boolean;
};

const SUPPORTED_ATTACHMENT_EXTENSIONS = new Set([
  "txt",
  "md",
  "csv",
  "json",
  "log",
  "yml",
  "yaml",
  "xml",
  "html",
  "htm",
  "js",
  "ts",
  "tsx",
  "jsx",
  "py",
  "r",
  "sql",
  "tex",
  "do",
  "pdf",
  "docx",
  "xls",
  "xlsx"
]);

const SUPPORTED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "bmp", "gif"]);
const MAX_ATTACHMENT_CHARACTERS = 200000;
const MAX_SPREADSHEET_ROWS = 80;
const MAX_SPREADSHEET_SHEETS = 4;

export const SUPPORTED_ATTACHMENT_ACCEPT =
  ".txt,.md,.csv,.json,.log,.yml,.yaml,.xml,.html,.htm,.js,.ts,.tsx,.jsx,.py,.r,.sql,.tex,.do,.pdf,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.bmp,.gif,text/*,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function getFileExtension(fileName: string) {
  const segments = fileName.toLowerCase().split(".");
  return segments.length > 1 ? segments[segments.length - 1] ?? "" : "";
}

function normalizeAttachmentText(rawContent: string) {
  return rawContent
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/([A-Za-z])[ \t]+([\u4e00-\u9fff])/g, "$1$2")
    .replace(/([\u4e00-\u9fff])[ \t]+([A-Za-z])/g, "$1$2")
    .replace(/([\u4e00-\u9fff])[ \t]+([\u4e00-\u9fff])/g, "$1$2")
    .replace(/((?:19|20)\d{2})\s*年?\s*(?:-|~|\uFF5E|\u301C|\u2013|\u2014|至|到)\s*((?:19|20)\d{2})\s*年?/g, "$1到$2年")
    .replace(/深沪A股/g, "沪深A股")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildAttachment(file: File, mimeType: string, rawContent: string, truncated = false): ComposerAttachment {
  const normalized = normalizeAttachmentText(rawContent);

  if (!normalized) {
    throw new Error("文件中没有可读取的内容，请换一个文件再试。");
  }

  return {
    name: file.name,
    mimeType,
    size: file.size,
    content: normalized.slice(0, MAX_ATTACHMENT_CHARACTERS),
    truncated: truncated || normalized.length > MAX_ATTACHMENT_CHARACTERS,
    source: mimeType.startsWith("image/") ? "image" : "file",
    file: null,
    processed: true
  };
}

export function buildPendingImageAttachment(file: File): ComposerAttachment {
  return {
    name: file.name,
    mimeType: file.type || "image/png",
    size: file.size,
    content: "",
    truncated: false,
    source: "image",
    file,
    processed: false
  };
}

export function canReadAttachment(file: File) {
  const extension = getFileExtension(file.name);
  return (
    file.type.startsWith("text/") ||
    file.type.startsWith("image/") ||
    SUPPORTED_ATTACHMENT_EXTENSIONS.has(extension) ||
    SUPPORTED_IMAGE_EXTENSIONS.has(extension)
  );
}

async function readPlainTextAttachment(file: File): Promise<ComposerAttachment> {
  const rawContent = await file.text();
  return buildAttachment(file, file.type || "text/plain", rawContent);
}

async function readPdfAttachment(file: File): Promise<ComposerAttachment> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
      import.meta.url
    ).toString();
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  const pageTexts: string[] = [];
  let totalLength = 0;
  let truncated = false;

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as Array<{ str?: string }>)
      .map((item) => item.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!pageText) {
      continue;
    }

    const nextChunk = "第" + pageNumber + "页\n" + pageText;
    totalLength += nextChunk.length;
    pageTexts.push(nextChunk);

    if (
      totalLength >= MAX_ATTACHMENT_CHARACTERS ||
      (pageNumber < document.numPages && totalLength >= MAX_ATTACHMENT_CHARACTERS * 0.9)
    ) {
      truncated = pageNumber < document.numPages;
      break;
    }
  }

  return buildAttachment(file, file.type || "application/pdf", pageTexts.join("\n\n"), truncated);
}

async function readDocxAttachment(file: File): Promise<ComposerAttachment> {
  const mammoth = (await import("mammoth")) as {
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return buildAttachment(
    file,
    file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    result.value
  );
}

async function readSpreadsheetAttachment(file: File): Promise<ComposerAttachment> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });
  const sheetTexts: string[] = [];
  let truncated = workbook.SheetNames.length > MAX_SPREADSHEET_SHEETS;
  let totalLength = 0;
  const orderedSheetNames = [...workbook.SheetNames].sort((a, b) => {
    const score = (name: string) => (/变量|字典|说明|codebook|dictionary|field|字段/i.test(name) ? 0 : 1);
    return score(a) - score(b);
  });

  for (const sheetName of orderedSheetNames.slice(0, MAX_SPREADSHEET_SHEETS)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      continue;
    }
    const isDictionaryLikeSheet = /变量|字典|说明|codebook|dictionary|field|字段/i.test(sheetName);
    const rowLimit = isDictionaryLikeSheet ? Math.max(MAX_SPREADSHEET_ROWS, 140) : 32;

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
      defval: ""
    }) as Array<Array<string | number | boolean | null>>;

    if (rows.length > rowLimit) {
      truncated = true;
    }

    const previewRows = rows.slice(0, rowLimit).map((row) =>
      row
        .map((cell) => String(cell ?? "").trim())
        .filter(Boolean)
        .join(" | ")
    );
    const body = previewRows.filter(Boolean).join("\n").trim();

    if (!body) {
      continue;
    }

    const nextChunk = "工作表：" + sheetName + "\n" + body;
    totalLength += nextChunk.length;
    sheetTexts.push(nextChunk);

    if (totalLength >= MAX_ATTACHMENT_CHARACTERS) {
      truncated = true;
      break;
    }
  }

  return buildAttachment(
    file,
    file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sheetTexts.join("\n\n"),
    truncated
  );
}

export async function readImageAttachment(
  file: File,
  onStatus?: (statusText: string) => void
): Promise<ComposerAttachment> {
  const rawContent = await extractImageText(file, (status) => onStatus?.(status.text));
  return buildAttachment(file, file.type || "image/png", rawContent);
}

export async function readComposerAttachment(
  file: File,
  options: { onStatus?: (statusText: string) => void } = {}
): Promise<ComposerAttachment> {
  if (!canReadAttachment(file)) {
    throw new Error("目前支持文本文件、表格、PDF、Word(.docx)，以及直接粘贴或上传截图图片。");
  }

  const extension = getFileExtension(file.name);

  if (file.type.startsWith("image/") || SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return readImageAttachment(file, options.onStatus);
  }

  if (extension === "pdf") {
    return readPdfAttachment(file);
  }

  if (extension === "docx") {
    return readDocxAttachment(file);
  }

  if (extension === "xls" || extension === "xlsx") {
    return readSpreadsheetAttachment(file);
  }

  return readPlainTextAttachment(file);
}

export function formatAttachmentSize(size: number) {
  if (size < 1024) {
    return size + " B";
  }

  if (size < 1024 * 1024) {
    return (size / 1024).toFixed(1) + " KB";
  }

  return (size / (1024 * 1024)).toFixed(1) + " MB";
}

function getAttachmentSourceType(attachment: ComposerAttachment) {
  const extension = getFileExtension(attachment.name);
  if (attachment.source === "image") {
    return "image_ocr";
  }
  if (["xls", "xlsx", "csv"].includes(extension)) {
    return "spreadsheet";
  }
  if (["pdf", "docx", "txt", "md"].includes(extension)) {
    return "document";
  }
  return "attachment";
}

export function buildComposerSubmission(rawMessage: string, attachmentInput: ComposerAttachment | ComposerAttachment[] | null) {
  const attachments = Array.isArray(attachmentInput) ? attachmentInput : attachmentInput ? [attachmentInput] : [];
  const primaryAttachment = attachments[0] ?? null;
  const attachmentExtension = primaryAttachment ? getFileExtension(primaryAttachment.name) : "";
  const looksLikeDictionaryAttachment =
    primaryAttachment?.source === "file" && ["csv", "xls", "xlsx", "json", "txt", "md"].includes(attachmentExtension);
  const looksLikeResearchDocumentAttachment =
    primaryAttachment?.source === "file" && ["pdf", "docx", "txt", "md"].includes(attachmentExtension);
  const baseMessage =
    rawMessage.trim() ||
    (primaryAttachment
      ? primaryAttachment.source === "image"
        ? "请结合截图识别内容继续处理。"
        : looksLikeDictionaryAttachment
          ? "请判断这个附件是否是数据字典或字段表；如果是，请识别真实字段名、字段含义和候选变量角色。"
          : looksLikeResearchDocumentAttachment
            ? "请从附件中提取研究设定，包括研究主题、解释变量、被解释变量、样本区间、控制变量、机制变量、固定效应、面板个体变量、时间变量和聚类变量。"
          : "请结合附件内容继续处理。"
      : "");

  if (attachments.length === 0) {
    return {
      userMessage: baseMessage,
      payload: rawMessage.trim()
        ? {
            inputSources: [{
              sourceType: "user_text",
              text: rawMessage.trim()
            }]
          } as Record<string, unknown>
        : {} as Record<string, unknown>
    };
  }

  const inputSources = [
    rawMessage.trim()
      ? {
          sourceType: "user_text",
          text: rawMessage.trim()
        }
      : null,
    ...attachments.map((attachment) => ({
      sourceType: getAttachmentSourceType(attachment),
      fileName: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      text: attachment.content,
      truncated: attachment.truncated,
      source: attachment.source
    }))
  ].filter(Boolean);

  return {
    userMessage: baseMessage,
    payload: {
      attachment: {
        name: primaryAttachment?.name,
        mimeType: primaryAttachment?.mimeType,
        size: primaryAttachment?.size,
        truncated: primaryAttachment?.truncated
      },
      attachments: attachments.map((attachment) => ({
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        truncated: attachment.truncated
      })),
      inputSources
    }
  };
}
