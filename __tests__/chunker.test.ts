import { splitIntoChunks, splitSentences } from "../src/chunker";

describe("splitSentences", () => {
  it("splits on sentence punctuation", () => {
    expect(splitSentences("Hello there. How are you? Fine!")).toEqual([
      "Hello there.",
      "How are you?",
      "Fine!",
    ]);
  });

  it("treats line breaks as boundaries", () => {
    expect(splitSentences("Dear John\nGreetings from Acme")).toEqual([
      "Dear John",
      "Greetings from Acme",
    ]);
  });

  it("returns empty for empty text", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("  \n ")).toEqual([]);
  });
});

describe("splitIntoChunks", () => {
  it("returns empty for empty text", () => {
    expect(splitIntoChunks("")).toEqual([]);
  });

  it("keeps short text as one chunk", () => {
    expect(splitIntoChunks("Hello there.")).toEqual(["Hello there."]);
  });

  it("keeps the first chunk small and respects the max", () => {
    const sentence = "This sentence is about sixty characters long, more or less.";
    const text = Array(30).fill(sentence).join(" ");
    const chunks = splitIntoChunks(text, { firstMax: 280, max: 600 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThanOrEqual(280);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(600);
    }
  });

  it("does not lose any words", () => {
    const text = "One. Two two. Three three three. ".repeat(50).trim();
    const joined = splitIntoChunks(text).join(" ").replace(/\s+/g, " ").trim();
    expect(joined).toBe(text.replace(/\s+/g, " ").trim());
  });

  it("hard-splits a single run-on longer than the max", () => {
    const runOn = "word ".repeat(300).trim();
    const chunks = splitIntoChunks(runOn, { firstMax: 280, max: 600 });
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(600);
    }
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(runOn);
  });
});
