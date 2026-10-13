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
| 抓取目标预检 | 目标 URL 必须 ≤2048 字符、`http(s)`、无内嵌凭据、非私网地址。地址字面量在联系 TinyFish 之前离线判定——包括前缀匹配会漏掉的 IPv4-mapped、6to4、NAT64 写法；末尾 DNS 根点（`localhost.`）会先做规范化，无法借它绕过名称检查。TinyFish 服务端还会再次拒绝私网与元数据地址。但*主机名*解析到私网地址无法离线识别。API 端点是运维配置：环回/私网地址（本地 mock、LAN 网关）予以放行，与一方 provider 一致。 |
| 最小凭据面 | 每次请求解析一个引用（默认 `TINYFISH_API_KEY`）：字面量 `apiKey`（不推荐）→ harness credentials 服务 → launch environment。错误消息只提引用名，绝不出现 key 值。 |
| 不扩大权限 | bundle 补丁只挂载插件并改写 `web` 行，**从不**全局启用 `tool-web`——哪些 agent 有 web 工具由你的 composition 决定。 |
| 无安装钩子、两个小运行时依赖 | `prepare` 只跑 `tsc`；运行时依赖是 pin 死的 `@deepseek-ai/schemastery` 与 `ipaddr.js`。 |

## 快速开始

在 https://agent.tinyfish.ai/api-keys 创建一个 key，然后把下面这段话粘贴给
在你机器上运行的 AI（dsh 会话、Claude Code、Cursor……），先把 `<name>`
换成你的 profile 名：

```text
把 dsh-web-tinyfish 插件安装进我的 dsh profile "<name>" 并验证：

1. 向我要一个 TinyFish API key（在 https://agent.tinyfish.ai/api-keys 创建，sk- 开头）。
2. 克隆 https://github.com/Alen-Leo/dsh-web-tinyfish，在检出目录执行 pnpm pack --pack-destination ~/.dsh/tarballs。
3. 进入 ~/.dsh/profiles/<name>，执行 pnpm add ~/.dsh/tarballs/dsh-web-tinyfish-<version>.tgz。
   不要从 registry 安装 dsh-web-tinyfish——npm 上这个名字属于无关的第三方包。
4. 在 ~/.dsh/profiles/<name>/package.json 的 dsh.profile.bundles 列表末尾加上 "dsh-web-tinyfish"。
5. 在 ~/.dsh/profiles/<name>/cordis.patch.yml 末尾追加下面三行（若已有 web-tinyfish 行，把 apiKey 并入该行的 config，不要追加第二个同 id 行）：
   - id: web-tinyfish
     config:
       apiKey: "<我的 TinyFish key>"
6. 重启 profile，跑一条 web_search 查询 TinyFish 文档，确认有结果返回。
```

想自己动手？手动步骤见 [INSTALL.zh.md](INSTALL.zh.md)。无论哪种方式，
装好后都不需要设置任何环境变量：

```sh
dsh --profile <name> "用 web_search 找 TinyFish 文档并总结"
```

插件装好后，补丁层会把 `web_search` 和 `web_fetch` 都切到 TinyFish；可选的
部署级调优写在 profile 补丁里：

```yaml
# ~/.dsh/profiles/<name>/cordis.patch.yml —— 可选的部署级调优
- id: web-tinyfish
  config:
    search:
      location: US
      language: en
    fetch:
      format: markdown
```

想让 `web_fetch` 改回快速的本地 HTTP provider（裸 GET、无渲染、无限流），
改写 `web` 行即可：

```yaml
- id: web
  config:
    searchProvider: tinyfish
    fetchProvider: http
```

临时切换连补丁都不用改：`DSH_WEB_SEARCH_PROVIDER=tinyfish dsh …`
（PowerShell 需先 `$env:DSH_WEB_SEARCH_PROVIDER = 'tinyfish'`；seam 把这两个
环境变量视为 `web` 行字段的等价物）。

所有字段都是可实时生效的配置字段：harness 会把它们投影成 `web-tinyfish`
这一行的设置表单，两个 provider 每次请求都读取当前值，因此提交的修改无需
重启即可生效。

完整配置参考：[CONFIG.zh.md](CONFIG.zh.md)。行为与错误映射：[USAGE.zh.md](USAGE.zh.md)。

## 已知限制

- **抓取结果恒为 `statusCode: 200`。** TinyFish 不透传目标页自身的 HTTP
  状态；每 URL 失败（`bot_blocked`、`timeout`、`selector_not_matched`……）
  以工具错误的形式呈现。
- **Search 中 seam 无法承载的字段会被丢弃**：`position`、`site_name`、
  `publisher`，以及学术结果的 `authors` / `venue` / `year` /
  `cited_by_count` / `pdf_url`。Search 没有服务端条数参数，`maxResults`
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
