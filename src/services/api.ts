const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/$/, "");

/**
 * Fetch with an AbortController timeout.
 * Throws if the request exceeds `timeoutMs`.
 */
export async function fetchWithTimeout(
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

/** Returns true if the server responds within 3 s. */
export async function healthCheck(): Promise<boolean> {
  try {
    const resp = await fetchWithTimeout(`${BACKEND}/healthz`, {}, 3000);
    return resp.ok;
  } catch {
    return false;
  }
}

/** Fire-and-forget ping to wake a cold Render instance. */
export function pingServer(): void {
  fetchWithTimeout(`${BACKEND}/healthz`, {}, 5000).catch(() => {});
}

export interface OcrResult {
  text: string;
  guidance?: string;
}

/** Send a base64 image to the server for OCR. 30 s timeout. */
export async function ocrRequest(imageDataUrl: string): Promise<OcrResult> {
  const resp = await fetchWithTimeout(
    `${BACKEND}/ocr`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUrl }),
    },
    30000
  );

  if (!resp.ok) {
    if (resp.status === 500) throw new Error("SERVER_ERROR");
    if (resp.status === 404) throw new Error("SERVER_NOT_FOUND");
    const errBody = await safeJson(resp);
    throw new Error(errBody?.error || `Server error ${resp.status}`);
  }

  return (await resp.json()) as OcrResult;
}

/** Request TTS audio from the server. Returns base64-encoded MP3. 15 s timeout. */
export async function ttsRequest(
  text: string,
  voice: string = "nova"
): Promise<string> {
  const response = await fetchWithTimeout(
    `${BACKEND}/tts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
    },
    15000
  );

  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status}`);
  }

  const audioBlob = await response.blob();
  const reader = new FileReader();

  const base64Audio = await new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  return base64Audio;
}

async function safeJson(resp: Response) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

export { BACKEND };
