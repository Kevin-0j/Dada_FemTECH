import type { Clock, SessionStore } from "../../contracts/ports.ts";
import type { Session } from "../../domain/screening.ts";

/**
 * Keeps conversations in memory only, and forgets them after a period of silence. Restarting
 * the server ends every conversation, which is the privacy trade-off we want for an MVP.
 */
export class MemorySessionStore implements SessionStore {
  readonly #entries = new Map<string, { session: Session; expiresAt: number }>();
  readonly #clock: Clock;
  readonly #ttlMs: number;

  constructor(clock: Clock, ttlMs: number) {
    this.#clock = clock;
    this.#ttlMs = ttlMs;
  }

  get(key: string): Session | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= this.#clock.now().getTime()) {
      this.#entries.delete(key);
      return undefined;
    }
    return entry.session;
  }

  set(key: string, session: Session): void {
    this.#sweep();
    this.#entries.set(key, { session, expiresAt: this.#clock.now().getTime() + this.#ttlMs });
  }

  delete(key: string): void {
    this.#entries.delete(key);
  }

  get size(): number {
    return this.#entries.size;
  }

  #sweep(): void {
    const now = this.#clock.now().getTime();
    for (const [key, entry] of this.#entries) {
      if (entry.expiresAt <= now) this.#entries.delete(key);
    }
  }
}
