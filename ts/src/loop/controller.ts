/**
 * Loop controller — pause/resume state machine with Promise-based blocking (AC-342).
 * Mirrors Python's autocontext/harness/core/controller.py.
 */

export class LoopController {
  #paused = false;
  #resumeResolvers: Array<() => void> = [];
  #gateOverride: string | null = null;
  #pendingHint: string | null = null;
  #chatQueue: Array<{ role: string; message: string; resolve: (response: string) => void }> = [];
  #pendingChatResolvers: Array<(response: string) => void> = [];

  pause(): void {
    this.#paused = true;
  }

  resume(): void {
    this.#paused = false;
    // Resolve all waiting promises
    const resolvers = this.#resumeResolvers.splice(0);
    for (const resolve of resolvers) {
      resolve();
    }
  }

  isPaused(): boolean {
    return this.#paused;
  }

  waitIfPaused(): Promise<void> {
    if (!this.#paused) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.#resumeResolvers.push(resolve);
    });
  }

  setGateOverride(decision: string): void {
    this.#gateOverride = decision;
  }

  takeGateOverride(): string | null {
    const val = this.#gateOverride;
    this.#gateOverride = null;
    return val;
  }

  injectHint(text: string): void {
    this.#pendingHint = text;
  }

  takeHint(): string | null {
    const val = this.#pendingHint;
    this.#pendingHint = null;
    return val;
  }

  submitChat(role: string, message: string): Promise<string> {
    return new Promise<string>((resolve) => {
      this.#chatQueue.push({ role, message, resolve });
    });
  }

  pollChat(): [string, string] | null {
    if (this.#chatQueue.length === 0) return null;
    const entry = this.#chatQueue.shift()!;
    this.#pendingChatResolvers.push(entry.resolve);
    return [entry.role, entry.message];
  }

  respondChat(_role: string, response: string): void {
    if (this.#pendingChatResolvers.length > 0) {
      const resolve = this.#pendingChatResolvers.shift()!;
      resolve(response);
    }
  }
}
