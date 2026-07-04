import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBanner: {
    paddingTop: 64,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  status: { color: "#fff", fontSize: 30, fontWeight: "800" },
  hint: { color: "#ffd60a", fontSize: 15, marginTop: 6 },
  sheet: {
    maxHeight: "45%",
    backgroundColor: "rgba(0,0,0,0.75)",
    padding: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  summary: { color: "#ffd60a", fontSize: 22, fontWeight: "700", marginBottom: 10 },
  transcriptScroll: { flexGrow: 0 },
  transcript: { color: "#fff", fontSize: 18, lineHeight: 26 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 8 },
  bodyText: { color: "#ddd", fontSize: 17, lineHeight: 24 },
  primaryBtn: {
    backgroundColor: "#0a84ff",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  card: { margin: 24, padding: 24, backgroundColor: "#111", borderRadius: 18 },
});
