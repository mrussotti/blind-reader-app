import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  AccessibilityInfo,
  findNodeHandle,
  StyleSheet,
  Platform,
} from "react-native";
import { CameraView } from "expo-camera";
import * as Haptics from "expo-haptics";
import { setIsAudioActiveAsync, setAudioModeAsync } from "expo-audio";

import { useCamera } from "./src/hooks/useCamera";
import { useTTS } from "./src/hooks/useTTS";
import { useVoiceCommands } from "./src/hooks/useVoiceCommands";
import { healthCheck, pingServer, ocrRequest } from "./src/services/api";
import {
  playSuccessHaptic,
  playErrorHaptic,
} from "./src/utils/haptics";
import { CaptureButton } from "./src/components/CaptureButton";
import { ControlsRow } from "./src/components/ControlsRow";
import { TranscriptCard } from "./src/components/TranscriptCard";
import { styles } from "./src/styles";

const DOUBLE_TAP_MS = 325;

export default function App() {
  const { cameraRef, permission, requestPermission, takePicture } = useCamera();
  const { speakLocal, speakDocument, stopAll, isPlaying, cleanup } = useTTS();

  const [busy, setBusy] = useState(false);
  const [lastText, setLastText] = useState("");
  const [showTranscript, setShowTranscript] = useState(true);

  const captureBtnRef = useRef<View | null>(null);
  const lastTapTsRef = useRef<number>(0);

  // ── Voice commands ──

  const commandHandlerRef = useRef<((cmd: string) => Promise<void>) | null>(
    null
  );
  const { startListening, stopListening } =
    useVoiceCommands(commandHandlerRef);

  // Always keep the handler fresh so it sees latest state
  commandHandlerRef.current = async (command: string) => {
    stopListening();

    switch (command) {
      case "capture":
        await onCapture();
        break;
      case "replay":
        if (lastText) {
          await speakDocument(lastText);
        } else {
          await speakLocal(
            "No document to replay. Say capture to take a photo."
          );
        }
        break;
      case "stop":
        await stopAll();
        await speakLocal("Stopped.");
        break;
      case "clear":
        setLastText("");
        await speakLocal("Transcript cleared.");
        break;
      case "help":
        await speakLocal(
          "Available commands. " +
            "Say capture to take a photo. " +
            "Say replay to hear the document again. " +
            "Say stop to stop audio. " +
            "Say clear to clear the transcript."
        );
        break;
    }

    // Resume listening after the action finishes
    await delay(300);
    startListening();
  };

  // ── Initialization: audio setup, server warm-up, welcome ──

  useEffect(() => {
    (async () => {
      try {
        await setIsAudioActiveAsync(true);
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
        });
      } catch (err) {
        console.warn("Failed to configure audio session:", err);
      }

      if (!permission) return;
      if (!permission.granted) {
        const { granted } = await requestPermission();
        if (!granted) return;
      }

      // Wake the Render instance in background
      pingServer();

      await delay(500);

      // Check if server is warming up
      const serverOk = await healthCheck();
      if (!serverOk) {
        await speakLocal("Server is warming up. This may take a moment.");
      }

      await speakLocal(
        "Camera ready. You can say capture to take a photo, " +
          "or double tap anywhere on the screen. Say help for all commands."
      );

      const node = findNodeHandle(captureBtnRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);

      // Start listening for voice commands
      await delay(300);
      startListening();
    })();

    return () => {
      stopListening();
      cleanup();
    };
  }, [permission]);

  // ── Permission screens ──

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.mono}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.title}>Permission needed</Text>
          <Text style={styles.bodyText}>
            We need access to your camera to capture documents for reading.
          </Text>
          <Pressable
            onPress={() => requestPermission()}
            style={[styles.primaryBtn, { marginTop: 16 }]}
            accessibilityRole="button"
            accessibilityLabel="Grant camera permission"
          >
            <Text style={styles.primaryBtnText}>Grant Permission</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Capture flow ──

  async function onCapture() {
    if (busy) return;
    setBusy(true);

    try {
      // 1. Take photo + check server health in parallel
      const [dataUrl, serverOk] = await Promise.all([
        takePicture(),
        healthCheck(),
      ]);

      if (!serverOk) {
        await playErrorHaptic();
        await speakLocal(
          "Cannot reach server. Please check your internet connection."
        );
        return;
      }

      // 2. Photo succeeded — announce (fixes race condition: photo FIRST, then announce)
      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } catch {}

      await speakLocal("Photo captured. Processing document.");

      // 3. Send to OCR (30 s timeout via api.ts)
      const result = await ocrRequest(dataUrl);
      const text = (result.text ?? "").trim();
      const guidance = result.guidance?.trim();

      setLastText(text);

      // 4. Speak positioning guidance if the model provided it
      if (guidance) {
        await speakLocal(guidance);
      }

      if (!text) {
        await playErrorHaptic();
        AccessibilityInfo.announceForAccessibility(
          "I couldn't read any text. Try again with better lighting or framing."
        );
        await speakLocal(
          "I couldn't read any text from this image. " +
            "Please try again with better lighting, and make sure the document is centered and in focus."
        );
      } else {
        await playSuccessHaptic();
        AccessibilityInfo.announceForAccessibility("Reading now.");
        await speakLocal("Document ready. Reading now.");
        await delay(400);
        await speakDocument(text);
      }
    } catch (e: any) {
      await playErrorHaptic();

      let errorMessage = "Something went wrong.";
      let guidance = "Please try again.";
      const errorStr = String(e?.message || e || "");

      if (
        errorStr.includes("Network request failed") ||
        errorStr.includes("Failed to fetch") ||
        errorStr.includes("aborted")
      ) {
        errorMessage = "Cannot connect to server.";
        guidance =
          "Please check your internet connection and try again.";
      } else if (errorStr === "SERVER_ERROR") {
        errorMessage = "Server error occurred.";
        guidance = "Please wait a moment and try again.";
      } else if (errorStr === "SERVER_NOT_FOUND") {
        errorMessage = "Cannot reach server.";
        guidance = "Please make sure the server is running.";
      } else if (errorStr.includes("Failed to capture image")) {
        errorMessage = "Camera error.";
        guidance = "Failed to take the photo. Please try again.";
      } else {
        errorMessage = "An unexpected error occurred.";
        guidance = errorStr.substring(0, 100);
      }

      const fullMessage = `${errorMessage} ${guidance}`;
      AccessibilityInfo.announceForAccessibility(fullMessage);
      await speakLocal(fullMessage);
    } finally {
      try {
        await Haptics.selectionAsync();
      } catch {}
      setBusy(false);
    }
  }

  // ── Double-tap handler for non-VoiceOver users ──

  function onCameraTap() {
    const now = Date.now();
    if (now - lastTapTsRef.current <= DOUBLE_TAP_MS) {
      lastTapTsRef.current = 0;
      onCapture();
    } else {
      lastTapTsRef.current = now;
    }
  }

  // ── UI ──

  return (
    <View style={styles.root}>
      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          accessibilityLabel="Camera view. Double tap anywhere on the camera to capture."
        />
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onCameraTap}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View pointerEvents="none" />
        </Pressable>
      </View>

      <View style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text style={styles.appTitle}>Blind Document Reader</Text>
          <Text style={styles.appSubtitle}>
            Voice controlled — say "capture", "replay", "stop", or "help".
          </Text>
        </View>

        <CaptureButton
          ref={captureBtnRef}
          onCapture={onCapture}
          busy={busy}
        />

        <ControlsRow
          showTranscript={showTranscript}
          onToggleTranscript={() => {
            setShowTranscript((s) => !s);
            speakLocal(
              showTranscript ? "Transcript hidden" : "Transcript shown"
            );
          }}
          hasText={!!lastText}
          onClear={() => {
            setLastText("");
            speakLocal("Transcript cleared");
          }}
          onReplay={() => speakDocument(lastText)}
          onStop={stopAll}
          isPlaying={isPlaying}
        />

        <TranscriptCard text={lastText} visible={showTranscript} />

        <Text style={styles.footerNote}>
          {Platform.select({
            ios: "Audio plays even in Silent mode.",
            android: "Audio plays with system media volume.",
          })}
        </Text>
      </View>
    </View>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
