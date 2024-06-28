export { assert, assertEquals, assertStrictEquals } from "jsr:@std/assert@0.226.0";

export function hexStringToBytes(str: string): Uint8Array {
    return Uint8Array.from(Array.from(str, (char) => char.charCodeAt(0)));
}
