import { CustomEmojiId } from "./custom_emoji_id.ts";
import { assert, assertEquals, assertStrictEquals } from "./deps_test.ts";
import { decode, encode } from "./encode.ts";
import {
  findBankCardNumbers,
  findBotCommands,
  findCashtags,
  findHashtags,
  findMediaTimestamps,
  findMentions,
  findTgURLs,
  findURLs,
  isEmailAddress,
  parseHTML,
  parseMarkdownV2,
} from "./match.ts";
import { MessageEntity } from "./types.ts";
import { UserId } from "./user_id.ts";

function checkFn(fn: (text: Uint8Array) => [number, number][]) {
  return (text: string, expected: string[]) => {
    const encoded = encode(text);
    const result = fn(encoded);
    const actual = result.map(([s, e]) => decode(encoded.slice(s, e)));
    assertEquals(actual, expected);
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
  check("/a@b", []);
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
    const encoded = encode(text);
    const result = findMediaTimestamps(encoded);
    const actual = result.map(([[s, e], t]) => [decode(encoded.slice(s, e)), t]);
    assertEquals(actual, expected);
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

Deno.test("tg urls", () => {
  const check = checkFn(findTgURLs);
  check("", []);
  check("tg://", []);
  check("tg://a", ["tg://a"]);
  check("a", []);
  check("stg://a", ["tg://a"]);
  check(
    "asd  asdas das ton:asd tg:test ton://resolve tg://resolve TON://_-RESOLVE_- TG://-_RESOLVE-_",
    ["ton://resolve", "tg://resolve", "TON://_-RESOLVE_-", "TG://-_RESOLVE-_"],
  );
  check("tg:test/", []);
  check("tg:/test/", []);
  check("tg://test/", ["tg://test/"]);
  check("tg://test/?", ["tg://test/"]);
  check("tg://test/#", ["tg://test/#"]);
  check("tg://test?", ["tg://test"]);
  check("tg://test#", ["tg://test"]);
  check("tg://test/―asd―?asd=asd&asdas=―#――――", [
    "tg://test/―asd―?asd=asd&asdas=―#――――",
  ]);
  check("tg://test/?asd", ["tg://test/?asd"]);
  check("tg://test/?.:;,('?!`.:;,('?!`", ["tg://test/"]);
  check("tg://test/#asdf", ["tg://test/#asdf"]);
  check("tg://test?asdf", ["tg://test?asdf"]);
  check("tg://test#asdf", ["tg://test#asdf"]);
  check("tg://test?as‖df", ["tg://test?as"]);
  check("tg://test?sa<df", ["tg://test?sa"]);
  check("tg://test?as>df", ["tg://test?as"]);
  check('tg://test?as"df', ["tg://test?as"]);
  check("tg://test?as«df", ["tg://test?as"]);
  check("tg://test?as»df", ["tg://test?as"]);
  check("tg://test?as(df", ["tg://test?as(df"]);
  check("tg://test?as)df", ["tg://test?as)df"]);
  check("tg://test?as[df", ["tg://test?as[df"]);
  check("tg://test?as]df", ["tg://test?as]df"]);
  check("tg://test?as{df", ["tg://test?as{df"]);
  check("tg://test?as'df", ["tg://test?as'df"]);
  check("tg://test?as}df", ["tg://test?as}df"]);
  check("tg://test?as$df", ["tg://test?as$df"]);
  check("tg://test?as%df", ["tg://test?as%df"]);
  check("tg://%30/sccct", []);
  check("tg://test:asd@google.com:80", ["tg://test"]);
  check("tg://google.com", ["tg://google"]);
  check("tg://google/.com", ["tg://google/.com"]);
  check("tg://127.0.0.1", ["tg://127"]);
  check("tg://б.а.н.а.на", []);
});

Deno.test("email address", () => {
  const check = (text: string, expected: boolean) => {
    const result = encode(text);
    const actual = isEmailAddress(result);
    return assertEquals(actual, expected);
  };

  check("telegram.org", false);
  check("security@telegram.org", true);
  check("security.telegram.org", false);
  check("", false);
  check("@", false);
  check("A@a.a.a.ab", true);
  check("A@a.ab", true);
  check("Test@aa.aa.aa.aa", true);
  check("Test@test.abd", true);
  check("a@a.a.a.ab", true);
  check("test@test.abd", true);
  check("test@test.com", true);
  check("test.abd", false);
  check("a.ab", false);
  check("a.bc@d.ef", true);

  const badUserdatas = [
    "",
    "a.a.a.a.a.a.a.a.a.a.a.a",
    "+.+.+.+.+.+",
    "*.a.a",
    "a.*.a",
    "a.a.*",
    "a.a.",
    "a.a.abcdefghijklmnopqrstuvwxyz0123456789",
    "a.abcdefghijklmnopqrstuvwxyz0.a",
    "abcdefghijklmnopqrstuvwxyz0.a.a",
  ];
  const goodUserdatas = [
    "a.a.a.a.a.a.a.a.a.a.a",
    "a+a+a+a+a+a+a+a+a+a+a",
    "+.+.+.+.+._",
    "aozAQZ0-5-9_+-aozAQZ0-5-9_.aozAQZ0-5-9_.-._.+-",
    "a.a.a",
    "a.a.abcdefghijklmnopqrstuvwxyz012345678",
    "a.abcdefghijklmnopqrstuvwxyz.a",
    "a..a",
    "abcdefghijklmnopqrstuvwxyz.a.a",
    ".a.a",
  ];
  const badDomains = [
    "",
    ".",
    "abc",
    "localhost",
    "a.a.a.a.a.a.a.ab",
    ".......",
    "a.a.a.a.a.a+ab",
    "a+a.a.a.a.a.ab",
    "a.a.a.a.a.a.a",
    "a.a.a.a.a.a.abcdefghi",
    "a.a.a.a.a.a.ab0yz",
    "a.a.a.a.a.a.ab9yz",
    "a.a.a.a.a.a.ab-yz",
    "a.a.a.a.a.a.ab_yz",
    "a.a.a.a.a.a.ab*yz",
    ".ab",
    ".a.ab",
    "a..ab",
    "a.a.a..a.ab",
    ".a.a.a.a.ab",
    "abcdefghijklmnopqrstuvwxyz01234.ab",
    "ab0cd.abd.aA*sd.0.9.0-9.ABOYZ",
    "ab*cd.abd.aAasd.0.9.0-9.ABOYZ",
    "ab0cd.abd.aAasd.0.9.0*9.ABOYZ",
    "*b0cd.ab_d.aA-sd.0.9.0-9.ABOYZ",
    "ab0c*.ab_d.aA-sd.0.9.0-9.ABOYZ",
    "ab0cd.ab_d.aA-sd.0.9.0-*.ABOYZ",
    "ab0cd.ab_d.aA-sd.0.9.*-9.ABOYZ",
    "-b0cd.ab_d.aA-sd.0.9.0-9.ABOYZ",
    "ab0c-.ab_d.aA-sd.0.9.0-9.ABOYZ",
    "ab0cd.ab_d.aA-sd.-.9.0-9.ABOYZ",
    "ab0cd.ab_d.aA-sd.0.9.--9.ABOYZ",
    "ab0cd.ab_d.aA-sd.0.9.0--.ABOYZ",
    "_b0cd.ab_d.aA-sd.0.9.0-9.ABOYZ",
    "ab0c_.ab_d.aA-sd.0.9.0-9.ABOYZ",
    "ab0cd.ab_d.aA-sd._.9.0-9.ABOYZ",
    "ab0cd.ab_d.aA-sd.0.9._-9.ABOYZ",
    "ab0cd.ab_d.aA-sd.0.9.0-_.ABOYZ",
    "-.ab_d.aA-sd.0.9.0-9.ABOYZ",
    "ab0cd.ab_d.-.0.9.0-9.ABOYZ",
    "ab0cd.ab_d.aA-sd.0.9.-.ABOYZ",
    "_.ab_d.aA-sd.0.9.0-9.ABOYZ",
    "ab0cd.ab_d._.0.9.0-9.ABOYZ",
    "ab0cd.ab_d.aA-sd.0.9._.ABOYZ",
  ];
  const goodDomains = [
    "a.a.a.a.a.a.ab",
    "a.a.a.a.a.a.abcdef",
    "a.a.a.a.a.a.aboyz",
    "a.a.a.a.a.a.ABOYZ",
    "a.a.a.a.a.a.AbOyZ",
    "abcdefghijklmnopqrstuvwxyz0123.ab",
    "ab0cd.ab_d.aA-sd.0.9.0-9.ABOYZ",
    "A.Z.aA-sd.a.z.0-9.ABOYZ",
  ];

  for (const userdata of badUserdatas) {
    for (const domain of badDomains) {
      check(userdata + "@" + domain, false);
      check(userdata + domain, false);
    }
    for (const domain of goodDomains) {
      check(userdata + "@" + domain, false);
      check(userdata + domain, false);
    }
  }
  for (const userdata of goodUserdatas) {
    for (const domain of badDomains) {
      check(userdata + "@" + domain, false);
      check(userdata + domain, false);
    }
    for (const domain of goodDomains) {
      check(userdata + "@" + domain, true);
      check(userdata + domain, false);
    }
  }
});

Deno.test("url", () => {
  const check = (
    str: string,
    expectedUrls: string[],
    expectedEmailAddresses: string[] = [],
  ) => {
    const encoded = encode(str);
    const results = findURLs(encoded);
    const actualUrls: string[] = [];
    const actualEmailAddress: string[] = [];
    for (const [[start, end], email] of results) {
      if (!email) actualUrls.push(decode(encoded.slice(start, end)));
      else actualEmailAddress.push(decode(encoded.slice(start, end)));
    }
    assertEquals(actualUrls, expectedUrls);
    assertEquals(actualEmailAddress, expectedEmailAddresses);
  };

  check("telegram.org", ["telegram.org"]);
  check("(telegram.org)", ["telegram.org"]);
  check("\ntelegram.org)", ["telegram.org"]);
  check(" telegram.org)", ["telegram.org"]);
  check(".telegram.org)", []);
  check("()telegram.org/?q=()", ["telegram.org/?q=()"]);
  check('"telegram.org"', ["telegram.org"]);
  check(" telegram. org. www. com... telegram.org... ...google.com...", [
    "telegram.org",
  ]);
  check(" telegram.org ", ["telegram.org"]);
  check(
    "Такой сайт: http://www.google.com или такой telegram.org ",
    ["http://www.google.com", "telegram.org"],
  );
  check(" telegram.org. ", ["telegram.org"]);
  check("http://google,.com", []);
  check("http://telegram.org/?asd=123#123.", [
    "http://telegram.org/?asd=123#123",
  ]);
  check("[http://google.com](test)", ["http://google.com"]);
  check("", []);
  check(".", []);

  check("http://@google.com", []);
  check("http://@goog.com", []); // TODO: server fix
  check("http://@@google.com", []);
  check("http://a@google.com", ["http://a@google.com"]);
  check("http://test@google.com", ["http://test@google.com"]);
  check("google.com:᪉᪉᪉᪉᪉", ["google.com"]);
  check("https://telegram.org", ["https://telegram.org"]);
  check("http://telegram.org", ["http://telegram.org"]);
  check("ftp://telegram.org", ["ftp://telegram.org"]);
  check("ftps://telegram.org", []);
  check("sftp://telegram.org", []);
  check("hTtPs://telegram.org", ["hTtPs://telegram.org"]);
  check("HTTP://telegram.org", ["HTTP://telegram.org"]);
  check("аHTTP://telegram.org", ["HTTP://telegram.org"]);
  check("sHTTP://telegram.org", []);
  check("://telegram.org", []);
  check("google.com:᪀᪀", ["google.com"]);
  check(
    "http://" +
      "abcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkab" +
      "cdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcd" +
      "efghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdef" +
      "ghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefgh" +
      "ijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghij" +
      "kabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijka" +
      "bcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabc" +
      "defghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijk.com",
    [],
  );
  check("http://  .com", []);
  check("URL:     .com", []);
  check("URL: .com", []);
  check(".com", []);
  check("http://  .", []);
  check("http://.", []);
  check("http://.com", []);
  check("http://  .", []);
  check(",ahttp://google.com", ["http://google.com"]);
  check(".ahttp://google.com", []);
  check("http://1.0", []);
  check("http://a.0", []);
  check("http://a.a", []);
  check("google.com:1#ab c", ["google.com:1#ab"]);
  check("google.com:1#", ["google.com:1"]);
  check("google.com:1#1", ["google.com:1#1"]);
  check("google.com:00000001/abs", ["google.com:00000001/abs"]);
  check("google.com:000000065535/abs", ["google.com:000000065535/abs"]);
  check("google.com:000000065536/abs", ["google.com"]);
  check("google.com:000000080/abs", ["google.com:000000080/abs"]);
  check("google.com:0000000/abs", ["google.com"]);
  check("google.com:0/abs", ["google.com"]);
  check("google.com:/abs", ["google.com"]);
  check("google.com:65535", ["google.com:65535"]);
  check("google.com:65536", ["google.com"]);
  check("google.com:99999", ["google.com"]);
  check("google.com:100000", ["google.com"]);
  check("127.001", []);
  check("127.0.0.1", ["127.0.0.1"]);
  check("127.0.0.01", []);
  check("127.0.0.256", []);
  check("127.0.0.300", []);
  check("127.0.0.1000", []);
  check("127.0.0.260", []);
  check("1.0", []);
  check("www.🤙.tk", ["www.🤙.tk"]);
  check("a.ab", []);
  check("test.abd", []);
  check("ТеСт.Москва", []);
  check("ТеСт.МоСкВΑ", []);
  check("ТеСт.МоСкВа", ["ТеСт.МоСкВа"]);
  check("ТеСт.МоСкВач", []);
  check("http://ÀТеСт.МоСкВач", ["http://ÀТеСт.МоСкВач"]);
  check("ÀÁ.com. ÀÁ.com.", ["ÀÁ.com", "ÀÁ.com"]);
  check("ÀÁ.com,ÀÁ.com.", ["ÀÁ.com", "ÀÁ.com"]);
  check("teiegram.org/test", []);
  check("TeiegraM.org/test", []);
  check("http://test.google.com/?q=abc()}[]def", [
    "http://test.google.com/?q=abc()",
  ]);
  check("http://test.google.com/?q=abc([{)]}def", [
    "http://test.google.com/?q=abc([{)]}def",
  ]);
  check("http://test.google.com/?q=abc(){}]def", [
    "http://test.google.com/?q=abc(){}",
  ]);
  check("http://test.google.com/?q=abc){}[]def", [
    "http://test.google.com/?q=abc",
  ]);
  check("http://test.google.com/?q=abc(){}[]def", [
    "http://test.google.com/?q=abc(){}[]def",
  ]);
  check("http://test-.google.com", []);
  check("http://test_.google.com", ["http://test_.google.com"]);
  check("http://google_.com", []);
  check("http://google._com_", []);
  check("http://[2001:4860:0:2001::68]/", []); // TODO
  check("tg://resolve", []);
  check("test.abd", []);
  check("/.b/..a    @.....@/. a.ba", ["a.ba"]);
  check("bbbbbbbbbbbbbb.@.@", []);
  check("http://google.com/", ["http://google.com/"]);
  check("http://google.com?", ["http://google.com"]);
  check("http://google.com#", ["http://google.com"]);
  check("http://google.com##", ["http://google.com##"]);
  check("http://google.com/?", ["http://google.com/"]);
  check("https://www.google.com/ab,", ["https://www.google.com/ab"]);
  check("@.", []);
  check(
    'a.b.google.com dfsknnfs gsdfgsg http://códuia.de/ dffdg," 12)(cpia.de/())(" http://гришка.рф/ sdufhdf ' +
      "http://xn--80afpi2a3c.xn--p1ai/ I have a good time.Thanks, guys!\n\n(hdfughidufhgdis) go#ogle.com гришка.рф " +
      "hsighsdf gi почта.рф\n\n✪df.ws/123      " +
      "xn--80afpi2a3c.xn--p1ai\n\nhttp://foo.com/blah_blah\nhttp://foo.com/blah_blah/\n(Something like " +
      "http://foo.com/blah_blah)\nhttp://foo.com/blah_blah_(wikipedi8989a_Вася)\n(Something like " +
      "http://foo.com/blah_blah_(Стакан_007))\nhttp://foo.com/blah_blah.\nhttp://foo.com/blah_blah/.\n<http://foo.com/" +
      "blah_blah>\n<http://fo@@@@@@@@@^%#*@^&@$#*@#%^*&!^#o.com/blah_blah/>\nhttp://foo.com/blah_blah,\nhttp://" +
      "www.example.com/wpstyle/?p=364.\nhttp://✪df.ws/123\nrdar://1234\nrdar:/1234\nhttp://" +
      "userid:password@example.com:8080\nhttp://userid@example.com\nhttp://userid@example.com:8080\nhttp://" +
      "userid:password@example.com\nhttp://example.com:8080 " +
      "x-yojimbo-item://6303E4C1-xxxx-45A6-AB9D-3A908F59AE0E\nmessage://" +
      "%3c330e7f8409726r6a4ba78dkf1fd71420c1bf6ff@mail.gmail.com%3e\nhttp://➡️.ws/䨹\nwww.➡️.ws/" +
      "䨹\n<tag>http://example.com</tag>\nJust a www.example.com " +
      "link.\n\n➡️.ws/" +
      "䨹\n\nabcdefghijklmnopqrstuvwxyz0123456789qwe_sdfsdf.aweawe-sdfs.com\nwww.🤙.tk:1\ngoogle.com:" +
      "᪉᪉᪉᪉\ngoogle." +
      "com:᪀᪀\nhttp://  .com\nURL:     .com\nURL: " +
      ".com\n\ngoogle.com?qwe\ngoogle.com#qwe\ngoogle.com/?\ngoogle.com/#\ngoogle.com?\ngoogle.com#\n",
    [
      "a.b.google.com",
      "http://códuia.de/",
      "cpia.de/()",
      "http://гришка.рф/",
      "http://xn--80afpi2a3c.xn--p1ai/",
      "гришка.рф",
      "почта.рф",
      "✪df.ws/123",
      "xn--80afpi2a3c.xn--p1ai",
      "http://foo.com/blah_blah",
      "http://foo.com/blah_blah/",
      "http://foo.com/blah_blah",
      "http://foo.com/blah_blah_(wikipedi8989a_Вася)",
      "http://foo.com/blah_blah_(Стакан_007)",
      "http://foo.com/blah_blah",
      "http://foo.com/blah_blah/",
      "http://foo.com/blah_blah",
      "http://foo.com/blah_blah",
      "http://www.example.com/wpstyle/?p=364",
      "http://✪df.ws/123",
      "http://userid:password@example.com:8080",
      "http://userid@example.com",
      "http://userid@example.com:8080",
      "http://userid:password@example.com",
      "http://example.com:8080",
      "http://➡️.ws/䨹",
      "www.➡️.ws/䨹",
      "http://example.com",
      "www.example.com",
      "➡️.ws/䨹",
      "abcdefghijklmnopqrstuvwxyz0123456789qwe_sdfsdf.aweawe-sdfs.com",
      "www.🤙.tk:1",
      "google.com",
      "google.com",
      "google.com?qwe",
      "google.com#qwe",
      "google.com/",
      "google.com/#",
      "google.com",
      "google.com",
    ],
  );
  check("https://t.…", []);
  check("('http://telegram.org/a-b/?br=ie&lang=en',)", [
    "http://telegram.org/a-b/?br=ie&lang=en",
  ]);
  check("https://ai.telegram.org/bot%20bot/test-...", [
    "https://ai.telegram.org/bot%20bot/test-",
  ]);
  check("a.bc@c.com", [], ["a.bc@c.com"]);
  check("https://a.bc@c.com", ["https://a.bc@c.com"]);
  check("https://a.de[bc@c.com", ["https://a.de"], ["bc@c.com"]);
  check("https://a.de/bc@c.com", ["https://a.de/bc@c.com"]);
  check("https://a.de]bc@c.com", ["https://a.de"], ["bc@c.com"]);
  check("https://a.de{bc@c.com", ["https://a.de"], ["bc@c.com"]);
  check("https://a.de}bc@c.com", ["https://a.de"], ["bc@c.com"]);
  check("https://a.de(bc@c.com", ["https://a.de"], ["bc@c.com"]);
  check("https://a.de)bc@c.com", ["https://a.de"], ["bc@c.com"]);
  check("https://a.debc@c.com", ["https://a.debc@c.com"]);
  check("https://a.de'bc@c.com", ["https://a.de"], ["bc@c.com"]);
  check("https://a.de`bc@c.com", ["https://a.de"], ["bc@c.com"]);
  check("https://a.bcde.fg@c.com", ["https://a.bcde.fg@c.com"]);
  check("https://a:h.bcde.fg@c.com", ["https://a:h.bcde.fg@c.com"]);
  check("https://abc@c.com", ["https://abc@c.com"]);
  check("https://de[bc@c.com", [], ["bc@c.com"]);
  check("https://de/bc@c.com", []);
  check("https://de]bc@c.com", [], ["bc@c.com"]);
  check("https://de{bc@c.com", [], ["bc@c.com"]);
  check("https://de}bc@c.com", [], ["bc@c.com"]);
  check("https://de(bc@c.com", [], ["bc@c.com"]);
  check("https://de)bc@c.com", [], ["bc@c.com"]);
  check("https://de\\bc@c.com", ["https://de\\bc@c.com"]);
  check("https://de'bc@c.com", [], ["bc@c.com"]);
  check("https://de`bc@c.com", [], ["bc@c.com"]);
  check("https://bc:defg@c.com", ["https://bc:defg@c.com"]);
  check("https://a:hbc:defg@c.com", ["https://a:hbc:defg@c.com"]);
  check("https://a.bc@test.com:cd.com", ["https://a.bc@test.com", "cd.com"]);
  check("telegram.Org", []);
  check("telegram.ORG", ["telegram.ORG"]);
  check("a.b.c.com.a.b.c", []);
  check("File '/usr/views.py'", []); // TODO server fix
  check("@views.py'", []); // TODO server fix
  check("#views.py'", []); // TODO server fix
  check("/views.py'", []); // TODO server fix
  check(".views.py", []);
  check("'views.py'", ["views.py"]);
  check("bug.http://test.com/test/+#", []); // TODO {"http://test.com/test/+#"}
  check("//AB.C.D.E.F.GH//", []);
  check("<http://www.ics.uci.edu/pub/ietf/uri/historical.html#WARNING>", [
    "http://www.ics.uci.edu/pub/ietf/uri/historical.html#WARNING",
  ]);
  check("Look :test@example.com", [":test@example.com"], []); // TODO {}, {"test@example.com"}
  check("Look mailto:test@example.com", [], ["test@example.com"]);
  check("http://test.com#a", ["http://test.com#a"]);
  check("http://test.com#", ["http://test.com"]);
  check("http://test.com?#", ["http://test.com?#"]);
  check("http://test.com/?#", ["http://test.com/?#"]);
  check("https://t.me/abcdef…", ["https://t.me/abcdef"]);
  check("https://t.me…", ["https://t.me"]);
  check("https://t.m…", []);
  check("https://t.…", []);
  check("https://t…", []);
  check("👉http://ab.com/cdefgh-1IJ", ["http://ab.com/cdefgh-1IJ"]);
  check("...👉http://ab.com/cdefgh-1IJ", []); // TODO
  check(".?", []);
  check("http://test―‑@―google―.―com―/―–―‐―/―/―/―?―‑―#―――", [
    "http://test―‑@―google―.―com―/―–―‐―/―/―/―?―‑―#―――",
  ]);
  check("http://google.com/‖", ["http://google.com/"]);
  check("a@b@c.com", [], []);
  check("abc@c.com@d.com", []);
  check("a@b.com:c@1", [], ["a@b.com"]);
  check("test@test.software", [], ["test@test.software"]);
  check("a:b?@gmail.com", []);
  check("a?:b@gmail.com", []);
  check("a#:b@gmail.com", []);
  check("a:b#@gmail.com", []);
  check("a!:b@gmail.com", ["a!:b@gmail.com"]);
  check("a:b!@gmail.com", ["a:b!@gmail.com"]);
  check("http://test_.com", []);
  check("test_.com", []);
  check("_test.com", []);
  check("_.test.com", ["_.test.com"]);
});

Deno.test("parse markdown v2", () => {
  const check = (text: string, result: string, entities?: MessageEntity[]) => {
    const str = encode(text);
    if (entities == null) {
      try {
        parseMarkdownV2(str);
      } catch (err) {
        assert(err instanceof Error);
        assertStrictEquals(err.message, result);
      }
    } else {
      const parsed = parseMarkdownV2(str);
      assertStrictEquals(decode(parsed.text), result);
      assertEquals(parsed.entities, entities);
    }
  };

  const reservedCharacters = encode("]()>#+-=|{}.!");
  const beginCharacters = encode("_*[~`");

  for (let codepoint = 1; codepoint < 126; codepoint++) {
    if (beginCharacters.includes(codepoint)) {
      continue;
    }
    const text = decode(Uint8Array.of(codepoint));
    if (!reservedCharacters.includes(codepoint)) {
      check(text, text, []);
    } else {
      check(text, `Character '${text}' is reserved and must be escaped with the preceding '\\'`);
      const escapedText = "\\" + text;
      check(escapedText, text, []);
    }
  }

  check("🏟 🏟_abacaba", "Can't find end of Italic entity at byte offset 9");
  check("🏟 🏟_abac * asd ", "Can't find end of Bold entity at byte offset 15");
  check("🏟 🏟_abac * asd _", "Can't find end of Italic entity at byte offset 21");
  check("🏟 🏟`", "Can't find end of Code entity at byte offset 9");
  check("🏟 🏟```", "Can't find end of Pre entity at byte offset 9");
  check("🏟 🏟```a", "Can't find end of Pre entity at byte offset 9");
  check("🏟 🏟```a ", "Can't find end of PreCode entity at byte offset 9");
  check("🏟 🏟__🏟 🏟_", "Can't find end of Italic entity at byte offset 20");
  check("🏟 🏟_🏟 🏟__", "Can't find end of Underline entity at byte offset 19");
  check("🏟 🏟```🏟 🏟`", "Can't find end of Code entity at byte offset 21");
  check("🏟 🏟```🏟 🏟_", "Can't find end of PreCode entity at byte offset 9");
  check("🏟 🏟```🏟 🏟\\`", "Can't find end of PreCode entity at byte offset 9");
  check("[telegram\\.org](asd\\)", "Can't find end of a URL at byte offset 16");
  check("[telegram\\.org](", "Can't find end of a URL at byte offset 16");
  check("[telegram\\.org](asd", "Can't find end of a URL at byte offset 16");
  check("🏟 🏟__🏟 _🏟___", "Can't find end of Italic entity at byte offset 23");
  check("🏟 🏟__", "Can't find end of Underline entity at byte offset 9");
  check("🏟 🏟||test\\|", "Can't find end of Spoiler entity at byte offset 9");
  check("🏟 🏟!", "Character '!' is reserved and must be escaped with the preceding '\\'");
  check("🏟 🏟![", "Can't find end of CustomEmoji entity at byte offset 9");
  check("🏟 🏟![👍", "Can't find end of CustomEmoji entity at byte offset 9");
  check("🏟 🏟![👍]", "Custom emoji entity must contain a tg://emoji URL");
  check("🏟 🏟![👍](tg://emoji?id=1234", "Can't find end of a custom emoji URL at byte offset 17");
  check("🏟 🏟![👍](t://emoji?id=1234)", "Custom emoji URL must have scheme tg");
  check("🏟 🏟![👍](tg:emojis?id=1234)", 'Custom emoji URL must have host "emoji"');
  check("🏟 🏟![👍](tg://emoji#test)", "Custom emoji URL must have an emoji identifier");
  check("🏟 🏟![👍](tg://emoji?test=1#&id=25)", "Custom emoji URL must have an emoji identifier");
  check("🏟 🏟![👍](tg://emoji?test=1231&id=025)", "Invalid custom emoji identifier specified");

  check("", "", []);
  check("\\\\", "\\", []);
  check("\\\\\\", "\\\\", []);
  check("\\\\\\\\\\_\\*\\`", "\\\\_*`", []);
  check("➡️ ➡️", "➡️ ➡️", []);
  check("🏟 🏟``", "🏟 🏟", []);
  check("🏟 🏟_abac \\* asd _", "🏟 🏟abac * asd ", [{ type: "italic", offset: 5, length: 11 }]);
  check("🏟 \\.🏟_🏟\\. 🏟_", "🏟 .🏟🏟. 🏟", [{ type: "italic", offset: 6, length: 6 }]);
  check("\\\\\\a\\b\\c\\d\\e\\f\\1\\2\\3\\4\\➡️\\", "\\abcdef1234\\➡️\\", []);
  check("➡️ ➡️_➡️ ➡️_", "➡️ ➡️➡️ ➡️", [{ type: "italic", offset: 5, length: 5 }]);
  check("➡️ ➡️_➡️ ➡️_*➡️ ➡️*", "➡️ ➡️➡️ ➡️➡️ ➡️", [{ type: "italic", offset: 5, length: 5 }, {
    type: "bold",
    offset: 10,
    length: 5,
  }]);
  check("🏟 🏟_🏟 \\.🏟_", "🏟 🏟🏟 .🏟", [{ type: "italic", offset: 5, length: 6 }]);
  check("🏟 🏟_🏟 *🏟*_", "🏟 🏟🏟 🏟", [{ type: "italic", offset: 5, length: 5 }, { type: "bold", offset: 8, length: 2 }]);
  check("🏟 🏟_🏟 __🏟___", "🏟 🏟🏟 🏟", [{ type: "italic", offset: 5, length: 5 }, {
    type: "underline",
    offset: 8,
    length: 2,
  }]);
  check("🏟 🏟__🏟 _🏟_ __", "🏟 🏟🏟 🏟 ", [{ type: "underline", offset: 5, length: 6 }, {
    type: "italic",
    offset: 8,
    length: 2,
  }]);
  check("🏟 🏟__🏟 _🏟_\\___", "🏟 🏟🏟 🏟_", [{ type: "underline", offset: 5, length: 6 }, {
    type: "italic",
    offset: 8,
    length: 2,
  }]);
  check("🏟 🏟`🏟 🏟```", "🏟 🏟🏟 🏟", [{ type: "code", offset: 5, length: 5 }]);
  check("🏟 🏟```🏟 🏟```", "🏟 🏟 🏟", [{ type: "pre_code", offset: 5, length: 3, language: encode("🏟") }]);
  check("🏟 🏟```🏟\n🏟```", "🏟 🏟🏟", [{ type: "pre_code", offset: 5, length: 2, language: encode("🏟") }]);
  check("🏟 🏟```🏟\r🏟```", "🏟 🏟🏟", [{ type: "pre_code", offset: 5, length: 2, language: encode("🏟") }]);
  check("🏟 🏟```🏟\n\r🏟```", "🏟 🏟🏟", [{ type: "pre_code", offset: 5, length: 2, language: encode("🏟") }]);
  check("🏟 🏟```🏟\r\n🏟```", "🏟 🏟🏟", [{ type: "pre_code", offset: 5, length: 2, language: encode("🏟") }]);
  check("🏟 🏟```🏟\n\n🏟```", "🏟 🏟\n🏟", [{ type: "pre_code", offset: 5, length: 3, language: encode("🏟") }]);
  check("🏟 🏟```🏟\r\r🏟```", "🏟 🏟\r🏟", [{ type: "pre_code", offset: 5, length: 3, language: encode("🏟") }]);
  check("🏟 🏟```🏟 \\\\\\`🏟```", "🏟 🏟 \\`🏟", [{ type: "pre_code", offset: 5, length: 5, language: encode("🏟") }]);
  check("🏟 🏟**", "🏟 🏟", []);
  check("||test||", "test", [{ type: "spoiler", offset: 0, length: 4 }]);
  check("🏟 🏟``", "🏟 🏟", []);
  check("🏟 🏟``````", "🏟 🏟", []);
  check("🏟 🏟____", "🏟 🏟", []);
  check("`_* *_`__*` `*__", "_* *_ ", [
    { type: "code", offset: 0, length: 5 },
    { type: "code", offset: 5, length: 1 },
    { type: "bold", offset: 5, length: 1 },
    { type: "underline", offset: 5, length: 1 },
  ]);
  check("_* * ` `_", "   ", [
    { type: "italic", offset: 0, length: 3 },
    { type: "bold", offset: 0, length: 1 },
    { type: "code", offset: 2, length: 1 },
  ]);
  check("[](telegram.org)", "", []);
  check("[ ](telegram.org)", " ", [{ type: "text_link", offset: 0, length: 1, url: encode("http://telegram.org/") }]);
  check("[ ](as)", " ", []);
  check("[telegram\\.org]", "telegram.org", [{
    type: "text_link",
    offset: 0,
    length: 12,
    url: encode("http://telegram.org/"),
  }]);
  check("[telegram\\.org]a", "telegram.orga", [{
    type: "text_link",
    offset: 0,
    length: 12,
    url: encode("http://telegram.org/"),
  }]);
  check("[telegram\\.org](telegram.dog)", "telegram.org", [{
    type: "text_link",
    offset: 0,
    length: 12,
    url: encode("http://telegram.dog/"),
  }]);
  check("[telegram\\.org](https://telegram.dog?)", "telegram.org", [{
    type: "text_link",
    offset: 0,
    length: 12,
    url: encode("https://telegram.dog/?"),
  }]);
  check("[telegram\\.org](https://telegram.dog?\\\\\\()", "telegram.org", [{
    type: "text_link",
    offset: 0,
    length: 12,
    url: encode("https://telegram.dog/?\\("),
  }]);
  check("[telegram\\.org]()", "telegram.org", []);
  check("[telegram\\.org](asdasd)", "telegram.org", []);
  check("[telegram\\.org](tg:user?id=123456)", "telegram.org", [{
    type: "text_mention",
    offset: 0,
    length: 12,
    user_id: new UserId(123456n),
  }]);
  check("🏟 🏟![👍](TG://EMoJI/?test=1231&id=25#id=32)a", "🏟 🏟👍a", [{
    type: "custom_emoji",
    offset: 5,
    length: 2,
    custom_emoji_id: new CustomEmojiId(25n),
  }]);
});

Deno.test("parse html", () => {
  const check = (text: string, result: string, entities?: MessageEntity[]) => {
    const str = encode(text);
    if (entities == null) {
      try {
        parseHTML(str);
      } catch (err) {
        assert(err instanceof Error);
        assertStrictEquals(err.message, result);
      }
    } else {
      const parsed = parseHTML(str);
      assertStrictEquals(decode(parsed.text), result);
      assertEquals(parsed.entities, entities);
    }
  };

  const INVALID_SURROGATE_PAIR_ERROR_MESSAGE =
    "Text contains invalid Unicode characters after decoding HTML entities, check for unmatched surrogate code units";

  check("&#57311;", INVALID_SURROGATE_PAIR_ERROR_MESSAGE);
  check("&#xDFDF;", INVALID_SURROGATE_PAIR_ERROR_MESSAGE);
  check("&#xDFDF", INVALID_SURROGATE_PAIR_ERROR_MESSAGE);
  check("🏟 🏟&lt;<abacaba", "Unclosed start tag at byte offset 13");
  check("🏟 🏟&lt;<abac aba>", 'Unsupported start tag "abac" at byte offset 13');
  check("🏟 🏟&lt;<abac>", 'Unsupported start tag "abac" at byte offset 13');
  check("🏟 🏟&lt;<i   =aba>", 'Empty attribute name in the tag "i" at byte offset 13');
  check(
    "🏟 🏟&lt;<i    aba>",
    'Expected equal sign in declaration of an attribute of the tag "i" at byte offset 13',
  );
  check("🏟 🏟&lt;<i    aba  =  ", 'Unclosed start tag "i" at byte offset 13');
  check("🏟 🏟&lt;<i    aba  =  190azAz-.,", "Unexpected end of name token at byte offset 27");
  check('🏟 🏟&lt;<i    aba  =  "&lt;&gt;&quot;>', "Unclosed start tag at byte offset 13");
  check("🏟 🏟&lt;<i    aba  =  '&lt;&gt;&quot;>", "Unclosed start tag at byte offset 13");
  check("🏟 🏟&lt;</", "Unexpected end tag at byte offset 13");
  check("🏟 🏟&lt;<b></b></", "Unexpected end tag at byte offset 20");
  check("🏟 🏟&lt;<i>a</i   ", "Unclosed end tag at byte offset 17");
  check("🏟 🏟&lt;<i>a</em   >", 'Unmatched end tag at byte offset 17, expected "</i>", found "</em>"');

  check("", "", []);
  check("➡️ ➡️", "➡️ ➡️", []);
  check("&ge;&lt;&gt;&amp;&quot;&laquo;&raquo;&#12345678;", '&ge;<>&"&laquo;&raquo;&#12345678;', []);
  check("&Or;", "&Or;", []);
  check("➡️ ➡️<i>➡️ ➡️</i>", "➡️ ➡️➡️ ➡️", [{ type: "italic", offset: 5, length: 5 }]);
  check("➡️ ➡️<em>➡️ ➡️</em>", "➡️ ➡️➡️ ➡️", [{ type: "italic", offset: 5, length: 5 }]);
  check("➡️ ➡️<b>➡️ ➡️</b>", "➡️ ➡️➡️ ➡️", [{ type: "bold", offset: 5, length: 5 }]);
  check("➡️ ➡️<strong>➡️ ➡️</strong>", "➡️ ➡️➡️ ➡️", [{ type: "bold", offset: 5, length: 5 }]);
  check("➡️ ➡️<u>➡️ ➡️</u>", "➡️ ➡️➡️ ➡️", [{ type: "underline", offset: 5, length: 5 }]);
  check("➡️ ➡️<ins>➡️ ➡️</ins>", "➡️ ➡️➡️ ➡️", [{ type: "underline", offset: 5, length: 5 }]);
  check("➡️ ➡️<s>➡️ ➡️</s>", "➡️ ➡️➡️ ➡️", [{ type: "strikethrough", offset: 5, length: 5 }]);
  check("➡️ ➡️<strike>➡️ ➡️</strike>", "➡️ ➡️➡️ ➡️", [{ type: "strikethrough", offset: 5, length: 5 }]);
  check("➡️ ➡️<del>➡️ ➡️</del>", "➡️ ➡️➡️ ➡️", [{ type: "strikethrough", offset: 5, length: 5 }]);
  check("➡️ ➡️<i>➡️ ➡️</i><b>➡️ ➡️</b>", "➡️ ➡️➡️ ➡️➡️ ➡️", [
    { type: "italic", offset: 5, length: 5 },
    { type: "bold", offset: 10, length: 5 },
  ]);
  check("🏟 🏟<i>🏟 &lt🏟</i>", "🏟 🏟🏟 <🏟", [{ type: "italic", offset: 5, length: 6 }]);
  check("🏟 🏟<i>🏟 &gt;<b aba   =   caba>&lt🏟</b></i>", "🏟 🏟🏟 ><🏟", [
    { type: "italic", offset: 5, length: 7 },
    { type: "bold", offset: 9, length: 3 },
  ]);
  check("🏟 🏟&lt;<i    aba  =  190azAz-.   >a</i>", "🏟 🏟<a", [{ type: "italic", offset: 6, length: 1 }]);
  check("🏟 🏟&lt;<i    aba  =  190azAz-.>a</i>", "🏟 🏟<a", [{ type: "italic", offset: 6, length: 1 }]);
  check('🏟 🏟&lt;<i    aba  =  "&lt;&gt;&quot;">a</i>', "🏟 🏟<a", [{ type: "italic", offset: 6, length: 1 }]);
  check("🏟 🏟&lt;<i    aba  =  '&lt;&gt;&quot;'>a</i>", "🏟 🏟<a", [{ type: "italic", offset: 6, length: 1 }]);
  check("🏟 🏟&lt;<i    aba  =  '&lt;&gt;&quot;'>a</>", "🏟 🏟<a", [{ type: "italic", offset: 6, length: 1 }]);
  check("🏟 🏟&lt;<i>🏟 🏟&lt;</>", "🏟 🏟<🏟 🏟<", [{ type: "italic", offset: 6, length: 6 }]);
  check("🏟 🏟&lt;<i>a</    >", "🏟 🏟<a", [{ type: "italic", offset: 6, length: 1 }]);
  check("🏟 🏟&lt;<i>a</i   >", "🏟 🏟<a", [{ type: "italic", offset: 6, length: 1 }]);
  check("🏟 🏟&lt;<b></b>", "🏟 🏟<", []);
  check("<i>\t</i>", "\t", [{ type: "italic", offset: 0, length: 1 }]);
  check("<i>\r</i>", "\r", [{ type: "italic", offset: 0, length: 1 }]);
  check("<i>\n</i>", "\n", [{ type: "italic", offset: 0, length: 1 }]);
  check('➡️ ➡️<span class = "tg-spoiler">➡️ ➡️</span><b>➡️ ➡️</b>', "➡️ ➡️➡️ ➡️➡️ ➡️", [
    { type: "spoiler", offset: 5, length: 5 },
    { type: "bold", offset: 10, length: 5 },
  ]);
  check('🏟 🏟<span class="tg-spoiler">🏟 &lt🏟</span>', "🏟 🏟🏟 <🏟", [{ type: "spoiler", offset: 5, length: 6 }]);
  check('🏟 🏟<span class="tg-spoiler">🏟 &gt;<b aba   =   caba>&lt🏟</b></span>', "🏟 🏟🏟 ><🏟", [
    { type: "spoiler", offset: 5, length: 7 },
    { type: "bold", offset: 9, length: 3 },
  ]);
  check("➡️ ➡️<tg-spoiler>➡️ ➡️</tg-spoiler><b>➡️ ➡️</b>", "➡️ ➡️➡️ ➡️➡️ ➡️", [
    { type: "spoiler", offset: 5, length: 5 },
    { type: "bold", offset: 10, length: 5 },
  ]);
  check("🏟 🏟<tg-spoiler>🏟 &lt🏟</tg-spoiler>", "🏟 🏟🏟 <🏟", [{ type: "spoiler", offset: 5, length: 6 }]);
  check("🏟 🏟<tg-spoiler>🏟 &gt;<b aba   =   caba>&lt🏟</b></tg-spoiler>", "🏟 🏟🏟 ><🏟", [
    { type: "spoiler", offset: 5, length: 7 },
    { type: "bold", offset: 9, length: 3 },
  ]);
  check("<a href=telegram.org>\t</a>", "\t", [{
    type: "text_link",
    offset: 0,
    length: 1,
    url: encode("http://telegram.org/"),
  }]);
  check("<a href=telegram.org>\r</a>", "\r", [{
    type: "text_link",
    offset: 0,
    length: 1,
    url: encode("http://telegram.org/"),
  }]);
  check("<a href=telegram.org>\n</a>", "\n", [{
    type: "text_link",
    offset: 0,
    length: 1,
    url: encode("http://telegram.org/"),
  }]);
  check("<code><i><b> </b></i></code><i><b><code> </code></b></i>", "  ", [
    { type: "code", offset: 0, length: 1 },
    { type: "bold", offset: 0, length: 1 },
    { type: "italic", offset: 0, length: 1 },
    { type: "code", offset: 1, length: 1 },
    { type: "bold", offset: 1, length: 1 },
    { type: "italic", offset: 1, length: 1 },
  ]);
  check("<i><b> </b> <code> </code></i>", "   ", [
    { type: "italic", offset: 0, length: 3 },
    { type: "bold", offset: 0, length: 1 },
    { type: "code", offset: 2, length: 1 },
  ]);
  check("<a href=telegram.org> </a>", " ", [{
    type: "text_link",
    offset: 0,
    length: 1,
    url: encode("http://telegram.org/"),
  }]);
  check('<a href  ="telegram.org"   > </a>', " ", [{
    type: "text_link",
    offset: 0,
    length: 1,
    url: encode("http://telegram.org/"),
  }]);
  check("<a   href=  'telegram.org'   > </a>", " ", [{
    type: "text_link",
    offset: 0,
    length: 1,
    url: encode("http://telegram.org/"),
  }]);
  check("<a   href=  'telegram.org?&lt;'   > </a>", " ", [{
    type: "text_link",
    offset: 0,
    length: 1,
    url: encode("http://telegram.org/?<"),
  }]);
  check("<a> </a>", " ", []);
  check("<a>telegram.org </a>", "telegram.org ", []);
  check("<a>telegram.org</a>", "telegram.org", [{
    type: "text_link",
    offset: 0,
    length: 12,
    url: encode("http://telegram.org/"),
  }]);
  check("<a>https://telegram.org/asdsa?asdasdwe#12e3we</a>", "https://telegram.org/asdsa?asdasdwe#12e3we", [
    { type: "text_link", offset: 0, length: 42, url: encode("https://telegram.org/asdsa?asdasdwe#12e3we") },
  ]);
  check("🏟 🏟&lt;<pre  >🏟 🏟&lt;</>", "🏟 🏟<🏟 🏟<", [{ type: "pre", offset: 6, length: 6 }]);
  check("🏟 🏟&lt;<code >🏟 🏟&lt;</>", "🏟 🏟<🏟 🏟<", [{ type: "code", offset: 6, length: 6 }]);
  check("🏟 🏟&lt;<pre><code>🏟 🏟&lt;</code></>", "🏟 🏟<🏟 🏟<", [
    { type: "pre", offset: 6, length: 6 },
    { type: "code", offset: 6, length: 6 },
  ]);
  check('🏟 🏟&lt;<pre><code class="language-">🏟 🏟&lt;</code></>', "🏟 🏟<🏟 🏟<", [
    { type: "pre", offset: 6, length: 6 },
    { type: "code", offset: 6, length: 6 },
  ]);
  check('🏟 🏟&lt;<pre><code class="language-fift">🏟 🏟&lt;</></>', "🏟 🏟<🏟 🏟<", [
    { type: "pre_code", offset: 6, length: 6, language: encode("fift") },
  ]);
  check('🏟 🏟&lt;<code class="language-fift"><pre>🏟 🏟&lt;</></>', "🏟 🏟<🏟 🏟<", [
    { type: "pre_code", offset: 6, length: 6, language: encode("fift") },
  ]);
  check('🏟 🏟&lt;<pre><code class="language-fift">🏟 🏟&lt;</> </>', "🏟 🏟<🏟 🏟< ", [
    { type: "pre", offset: 6, length: 7 },
    { type: "code", offset: 6, length: 6 },
  ]);
  check('🏟 🏟&lt;<pre> <code class="language-fift">🏟 🏟&lt;</></>', "🏟 🏟< 🏟 🏟<", [
    { type: "pre", offset: 6, length: 7 },
    { type: "code", offset: 7, length: 6 },
  ]);
  check('➡️ ➡️<tg-emoji emoji-id = "12345">➡️ ➡️</tg-emoji><b>➡️ ➡️</b>', "➡️ ➡️➡️ ➡️➡️ ➡️", [
    { type: "custom_emoji", offset: 5, length: 5, custom_emoji_id: new CustomEmojiId(12345n) },
    { type: "bold", offset: 10, length: 5 },
  ]);
  check('🏟 🏟<tg-emoji emoji-id="54321">🏟 &lt🏟</tg-emoji>', "🏟 🏟🏟 <🏟", [
    { type: "custom_emoji", offset: 5, length: 6, custom_emoji_id: new CustomEmojiId(54321n) },
  ]);
  check('🏟 🏟<b aba   =   caba><tg-emoji emoji-id="1">🏟</tg-emoji>1</b>', "🏟 🏟🏟1", [
    { type: "bold", offset: 5, length: 3 },
    { type: "custom_emoji", offset: 5, length: 2, custom_emoji_id: new CustomEmojiId(1n) },
  ]);
});
