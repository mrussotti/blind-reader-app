import type { FrameCheckResult } from "./api";

export interface FramingDeps {
  takeSnapshot(): Promise<string>;
  takeCapture(): Promise<string>;
  frameCheck(image: string): Promise<FrameCheckResult>;
  speak(text: string): Promise<void>;
  setTorch(on: boolean): void;
  hapticCapture(): void;
  delay(ms: number): Promise<void>;
  now(): number;
}

export type FramingOutcome =
  | { kind: "photo"; image: string }
  | { kind: "idle" }
  | { kind: "cancelled" };

const GOOD_FRAMES_TO_CAPTURE = 2;
const LOOP_DELAY_MS = 450;
const ERROR_DELAY_MS = 2500;
const CUE_REPEAT_MS = 6000;
const EMPTY_PROMPT_MS = 12000;
const ERROR_SPEAK_MS = 15000;
const IDLE_EMPTY_CHECKS = 60; // roughly a minute or two with no page in view
const IDLE_ERROR_CHECKS = 15; // server unreachable for a long stretch

const EMPTY_PROMPT =
  "I don't see a page yet. Lay the letter flat, and hold the phone about a foot above it.";
const SERVER_TROUBLE = "I'm having trouble reaching the server. I'll keep trying.";

/**
 * The framing loop: watch low-res camera snapshots, speak short cues to
 * guide the user's hands, and capture a full-quality photo once the page
 * has been framed for two consecutive checks. The user never triggers the
 * capture; the app is their eyes. All device access is injected so this
 * logic is testable.
 */
export class FramingController {
  private cancelled = false;

  constructor(private deps: FramingDeps) {}

  cancel(): void {
    this.cancelled = true;
  }

  async run(): Promise<FramingOutcome> {
    let goodStreak = 0;
    let emptyStreak = 0;
    let errorStreak = 0;
    let lastCue = "";
    let lastCueAt = -Infinity;
    let lastEmptyPromptAt = -Infinity;
    let lastErrorSpokenAt = -Infinity;

    while (!this.cancelled) {
      let snapshot: string;
      try {
        snapshot = await this.deps.takeSnapshot();
      } catch {
        await this.deps.delay(600);
        continue;
      }

      let result: FrameCheckResult;
      try {
        result = await this.deps.frameCheck(snapshot);
        errorStreak = 0;
      } catch {
        errorStreak++;
        if (errorStreak >= IDLE_ERROR_CHECKS) return { kind: "idle" };
        const now = this.deps.now();
        if (errorStreak >= 2 && now - lastErrorSpokenAt > ERROR_SPEAK_MS) {
          lastErrorSpokenAt = now;
          await this.deps.speak(SERVER_TROUBLE);
        }
        await this.deps.delay(ERROR_DELAY_MS);
        continue;
      }
      if (this.cancelled) return { kind: "cancelled" };

      if (result.needsLight) this.deps.setTorch(true);

      goodStreak = result.status === "good" ? goodStreak + 1 : 0;
      if (goodStreak >= GOOD_FRAMES_TO_CAPTURE) {
        this.deps.hapticCapture();
        try {
          const image = await this.deps.takeCapture();
          return { kind: "photo", image };
        } catch {
          goodStreak = 0;
          continue;
        }
      }

      const now = this.deps.now();
      if (result.status === "no_document") {
        emptyStreak++;
        if (emptyStreak >= IDLE_EMPTY_CHECKS) return { kind: "idle" };
        if (now - lastEmptyPromptAt > EMPTY_PROMPT_MS) {
          lastEmptyPromptAt = now;
          await this.deps.speak(EMPTY_PROMPT);
        }
      } else {
        emptyStreak = 0;
        if (result.cue && (result.cue !== lastCue || now - lastCueAt > CUE_REPEAT_MS)) {
          lastCue = result.cue;
          lastCueAt = now;
          await this.deps.speak(result.cue);
        }
      }

      await this.deps.delay(LOOP_DELAY_MS);
    }
    return { kind: "cancelled" };
  }
}
