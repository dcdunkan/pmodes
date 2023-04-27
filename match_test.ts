import { assert, assertEquals } from "./deps_test.ts";
import { findBotCommands, findMentions } from "./match.ts";

interface TestCase {
  /** Name of the test step */
  name: string;
  /** The text that should be parsed */
  text: string;
  /** Array of the expected entities' start and end position */
  expected: [number, number][];
  /** The found entities */
  result: string[];
}

const functions = {
  mentions: findMentions,
  commands: findBotCommands,
};

const testcases: Record<keyof typeof functions, TestCase[]> = {
  mentions: [
    {
      name: "should match simple mentions",
      text: "normal @mentions between @te_t and stuff",
      expected: [[7, 16], [25, 30]],
      result: ["@mentions", "@te_t"],
    },
    {
      name: "should only match first one in @mention@mention",
      text: "weird @mention@mention.",
      expected: [[6, 14]],
      result: ["@mention"],
    },
    {
      name: "should not match mentions prefixed with non-special char",
      text: "heh 4@mention x@mention",
      expected: [],
      result: [],
    },
    {
      name: "should match mentions prefixed with special char",
      text: "hehe #@mention $@mention /@mention -@mention",
      expected: [[6, 14], [16, 24], [26, 34], [36, 44]],
      result: ["@mention", "@mention", "@mention", "@mention"],
    },
    {
      name: "should not match mentions prefixed with an underscore",
      text: "hehe _@mention",
      expected: [],
      result: [],
    },
    {
      name: "should not match mentions less than 3 characters",
      text: "@m",
      expected: [],
      result: [],
    },
    {
      name: "should not match mentions more than 32 characters",
      text: "@123456789012345678901234567890123",
      expected: [],
      result: [],
    },
    {
      name: "should not include non-alpha-digit-underscore prefix",
      text: "@dont₣",
      expected: [[0, 5]],
      result: ["@dont"],
    },
  ],
  commands: [
    {
      name: "should match simple commands",
      text: "simple /commands between /te_t",
      expected: [[7, 16], [25, 30]],
      result: ["/commands", "/te_t"],
    },
    {
      name: "should not match commands prefixed with / or < or > or _",
      text: "//slash </lt >/gt _/underscore",
      expected: [],
      result: [],
    },
    {
      name: "should match commands prefixed with other than / or < or > or _",
      text: "./period -/hyphen",
      expected: [[1, 8], [10, 17]],
      result: ["/period", "/hyphen"],
    },
    {
      name: "should not match commands suffixed with / or < or >",
      text: "/slash/ /lt< /gt>",
      expected: [],
      result: [],
    },
    {
      name: "should match commands suffixed with other than / or < or >",
      text: "/hyphen- /underscore_ /kek#",
      expected: [[0, 7], [9, 21], [22, 26]],
      result: ["/hyphen", "/underscore_", "/kek"],
    },
    {
      name: "should match commands with mention",
      text: "/command@bot /kek@user_name",
      expected: [[0, 12], [13, 27]],
      result: ["/command@bot", "/kek@user_name"],
    },
    {
      name: "should not include mention ending with / or > or <",
      text: "/kek@kek/",
      expected: [[0, 4]],
      result: ["/kek"],
    },
    {
      name: "should not include @ at the end",
      text: "/kek@",
      expected: [[0, 4]],
      result: ["/kek"],
    },
    {
      name:
        "should not match mentions in commands with mention.length < 3 or > 32",
      text: "/cmd@12 /cmd@123456789012345678901234567890123",
      expected: [[0, 4], [8, 12]],
      result: ["/cmd", "/cmd"],
    },
    {
      name: "should not match commands less than 1 char",
      text: "/",
      expected: [],
      result: [],
    },
    {
      name: "should not match commands more than 64 char",
      text:
        "/12345678901234567890123456789012345678901234567890123456789012345",
      expected: [],
      result: [],
    },
  ],
};

for (const test in testcases) {
  Deno.test(test, async ({ step }) => {
    for (const testcase of testcases[test as keyof typeof testcases]) {
      if (testcase.expected == null) continue; // useful while writing test cases.
      await step(testcase.name, () => {
        const actual = functions[test as keyof typeof functions](testcase.text);
        assert(actual.length == testcase.expected.length);
        assertEquals(actual, testcase.expected);
        assertEquals(
          actual.map(([s, e]) => testcase.text.substring(s, e)),
          testcase.result,
        );
      });
    }
  });
}
