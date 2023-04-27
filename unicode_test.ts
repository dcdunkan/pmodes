import { assert } from "./deps_test.ts";
import { getUnicodeSimpleCategory, UnicodeSimpleCategory } from "./unicode.ts";

const testcases: [string | number, UnicodeSimpleCategory][] = [
  [-1, UnicodeSimpleCategory.Unknown],
  ["-", UnicodeSimpleCategory.Unknown],
  ["A", UnicodeSimpleCategory.Letter],
  ["z", UnicodeSimpleCategory.Letter],
  // ["á", UnicodeSimpleCategory.Letter], // TODO: check how these works in the original imp.
  ["1", UnicodeSimpleCategory.DecimalNumber], // yes, that's how original imp. also work.
  ["0", UnicodeSimpleCategory.DecimalNumber],
  ["½", UnicodeSimpleCategory.Number],
  ["٨", UnicodeSimpleCategory.Number], // its '8' in Easter Arabic/Urdu/and few other langs.
  [" ", UnicodeSimpleCategory.Separator],
];

const type: Record<UnicodeSimpleCategory, string> = {
  "0": "Unknown",
  "1": "Letter",
  "2": "DecimalNumber",
  "3": "Number",
  "4": "Separator",
};

Deno.test("unicode simple category", async ({ step }) => {
  for (const [input, expected] of testcases) {
    await step(`"${input}" is ${type[expected]}`, () => {
      const code = typeof input == "string" ? input.charCodeAt(0) : input;
      const category = getUnicodeSimpleCategory(code);
      assert(category === expected);
    });
  }
});
