# Usage

English | [中文](USAGE.zh.md)

Both providers answer the model-facing `web_search` / `web_fetch` tools; there
is no separate tool surface.

## What the model sees

- **`web_search`** results cite `url`, `title` (when present), `snippet` (when
  present), and `publishedAt` (when TinyFish reports a date). Results are
  deduplicated by URL and capped by the tool's result bound.
- **`web_fetch`** returns the extracted page as markdown (`text` body) or
  semantic HTML (`html` body) under the URL the page finally landed on
  (`final_url`), capped at `fetch.maxTextBytes` without splitting characters.

## Error mapping

| TinyFish side | Tool-visible failure |
| --- | --- |
| `401` `MISSING_API_KEY` / `INVALID_API_KEY` / `UNAUTHORIZED` | credential-missing error naming the reference (`WEB_PROVIDER_CREDENTIAL_MISSING`) |
| `429` rate limit (150 URLs/min per key) | provider error carrying the TinyFish code |
| `400` `INVALID_INPUT` and other non-2xx | provider error carrying code + message |
| fetch per-URL failure (`bot_blocked`, `timeout`, `selector_not_matched`, `selector_unsupported`, `content_too_large`, `empty_content`, …) | provider error naming the URL and the code; selector failures add unmatched + candidate selectors |
| caller cancellation | `WEB_ABORTED` |
| endpoint redirect | refused before following; provider error naming the redirect |
| network/DNS/TLS failure (`TypeError: fetch failed`) | provider error labeled `network/transport`, with the undici cause chain |
| private/loopback fetch target | refused locally; no request leaves the machine |

## Cost notes

- Search and Fetch are free at any TinyFish wallet balance; the Agent and
  Browser APIs are not used by this plugin.
- Fetch sends exactly one URL per request (the seam's fetch is per-URL), so
  TinyFish's 10-URL batching is not exercised.
- Requests identify as `dsh-web-tinyfish/<version>` through `User-Agent`.

## Verifying the installation

```sh
export TINYFISH_API_KEY="tf_..."
dsh --profile <name> "use web_search to find the TinyFish docs, then web_fetch https://docs.tinyfish.ai/fetch-api and summarize"
```
