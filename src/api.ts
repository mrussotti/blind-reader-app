const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
const APP_KEY = process.env.EXPO_PUBLIC_APP_KEY;

export interface FrameCheckResult {
  status: "good" | "adjust" | "no_document";
  cue: string | null;
  needsLight: boolean;
}

export interface TranscribeResult {
  summary: string;
  text: string;
  guidance: string | null;
  documentType: string;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  const resp = await fetchWithTimeout(
    `${BACKEND}${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(APP_KEY ? { "X-App-Key": APP_KEY } : {}),
      },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
  if (!resp.ok) throw new Error(`${path} failed: ${resp.status}`);
  return resp;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const resp = await fetchWithTimeout(`${BACKEND}/healthz`, {}, 3000);
    return resp.ok;
  } catch {
    return false;
  }
}

export async function frameCheck(image: string): Promise<FrameCheckResult> {
  const resp = await postJson("/frame-check", { image }, 10000);
  return (await resp.json()) as FrameCheckResult;
}

export async function transcribe(image: string): Promise<TranscribeResult> {
  const resp = await postJson("/transcribe", { image }, 60000);
  return (await resp.json()) as TranscribeResult;
}

/** Request TTS for one chunk of text. Returns base64-encoded MP3. */
export async function speakRequest(text: string, voice = "nova"): Promise<string> {
  const resp = await postJson("/speak", { text, voice }, 20000);
  const blob = await resp.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export { BACKEND };
