import { useCallback, useRef } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import * as Haptics from "expo-haptics";

type CommandHandler = (command: string) => Promise<void>;

/**
 * Manages always-on voice command recognition.
 *
 * Cycle: speak → listen → recognise → act → speak → listen …
 *
 * The hook calls `commandHandlerRef.current(command)` when a known
 * command is detected.  The handler is responsible for calling
 * `startListening()` again when the action (and any TTS) finishes.
 */
export function useVoiceCommands(
  commandHandlerRef: React.MutableRefObject<CommandHandler | null>
) {
  const isListeningRef = useRef(false);
  const gotResultRef = useRef(false);

  // ── start / stop ──

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    try {
      const { granted } =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) return;

      isListeningRef.current = true;
      gotResultRef.current = false;

      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: false,
        continuous: false,
      });
    } catch (e) {
      console.warn("Voice recognition failed to start:", e);
      isListeningRef.current = false;
    }
  }, []);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    gotResultRef.current = true; // prevent auto-restart from "end" event
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {}
  }, []);

  // ── events ──

  useSpeechRecognitionEvent("start", () => {
    // Light haptic so the blind user knows the mic is active
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  });

  useSpeechRecognitionEvent("result", (event) => {
    gotResultRef.current = true;
    isListeningRef.current = false;

    const transcript =
      event.results?.[0]?.transcript?.toLowerCase().trim() ?? "";
    const command = parseCommand(transcript);

    if (command) {
      // Handler will call startListening() when done
      commandHandlerRef.current?.(command);
    } else {
      // Unrecognised speech — resume listening
      setTimeout(() => startListening(), 500);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    isListeningRef.current = false;
    if (gotResultRef.current) return; // result handler owns the lifecycle
    // Silence / timeout — restart
    setTimeout(() => startListening(), 500);
  });

  useSpeechRecognitionEvent("error", () => {
    isListeningRef.current = false;
    // Restart after a brief pause
    setTimeout(() => startListening(), 1000);
  });

  return { startListening, stopListening };
}

// ── command parsing ──

const COMMANDS: [string, string[]][] = [
  ["capture", ["capture", "take photo", "take a photo", "photo", "scan", "read this", "picture"]],
  ["replay", ["replay", "play again", "read again", "repeat", "again"]],
  ["stop", ["stop", "quiet", "silence"]],
  ["clear", ["clear", "erase", "delete"]],
  ["help", ["help", "commands", "what can i say", "what can you do"]],
];

function parseCommand(transcript: string): string | null {
  for (const [command, keywords] of COMMANDS) {
    if (keywords.some((kw) => transcript.includes(kw))) {
      return command;
    }
  }
  return null;
}
