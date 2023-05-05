import { assertEquals } from "./deps_test.ts";
import {
  findBankCardNumbers,
  findBotCommands,
  findCashtags,
  findHashtags,
  findMediaTimestamps,
  findMentions,
} from "./match.ts";

function checkFn(fn: (text: string) => [number, number][]) {
  return (text: string, expected: string[]) => {
    assertEquals(fn(text).map(([s, e]) => text.substring(s, e)), expected);
  };
}

Deno.test("mentions", () => {
  const check = checkFn(findMentions);
  check("@mention", ["@mention"]);
  check("@mention ", ["@mention"]);
  check(" @mention", ["@mention"]);
  check(" @mention ", ["@mention"]);
  check("@abc @xyz @abc @xyz @xxx@yyy @ttt", []);
  check(
    "@abcde @xyzxy @abcde @xyzxy @xxxxx@yyyyy @ttttt",
    ["@abcde", "@xyzxy", "@abcde", "@xyzxy", "@xxxxx", "@ttttt"],
  );
  check("no@mention", []);
  check("@n", []);
  check("@abcdefghijklmnopqrstuvwxyz123456", [
    "@abcdefghijklmnopqrstuvwxyz123456",
  ]);
  check("@abcdefghijklmnopqrstuvwxyz1234567", []);
  check("нет@mention", []);
  check(
    "@ya @gif @wiki @vid @bing @pic @bold @imdb @ImDb @coub @like @vote @giff @cap ya cap @y @yar @bingg @bin",
    [
      "@gif",
      "@wiki",
      "@vid",
      "@bing",
      "@pic",
      "@bold",
      "@imdb",
      "@ImDb",
      "@coub",
      "@like",
      "@vote",
      "@giff",
      "@bingg",
    ],
  );
});

Deno.test("bot commands", () => {
  const check = checkFn(findBotCommands);
  // 1..64@3..32
  check("/abc", ["/abc"]);
  check(" /abc", ["/abc"]);
  check("/abc ", ["/abc"]);
  check(" /abc ", ["/abc"]);
  check("/a@abc", ["/a@abc"]);
  // TODO: ask about this to @levlam. because, in the original tests,
  // it is NOT supposed to match "/a". and according to the original
  // matching function, it should match "/a". (as far as i understood).
  // and bot api does too :/ i'm confused.
  check("/a@b", ["/a"]); // hmmmm...
  check("/@bfdsa", []);
  check("/test/", []);
});

Deno.test("hashtags", () => {
  const check = checkFn(findHashtags);
  check("", []);
  check("#", []);
  check("##", []);
  check("###", []);
  check("#a", ["#a"]);
  check(" #a", ["#a"]);
  check("#a ", ["#a"]);
  check(" #я ", ["#я"]);
  check(" я#a ", []);
  check(" #a# ", []);
  check(" #123 ", []);
  check(" #123a ", ["#123a"]);
  check(" #a123 ", ["#a123"]);
  check(" #123a# ", []);
  check(" #" + "1".repeat(300), []);
  check(" #" + "1".repeat(256), []);
  check(" #" + "1".repeat(256) + "a ", []);
  check(" #" + "1".repeat(255) + "a", ["#" + "1".repeat(255) + "a"]);
  check(" #" + "1".repeat(255) + "Я", ["#" + "1".repeat(255) + "Я"]);
  check(" #" + "1".repeat(255) + "a" + "b".repeat(255) + "# ", []);
  check("#a#b #c #d", ["#c", "#d"]);
  check("#test", ["#test"]);
  check("#te·st", ["#te·st"]);
  check(
    "\u{0001F604}\u{0001F604}\u{0001F604}\u{0001F604} \u{0001F604}\u{0001F604}\u{0001F604}#" +
      "1".repeat(200) +
      "ООО" + "2".repeat(200),
    ["#" + "1".repeat(200) + "ООО" + "2".repeat(53)],
  );
  check("#a\u2122", ["#a"]);
  check("#a൹", ["#a"]);
  check("#aඁං෴ก฿", ["#aඁං෴ก"]);
});

Deno.test("cashtags", () => {
  const check = checkFn(findCashtags);
  check("", []);
  check("$", []);
  check("$$", []);
  check("$$$", []);
  check("$a", []);
  check(" $a", []);
  check("$a ", []);
  check(" $я ", []);
  check("$ab", []);
  check("$abc", []);
  check("$", []);
  check("$A", ["$A"]);
  check("$AB", ["$AB"]);
  check("$ABС", []);
  check("$АBC", []);
  check("$АВС", []);
  check("$ABC", ["$ABC"]);
  check("$ABCD", ["$ABCD"]);
  check("$ABCDE", ["$ABCDE"]);
  check("$ABCDEF", ["$ABCDEF"]);
  check("$ABCDEFG", ["$ABCDEFG"]);
  check("$ABCDEFGH", ["$ABCDEFGH"]);
  check("$ABCDEFGHJ", []);
  check("$ABCDEFGH1", []);
  check(" $XYZ", ["$XYZ"]);
  check("$XYZ ", ["$XYZ"]);
  check(" $XYZ ", ["$XYZ"]);
  check(" $$XYZ ", []);
  check(" $XYZ$ ", []);
  check(" $ABC1 ", []);
  check(" $1ABC ", []);
  check(" 1$ABC ", []);
  check(" А$ABC ", []);
  check("$ABC$DEF $GHI $KLM", ["$GHI", "$KLM"]);
  check("$TEST", ["$TEST"]);
  check("$1INC", []);
  check("$1INCH", ["$1INCH"]);
  check("...$1INCH...", ["$1INCH"]);
  check("$1inch", []);
  check("$1INCHA", []);
  check("$1INCHА", []);
  check("$ABC\u2122", ["$ABC"]);
  check("\u2122$ABC", ["$ABC"]);
  check("\u2122$ABC\u2122", ["$ABC"]);
  check("$ABC൹", ["$ABC"]);
  check("$ABCඁ", []);
  check("$ABCං", []);
  check("$ABC෴", []);
  check("$ABCก", []);
  check("$ABC฿", ["$ABC"]);
});

Deno.test("media timestamps", () => {
  const check = (text: string, expected: [string, number][]) => {
    assertEquals(
      findMediaTimestamps(text).map(([[s, e], t]) => [text.substring(s, e), t]),
      expected,
    );
  };

  check("", []);
  check(":", []);
  check(":1", []);
  check("a:1", []);
  check("01", []);
  check("01:", []);
  check("01::", []);
  check("01::", []);
  check("a1:1a", []);
  check("a1::01a", []);
  check("2001:db8::8a2e:f70:13a4", []);
  check("0:00", [["0:00", 0]]);
  check("+0:00", [["0:00", 0]]);
  check("0:00+", [["0:00", 0]]);
  check("a0:00", []);
  check("0:00a", []);
  check("б0:00", []);
  check("0:00б", []);
  check("_0:00", []);
  check("0:00_", []);
  check("00:00:00:00", []);
  check("1:1:01 1:1:1", [["1:1:01", 3661]]);
  check(
    "0:0:00 00:00 000:00 0000:00 00000:00 00:00:00 000:00:00 00:000:00 00:00:000",
    [["0:0:00", 0], ["00:00", 0], ["000:00", 0], ["0000:00", 0], [
      "00:00:00",
      0,
    ]],
  );
  check("00:0:00 0:00:00 00::00 :00:00 00:00: 00:00:0 00:00:", [
    ["00:0:00", 0],
    ["0:00:00", 0],
  ]);
  check("1:1:59 1:1:-1 1:1:60", [["1:1:59", 3719]]);
  check("1:59:00 1:-1:00 1:60:00", [["1:59:00", 7140], ["1:00", 60]]);
  check("59:59 60:00", [["59:59", 3599], ["60:00", 3600]]);
  check("9999:59 99:59:59 99:60:59", [["9999:59", 599999], [
    "99:59:59",
    360000 - 1,
  ]]);
  check("2001:db8::8a2e:f70:13a4", []);
});

Deno.test("bank card numbers", () => {
  const check = checkFn(findBankCardNumbers);
  check("", []);
  check("123456789015", []);
  check("1234567890120", []);
  check("1234567890121", []);
  check("1234567890122", []);
  check("1234567890123", []);
  check("1234567890124", []);
  check("1234567890125", []);
  check("1234567890126", []);
  check("1234567890127", []);
  check("1234567890128", ["1234567890128"]);
  check("1234567890129", []);
  check("12345678901500", ["12345678901500"]);
  check("123456789012800", ["123456789012800"]);
  check("1234567890151800", ["1234567890151800"]);
  check("12345678901280000", ["12345678901280000"]);
  check("123456789015009100", ["123456789015009100"]);
  check("1234567890128000000", ["1234567890128000000"]);
  check("12345678901500910000", []);
  check(" - - - - 1 - -- 2 - - -- 34 - - - 56- - 7890150000  - - - -", []);
  check(" - - - - 1 - -- 234 - - 56- - 7890150000  - - - -", [
    "1 - -- 234 - - 56- - 7890150000",
  ]);
  check("4916-3385-0608-2832; 5280 9342 8317 1080 ;345936346788903", [
    "4916-3385-0608-2832",
    "5280 9342 8317 1080",
    "345936346788903",
  ]);
  check(
    "4556728228023269, 4916141675244747020, 49161416752447470, 4556728228023269",
    ["4556728228023269", "4916141675244747020", "4556728228023269"],
  );
  check("a1234567890128", []);
  check("1234567890128a", []);
  check("1234567890128а", []);
  check("а1234567890128", []);
  check("1234567890128_", []);
  check("_1234567890128", []);
  check("1234567890128/", ["1234567890128"]);
  check('"1234567890128', ["1234567890128"]);
  check("+1234567890128", []);
});
