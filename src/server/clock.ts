/** The only way the server finds out what time it is, so tests can control time. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
