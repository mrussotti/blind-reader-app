import {
  playSuccessHaptic,
  playErrorHaptic,
  playButtonHaptic,
} from "../src/utils/haptics";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: {
    Success: "success",
    Error: "error",
    Warning: "warning",
  },
}));

const Haptics = require("expo-haptics");

describe("haptics", () => {
  beforeEach(() => jest.clearAllMocks());

  it("playSuccessHaptic fires two medium impacts", async () => {
    await playSuccessHaptic();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("medium");
  });

  it("playErrorHaptic fires error notification", async () => {
    await playErrorHaptic();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("error");
  });

  it("playButtonHaptic fires light impact", async () => {
    await playButtonHaptic();
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
  });

  it("haptics swallow errors gracefully", async () => {
    Haptics.impactAsync.mockRejectedValue(new Error("No haptic engine"));
    await expect(playSuccessHaptic()).resolves.toBeUndefined();
  });
});
