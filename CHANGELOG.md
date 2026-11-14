# Changelog

## 0.4.0

- Adapted to dsh `0.2.2-rc.3` (the Desktop runtime): development and test
  dependencies now pin `@deepseek-ai/dsh-web`, `@deepseek-ai/dsh-credentials`,
  and `@deepseek-ai/dsh-launch-environment` at `0.2.2-rc.3` with
  `@deepseek-ai/cordis` at `4.1.0` and `@deepseek-ai/dsh-package-manifest` at
  `0.2.2-rc.3` (type-only), matching what the runtime ships. The provider-facing
  seam changes in 0.2.2 are additive, so no existing behavior changed.
- `@deepseek-ai/schemastery` moves `3.18.5` → `3.19.0` in `dependencies`,
  matching the runtime and `dsh-web@0.2.2-rc.3`'s own `~3.19.0` constraint.
- Both providers now populate the picker surface 0.2.2 added to the seam:
  `title` ("TinyFish") and a localized `description` (en/zh/ja/es/fr/de/ru/pt)
  that `ctx.web.listProviders()` returns to the Web provider pickers, and the
  optional `ready(llmProvider)` gate — an async, network-free answer to
  "would this provider's next call carry a credential?" that resolves the full
  key chain (literal key → credentials service → launch environment). A broken
  section answers ready so the request path keeps reporting the structured
  `WebError`; a missing key answers not-ready so hosts can withhold their web
  tools with a credential hint instead of failing the first call.
- Engine and peer ranges stay `>=0.2.0-rc.2 <0.3.0` (cordis `>=4.0.4`): they
  already admit `0.2.2-rc.3` and cordis `4.1.0`. `minimumReleaseAgeExclude`
  entries move to `0.2.2-rc.3` (plus `dsh-package-manifest`).
- Review hardening applied with the adaptation:
  - `search.domainType: "research_paper"` now rejects the date and freshness
    filters (`recencyMinutes`/`afterDate`/`beforeDate`) the Search API does not
    support on the academic corpus, pointing at `pubYearMin`/`pubYearMax`
    instead of failing silently server-side.
  - A malformed `search.baseURL`/`fetch.baseURL` (or a malformed
    `TINYFISH_*_BASE_URL` override) now fails loud at plugin load with the
    field-naming `parseEndpoint` diagnosis, instead of degrading into a silent
    "registered but unavailable".
  - `fetch.perUrlTimeoutMs >= requestTimeoutMs` — a per-URL budget the
    whole-request timeout expires first — is rejected at load and per request.
  - Per-URL fetch failures now carry the origin HTTP status (`HTTP 404`) next
    to TinyFish's error code.
  - A failing credentials-service read is mapped onto `WEB_PROVIDER_ERROR`
    naming the reference, instead of escaping the seam's error taxonomy.
  - Tests cover the two previously untested documented paths: endpoint bases
    taken from the `TINYFISH_SEARCH_BASE_URL` launch-environment override, and
    key resolution through the harness credentials service.

## 0.3.1

- Adapted to dsh `0.2.1-rc.3` (the Desktop runtime): development and test
  dependencies now pin `@deepseek-ai/dsh-web`, `@deepseek-ai/dsh-credentials`,
  and `@deepseek-ai/dsh-launch-environment` at `0.2.1-rc.3` with
  `@deepseek-ai/cordis` at `4.0.5`, so typecheck and tests run against the
  exact package versions the runtime ships. The provider-facing API surface
  (`WebError`, `WebSearchProvider`, `WebFetchProvider`, `credentialRef`,
  `launchEnvironmentOf`) is unchanged between `0.2.0-rc.2` and `0.2.1-rc.3`;
  no plugin code change was needed.
- `@deepseek-ai/schemastery` moves `3.18.4` → `3.18.5`, matching the runtime
  and `dsh-web@0.2.1-rc.3`'s own `~3.18.5` constraint, so the Config schema is
  built with the same Schemastery the host validates it against.
- Engine and peer ranges stay `>=0.2.0-rc.2 <0.3.0` (cordis `>=4.0.4`): they
  already admit `0.2.1-rc.3`, and dsh's compatibility check evaluates them
  with prereleases participating. `minimumReleaseAgeExclude` entries move to
  `0.2.1-rc.3`.

## 0.3.0

- The bundle patch now routes `web_fetch` through TinyFish as well
  (`fetchProvider: tinyfish`), so both web tools run on the plugin out of the
  box — its rendered-and-extracted markdown serves agents far better than the
  raw HTML the local provider returns, at a typical 1–2s per fetch. Keep
  `web_fetch` on the plain local HTTP provider by overriding the `web` row
  with `fetchProvider: http`; README documents the override.
- Docs: reworked to the standard shape. README quick start and INSTALL open
  with a paste-to-an-AI-agent install paragraph; INSTALL splits into that
  automated route and a manual route whose steps each use one cross-platform
  command block (bash and PowerShell share it), with platform-specific
  snippets only for writing `config.apiKey` into the profile patch. Key
  alternatives (env var incl. `.env` with the GUI/`setx` caveat, credentials
  service, `apiKeyEnv`) collapsed into one short section, and paths use the
  concrete default `~/.dsh` throughout.
- Releases ship as GitHub Releases with the packed tarball attached — this
  project does not publish to npm (the name belongs to an unrelated
  third-party package). The tag-triggered `npm publish` workflow, which
  failed on the 0.3.0 tag, is replaced by one that typechecks, tests,
  builds, packs, and attaches the tarball to a GitHub Release; INSTALL
  points at the Releases page as the no-clone way to get the tarball.

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
- `apiKeyEnv` carries `credentialRef`'s name grammar
  (`/^[A-Za-z_][A-Za-z0-9_]*$/`) as a schema pattern, so an empty or malformed
  reference fails at write time (load, or a settings-form commit) instead of
  disabling the provider with an invisible cause.
- Install docs route through the packed tarball: the npm name
  `dsh-web-tinyfish` currently belongs to an unrelated third-party package,
  so a registry `pnpm add` installs the wrong code and publishing under the
  name would be refused.
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
