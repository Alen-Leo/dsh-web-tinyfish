# Install

English | [中文](INSTALL.zh.md)

## Requirements

- dsh `>=0.2.0-rc.2 <0.3.0` with a profile you control (`dsh --profile <name>`).
- Node `^22.19 || >=24` (the profile runtime already satisfies this).
- A TinyFish API key — create one at https://agent.tinyfish.ai/api-keys (starts with `sk-`).
- Paths below use the default dsh home `~/.dsh` (Windows: `%USERPROFILE%\.dsh`).

## Option A: let an AI agent install it

Paste this paragraph to an AI agent running on your machine (a dsh session,
Claude Code, Cursor, …) after replacing `<name>` with your profile name:

```text
Install the dsh-web-tinyfish plugin into my dsh profile "<name>" and verify it:

1. Ask me for a TinyFish API key (created at https://agent.tinyfish.ai/api-keys, starts with sk-).
2. Clone https://github.com/Alen-Leo/dsh-web-tinyfish and run `pnpm pack --pack-destination ~/.dsh/tarballs` in the checkout.
3. In ~/.dsh/profiles/<name> run `pnpm add ~/.dsh/tarballs/dsh-web-tinyfish-<version>.tgz`.
   Do not `pnpm add dsh-web-tinyfish` from a registry — that npm name belongs to an unrelated third-party package.
4. Add "dsh-web-tinyfish" to the end of the dsh.profile.bundles list in ~/.dsh/profiles/<name>/package.json.
5. Append to ~/.dsh/profiles/<name>/cordis.patch.yml (if a web-tinyfish row already exists, merge apiKey into its config instead of adding a second row):
   - id: web-tinyfish
     config:
       apiKey: "<my TinyFish key>"
6. Restart the profile, then run a web_search query for the TinyFish docs and confirm results come back.
```

## Option B: manual install

1. Pack the tarball and install it into the profile (the same commands work in
   bash and PowerShell):

   ```sh
   pnpm pack --pack-destination ~/.dsh/tarballs
   cd ~/.dsh/profiles/<name>
   pnpm add ~/.dsh/tarballs/dsh-web-tinyfish-<version>.tgz
   ```

   > **Do not `pnpm add dsh-web-tinyfish` from a registry** — the npm name
   > currently belongs to an unrelated third-party package. Prefer the tarball
   > over `pnpm add <directory>` too: a directory install becomes a `link:`
   > into the checkout, whose dev `node_modules` shadows the peers and breaks
   > the plugin's error classes.

   Pack into a directory that survives reboots: the `file:` dependency spec
   pnpm writes keeps pointing at the tarball, so a path the OS reclaims
   (`/tmp`) breaks later `pnpm install` / `pnpm update` in the profile.

2. Add the bundle to `~/.dsh/profiles/<name>/package.json`, appending
   `dsh-web-tinyfish` to your existing bundle list:

   ```json
   {
     "dsh": {
       "profile": {
         "bundles": ["@deepseek-ai/dsh-base", "dsh-web-tinyfish"]
       }
     }
   }
   ```

   It goes last: bundle patches apply in list order, and this one retargets the
   `web` row that `dsh-base` pins.

3. Write the key into the profile patch
   (`~/.dsh/profiles/<name>/cordis.patch.yml`) — this is the part whose syntax
   differs per platform:

   **macOS / Linux**

   ```sh
   cat >> ~/.dsh/profiles/<name>/cordis.patch.yml <<'EOF'
   - id: web-tinyfish
     config:
       apiKey: "sk-..."
   EOF
   ```

   **Windows (PowerShell)**

   ```powershell
   Add-Content ~\.dsh\profiles\<name>\cordis.patch.yml @'
   - id: web-tinyfish
     config:
       apiKey: "sk-..."
   '@
   ```

   If the file already has a `web-tinyfish` row, add `apiKey` under its
   existing `config:` instead of appending a second row.

4. Restart the profile and verify:

   ```sh
   dsh --profile <name> "use web_search to find the TinyFish docs, then web_fetch https://docs.tinyfish.ai/fetch-api and summarize"
   ```

## Updating / removing

```sh
pnpm pack --pack-destination ~/.dsh/tarballs   # update: re-pack in the checkout first
cd ~/.dsh/profiles/<name>
pnpm add ~/.dsh/tarballs/dsh-web-tinyfish-<version>.tgz   # update
pnpm remove dsh-web-tinyfish     # remove (also drop the bundles entry)
```

## Alternative places for the key

The profile patch above is the deterministic route. Also supported:

- `TINYFISH_API_KEY` in the environment (`.env` included). Terminal-launched dsh
  picks it up; GUI apps do not inherit shell variables — on Windows use
  `setx TINYFISH_API_KEY "sk-..."`, then fully quit and relaunch the app.
- The harness credentials service.
- A different variable name via `apiKeyEnv`.

## Env-only switch (no install-time patching)

The `web` seam reads `DSH_WEB_SEARCH_PROVIDER` / `DSH_WEB_FETCH_PROVIDER` as
equivalents of its config fields. With the plugin installed and registered,
this overrides routing without touching any patch layer:

```sh
DSH_WEB_SEARCH_PROVIDER=tinyfish dsh --profile <name> "task"   # macOS / Linux

# Windows PowerShell
$env:DSH_WEB_SEARCH_PROVIDER = "tinyfish"
dsh --profile <name> "task"
```
