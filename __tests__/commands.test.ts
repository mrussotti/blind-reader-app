import { parseCommand } from "../src/commands";

test.each([
  ["please read it again", "again"],
  ["start over", "again"],
  ["slower", "slower"],
  ["slow down please", "slower"],
  ["too fast", "slower"],
  ["speed up", "faster"],
  ["too slow", "faster"],
  ["stop", "stop"],
  ["that's all", "done"],
  ["all done", "done"],
  ["continue", "resume"],
  ["keep reading", "resume"],
  ["next page", "next"],
  ["help", "help"],
  ["", null],
  ["what a lovely day", null],
] as Array<[string, string | null]>)("parses %p as %p", (input, expected) => {
  expect(parseCommand(input)).toBe(expected);
});
