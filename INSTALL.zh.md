# 安装

[English](INSTALL.md) | 中文

## 前提

- dsh `>=0.2.0-rc.2 <0.3.0`，且有一个你自己控制的 profile（`dsh --profile <name>`）。
- Node `^22.19 || >=24`（profile 运行时本身已满足）。
- 一个 TinyFish API key——在 https://agent.tinyfish.ai/api-keys 创建（`sk-` 开头）。
- 下文路径按默认 dsh 主目录 `~/.dsh` 书写（Windows：`%USERPROFILE%\.dsh`）。

## 方式 A：交给 AI 安装

把下面这段话粘贴给在你机器上运行的 AI（dsh 会话、Claude Code、Cursor……），
先把 `<name>` 换成你的 profile 名：

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

## 方式 B：手动安装

1. 打 tarball 并装进 profile（以下命令在 bash 和 PowerShell 中通用）：

   ```sh
   pnpm pack --pack-destination ~/.dsh/tarballs
   cd ~/.dsh/profiles/<name>
   pnpm add ~/.dsh/tarballs/dsh-web-tinyfish-<version>.tgz
   ```

   > **不要从 registry 执行 `pnpm add dsh-web-tinyfish`**——npm 上该名称目前
   > 属于一个无关的第三方包。也建议别用 `pnpm add <目录>`：目录安装会变成
   > 指回检出的 `link:` 安装，检出的 dev `node_modules` 会遮蔽 peer 副本，
   > 破坏插件的错误类身份。请用 tarball。

   务必 pack 进重启后仍然存在的目录：pnpm 写下的 `file:` 依赖规格会一直
   指向该 tarball，路径被系统回收（如 `/tmp`）后 profile 里的
   `pnpm install` / `pnpm update` 就会失败。

2. 在 `~/.dsh/profiles/<name>/package.json` 里把 `dsh-web-tinyfish` 追加到
   你现有的 bundle 列表末尾：

   ```json
   {
     "dsh": {
       "profile": {
         "bundles": ["@deepseek-ai/dsh-base", "dsh-web-tinyfish"]
       }
     }
   }
   ```

   放最后：bundle 补丁按列表顺序应用，本补丁要改写 `dsh-base` 钉住的
   `web` 行。

3. 把 key 写进 profile 补丁（`~/.dsh/profiles/<name>/cordis.patch.yml`）——
   只有这一步的命令按平台区分：

   **macOS / Linux**

   ```sh
   cat >> ~/.dsh/profiles/<name>/cordis.patch.yml <<'EOF'
   - id: web-tinyfish
     config:
       apiKey: "sk-..."
   EOF
   ```

   **Windows（PowerShell）**

   ```powershell
   Add-Content ~\.dsh\profiles\<name>\cordis.patch.yml @'
   - id: web-tinyfish
     config:
       apiKey: "sk-..."
   '@
   ```

   补丁里若已有 `web-tinyfish` 行，把 `apiKey` 加进它现有的 `config:` 即可，
   不要追加第二个同 id 行。

4. 重启 profile 并验证：

   ```sh
   dsh --profile <name> "use web_search to find the TinyFish docs, then web_fetch https://docs.tinyfish.ai/fetch-api and summarize"
   ```

## 更新 / 移除

```sh
pnpm pack --pack-destination ~/.dsh/tarballs   # 更新前先在插件检出里重新打包
cd ~/.dsh/profiles/<name>
pnpm add ~/.dsh/tarballs/dsh-web-tinyfish-<version>.tgz   # 更新
pnpm remove dsh-web-tinyfish     # 移除（同时删掉 bundles 条目）
```

## key 的其他存放位置

上面写进 profile 补丁是确定可用的途径。也支持：

- 环境变量 `TINYFISH_API_KEY`（含 `.env`）。终端启动的 dsh 能读到；GUI 应用
  不继承终端变量——Windows 上用 `setx TINYFISH_API_KEY "sk-..."`，然后完全
  退出应用再启动。
- harness credentials 服务。
- 用 `apiKeyEnv` 换一个变量名。

## 仅用环境变量切换（不动任何补丁）

`web` seam 会把 `DSH_WEB_SEARCH_PROVIDER` / `DSH_WEB_FETCH_PROVIDER` 当作其
配置字段的等价物。插件装好并注册后，不改任何补丁层即可改路由：

```sh
DSH_WEB_SEARCH_PROVIDER=tinyfish dsh --profile <name> "task"   # macOS / Linux

# Windows PowerShell
$env:DSH_WEB_SEARCH_PROVIDER = "tinyfish"
dsh --profile <name> "task"
```
