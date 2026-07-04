import React, { useEffect, useReducer, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";

import { MailReaderMachine } from "./src/machine";
import { styles } from "./src/styles";

export default function App() {
  useKeepAwake();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const machineRef = useRef<MailReaderMachine | null>(null);
  const startedRef = useRef(false);
  const [torch, setTorch] = useState(false);
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) {
      if (permission.canAskAgain) void requestPermission();
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const machine = new MailReaderMachine({
      takeSnapshot: async () => {
        const photo = await cameraRef.current?.takePictureAsync({
          base64: true,
          quality: 0.2,
          skipProcessing: true,
        });
        if (!photo?.base64) throw new Error("snapshot failed");
        return `data:image/jpeg;base64,${photo.base64}`;
      },
      takeCapture: async () => {
        const photo = await cameraRef.current?.takePictureAsync({
          base64: true,
          quality: 0.7,
          skipProcessing: true,
        });
        if (!photo?.base64) throw new Error("capture failed");
        return `data:image/jpeg;base64,${photo.base64}`;
      },
      setTorch,
    });
    machineRef.current = machine;
    machine.subscribe(forceRender);
    void machine.start();
    // The root component never unmounts in practice; the machine lives for
    // the life of the app.
  }, [permission]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.title}>Camera permission needed</Text>
          <Text style={styles.bodyText}>
            Mail Reader uses the camera to read letters out loud.
          </Text>
          <Pressable
            onPress={() => requestPermission()}
            style={styles.primaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Grant camera permission"
          >
            <Text style={styles.primaryBtnText}>Grant Permission</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const machine = machineRef.current;
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        animateShutter={false}
      />
      <Pressable
        style={styles.overlay}
        onPress={() => machineRef.current?.onTap()}
        accessibilityRole="button"
        accessibilityLabel="Mail Reader. Tap anywhere to pause or continue."
      >
        <View style={styles.topBanner}>
          <Text style={styles.status}>{machine?.statusLine ?? "Starting…"}</Text>
          {machine && !machine.voiceEnabled ? (
            <Text style={styles.hint}>
              Voice commands off (Expo Go) — tap to pause and continue
            </Text>
          ) : null}
        </View>
        {machine?.summary || machine?.text ? (
          <View style={styles.sheet} pointerEvents="box-none">
            {machine?.summary ? <Text style={styles.summary}>{machine.summary}</Text> : null}
            {machine?.text ? (
              <ScrollView style={styles.transcriptScroll}>
                <Text style={styles.transcript}>{machine.text}</Text>
              </ScrollView>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
