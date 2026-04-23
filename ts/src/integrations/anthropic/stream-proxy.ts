/**
 * AnthropicStreamProxy — block-aware accumulator for Anthropic SSE streams.
 *
 * Tracks content blocks by index (matching Anthropic's SSE structure).
 * Uses FinalizationRegistry for abandoned-stream detection.
 * Mirror of Python _stream.py for Anthropic.
 *
 * NOTE: The Anthropic SDK's messages.create({stream:true}) returns an
 * APIPromise<Stream>, so innerStream may be a Promise<AsyncIterable>.
 * Both cases are handled.
 */
import type { AccumulatedBlock } from "./trace-builder.js";

type OnFinalize = (
  blocks: Map<number, AccumulatedBlock>,
  usage: Record<string, unknown> | null,
  stopReason: string | null,
  outcome: Record<string, unknown>,
) => void;

/**
 * Finalizer callback for FinalizationRegistry — fires when the proxy is GC'd.
 * Must NOT close over the proxy itself to prevent reference cycles.
 */
function _abandonedCallback(
  state: { finalized: boolean },
  onFinalize: OnFinalize,
  blocks: Map<number, AccumulatedBlock>,
  usage: { value: Record<string, unknown> | null },
  stopReason: { value: string | null },
): void {
  if (state.finalized) return;
  try {
    onFinalize(blocks, usage.value, stopReason.value, {
      label: "partial",
      reasoning: "abandonedStream",
    });
  } catch {
    // best-effort
  }
  state.finalized = true;
}

const _registry = new FinalizationRegistry<{
  state: { finalized: boolean };
  onFinalize: OnFinalize;
  blocks: Map<number, AccumulatedBlock>;
  usage: { value: Record<string, unknown> | null };
  stopReason: { value: string | null };
}>(({ state, onFinalize, blocks, usage, stopReason }) =>
  _abandonedCallback(state, onFinalize, blocks, usage, stopReason),
);

export class AnthropicStreamProxy implements AsyncIterable<unknown> {
  readonly _contentBlocks: Map<number, AccumulatedBlock>;
  private readonly _usage: { value: Record<string, unknown> | null };
  private readonly _stopReason: { value: string | null };
  private readonly _onFinalize: OnFinalize;
  private readonly _state: { finalized: boolean };
  // innerStream may be a direct AsyncIterable or a Promise<AsyncIterable>
  private _innerStream: AsyncIterable<unknown> | null = null;
  private _innerStreamPromise: Promise<AsyncIterable<unknown>> | null = null;

  constructor(opts: { innerStream: unknown; onFinalize: OnFinalize }) {
    this._contentBlocks = new Map();
    this._usage = { value: null };
    this._stopReason = { value: null };
    this._onFinalize = opts.onFinalize;
    this._state = { finalized: false };

    // Detect if innerStream is a Promise<AsyncIterable> or direct AsyncIterable
    if (
      opts.innerStream &&
      typeof (opts.innerStream as { then?: unknown }).then === "function"
    ) {
      this._innerStreamPromise = opts.innerStream as Promise<AsyncIterable<unknown>>;
    } else {
      this._innerStream = opts.innerStream as AsyncIterable<unknown>;
    }

    // Register finalizer — pass state+callback, NOT the proxy (prevents cycle)
    const state = this._state;
    const onFinalize = opts.onFinalize;
    const blocks = this._contentBlocks;
    const usage = this._usage;
    const stopReason = this._stopReason;
    _registry.register(this, { state, onFinalize, blocks, usage, stopReason });
  }

  [Symbol.asyncIterator](): AsyncIterator<unknown> {
    return this._makeIterator();
  }

  private async *_makeIterator(): AsyncGenerator<unknown> {
    // Resolve the inner stream if needed (Anthropic SDK returns APIPromise)
    let inner: AsyncIterable<unknown>;
    if (this._innerStream !== null) {
      inner = this._innerStream;
    } else if (this._innerStreamPromise !== null) {
      inner = await this._innerStreamPromise;
    } else {
      return;
    }

    try {
      for await (const event of inner) {
        this._handleEvent(event as Record<string, unknown>);
        yield event;
        // Finalize immediately on message_stop (before iterator is fully consumed)
        if ((event as Record<string, unknown>)["type"] === "message_stop") {
          if (!this._state.finalized) {
            this._onFinalize(
              this._contentBlocks,
              this._usage.value,
              this._stopReason.value,
              { label: "success" },
            );
            this._state.finalized = true;
            _registry.unregister(this);
          }
        }
      }
      // Also finalize here in case message_stop was not in the stream
      if (!this._state.finalized) {
        this._onFinalize(
          this._contentBlocks,
          this._usage.value,
          this._stopReason.value,
          { label: "success" },
        );
        this._state.finalized = true;
        _registry.unregister(this);
      }
    } catch (exc) {
      if (!this._state.finalized) {
        const { mapExceptionToReason } = await import("./taxonomy.js");
        this._onFinalize(
          this._contentBlocks,
          this._usage.value,
          this._stopReason.value,
          {
            label: "failure",
            error: {
              type: mapExceptionToReason(exc),
              message: String(exc),
              stack: exc instanceof Error ? (exc.stack ?? null) : null,
            },
          },
        );
        this._state.finalized = true;
        _registry.unregister(this);
      }
      throw exc;
    }
  }

  private _handleEvent(ev: Record<string, unknown>): void {
    const type = ev["type"] as string;

    if (type === "message_start") {
      const msg = ev["message"] as Record<string, unknown> | undefined;
      if (msg?.["usage"]) {
        this._usage.value = msg["usage"] as Record<string, unknown>;
      }
    } else if (type === "content_block_start") {
      const idx = Number(ev["index"]);
      const cb = ev["content_block"] as Record<string, unknown>;
      this._contentBlocks.set(idx, {
        type: String(cb["type"] ?? "unknown"),
        buffer: "",
        id: cb["id"] as string | undefined,
        name: cb["name"] as string | undefined,
      });
    } else if (type === "content_block_delta") {
      const idx = Number(ev["index"]);
      const delta = ev["delta"] as Record<string, unknown>;
      const dtype = delta["type"] as string;
      const entry = this._contentBlocks.get(idx) ?? { type: "unknown", buffer: "" };
      if (dtype === "text_delta") {
        entry.buffer += String(delta["text"] ?? "");
      } else if (dtype === "input_json_delta") {
        entry.buffer += String(delta["partial_json"] ?? "");
      }
      this._contentBlocks.set(idx, entry);
    } else if (type === "content_block_stop") {
      const idx = Number(ev["index"]);
      const entry = this._contentBlocks.get(idx);
      if (entry?.type === "tool_use") {
        try {
          entry.finalizedInput = entry.buffer
            ? (JSON.parse(entry.buffer) as Record<string, unknown>)
            : {};
        } catch {
          entry.finalizedInput = { _rawJsonError: entry.buffer };
        }
      }
    } else if (type === "message_delta") {
      const delta = ev["delta"] as Record<string, unknown>;
      if (delta["stop_reason"]) {
        this._stopReason.value = String(delta["stop_reason"]);
      }
      if (ev["usage"]) {
        this._usage.value = {
          ...(this._usage.value ?? {}),
          ...(ev["usage"] as Record<string, unknown>),
        };
      }
    }
  }
}

type HelperOutcome = Record<string, unknown>;
type HelperMessage = Record<string, unknown>;

function _currentSnapshot(
  target: Record<string | symbol, unknown>,
): HelperMessage | null {
  const snapshot =
    (target["currentMessageSnapshot"] as HelperMessage | undefined) ??
    (target["current_message_snapshot"] as HelperMessage | undefined);
  return snapshot && typeof snapshot === "object" ? snapshot : null;
}

export function wrapHelperStream(opts: {
  innerHelper: unknown;
  onFinalize: (message: HelperMessage, outcome: HelperOutcome) => void;
  onFailure: (exc: unknown) => void;
}): unknown {
  const target = opts.innerHelper as Record<string | symbol, unknown>;
  const state = { finalized: false };

  const emitFinalize = (message: HelperMessage, outcome: HelperOutcome): void => {
    if (state.finalized) return;
    opts.onFinalize(message, outcome);
    state.finalized = true;
  };

  const emitFailure = (exc: unknown): void => {
    if (state.finalized) return;
    opts.onFailure(exc);
    state.finalized = true;
  };

  const emitPartialFromSnapshot = (): void => {
    const snapshot = _currentSnapshot(target);
    if (snapshot) {
      emitFinalize(snapshot, { label: "partial", reasoning: "abandonedStream" });
    }
  };

  const invokeFinalMessage = async (): Promise<HelperMessage> => {
    const method = target["finalMessage"];
    if (typeof method === "function") {
      return await (method as (...args: Array<unknown>) => Promise<HelperMessage>).call(target);
    }
    const snapshot = _currentSnapshot(target);
    if (snapshot) return snapshot;
    throw new Error("Anthropic helper stream does not expose finalMessage()");
  };

  let wrapped: unknown;
  wrapped = new Proxy(target, {
    get(innerTarget, prop, receiver) {
      if (prop === Symbol.asyncIterator) {
        return () => {
          const iteratorFactory = Reflect.get(
            innerTarget,
            Symbol.asyncIterator,
            receiver,
          ) as (() => AsyncIterator<unknown>) | undefined;
          if (!iteratorFactory) {
            throw new Error("Anthropic helper stream is not async iterable");
          }
          const innerIterator = iteratorFactory.call(innerTarget);
          return {
            next: async (value?: unknown) => {
              try {
                const result = await innerIterator.next(value as never);
                if (result.done && !state.finalized) {
                  emitFinalize(await invokeFinalMessage(), { label: "success" });
                }
                return result;
              } catch (exc) {
                emitFailure(exc);
                throw exc;
              }
            },
            return: async (value?: unknown) => {
              try {
                const result = innerIterator.return
                  ? await innerIterator.return(value)
                  : { done: true, value };
                if (!state.finalized) {
                  emitPartialFromSnapshot();
                }
                return result;
              } catch (exc) {
                emitFailure(exc);
                throw exc;
              }
            },
            throw: async (err?: unknown) => {
              emitFailure(err);
              if (innerIterator.throw) {
                return await innerIterator.throw(err);
              }
              throw err;
            },
          } satisfies AsyncIterator<unknown>;
        };
      }

      if (prop === "finalMessage") {
        return async (...args: Array<unknown>) => {
          try {
            const method = Reflect.get(innerTarget, prop, innerTarget) as (
              ...innerArgs: Array<unknown>
            ) => Promise<HelperMessage>;
            const message = await method.apply(innerTarget, args);
            emitFinalize(message, { label: "success" });
            return message;
          } catch (exc) {
            emitFailure(exc);
            throw exc;
          }
        };
      }

      if (prop === "finalText") {
        return async (...args: Array<unknown>) => {
          try {
            const method = Reflect.get(innerTarget, prop, innerTarget) as (
              ...innerArgs: Array<unknown>
            ) => Promise<string>;
            const text = await method.apply(innerTarget, args);
            if (!state.finalized) {
              emitFinalize(await invokeFinalMessage(), { label: "success" });
            }
            return text;
          } catch (exc) {
            emitFailure(exc);
            throw exc;
          }
        };
      }

      if (prop === "textStream") {
        return (async function* () {
          for await (const event of wrapped as AsyncIterable<Record<string, unknown>>) {
            if (event["type"] === "content_block_delta") {
              const delta = event["delta"] as Record<string, unknown>;
              if (delta["type"] === "text_delta") {
                yield String(delta["text"] ?? "");
              }
            }
          }
        })();
      }

      const value = Reflect.get(innerTarget, prop, receiver);
      if (typeof value === "function") {
        return value.bind(innerTarget);
      }
      return value;
    },
  });

  return wrapped;
}
