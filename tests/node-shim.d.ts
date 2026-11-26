// Tipos mínimos para typecheck sin @types/node (el entorno de CI puede usar @types/node real).
declare module 'node:test' {
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function describe(name: string, fn: () => void): void;
}
declare module 'node:assert/strict' {
  const assert: {
    (v: unknown, msg?: string): asserts v;
    ok(v: unknown, msg?: string): asserts v;
    equal(a: unknown, b: unknown, msg?: string): void;
    deepEqual(a: unknown, b: unknown, msg?: string): void;
    match(s: string, r: RegExp, msg?: string): void;
    throws(fn: () => unknown, r?: RegExp): void;
    rejects(p: Promise<unknown>, r?: RegExp): Promise<void>;
  };
  export default assert;
}
