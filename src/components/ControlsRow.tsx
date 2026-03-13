import React from "react";
import { View, Pressable, Text } from "react-native";
import { styles } from "../styles";
import { playButtonHaptic } from "../utils/haptics";

interface Props {
  showTranscript: boolean;
  onToggleTranscript: () => void;
  hasText: boolean;
  onClear: () => void;
  onReplay: () => void;
  onStop: () => void;
  isPlaying: boolean;
}

export function ControlsRow({
  showTranscript,
  onToggleTranscript,
  hasText,
  onClear,
  onReplay,
  onStop,
  isPlaying,
}: Props) {
  return (
    <View style={styles.controlsRow}>
      <Pressable
        onPress={async () => {
          await playButtonHaptic();
          onToggleTranscript();
        }}
        style={styles.secondaryBtn}
        accessibilityRole="button"
        accessibilityLabel={
          showTranscript ? "Hide transcript" : "Show transcript"
        }
      >
        <Text style={styles.secondaryBtnText}>
          {showTranscript ? "Hide Transcript" : "Show Transcript"}
        </Text>
      </Pressable>

      {hasText && (
        <Pressable
          onPress={async () => {
            await playButtonHaptic();
            onReplay();
          }}
          style={[styles.secondaryBtn, { marginLeft: 10 }]}
          accessibilityRole="button"
          accessibilityLabel="Replay document reading"
        >
          <Text style={styles.secondaryBtnText}>Replay</Text>
        </Pressable>
      )}

      {isPlaying && (
        <Pressable
          onPress={async () => {
            await playButtonHaptic();
            onStop();
          }}
          style={[styles.secondaryBtn, { marginLeft: 10 }]}
          accessibilityRole="button"
          accessibilityLabel="Stop audio"
        >
          <Text style={styles.secondaryBtnText}>Stop</Text>
        </Pressable>
      )}

      {hasText && (
        <Pressable
          onPress={async () => {
            await playButtonHaptic();
            onClear();
          }}
          style={[styles.secondaryBtn, { marginLeft: 10 }]}
          accessibilityRole="button"
          accessibilityLabel="Clear transcript"
        >
          <Text style={styles.secondaryBtnText}>Clear</Text>
        </Pressable>
      )}
    </View>
  );
}
