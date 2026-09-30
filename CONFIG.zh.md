# 配置参考

[English](CONFIG.md) | 中文

所有字段均可省略，且都是可实时生效的配置字段：harness 会把它们投影成
`web-tinyfish` 这一行的设置表单，两个 provider 每次请求都读取当前值。跨字段
规则在插件加载时响亮报错；若表单存入了单个字段无法拒绝的组合，则在其第一次
被使用时报错。

## 顶层

| 字段 | 类型 | 默认 | 含义 |
| --- | --- | --- | --- |
| `apiKey` | string（secret） | — | 字面量 API key。避免提交到版本库；优先 `apiKeyEnv`。 |
| `apiKeyEnv` | string（credential-ref） | `TINYFISH_API_KEY` | 每次请求依次经 credentials 服务、launch environment 解析。 |
| `requestTimeoutMs` | 整数 ≥100 | `150000` | 两个 API 的整体请求超时。 |
| `search` | object | — | Search provider 调优（下表）。 |
| `fetch` | object | — | Fetch provider 调优（下表）。 |

端点覆盖：未设置对应 `baseURL` 时，launch environment 的
`TINYFISH_SEARCH_BASE_URL` / `TINYFISH_FETCH_BASE_URL` 生效。

`requestTimeoutMs` 默认 150s：TinyFish 的单 URL 预算为 110s、整个 fetch 请求有
120s 上限，且官方要求客户端至少等待 150s，才能拿到结构化的 `timeout` 条目而不是
本地中断；它还必须大于 `fetch.perUrlTimeoutMs`，否则该预算永远不会生效。
`tool-web` 会先于本 provider 设限（`fetchTimeoutMs` / `searchTimeoutMs` 默认
30s，`dsh-base` 把 search 提到 60s），因此调大本项时也要一并调大它们。

## `search`

| 字段 | 类型 | 默认 | 映射到 |
| --- | --- | --- | --- |
| `baseURL` | string | `https://api.search.tinyfish.ai` | — |
| `location` | string | 自动（API 侧） | `location`——国家码，如 `US`、`GB` |
| `language` | string | 自动（API 侧） | `language`——语言码，如 `en`、`zh` |
| `includeDomains` | string[] | — | `include_domains`——裸域名，逗号拼接 |
| `excludeDomains` | string[] | — | `exclude_domains` |
| `recencyMinutes` | 1–5256000 | — | `recency_minutes`——**不能与日期边界同用** |
| `afterDate` | `YYYY-MM-DD` | — | `after_date`——≤ `beforeDate` |
| `beforeDate` | `YYYY-MM-DD` | — | `before_date` |
| `domainType` | `web` \| `news` \| `research_paper` | — | `domain_type` |
| `pubYearMin` | 0–9999 | — | `pub_year_min`——仅限 `research_paper` |
| `pubYearMax` | 0–9999 | — | `pub_year_max`——≥ `pubYearMin` |

## `fetch`

| 字段 | 类型 | 默认 | 映射到 |
| --- | --- | --- | --- |
| `baseURL` | string | `https://api.fetch.tinyfish.ai` | — |
| `format` | `markdown` \| `html` | `markdown` | `format`——markdown → text body，html → html body |
| `ttlSeconds` | 整数 ≥0 | — | `ttl`——缺省任意缓存，`0` 强制 live |
| `perUrlTimeoutMs` | 1–110000 | — | `per_url_timeout_ms`——TinyFish 侧每 URL 预算，需小于 `requestTimeoutMs` |
| `maxTextBytes` | 整数 ≥1024 | `524288` | 本地字节上限；截断时结果标记 `truncated` |
| `includeSelectors` | string[1..20] | — | `include_selectors`——CSS 选择器，每条 1–1000 字符 |
| `excludeSelectors` | string[1..20] | — | `exclude_selectors` |
