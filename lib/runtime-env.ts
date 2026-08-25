import { AsyncLocalStorage } from "node:async_hooks";

type D1PreparedStatementLike = {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = unknown>(column?: string): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run<T = unknown>(): Promise<T>;
  raw<T = unknown>(): Promise<T[]>;
};

export type RuntimeEnv = {
  MARKET_PULSE_USERNAME?: string;
  MARKET_PULSE_PASSWORD?: string;
  MARKET_PULSE_SESSION_SECRET?: string;
  DB?: {
    prepare(query: string): D1PreparedStatementLike;
    batch<T = unknown>(statements: D1PreparedStatementLike[]): Promise<T[]>;
    exec(query: string): Promise<unknown>;
  };
};

const runtimeEnvKey = Symbol.for("market-pulse.runtime-env");
const runtimeRoot = globalThis as typeof globalThis & { [runtimeEnvKey]?: AsyncLocalStorage<RuntimeEnv> };
const runtimeEnvStorage = runtimeRoot[runtimeEnvKey] ??= new AsyncLocalStorage<RuntimeEnv>();

export function runWithRuntimeEnv<T>(env: RuntimeEnv, callback: () => T | Promise<T>) {
  return runtimeEnvStorage.run(env, callback);
}

export function getRuntimeEnv() {
  return runtimeEnvStorage.getStore() ?? null;
}
