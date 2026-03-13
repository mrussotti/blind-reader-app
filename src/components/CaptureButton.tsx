import React from "react";
import { Pressable, Text, ActivityIndicator, View } from "react-native";
import { styles } from "../styles";

interface Props {
  onCapture: () => void;
  busy: boolean;
}

export const CaptureButton = React.forwardRef<View, Props>(
  ({ onCapture, busy }, ref) => (
    <Pressable
      ref={ref}
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
  )
);
