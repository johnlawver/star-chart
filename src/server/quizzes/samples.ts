import { randomInt } from "node:crypto";
import type { QuizItem, SampleSet } from "../database.js";

// Built-in sample quizzes, so a topic works before anyone (a grown-up, or the quiz feed) has written any.
// Each level makes them a little harder.

const spellingWords: string[][] = [
  ["cat", "dog", "sun", "hat", "bed", "pig", "cup", "red", "big", "run"],
  ["the", "said", "was", "you", "they", "have", "come", "some", "what", "there"],
  ["because", "friend", "people", "before", "again", "school", "water", "little", "could", "would"],
];

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Some distinct picks from a list. */
function pick<T>(from: readonly T[], count: number): T[] {
  const pool = [...from];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) picked.push(...pool.splice(randomInt(0, pool.length), 1));
  return picked;
}

export function sampleQuiz(set: SampleSet, level: number): { title: string; instructions: string; items: QuizItem[] } {
  switch (set) {
    case "addition": {
      // Level 1: sums up to 5; level 2: up to 10; and so on.
      const most = 5 * level;
      const items = Array.from({ length: 10 }, () => {
        const a = randomInt(0, most + 1);
        const b = randomInt(0, most - a + 1);
        return { prompt: `${a} + ${b} =`, answer: String(a + b) };
      });
      return { title: "Addition", instructions: "Write the answer to each one.", items };
    }
    case "subtraction": {
      const most = 5 * level;
      const items = Array.from({ length: 10 }, () => {
        const a = randomInt(0, most + 1);
        const b = randomInt(0, a + 1);
        return { prompt: `${a} - ${b} =`, answer: String(a - b) };
      });
      return { title: "Subtraction", instructions: "Write the answer to each one.", items };
    }
    case "letters": {
      // Level 1: capital letters; from level 2, lowercase too.
      const items = pick([...letters], 6).map((letter) => {
        const shown = level >= 2 && randomInt(0, 2) === 1 ? letter.toLowerCase() : letter;
        return { prompt: `Find the letter ${shown}`, answer: shown };
      });
      return { title: "Letters", instructions: "Point to each letter and say it out loud.", items };
    }
    case "numbers": {
      const items = pick(
        Array.from({ length: 10 * level + 1 }, (_, n) => n),
        6,
      ).map((n) => ({ prompt: `Find the number ${n}`, answer: String(n) }));
      return { title: "Numbers", instructions: "Point to each number and say it out loud.", items };
    }
    case "spelling": {
      const words = spellingWords[Math.min(level, spellingWords.length) - 1]!;
      const items = pick(words, 6).map((word) => ({ prompt: `Spell: ${word}`, answer: word }));
      return { title: "Spelling", instructions: "A grown-up reads each word; write it down.", items };
    }
  }
}
