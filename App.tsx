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
  ScrollView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";

// Configure your backend (prefer EXPO_PUBLIC_BACKEND_URL for builds)
const BACKEND =
  process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ||
  "http://192.168.1.49:4000";

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const [busy, setBusy] = useState(false);
  const [lastText, setLastText] = useState<string>("");
  const [showTranscript, setShowTranscript] = useState<boolean>(true); // set false to hide by default
  const captureBtnRef = useRef<View | null>(null);

  // Robust audio session: play in Silent mode, mix with VO
  useEffect(() => {
    (async () => {
      try {
        await Audio.setIsEnabledAsync(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,                 // PlayAndRecord category helps with Silent mode
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          playThroughEarpieceAndroid: false,
        });
      } catch {
        // no-op
      }
    })();
  }, []);

  // Initial accessibility hint once permission is granted
  useEffect(() => {
    (async () => {
      if (!permission) return;
      if (!permission.granted) {
        const { granted } = await requestPermission();
        if (!granted) return;
      }

      try {
        await speakAsync("Camera ready. Double tap the button below to take a photo.");
      } catch {}
      const node = findNodeHandle(captureBtnRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    })();
  }, [permission]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.mono}>Requesting camera permission…</Text>
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

  async function onCapture() {
    if (busy) return;

    setBusy(true);
    try {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      AccessibilityInfo.announceForAccessibility("Photo taken. Processing.");
      await delay(600); // avoid VO/TTS collision

      const photo = await cameraRef.current?.takePictureAsync({
        base64: true,
        quality: 0.65,
        skipProcessing: true,
      });
      if (!photo?.base64) throw new Error("Failed to capture image");

      const dataUrl = `data:image/jpeg;base64,${photo.base64}`;
      const resp = await fetch(`${BACKEND}/ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });

      if (!resp.ok) {
        const errBody = await safeJson(resp);
        throw new Error(errBody?.error || `Server error ${resp.status}`);
      }

      const json = (await resp.json()) as { text?: string; error?: string };
      const text = (json.text ?? "").trim();
      setLastText(text);

      if (!text) {
        AccessibilityInfo.announceForAccessibility(
          "I couldn't read any text. Try again with better lighting or framing."
        );
        await speakAsync("I couldn't read any text. Please try again with better lighting or framing.");
      } else {
        AccessibilityInfo.announceForAccessibility("Reading now.");
        await delay(600);
        await speakAll(text);
      }
    } catch (e: any) {
      const msg = String(e?.message || e || "Unexpected error");
      AccessibilityInfo.announceForAccessibility(`Error: ${msg}`);
      try { await speakAsync(`Error: ${msg}`); } catch {}
    } finally {
      try { await Haptics.selectionAsync(); } catch {}
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        accessibilityLabel="Camera view. Double tap the button at the bottom to capture."
      />

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text style={styles.appTitle}>Blind Document Reader</Text>
          <Text style={styles.appSubtitle}>
            Point at a document and tap “Capture & Read”
          </Text>
        </View>

        <Pressable
          ref={captureBtnRef}
          onPress={onCapture}
          disabled={busy}
          style={[styles.primaryBtnLarge, busy && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Capture and read document"
        >
          {busy ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.primaryBtnLargeText}>Capture & Read</Text>
          )}
        </Pressable>

        <View style={styles.controlsRow}>
          <Pressable
            onPress={() => setShowTranscript((s) => !s)}
            style={styles.secondaryBtn}
            accessibilityRole="button"
            accessibilityLabel={showTranscript ? "Hide transcript" : "Show transcript"}
          >
            <Text style={styles.secondaryBtnText}>
              {showTranscript ? "Hide Transcript" : "Show Transcript"}
            </Text>
          </Pressable>

          {lastText ? (
            <Pressable
              onPress={() => setLastText("")}
              style={[styles.secondaryBtn, { marginLeft: 10 }]}
              accessibilityRole="button"
              accessibilityLabel="Clear transcript"
            >
              <Text style={styles.secondaryBtnText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {showTranscript && !!lastText && (
          <View style={styles.transcriptCard}>
            <Text style={styles.transcriptTitle}>Transcript</Text>
            <ScrollView style={{ maxHeight: 160 }}>
              <Text selectable style={styles.transcriptText}>
                {lastText}
              </Text>
            </ScrollView>
          </View>
        )}

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

/* ---------------------------- Speech helpers ---------------------------- */

async function speakAsync(utterance: string): Promise<void> {
  return new Promise(async (resolve) => {
    try {
      try {
        const speaking = await Speech.isSpeakingAsync();
        if (speaking) {
          Speech.stop();
          await delay(80);
        }
      } catch {}

      // Re-assert audio mode just-in-time (helps keep Silent-mode playback reliable)
      try {
        await Audio.setIsEnabledAsync(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          playThroughEarpieceAndroid: false,
        });
      } catch {}

      Speech.speak(utterance, {
        language: "en-US",
        pitch: 1.0,
        rate: 0.98,
        volume: 1.0,
        onDone: resolve,
        onStopped: resolve,
        onError: () => resolve(),
      });
    } catch {
      resolve();
    }
  });
}

async function speakAll(text: string) {
  const chunks = splitIntoChunks(text, 700);
  for (const c of chunks) await speakAsync(c);
}

function splitIntoChunks(s: string, max: number): string[] {
  const out: string[] = [];
  const parts = s.replace(/\s+/g, " ").split(/(?<=[\.\?\!])\s+/g);
  let buf = "";
  for (const p of parts) {
    if ((buf + " " + p).trim().length <= max) buf = (buf ? buf + " " : "") + p;
    else {
      if (buf) out.push(buf);
      if (p.length <= max) out.push(p);
      else for (let i = 0; i < p.length; i += max) out.push(p.slice(i, i + max));
      buf = "";
    }
  }
  if (buf) out.push(buf);
  return out;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeJson(resp: Response) {
  try { return await resp.json(); } catch { return null; }
}

/* -------------------------------- Styles -------------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
  camera: { flex: 1 },

  // Bottom sheet
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "rgba(9, 9, 11, 0.78)", // near-black with transparency
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  headerRow: { marginBottom: 10 },
  appTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  appSubtitle: {
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
    fontSize: 13,
  },

  primaryBtnLarge: {
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1f2937", // slate-800
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  primaryBtnLargeText: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  controlsRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  secondaryBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  transcriptCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(2,6,23,0.66)", // slate-950 w/ alpha
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  transcriptTitle: {
    color: "white",
    fontWeight: "800",
    marginBottom: 6,
  },
  transcriptText: {
    color: "#e5e7eb",
    lineHeight: 20,
  },

  footerNote: {
    marginTop: 10,
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    textAlign: "center",
  },

  // Permission screen
  center: {
    flex: 1,
    backgroundColor: "black",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  mono: { color: "white", opacity: 0.85 },

  card: {
    width: "92%",
    padding: 18,
    borderRadius: 16,
    backgroundColor: "rgba(17,24,39,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  title: {
    color: "white",
    fontWeight: "800",
    fontSize: 18,
    marginBottom: 6,
  },
  bodyText: { color: "rgba(255,255,255,0.8)" },

  primaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f2937",
    height: 48,
    borderRadius: 12,
  },
  primaryBtnText: { color: "white", fontSize: 16, fontWeight: "800" },
});
