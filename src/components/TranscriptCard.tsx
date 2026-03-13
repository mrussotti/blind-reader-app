import React from "react";
import { View, Text, ScrollView } from "react-native";
import { styles } from "../styles";

interface Props {
  text: string;
  visible: boolean;
}

export function TranscriptCard({ text, visible }: Props) {
  if (!visible || !text) return null;

  return (
    <View style={styles.transcriptCard}>
      <Text style={styles.transcriptTitle}>Transcript</Text>
      <ScrollView style={{ maxHeight: 160 }}>
        <Text selectable style={styles.transcriptText}>
          {text}
        </Text>
      </ScrollView>
    </View>
  );
}
