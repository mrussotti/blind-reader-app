import { useRef, useState, useCallback } from "react";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import { setIsAudioActiveAsync, setAudioModeAsync } from "expo-audio";
import { ttsRequest } from "../services/api";

export function useTTS() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  /** Stop all audio: local Speech and any playing Sound. */
  const stopAll = useCallback(async () => {
    Speech.stop();
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  /** Speak a short message using the device's local TTS (expo-speech). Instant, works offline. */
  const speakLocal = useCallback(
    async (text: string): Promise<void> => {
      await stopAll();
      return new Promise<void>((resolve) => {
        Speech.speak(text, {
          language: "en-US",
          rate: 0.9,
          onDone: () => resolve(),
          onError: () => resolve(),
          onStopped: () => resolve(),
        });
      });
    },
    [stopAll]
  );

  /** Play a document through server-side OpenAI TTS (higher quality). */
  const speakWithServerTTS = useCallback(
    async (text: string, voice: string = "nova"): Promise<void> => {
      await stopAll();
      setIsPlaying(true);

      try {
        await setIsAudioActiveAsync(true);
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
        });

        const base64Audio = await ttsRequest(text, voice);

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: `data:audio/mpeg;base64,${base64Audio}` },
          { shouldPlay: true }
        );

        soundRef.current = newSound;

        await new Promise<void>((resolve) => {
          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              resolve();
            }
          });
        });

        await newSound.unloadAsync();
        soundRef.current = null;
        setIsPlaying(false);
      } catch (error) {
        setIsPlaying(false);
        throw error;
      }
    },
    [stopAll]
  );

  /**
   * Read a document aloud. Tries server TTS first (high quality),
   * falls back to local TTS (expo-speech) if the server is unavailable.
   */
  const speakDocument = useCallback(
    async (text: string, voice: string = "nova"): Promise<void> => {
      try {
        await speakWithServerTTS(text, voice);
      } catch {
        // Fallback to local TTS — lower quality but the user still hears the text
        await speakLocal(text);
      }
    },
    [speakWithServerTTS, speakLocal]
  );

  /** Clean up audio resources on unmount. */
  const cleanup = useCallback(async () => {
    await stopAll();
  }, [stopAll]);

  return {
    speakLocal,
    speakDocument,
    stopAll,
    isPlaying,
    cleanup,
  };
}
