import type { FrameCheckResult } from "../src/api";
import { FramingController, FramingDeps } from "../src/framing";

type Step = FrameCheckResult | Error;

const good: FrameCheckResult = { status: "good", cue: null, needsLight: false };
const noDoc: FrameCheckResult = { status: "no_document", cue: null, needsLight: false };
const adjust = (cue: string, needsLight = false): FrameCheckResult => ({
  status: "adjust",
  cue,
  needsLight,
});

function makeHarness(script: Step[]) {
  let time = 0;
  let call = 0;
  const spoken: string[] = [];
  const torch: boolean[] = [];
  let captures = 0;
  const deps: FramingDeps = {
    takeSnapshot: async () => "snap",
    takeCapture: async () => {
      captures++;
      return "photo-data";
    },
    frameCheck: async () => {
      const step = script[Math.min(call, script.length - 1)];
      call++;
      if (step instanceof Error) throw step;
      return step;
    },
    speak: async (text) => {
      spoken.push(text);
    },
    setTorch: (on) => {
      torch.push(on);
    },
    hapticCapture: () => {},
    delay: async (ms) => {
      time += ms;
    },
    now: () => time,
  };
  return { deps, spoken, torch, captures: () => captures, calls: () => call };
}

it("captures after two consecutive good frames", async () => {
  const h = makeHarness([adjust("Move the phone left."), good, good]);
  const outcome = await new FramingController(h.deps).run();
  expect(outcome).toEqual({ kind: "photo", image: "photo-data" });
  expect(h.captures()).toBe(1);
});

it("a good streak interrupted by a bad frame starts over", async () => {
  const h = makeHarness([good, adjust("Hold still."), good, good]);
  const outcome = await new FramingController(h.deps).run();
  expect(outcome).toEqual({ kind: "photo", image: "photo-data" });
  expect(h.calls()).toBe(4);
});

it("speaks a repeated cue once, not on every frame", async () => {
  const h = makeHarness([
    adjust("Move the phone left."),
    adjust("Move the phone left."),
    adjust("Move the phone left."),
    good,
    good,
  ]);
  await new FramingController(h.deps).run();
  expect(h.spoken.filter((s) => s === "Move the phone left.").length).toBe(1);
});

it("turns on the torch when the frame is dark", async () => {
  const h = makeHarness([adjust("Turn on a light.", true), good, good]);
  await new FramingController(h.deps).run();
  expect(h.torch).toContain(true);
});

it("prompts gently when no page is visible, throttled", async () => {
  const h = makeHarness([...Array(30).fill(noDoc), good, good]);
  await new FramingController(h.deps).run();
  const prompts = h.spoken.filter((s) => s.startsWith("I don't see a page"));
  expect(prompts.length).toBe(2);
});

it("speaks about server trouble after repeated errors, throttled", async () => {
  const err = new Error("network");
  const h = makeHarness([err, err, err, err, good, good]);
  await new FramingController(h.deps).run();
  const trouble = h.spoken.filter((s) => s.includes("trouble reaching the server"));
  expect(trouble.length).toBe(1);
});

it("goes idle after a long stretch of empty frames", async () => {
  const h = makeHarness([noDoc]);
  const outcome = await new FramingController(h.deps).run();
  expect(outcome).toEqual({ kind: "idle" });
});

it("goes idle when the server stays unreachable", async () => {
  const h = makeHarness([new Error("down")]);
  const outcome = await new FramingController(h.deps).run();
  expect(outcome).toEqual({ kind: "idle" });
});

it("returns cancelled when cancelled mid-run", async () => {
  const h = makeHarness([noDoc]);
  const controller = new FramingController(h.deps);
  const original = h.deps.frameCheck;
  h.deps.frameCheck = async (image) => {
    controller.cancel();
    return original(image);
  };
  const outcome = await controller.run();
  expect(outcome).toEqual({ kind: "cancelled" });
});
