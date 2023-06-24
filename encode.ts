export const ENCODER = new TextEncoder(), DECODER = new TextDecoder();

export function encode(data: string) {
  return ENCODER.encode(data);
}

export function decode(data: number): string;
export function decode(data: Uint8Array): string;
export function decode(data: number | Uint8Array): string {
  return DECODER.decode(typeof data === "number" ? new Uint8Array([data]) : data);
}

export function toInteger(str: Uint8Array, radix = 10) {
  return Number.parseInt(decode(str), radix);
}

export function mergeTypedArrays(...parts: Uint8Array[]) {
  const resultSize = parts.reduce((p, c) => p + c.length, 0);
  const result = new Uint8Array(resultSize);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
