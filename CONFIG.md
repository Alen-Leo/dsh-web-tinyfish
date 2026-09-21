# Configuration reference

English | [中文](CONFIG.zh.md)

Every field is optional; the shipped defaults need nothing but
`TINYFISH_API_KEY`. Cross-field rules fail loud at plugin load (and at the
first request for a broken settings section).

## Top level

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `apiKey` | string (secret) | — | Literal API key. Avoid committing it; prefer `apiKeyEnv`. |
| `apiKeyEnv` | string (credential-ref) | `TINYFISH_API_KEY` | Reference resolved per request through the credentials service, then the launch environment. |
| `requestTimeoutMs` | integer ≥100 | `45000` | Whole-request timeout for both APIs. |
| `search` | object | — | Search-provider tuning (below). |
| `fetch` | object | — | Fetch-provider tuning (below). |

Endpoint overrides: `TINYFISH_SEARCH_BASE_URL` / `TINYFISH_FETCH_BASE_URL`
launch-environment variables apply when the corresponding `baseURL` is unset.

## `search`

| Field | Type | Default | Maps to |
| --- | --- | --- | --- |
| `baseURL` | string | `https://api.search.tinyfish.ai` | — |
| `location` | string | auto (API) | `location` — country code, e.g. `US`, `GB` |
| `language` | string | auto (API) | `language` — language code, e.g. `en`, `zh` |
| `includeDomains` | string[] | — | `include_domains` — bare hostnames, comma-joined |
| `excludeDomains` | string[] | — | `exclude_domains` |
| `recencyMinutes` | 1–5256000 | — | `recency_minutes` — **cannot combine with the date bounds** |
| `afterDate` | `YYYY-MM-DD` | — | `after_date` — ≤ `beforeDate` |
| `beforeDate` | `YYYY-MM-DD` | — | `before_date` |
| `domainType` | `web` \| `news` \| `research_paper` | — | `domain_type` |
| `pubYearMin` | 0–9999 | — | `pub_year_min` — only with `domainType: research_paper` |
| `pubYearMax` | 0–9999 | — | `pub_year_max` — ≥ `pubYearMin` |

## `fetch`

| Field | Type | Default | Maps to |
| --- | --- | --- | --- |
| `baseURL` | string | `https://api.fetch.tinyfish.ai` | — |
| `format` | `markdown` \| `html` | `markdown` | `format` — markdown → text body, html → html body |
| `ttlSeconds` | integer ≥0 | — | `ttl` — omit = any cache, `0` = live fetch |
| `perUrlTimeoutMs` | 1–110000 | — | `per_url_timeout_ms` — TinyFish-side per-URL budget |
| `maxTextBytes` | integer ≥1024 | `524288` | local byte cap; result flags `truncated` when cut |
| `includeSelectors` | string[1..20] | — | `include_selectors` — CSS selectors, each 1–1000 chars |
| `excludeSelectors` | string[1..20] | — | `exclude_selectors` |
