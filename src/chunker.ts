/**
 * Split document text into TTS-sized chunks on sentence boundaries.
 * The first chunk is kept small so the first spoken words arrive fast;
 * later chunks are larger to reduce request count.
 */
export function splitIntoChunks(
  text: string,
  opts?: { firstMax?: number; max?: number }
): string[] {
  const firstMax = opts?.firstMax ?? 280;
  const max = opts?.max ?? 600;
  const sentences = splitSentences(text);
  const chunks: string[] = [];
  let current = "";
  let limit = firstMax;

  const flush = () => {
    if (current) {
      chunks.push(current);
      current = "";
      limit = max;
    }
  };

  for (const sentence of sentences) {
    if (sentence.length > limit) {
      flush();
      chunks.push(...hardSplit(sentence, max));
      limit = max;
      continue;
    }
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > limit) {
      flush();
      current = sentence;
    } else {
      current = candidate;
    }
  }
  flush();
  return chunks;
}

export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const matches = trimmed.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g);
    for (const match of matches ?? []) {
      const sentence = match.trim();
      if (sentence) out.push(sentence);
    }
  }
  return out;
}

function hardSplit(sentence: string, max: number): string[] {
  const pieces: string[] = [];
  let rest = sentence;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(" ", max);
    if (cut <= 0) cut = max;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}
