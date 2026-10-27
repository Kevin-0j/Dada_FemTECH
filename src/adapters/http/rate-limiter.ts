import type { Clock } from "../../contracts/ports.ts";

/**
 * Fixed-window limiter kept in memory. Enough for a single server; a deployment with several
 * servers would need a shared store.
 */
export class RateLimiter {
  readonly #windows = new Map<string, { start: number; count: number }>();
  readonly #clock: Clock;
  readonly #limit: number;
  readonly #windowMs: number;

  constructor(clock: Clock, limit: number, windowMs: number) {
    this.#clock = clock;
    this.#limit = limit;
    this.#windowMs = windowMs;
  }

  /** Records one request for the key and returns false if the key is over its limit. */
  allow(key: string): boolean {
    const now = this.#clock.now().getTime();
    const window = this.#windows.get(key);
    if (window === undefined || now - window.start >= this.#windowMs) {
      if (this.#windows.size > 10_000) this.#sweep(now);
      this.#windows.set(key, { start: now, count: 1 });
      return true;
    }
    window.count += 1;
    return window.count <= this.#limit;
  }

  #sweep(now: number): void {
    for (const [key, window] of this.#windows) {
      if (now - window.start >= this.#windowMs) this.#windows.delete(key);
    }
  }
}
