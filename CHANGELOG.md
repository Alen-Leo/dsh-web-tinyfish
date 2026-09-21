# Changelog

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
