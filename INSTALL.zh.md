# 安装

[English](INSTALL.md) | 中文

## 前提

- dsh `>=0.1.5-rc.2`，且有一个你自己控制的 profile（`dsh --profile <name>`）。
- Node `^22.19 || >=24`（profile 运行时本身已满足）。

## 步骤

1. 把包装进 profile 目录：

   ```sh
   cd "$DSH_HOME/profiles/<name>"
   pnpm add dsh-web-tinyfish
   ```

   包尚未发布到 npm 之前，从本地检出经 tarball 安装（不要直接指目录）：

   ```sh
   pnpm pack                                # 在插件检出里执行 → dsh-web-tinyfish-<version>.tgz
   cd "$DSH_HOME/profiles/<name>"
   pnpm add /path/to/dsh-web-tinyfish/dsh-web-tinyfish-<version>.tgz
   ```

   直接 `pnpm add <目录>` 会成为 `link:` 安装并指回检出，检出的 dev
   `node_modules` 会遮蔽安装闭包里的 peer 副本（`@deepseek-ai/dsh-web`
   等）——插件抛出的 `WebError` 类身份会错位，harness 丢失其错误码。
   tarball 拷贝没有自己的 `node_modules`，peer 沿普通父目录向上解析到
   dsh 安装闭包，符合设计。

2. 在 profile 清单（`$DSH_HOME/profiles/<name>/package.json`）里追加 bundle：

   ```json
   {
     "dsh": {
       "profile": {
         "bundles": ["@deepseek-ai/dsh-base", "dsh-web-tinyfish"]
       }
     }
   }
   ```

   保留原有 bundle 列表、把 `dsh-web-tinyfish` 放最后；bundle 补丁按列表顺序
   应用，本补丁要改写 `dsh-base` 钉住的 `web` 行。

3. 提供 key（任选其一）：

   ```sh
   export TINYFISH_API_KEY="tf_..."   # shell / .env
   ```

   或通过 harness credentials 服务存储，或用 `apiKeyEnv` 引用别的变量。

4. 重启 profile。`web_search` 即走 TinyFish。可选把 `web_fetch` 也切过去——
   见 README。

## 更新 / 移除

```sh
cd "$DSH_HOME/profiles/<name>"
pnpm update dsh-web-tinyfish     # 更新
pnpm remove dsh-web-tinyfish     # 移除（同时删掉 bundles 条目）
```

## 仅用环境变量切换（不动任何补丁）

`web` seam 会把 `DSH_WEB_SEARCH_PROVIDER` / `DSH_WEB_FETCH_PROVIDER` 当作其
配置字段的等价物。插件装好并注册后，不改任何补丁层即可改路由：

```sh
DSH_WEB_SEARCH_PROVIDER=tinyfish dsh --profile <name> "task"
```
