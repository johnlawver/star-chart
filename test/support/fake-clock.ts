import type { Clock } from "../../src/server/clock.js";

/** A clock that only moves when a test tells it to. */
export class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  set(to: Date): void {
    this.current = new Date(to);
  }

  advanceBy(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}
