/**
 * Voice commands via expo-speech-recognition, a native module that is NOT
 * available in Expo Go. Everything here degrades gracefully to "voice off":
 * the app stays fully usable with taps only.
 */
let SpeechRecognition: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("expo-speech-recognition");
  SpeechRecognition = mod?.ExpoSpeechRecognitionModule ?? null;
} catch {
  SpeechRecognition = null;
}

export function voiceAvailable(): boolean {
  return SpeechRecognition != null;
}

export async function ensureVoicePermission(): Promise<boolean> {
  if (!SpeechRecognition) return false;
  try {
    const result = await SpeechRecognition.requestPermissionsAsync();
    return !!result?.granted;
  } catch {
    return false;
  }
}

/**
 * Listen for one utterance and resolve with the transcript (lowercased),
 * or null on silence, error, or timeout. Never rejects.
 *
 * The mic must only be opened while nothing is speaking; callers are
 * responsible for awaiting all speech before calling this.
 */
export function listenOnce(timeoutMs = 6000): Promise<string | null> {
  if (!SpeechRecognition) return Promise.resolve(null);
  const M = SpeechRecognition;
  return new Promise((resolve) => {
    let finished = false;
    const subscriptions: Array<{ remove?: () => void }> = [];
    const finish = (value: string | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      for (const sub of subscriptions) {
        try {
          sub.remove?.();
        } catch {}
      }
      try {
        M.abort();
      } catch {}
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      subscriptions.push(
        M.addListener("result", (event: any) => {
          const transcript = event?.results?.[0]?.transcript ?? "";
          if (transcript) finish(transcript.toLowerCase().trim());
        })
      );
      subscriptions.push(M.addListener("error", () => finish(null)));
      subscriptions.push(M.addListener("end", () => finish(null)));
      M.start({ lang: "en-US", interimResults: false, continuous: false });
    } catch {
      finish(null);
    }
  });
}
