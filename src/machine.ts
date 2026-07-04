import { frameCheck, transcribe, TranscribeResult } from "./api";
import { splitIntoChunks } from "./chunker";
import { parseCommand } from "./commands";
import { FramingController } from "./framing";
import { hapticCapture, hapticError, hapticTick } from "./haptics";
import { ensureVoicePermission, listenOnce } from "./recognition";
import { clampRate, loadRate, RATE_STEP, saveRate } from "./settings";
import { configureAudio, DocReader, Speaker, TTSUnavailable } from "./speech";

export type Phase = "boot" | "framing" | "processing" | "reading" | "paused" | "prompt" | "idle";

export interface CameraDeps {
  takeSnapshot(): Promise<string>;
  takeCapture(): Promise<string>;
  setTorch(on: boolean): void;
}

const WELCOME =
  "Mail Reader is ready. Lay a letter flat on the table, and hold the phone above it. " +
  "I'll tell you how to move it, then I'll read the letter out loud. " +
  "Tap the screen any time to pause.";

/**
 * The one owner of the microphone and the speaker.
 *
 * Rules this machine enforces:
 * - The mic is only opened after a spoken prompt finishes; the app never
 *   listens to its own voice.
 * - Every state change the user needs to know about is spoken or haptic.
 * - The whole screen is one control: tap pauses and resumes.
 */
export class MailReaderMachine {
  phase: Phase = "boot";
  statusLine = "Starting…";
  summary = "";
  text = "";
  voiceEnabled = false;

  private speaker = new Speaker();
  private reader = new DocReader();
  private framing: FramingController | null = null;
  private rate = 1.0;
  private replayRequested = false;
  private stopRequested = false;
  private disposed = false;
  private wakeTap: (() => void) | null = null;
  private listeners = new Set<() => void>();

  constructor(private camera: CameraDeps) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  private setPhase(phase: Phase, statusLine?: string): void {
    this.phase = phase;
    if (statusLine !== undefined) this.statusLine = statusLine;
    this.emit();
  }

  async start(): Promise<void> {
    await configureAudio();
    this.rate = await loadRate();
    this.reader.rate = this.rate;
    this.speaker.rate = this.rate;
    this.voiceEnabled = await ensureVoicePermission();
    this.emit();
    await this.speaker.speak(WELCOME);
    void this.loop();
  }

  dispose(): void {
    this.disposed = true;
    this.framing?.cancel();
    this.wakeTap?.();
    void this.reader.stop();
    this.speaker.stop();
  }

  /** The whole screen is one control. */
  onTap(): void {
    if (this.wakeTap) {
      const wake = this.wakeTap;
      this.wakeTap = null;
      hapticTick();
      wake();
      return;
    }
    if (this.phase === "reading") {
      void this.pauseReading();
    } else if (this.phase === "paused") {
      this.resumeReading();
    } else {
      hapticTick();
    }
  }

  private async pauseReading(): Promise<void> {
    await this.reader.pause();
    this.setPhase("paused", "Paused — tap to continue");
    void this.pausedMenu();
  }

  private resumeReading(): void {
    this.speaker.stop();
    void this.reader.resume();
    this.setPhase("reading", "Reading aloud…");
  }

  private async pausedMenu(): Promise<void> {
    if (!this.voiceEnabled) {
      await this.speaker.speak("Paused. Tap the screen again to continue.");
      return;
    }
    await this.speaker.speak("Paused. Say slower, faster, start over, or tap to continue.");
    if (this.phase !== "paused") return;
    const heard = await listenOnce(5000);
    if (this.phase !== "paused") return;
    const command = heard ? parseCommand(heard) : null;
    switch (command) {
      case "slower":
        await this.changeRate(-RATE_STEP, "Okay, slower.");
        this.resumeReading();
        break;
      case "faster":
        await this.changeRate(RATE_STEP, "Okay, faster.");
        this.resumeReading();
        break;
      case "again":
        this.replayRequested = true;
        await this.reader.stop();
        break;
      case "resume":
        this.resumeReading();
        break;
      case "stop":
      case "done":
        this.stopRequested = true;
        await this.reader.stop();
        break;
      default:
        // Nothing understood; stay paused. A tap continues.
        break;
    }
  }

  private async changeRate(delta: number, confirmation: string): Promise<void> {
    this.rate = clampRate(this.rate + delta);
    this.speaker.rate = this.rate;
    await this.reader.setRate(this.rate);
    await saveRate(this.rate);
    await this.speaker.speak(confirmation);
  }

  private async loop(): Promise<void> {
    while (!this.disposed) {
      this.setPhase("framing", "Looking for a page…");
      this.framing = new FramingController({
        takeSnapshot: this.camera.takeSnapshot,
        takeCapture: this.camera.takeCapture,
        setTorch: this.camera.setTorch,
        frameCheck,
        speak: (text) => this.speaker.speak(text),
        hapticCapture,
        delay,
        now: () => Date.now(),
      });
      const outcome = await this.framing.run();
      this.framing = null;
      if (outcome.kind === "cancelled" || this.disposed) return;

      if (outcome.kind === "idle") {
        this.camera.setTorch(false);
        await this.speaker.speak(
          "I'll rest until you're ready. Tap the screen when you have another page."
        );
        this.setPhase("idle", "Resting — tap to wake");
        await new Promise<void>((resolve) => {
          this.wakeTap = resolve;
        });
        if (this.disposed) return;
        await this.speaker.speak("Okay, show me the page.");
        continue;
      }

      this.camera.setTorch(false);
      this.setPhase("processing", "Reading the page…");
      await this.speaker.speak("Got it. One moment.");

      let doc: TranscribeResult;
      try {
        doc = await transcribe(outcome.image);
      } catch {
        hapticError();
        await this.speaker.speak(
          "I couldn't reach the server to read this page. " +
            "Check the internet connection, then hold the phone over the page again."
        );
        continue;
      }

      if (!doc.text) {
        hapticError();
        await this.speaker.speak(
          doc.guidance || "I couldn't find any words on this page. Let's try again."
        );
        continue;
      }

      this.summary = doc.summary;
      this.text = doc.text;
      this.emit();
      if (doc.summary) await this.speaker.speak(doc.summary);

      await this.readDocument();
      await this.afterRead();
    }
  }

  private async readDocument(): Promise<void> {
    const chunks = splitIntoChunks(this.text);
    do {
      this.replayRequested = false;
      this.setPhase("reading", "Reading aloud…");
      try {
        await this.reader.read(chunks);
      } catch (error) {
        if (error instanceof TTSUnavailable) {
          const rest = chunks.slice(error.chunkIndex).join(" ");
          await this.speaker.speak(
            "The clear voice isn't available right now, so I'll use the phone's own voice."
          );
          await this.speaker.speak(rest);
        }
      }
    } while (this.replayRequested && !this.stopRequested && !this.disposed);
  }

  private async afterRead(): Promise<void> {
    if (this.disposed) return;
    this.setPhase("prompt", "Done — lay down the next page");
    if (this.stopRequested) {
      this.stopRequested = false;
      await this.speaker.speak("Okay. Lay down another page whenever you're ready.");
      return;
    }
    await this.speaker.speak(
      "That's the end of the page. Lay down the next page and I'll read it. " +
        "Or say again to hear this one once more."
    );
    if (!this.voiceEnabled) return;
    const heard = await listenOnce(5000);
    const command = heard ? parseCommand(heard) : null;
    if (command === "again") {
      await this.readDocument();
      await this.afterRead();
      return;
    }
    if (command === "done") {
      await this.speaker.speak("All done. I'll be right here when you need me.");
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
