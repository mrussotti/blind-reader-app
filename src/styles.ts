import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },

  cameraWrap: { flex: 1 },
  camera: { flex: 1 },

  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "rgba(9, 9, 11, 0.78)",
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
    backgroundColor: "#1f2937",
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
    flexWrap: "wrap",
    gap: 0,
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
    backgroundColor: "rgba(2,6,23,0.66)",
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
