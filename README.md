# dsh-web-tinyfish

English | [中文](README.zh.md)

TinyFish-backed `web_search` and `web_fetch` providers for the
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) web
capability seam (`ctx.web`). Independent third-party plugin — not affiliated
with DeepSeek or TinyFish, and written from scratch against the public
[provider seam](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/web/web)
and the [TinyFish API docs](https://docs.tinyfish.ai).

- One package registers **both** providers under the id `tinyfish`:
  - **Search** (`GET api.search.tinyfish.ai`) serves `web_search` — geo/language targeting, domain include/exclude, freshness windows and date bounds, `news` / `research_paper` corpora.
  - **Fetch** (`POST api.fetch.tinyfish.ai`) serves `web_fetch` — real-browser rendering, clean `markdown`/`html` extraction, CSS selector scoping, cache TTL control.
- Search and Fetch are free at any TinyFish wallet balance.

## Security posture

| Property | Behavior |
| --- | --- |
| Credential-bearing requests **refuse redirects** | Both API calls run with `redirect: 'error'`; a 30x from the endpoint fails instead of forwarding your `X-API-Key` to another origin. Regression-tested with a live redirecting server. |
| Fetch-target preflight | Target URLs must be ≤2048 chars, `http(s)`, without embedded credentials, and not private-network — checked locally before TinyFish is contacted. Configured API endpoints are operator configuration: loopback/private bases (local mocks, LAN gateways) are admitted, matching the first-party providers. |
| Minimal credential surface | One reference (`TINYFISH_API_KEY` by default) resolved per request: literal `apiKey` (discouraged) → harness credentials service → launch environment. Error messages name the reference, never a key value. |
| No privilege widening | The bundle patch inserts the plugin and retargets the `web` row. It never enables `tool-web` globally — which agents get web tools stays your composition's decision. |
| No install hooks, one runtime dep | `prepare` builds with `tsc`; the only runtime dependency is pinned `@deepseek-ai/schemastery`. |

## Quick start

```sh
export TINYFISH_API_KEY="tf_..."   # from https://agent.tinyfish.ai/api-keys
```

Install into your dsh profile (see [INSTALL.md](INSTALL.md)) and the patch layer
retargets `web_search` at TinyFish:

```yaml
# $DSH_HOME/profiles/<name>/cordis.patch.yml — optional per-deployment tuning
- id: web-tinyfish
  config:
    search:
      location: US
      language: en
    fetch:
      format: markdown
```

To also route `web_fetch` through TinyFish, override the `web` row:

```yaml
- id: web
  config:
    searchProvider: tinyfish
    fetchProvider: tinyfish
```

No patch at all is needed for a one-off switch:
`DSH_WEB_SEARCH_PROVIDER=tinyfish dsh …` (the seam treats the env vars as
equivalents of the row fields).

Full configuration reference: [CONFIG.md](CONFIG.md). Behavior and error
mapping: [USAGE.md](USAGE.md).

## Known limitations

- **Fetched pages always report `statusCode: 200`.** TinyFish does not pass the
  origin page's HTTP status through; per-URL failures (`bot_blocked`,
  `timeout`, `selector_not_matched`, …) surface as tool errors instead.
- **Search fields the seam cannot carry are dropped**: `position`, `site_name`,
  `publisher`, and the academic `authors` / `venue` / `pub_year` /
  `citation_count` / `pdf_url`. Search has no server-side result-count
  parameter, so `maxResults` truncates locally.
- **Not exposed** (no seam vocabulary for them): search pagination and
  `purpose`, fetch batching (`urls[1..10]`), `format: json`, `links` /
  `image_links`, highlights, and conditional requests (ETag). The Fetch API's
  browser-side redirect following to the *target* page is untouched — only
  redirects of the *API endpoint itself* are refused.

## Wiring the web tools

`dsh-base` profiles already enable `tool-web`; the Web app composes the tools
per agent preset. This patch deliberately never touches that row. To give one
preset the tools, add `tool-web` to its agent composition; to give every
preset the tools, enable the `tool-web` row in your own profile patch — the
choice and its blast radius stay visible in your layer.

## Development

```sh
pnpm install
pnpm run typecheck && pnpm test && pnpm run build
```

`node --test` with type stripping; no test-framework dependency. MIT © 2026
Alen <Alen299@163.com> — see [LICENSE](LICENSE). Changelog:
[CHANGELOG.md](CHANGELOG.md).
