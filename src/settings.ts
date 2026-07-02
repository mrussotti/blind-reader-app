import AsyncStorage from "@react-native-async-storage/async-storage";

const RATE_KEY = "mailreader.playbackRate";

export const DEFAULT_RATE = 1.0;
export const MIN_RATE = 0.6;
export const MAX_RATE = 1.4;
export const RATE_STEP = 0.15;

export function clampRate(rate: number): number {
  return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
}

export async function loadRate(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(RATE_KEY);
    const parsed = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(parsed) ? clampRate(parsed) : DEFAULT_RATE;
  } catch {
    return DEFAULT_RATE;
  }
}

export async function saveRate(rate: number): Promise<void> {
  try {
    await AsyncStorage.setItem(RATE_KEY, String(rate));
  } catch {}
}
