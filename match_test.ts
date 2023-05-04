import { assertEquals } from "./deps_test.ts";
import {
  findBotCommands,
  findCashtags,
  findHashtags,
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
