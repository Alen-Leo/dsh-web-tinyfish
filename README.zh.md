# dsh-web-tinyfish

[English](README.md) | 中文

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）的
web 能力 seam（`ctx.web`）提供基于 TinyFish 的 `web_search` 与 `web_fetch`
provider。独立第三方插件——与 DeepSeek、TinyFish 均无隶属关系，依据公开的
[provider seam](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/web/web)
与 [TinyFish API 文档](https://docs.tinyfish.ai) 从零实现。

- 一个包同时在 `tinyfish` 这个 id 下注册**两个** provider：
  - **Search**（`GET api.search.tinyfish.ai`）承载 `web_search`——地理/语言定向、域名包含/排除、时间窗与日期边界、`news` / `research_paper` 语料。
  - **Fetch**（`POST api.fetch.tinyfish.ai`）承载 `web_fetch`——真浏览器渲染、干净的 `markdown`/`html` 提取、CSS 选择器圈定、缓存 TTL 控制。
- TinyFish 的 Search 与 Fetch 在任何钱包余额下都免费。

## 安全特性

| 特性 | 行为 |
| --- | --- |
| 带凭据的请求**拒绝重定向** | 两个 API 调用都以 `redirect: 'error'` 发出；端点返回 30x 时直接失败，绝不把 `X-API-Key` 转发给其他 origin。用真实重定向服务器做了回归测试。 |
| 抓取目标预检 | 目标 URL 必须 ≤2048 字符、`http(s)`、无内嵌凭据、非私网地址——在联系 TinyFish 之前本地完成检查。API 端点是运维配置：环回/私网地址（本地 mock、LAN 网关）予以放行，与一方 provider 一致。 |
| 最小凭据面 | 每次请求解析一个引用（默认 `TINYFISH_API_KEY`）：字面量 `apiKey`（不推荐）→ harness credentials 服务 → launch environment。错误消息只提引用名，绝不出现 key 值。 |
| 不扩大权限 | bundle 补丁只挂载插件并改写 `web` 行，**从不**全局启用 `tool-web`——哪些 agent 有 web 工具由你的 composition 决定。 |
| 无安装钩子、单一运行时依赖 | `prepare` 只跑 `tsc`；唯一运行时依赖是 pin 死的 `@deepseek-ai/schemastery`。 |

## 快速开始

```sh
export TINYFISH_API_KEY="tf_..."   # 从 https://agent.tinyfish.ai/api-keys 获取
```

安装到你的 dsh profile（见 [INSTALL.zh.md](INSTALL.zh.md)），补丁层会把
`web_search` 切到 TinyFish：

```yaml
# $DSH_HOME/profiles/<name>/cordis.patch.yml —— 可选的部署级调优
- id: web-tinyfish
  config:
    search:
      location: US
      language: en
    fetch:
      format: markdown
```

想让 `web_fetch` 也走 TinyFish，改写 `web` 行即可：

```yaml
- id: web
  config:
    searchProvider: tinyfish
    fetchProvider: tinyfish
```

临时切换连补丁都不用改：`DSH_WEB_SEARCH_PROVIDER=tinyfish dsh …`
（seam 把这两个环境变量视为 `web` 行字段的等价物）。

完整配置参考：[CONFIG.zh.md](CONFIG.zh.md)。行为与错误映射：[USAGE.zh.md](USAGE.zh.md)。

## 已知限制

- **抓取结果恒为 `statusCode: 200`。** TinyFish 不透传目标页自身的 HTTP
  状态；每 URL 失败（`bot_blocked`、`timeout`、`selector_not_matched`……）
  以工具错误的形式呈现。
- **Search 中 seam 无法承载的字段会被丢弃**：`position`、`site_name`、
  `publisher`，以及学术结果的 `authors` / `venue` / `pub_year` /
  `citation_count` / `pdf_url`。Search 没有服务端条数参数，`maxResults`
  只能本地截断。
- **未暴露**（seam 没有对应语义）：搜索分页与 `purpose`、fetch 批量
  （`urls[1..10]`）、`format: json`、`links` / `image_links`、highlights、
  条件请求（ETag）。Fetch 到*目标页*的浏览器侧跳转不受影响——被拒绝的只是
  *API 端点自身*的重定向。

## web 工具的接线

`dsh-base` 系 profile 本来就启用 `tool-web`；Web 应用按 agent preset 组合
工具。本补丁刻意不碰那一行。只想给某个 preset 加工具，就在该 preset 的
agent composition 里加 `tool-web`；想给所有 preset 加，就在你自己的
profile 补丁里启用 `tool-web` 行——决定及其影响范围始终留在你的层里。

## 开发

```sh
pnpm install
pnpm run typecheck && pnpm test && pnpm run build
```

`node --test` 加类型剥离运行，不依赖任何测试框架。MIT © 2026
Alen <Alen299@163.com>——见 [LICENSE](LICENSE)。变更记录：[CHANGELOG.md](CHANGELOG.md)。
