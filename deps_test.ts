export { assert, assertEquals, assertStrictEquals, equal } from "jsr:@std/assert@0.226.0";

export function hexStringToBytes(str: string): Uint8Array {
    return Uint8Array.from(Array.from(str, (char) => char.charCodeAt(0)));
}

export function clone<T>(instance: T): T {
    if (Array.isArray(instance)) {
        // @ts-ignore let's ignore until i fix it properly
        return instance.map((i) => clone(i));
    } else {
        const prototype = Object.getPrototypeOf(instance);
        return Object.assign(Object.create(prototype), instance);
    }
}
