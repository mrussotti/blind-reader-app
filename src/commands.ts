export type Command =
  | "again"
  | "slower"
  | "faster"
  | "stop"
  | "next"
  | "done"
  | "resume"
  | "help";

/** Order matters: earlier entries win when keywords overlap. */
const TABLE: Array<[Command, string[]]> = [
  ["slower", ["slower", "slow down", "too fast"]],
  ["faster", ["faster", "speed up", "too slow"]],
  ["again", ["again", "repeat", "start over", "one more time", "replay"]],
  ["resume", ["continue", "resume", "keep reading", "keep going", "go on"]],
  ["next", ["next", "another page", "new page"]],
  ["done", ["done", "finished", "all done", "no more", "that's all"]],
  ["stop", ["stop", "quiet", "enough"]],
  ["help", ["help", "what can i say"]],
];

export function parseCommand(transcript: string): Command | null {
  const t = transcript.toLowerCase().trim();
  if (!t) return null;
  for (const [command, keywords] of TABLE) {
    if (keywords.some((kw) => t.includes(kw))) return command;
  }
  return null;
}
