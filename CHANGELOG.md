# Changelog

## 0.2.0

Targets dsh `>=0.2.0-rc.2 <0.3.0` (cordis `>=4.0.4`, schemastery `3.18.4`).

- **Breaking:** configuration is declared `volatile()` and read through `.get()`
  per request. The retired `SettingsProvider.installSection()` call is gone: dsh
  0.1.7-alpha.1 replaced that seam with schema-projected config forms, so the
  old call installed no settings card on newer hosts and failed silently. The
  `web-tinyfish` settings form now comes from the Config schema itself, and
  `SETTINGS_NAMESPACE` is no longer exported.
- **Breaking:** peer and engine ranges move to `>=0.2.0-rc.2 <0.3.0`
  (`@deepseek-ai/cordis` `>=4.0.4`).
- Fix the fetch-target preflight: IPv4-mapped IPv6 was refused only in its
  dotted spelling, while `URL.hostname` normalizes it to hex
  (`[::ffff:7f00:1]`), so `http://[::ffff:10.0.0.1]/` was admitted. Address
  literals are classified with `ipaddr.js` (the first-party choice), which also
  covers the 6to4, Teredo, and NAT64 spellings whose embedded IPv4 target a
  prefix test cannot reach. A trailing DNS-root dot is normalized before the
  textual checks, so `http://localhost./` names the same refused host as
  `http://localhost/`. The tests now drive those spellings through
  `validateTargetUrl`. A hostname that *resolves* to a private address still
  cannot be detected offline; TinyFish refuses those server-side.
- A cross-field configuration violation is reported as a provider error naming
  the field instead of leaving the provider "registered but unavailable", and
  such a request sends nothing. `available()` is now purely the seam's selection
  gate: a resolvable key and a parseable endpoint.
- `requestTimeoutMs` defaults to 150s — TinyFish's documented client guidance,
  and above the 110s per-URL budget `fetch.perUrlTimeoutMs` can already set.
  Docs note that `tool-web`'s `fetchTimeoutMs` / `searchTimeoutMs` bound a call
  first and must be raised alongside it.
- Docs: rate limits split per API (Search 30 requests/min, Fetch 150 URLs/min);
  academic wire fields corrected to `year` / `cited_by_count`; preflight and
  dependency claims corrected; `CHANGELOG.md` now ships in the package.

## 0.1.2

- Docs: correct the API-key example prefix — keys issued at
  agent.tinyfish.ai/api-keys start with `sk-`, not `tf_` (README, INSTALL,
  USAGE pairs).
- Docs: the tarball install flow now packs into `~/.dsh/tarballs`: the
  `file:` dependency spec pnpm records keeps pointing at the tarball, so an
  OS-reclaimed path such as `/tmp` breaks later `pnpm install` /
  `pnpm update` in the profile. Docs ship inside the tarball, hence the
  version bump.

## 0.1.1

- Fix misleading search/fetch transport errors: undici reports both endpoint
  redirect refusals and network/DNS/TLS failures as `TypeError: fetch failed`.
  `credentialedFetch` now inspects the cause chain, labels only real endpoint
  redirects as redirect refusals, and surfaces network failures as
  `network/transport` with the underlying cause (e.g. `ENOTFOUND`, TLS alert).

## 0.1.0

Initial release.

- `tinyfish` search provider: full Search API filter surface (geo/language,
  domain include/exclude, `recency_minutes` / date bounds, `domain_type`,
  publication-year bounds), URL dedup, honest `truncated` flagging.
- `tinyfish` fetch provider: single-URL POST, `markdown`/`html` extraction,
  cache TTL, per-URL server timeout, CSS include/exclude selectors,
  multibyte-safe local byte cap, per-URL failure mapping with selector retry
  hints.
- Credential chain: literal `apiKey` → harness credentials service → launch
  environment, one reference (`TINYFISH_API_KEY`), no key value in errors.
- Security: credentialed requests refuse redirects (regression-tested);
  fetch targets are preflighted for length, scheme, userinfo, and
  private/loopback/reserved networks. Configured API endpoints are operator
  configuration — loopback/private bases (local mocks, LAN gateways) are
  admitted, matching the first-party providers.
- Works with dsh `>=0.1.5-rc.2 <0.2.0` (peer and engine floor).
- Settings card `web-tinyfish` installed when a settings service is present;
  committed changes apply live without re-registration.
- Bundle patch inserts the plugin and retargets the `web` row's search
  provider; never touches `tool-web`.
- Documentation pairs (English/Chinese: README, CONFIG, USAGE, INSTALL) ship
  with the package and carry language switchers.
