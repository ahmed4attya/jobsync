import { TextEncoder, TextDecoder } from "util";
import { ReadableStream, TransformStream } from "stream/web";

if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder as typeof global.TextDecoder;
}
if (typeof global.ReadableStream === "undefined") {
  global.ReadableStream = ReadableStream as typeof global.ReadableStream;
}
if (typeof global.TransformStream === "undefined") {
  global.TransformStream = TransformStream as typeof global.TransformStream;
}

if (typeof global.Request === "undefined") {
  global.Request = class Request {} as any;
}
if (typeof global.Response === "undefined") {
  global.Response = class Response {} as any;
}
if (typeof global.Headers === "undefined") {
  global.Headers = class Headers {} as any;
}

// D-08 root: Node >= 26 declares experimental webstorage on its global
// ('localStorage' in globalThis is true, but without --localstorage-file the
// getter returns undefined). vitest 4's populateGlobal drops every jsdom
// window key that already exists on the Node global unless it is in its
// built-in KEYS list — localStorage/sessionStorage are not — so the test
// global never receives jsdom's storage, and vitest's window rebinding
// (window === global) makes the real jsdom window unreachable from setup
// files. Install a per-file in-memory Storage for both so every test file
// gets isolated, functional storage regardless of Node's experiments.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}
(globalThis as any).localStorage = new MemoryStorage();
(globalThis as any).sessionStorage = new MemoryStorage();
