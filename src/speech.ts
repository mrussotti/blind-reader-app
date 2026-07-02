import * as Speech from "expo-speech";
import { Audio } from "expo-av";

import { speakRequest } from "./api";

/** One-time audio session setup: audible even in iOS Silent mode. */
export async function configureAudio(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
    });
  } catch {}
}

/** Instant local TTS for UI feedback lines. Works offline. */
export class Speaker {
  rate = 1.0;

  speak(text: string): Promise<void> {
    Speech.stop();
    return new Promise((resolve) => {
      Speech.speak(text, {
        language: "en-US",
        rate: 0.95 * this.rate,
        onDone: () => resolve(),
        onError: () => resolve(),
        onStopped: () => resolve(),
      });
    });
  }

  stop(): void {
    Speech.stop();
  }
}

export class TTSUnavailable extends Error {
  constructor(public chunkIndex: number) {
    super("Server TTS unavailable");
  }
}

/**
 * Plays a document as a queue of server-TTS chunks, prefetching the next
 * chunk while the current one plays so playback never waits on the whole
 * document. Supports pause/resume, live playback-rate changes, and stop.
 *
 * Throws TTSUnavailable(chunkIndex) if the server can't produce audio, so
 * the caller can fall back to local TTS from that point in the document.
 */
export class DocReader {
  rate = 1.0;
  private sound: Audio.Sound | null = null;
  private stopped = false;
  private paused = false;
  private finishCurrent: (() => void) | null = null;

  get isPaused(): boolean {
    return this.paused;
  }

  async read(chunks: string[], voice = "nova"): Promise<void> {
    this.stopped = false;
    this.paused = false;
    if (chunks.length === 0) return;

    let next: Promise<string> | null = this.fetchChunk(chunks[0], voice);
    for (let i = 0; i < chunks.length; i++) {
      if (this.stopped) return;
      let base64: string;
      try {
        base64 = await next!;
      } catch {
        throw new TTSUnavailable(i);
      }
      next = i + 1 < chunks.length ? this.fetchChunk(chunks[i + 1], voice) : null;
      if (this.stopped) return;
      await this.playBase64(base64);
      await this.unloadCurrent();
    }
  }

  private fetchChunk(text: string, voice: string): Promise<string> {
    const promise = speakRequest(text, voice);
    promise.catch(() => {}); // mark handled; the read loop awaits the original
    return promise;
  }

  private playBase64(base64: string): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        this.finishCurrent = null;
        resolve();
      };
      this.finishCurrent = finish;
      (async () => {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: `data:audio/mpeg;base64,${base64}` },
            { shouldPlay: !this.paused, rate: this.rate, shouldCorrectPitch: true }
          );
          if (this.stopped) {
            try {
              await sound.unloadAsync();
            } catch {}
            finish();
            return;
          }
          this.sound = sound;
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) finish();
          });
        } catch {
          finish();
        }
      })();
    });
  }

  private async unloadCurrent(): Promise<void> {
    const sound = this.sound;
    this.sound = null;
    if (!sound) return;
    try {
      await sound.unloadAsync();
    } catch {}
  }

  async pause(): Promise<void> {
    this.paused = true;
    try {
      await this.sound?.pauseAsync();
    } catch {}
  }

  async resume(): Promise<void> {
    this.paused = false;
    try {
      await this.sound?.playAsync();
    } catch {}
  }

  async setRate(rate: number): Promise<void> {
    this.rate = rate;
    try {
      await this.sound?.setStatusAsync({ rate, shouldCorrectPitch: true });
    } catch {}
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.paused = false;
    const sound = this.sound;
    this.sound = null;
    try {
      await sound?.stopAsync();
    } catch {}
    try {
      await sound?.unloadAsync();
    } catch {}
    this.finishCurrent?.();
  }
}
