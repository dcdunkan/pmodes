<div align="center">

# Parse Modes

</div>

A **work-in-progress** TypeScript implementation of [TDLib](https://github.com/tdlib/td)'s functions and utilities
related to parsing text with several parse modes and matching text entities.

Few more methods are left to be implemented. But the tests are direclty ported from TDLib source without a change. And
they seem to be passing. So, I'll take that as a "it works"!

I cannot assure you the quality of the implementation, as I'm **not** good at C++ (TDLib is written in C++). So, I
probably have done few stupid things because I missed how C++ actually works.

Anyway, thank you so much.

<details>

<summary>
For now, here is what have been ported properly. But of course, they still might have a few bugs. And I'm just showing
off!
</summary>

###### match.ts (td/telegram/MessageEntity.cpp)

- [x] `match_mentions`
- [x] `match_bot_commands`
- [x] `match_hashtags`
- [x] `match_cashtags`
- [x] `match_media_timestamps`
- [x] `match_bank_card_numbers`
- [x] `is_url_unicode_symbol`
- [x] `is_url_path_symbol`
- [x] `match_tg_urls`
- [x] `is_protocol_symbol`
- [x] `is_user_data_symbol`
- [x] `is_domain_symbol`
- [x] `match_urls`
- [x] `is_valid_bank_card`
- [x] `is_email_address`
- [x] `is_common_tld`
- [x] `fix_url`
- [x] `get_valid_short_usernames`
- [x] `find_mentions`
- [x] `find_bot_commands`
- [x] `find_hashtags`
- [x] `find_cashtags`
- [x] `find_bank_card_numbers`
- [x] `find_tg_urls`
- [x] `find_urls`
- [x] `find_media_timestamps`
- [x] `text_length`
- [x] `get_type_priority`
- [x] `remove_empty_entities`
- [x] `sort_entities`
- [x] `check_is_sorted`
- [x] `check_non_intersecting`
- [x] `get_entity_type_mask`
- [x] `get_splittable_entities_mask`
- [x] `get_blockquote_entities_mask`
- [x] `get_continuous_entities_mask`
- [x] `get_pre_entities_mask`
- [x] `get_user_entities_mask`
- [x] `is_splittable_entity`
- [x] `is_blockquote_entity`
- [x] `is_continuous_entity`
- [x] `is_pre_entity`
- [x] `is_user_entity`
- [x] `is_hidden_data_entity`
- [x] `get_splittable_entity_type_index`
- [x] `are_entities_valid`
- [x] `remove_intersecting_entities`
- [x] `remove_entities_intersecting_blockquote`
- [x] `fix_entity_offsets`
- [x] `find_entities`
- [x] `find_media_timestamp_entities`
- [x] `merge_entities`
- [x] `is_plain_domain`
- [x] `get_first_url`
- [x] `parse_markdown`
- [x] `parse_markdown_v2`
- [x] `decode_html_entity`
- [ ] `parse_html`*

###### utilities.ts (from a lot of files)

- [x] `is_word_character`
- [x] `to_lower_begins_with`
- [x] `to_lower`
- [x] `split`
- [x] `full_split`
- [x] `begins_with`
- [x] `ends_with`
- [x] `is_space`
- [x] `is_alpha`
- [x] `is_alpha` from misc.h
- [x] `is_alnum`
- [x] `is_digit`
- [x] `is_alpha_digit`
- [x] `is_alpha_digit_or_underscore`
- [x] `is_alpha_digit_underscore_or_minus`
- [x] `is_hex_digit`
- [x] `hex_to_int`
- [x] `is_hashtag_letter`
- [x] `CHECK`
- [x] `LOG_CHECK`

###### unicode.ts (tdutils/td/utils/unicode.cpp)

- [x] `UnicodeSimpleCategory`
- [x] `get_unicode_simple_category`
- [x] `binary_search_ranges`
- [x] `unicode_to_lower`

###### utf8.ts (tdutils/td/utils/utf8.cpp)

- [x] `is_utf8_character_first_code_unit`
- [x] `utf8_length`
- [x] `utf8_utf16_length`
- [x] `prev_utf8_unsafe`
- [x] `next_utf8_unsafe`
- [x] `append_utf8_character`
- [x] `append_utf8_character_unsafe`
- [x] `utf8_to_lower`
- [x] `utf8_truncate`
- [x] `utf8_utf16_truncate`
- [x] `utf8_substr`
- [x] `utf8_utf16_substr`
- [x] `check_utf8`

###### other stuff

- [x] `CustomEmojiId`
- [x] `HttpUrl`
- [x] `HttpUrlProtocol`
- [x] `parse_url`
- [x] `IpAddress`
- [x] `parse_ipv6` (a compatible port from core-js)
- [x] `LinkManager::getLinkUserId`
- [x] `LinkManager::getLinkCustomEmojiId`
- [x] `LinkManager::getCheckedLink`
- [x] `LinkManager::checkLinkImpl`
- [x] `UserId`

> \* Most likely too buggy.

</details>
