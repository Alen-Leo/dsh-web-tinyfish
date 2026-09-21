# 使用

[English](USAGE.md) | 中文

两个 provider 直接服务模型可见的 `web_search` / `web_fetch` 工具，没有额外的
工具面。

## 模型看到什么

- **`web_search`** 结果引用 `url`、`title`（存在时）、`snippet`（存在时）、
  `publishedAt`（TinyFish 报告日期时）。结果按 URL 去重并按工具的条数上限截断。
- **`web_fetch`** 返回提取后的页面——markdown（`text` body）或语义化 HTML
  （`html` body）——URL 用页面最终落点（`final_url`），正文按
  `fetch.maxTextBytes` 截断且不会切断多字节字符。

## 错误映射

| TinyFish 侧 | 工具侧错误 |
| --- | --- |
| `401` `MISSING_API_KEY` / `INVALID_API_KEY` / `UNAUTHORIZED` | 凭据缺失错误，指名引用（`WEB_PROVIDER_CREDENTIAL_MISSING`） |
| `429` 限流（每 key 150 URL/分钟） | provider 错误，携带 TinyFish 错误码 |
| `400` `INVALID_INPUT` 及其他非 2xx | provider 错误，携带错误码与消息 |
| fetch 每 URL 失败（`bot_blocked`、`timeout`、`selector_not_matched`、`selector_unsupported`、`content_too_large`、`empty_content`……） | provider 错误，指名 URL 与错误码；选择器类失败附未命中与候选选择器 |
| 调用方取消 | `WEB_ABORTED` |
| 端点重定向 | 跟随前即拒绝；provider 错误，文案标明 endpoint redirect |
| 网络/DNS/TLS 失败（`TypeError: fetch failed`） | provider 错误，文案标明 `network/transport`，并带上 undici cause 链 |
| 抓取目标为私网/环回地址 | 本地拒绝；不会有任何请求出机 |

## 成本说明

- Search 与 Fetch 在任何 TinyFish 钱包余额下免费；本插件不使用 Agent 与
  Browser API。
- Fetch 每请求只发一个 URL（seam 的 fetch 本就按 URL 逐个），不会用到
  TinyFish 的 10-URL 批量。
- 请求通过 `User-Agent: dsh-web-tinyfish/<version>` 标识来源。

## 验证安装

```sh
export TINYFISH_API_KEY="tf_..."
dsh --profile <name> "用 web_search 找 TinyFish 文档，再 web_fetch https://docs.tinyfish.ai/fetch-api 并总结"
```
