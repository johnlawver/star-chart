/**
 * Every small animation on the observatory, by name, with its timing in one place. Screens use them as the class
 * `anim-<name>`. They move and fade only (transform and opacity), so an old picture frame keeps up.
 *
 * Some read CSS variables set where they're used: confetti reads `--dx`/`--dy` (where a piece ends up) and the flights
 * read `--fx`/`--fy` (where a star lands).
 *
 * Every animation ends. On the picture frame a looping animation keeps a whole processor core busy for as long as it
 * runs; a finished one costs nothing.
 */
export interface Animation {
  what: string;
  durationMs: number;
  easing: string;
  /** How many times it plays. Always a number: nothing loops on the frame. */
  repeat: number;
  keyframes: string;
}

export const animations = {
  sparkle: {
    what: "A star flaring up once, then settling",
    durationMs: 1400,
    easing: "ease-out",
    repeat: 1,
    keyframes: "0% { transform: scale(1); opacity: 0.6; } 30% { transform: scale(1.6) rotate(20deg); opacity: 1; } 100% { transform: scale(1); opacity: 1; }",
  },
  "fly-in": {
    what: "A new star hopping up, then flying into the jar",
    durationMs: 900,
    easing: "cubic-bezier(.5,-0.3,.6,1.2)",
    repeat: 1,
    keyframes: `0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
      15% { transform: translate(0, -40px) scale(1.3); opacity: 1; }
      100% { transform: translate(var(--fx), var(--fy)) scale(0.6); opacity: 1; }`,
  },
  "fly-out": {
    what: "A star leaving the jar to pay for something",
    durationMs: 800,
    easing: "cubic-bezier(.3,.7,.4,1)",
    repeat: 1,
    keyframes: `0% { transform: translate(0, 0) scale(0.6); opacity: 1; }
      100% { transform: translate(var(--fx), var(--fy)) scale(1.1); opacity: 0; }`,
  },
  confetti: {
    what: "A piece of confetti bursting out from the middle",
    durationMs: 1300,
    easing: "cubic-bezier(.2,.8,.3,1)",
    repeat: 1,
    keyframes: `0% { transform: translate(0, 0) rotate(0) scale(0.4); opacity: 1; }
      80% { opacity: 1; }
      100% { transform: translate(var(--dx), var(--dy)) rotate(540deg) scale(1); opacity: 0; }`,
  },
  hop: {
    what: "The mascot giving one short hop",
    durationMs: 700,
    easing: "ease-in-out",
    repeat: 1,
    keyframes: "0%, 100% { transform: translateY(0); } 40% { transform: translateY(-24px); } 70% { transform: translateY(4px); }",
  },
  "ticket-slide": {
    what: "A printed ticket sliding out of the top",
    durationMs: 1600,
    easing: "cubic-bezier(.2,.9,.3,1)",
    repeat: 1,
    keyframes: "0% { transform: translateY(-100%); } 100% { transform: translateY(0); }",
  },
  pop: {
    what: "A message or sticker popping into place",
    durationMs: 500,
    easing: "cubic-bezier(.3,1.6,.5,1)",
    repeat: 1,
    keyframes: "0% { transform: scale(0.3); opacity: 0; } 100% { transform: scale(1); opacity: 1; }",
  },
  wiggle: {
    what: "Something you can't have yet, shaking its head",
    durationMs: 600,
    easing: "ease-in-out",
    repeat: 3,
    keyframes: "0%, 100% { transform: rotate(0); } 25% { transform: rotate(-8deg); } 75% { transform: rotate(8deg); }",
  },
} satisfies Record<string, Animation>;

export type AnimationName = keyof typeof animations;

/** The CSS for every animation, as `.anim-<name>` classes. Delays can be added per element with `animation-delay`. */
export const animationCss = Object.entries(animations)
  .map(
    ([name, a]: [string, Animation]) =>
      `@keyframes anim-${name} { ${a.keyframes} }\n` +
      `.anim-${name} { animation: anim-${name} ${a.durationMs}ms ${a.easing} ${a.repeat} both; }`,
  )
  .join("\n");
