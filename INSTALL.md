# Install

English | [中文](INSTALL.zh.md)

## Requirements

- dsh `>=0.1.5-rc.2` with a profile you control (`dsh --profile <name>`).
- Node `^22.19 || >=24` (the profile's runtime already satisfies this).

## Steps

1. Install the package into the profile directory:

   ```sh
   cd "$DSH_HOME/profiles/<name>"
   pnpm add dsh-web-tinyfish
   ```

   Until the package is published, install from a checkout via a packed
   tarball, not the bare directory:

   ```sh
   pnpm pack                                # in the plugin checkout → dsh-web-tinyfish-<version>.tgz
   cd "$DSH_HOME/profiles/<name>"
   pnpm add /path/to/dsh-web-tinyfish/dsh-web-tinyfish-<version>.tgz
   ```

   A direct `pnpm add <directory>` becomes a `link:` install pointing into
   the checkout, and the checkout's dev `node_modules` then shadows the
   installation's peer copies (`@deepseek-ai/dsh-web` and friends) — the
   plugin would throw `WebError`s of the wrong class identity, and the
   harness would lose their error codes. The tarball copy has no
   `node_modules` of its own, so peers resolve through the ordinary
   parent-walk into the dsh installation closure, as designed.

2. Add the bundle to the profile manifest — `$DSH_HOME/profiles/<name>/package.json`:

   ```json
   {
     "dsh": {
       "profile": {
         "bundles": ["@deepseek-ai/dsh-base", "dsh-web-tinyfish"]
       }
     }
   }
   ```

   Keep your existing bundle list and append `dsh-web-tinyfish` last; bundle
   patches apply in list order, and this one retargets the `web` row that
   `dsh-base` pins.

3. Provide the key (choose one):

   ```sh
   export TINYFISH_API_KEY="tf_..."   # shell / .env
   ```

   or store it through the harness credentials service, or reference another
   variable with `apiKeyEnv`.

4. Restart the profile. `web_search` now runs on TinyFish. Optionally retarget
   `web_fetch` too — see the README.

## Updating / removing

```sh
cd "$DSH_HOME/profiles/<name>"
pnpm update dsh-web-tinyfish     # update
pnpm remove dsh-web-tinyfish     # remove (also drop the bundles entry)
```

## Env-only switch (no install-time patching)

The `web` seam reads `DSH_WEB_SEARCH_PROVIDER` / `DSH_WEB_FETCH_PROVIDER` as
equivalents of its config fields. With the plugin installed and registered,
this overrides routing without touching any patch layer:

```sh
DSH_WEB_SEARCH_PROVIDER=tinyfish dsh --profile <name> "task"
```
