import { CHECK } from "./utilities.ts";

export const random = {
  fastUint32(): number {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  },

  fastBool() {
    return (random.fastUint32() & 1) != 0;
  },

  fast(min: number, max: number) {
    CHECK(min <= max);
    return min + random.fastUint32() % (max - min + 1);
  },
};
