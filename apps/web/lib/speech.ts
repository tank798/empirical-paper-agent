const SEGMENT_PUNCTUATION = /[，。！？；：、,.!?;:]$/;
const SOFT_TRAILING_PUNCTUATION = /[，、；：,.!?;:]+$/;

function normalizeSpeechChunk(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, "$1$2")
    .replace(/[，,]+/g, "，")
    .replace(/[。]+/g, "。")
    .replace(/[？?]+/g, "？")
    .replace(/[！!]+/g, "！")
    .replace(/[；;]+/g, "；")
    .replace(/[：:]+/g, "：")
    .trim();
}

export function inferSpeechRecognitionLanguage(seedText: string) {
  return /[A-Za-z]{2,}|(?:stata|did|psm|iv|roa|esg|year|firm|stock|panel|regression|variable)/i.test(seedText)
    ? "en-US"
    : "zh-CN";
}

function joinSpeechSegments(left: string, right: string) {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  if (/[A-Za-z0-9]$/.test(left) && /^[A-Za-z0-9]/.test(right)) {
    return `${left} ${right}`;
  }

  if (SEGMENT_PUNCTUATION.test(left) || /\s$/.test(left) || /^[，。！？；：、,.!?;:\s]/.test(right)) {
    return `${left}${right}`;
  }

  return `${left}，${right}`;
}

export function appendCommittedSpeech(currentCommitted: string, nextChunk: string) {
  const normalizedChunk = normalizeSpeechChunk(nextChunk).replace(SOFT_TRAILING_PUNCTUATION, "");

  if (!normalizedChunk) {
    return currentCommitted;
  }

  const punctuatedChunk = SEGMENT_PUNCTUATION.test(normalizedChunk)
    ? normalizedChunk
    : /[A-Za-z0-9]$/.test(normalizedChunk)
      ? `${normalizedChunk},`
      : `${normalizedChunk}，`;

  return joinSpeechSegments(currentCommitted.trim(), punctuatedChunk);
}

export function buildSpeechText(baseText: string, committedText: string, interimText: string) {
  let nextText = baseText.trim();
  const normalizedCommitted = committedText.trim();
  const normalizedInterim = normalizeSpeechChunk(interimText);

  if (normalizedCommitted) {
    nextText = joinSpeechSegments(nextText, normalizedCommitted);
  }

  if (normalizedInterim) {
    nextText = joinSpeechSegments(nextText, normalizedInterim);
  }

  return nextText;
}

export function finalizeSpeechText(baseText: string, committedText: string, interimText: string) {
  let nextCommitted = committedText.trim();
  const normalizedInterim = normalizeSpeechChunk(interimText).replace(SOFT_TRAILING_PUNCTUATION, "");

  if (normalizedInterim) {
    nextCommitted = joinSpeechSegments(
      nextCommitted,
      /[A-Za-z0-9]$/.test(normalizedInterim) ? `${normalizedInterim}.` : `${normalizedInterim}。`
    );
  } else if (nextCommitted) {
    nextCommitted = nextCommitted.replace(SOFT_TRAILING_PUNCTUATION, "。");
  }

  return buildSpeechText(baseText, nextCommitted, "");
}
