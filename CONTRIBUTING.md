# Contributing / 贡献指南

Thanks for helping improve **AI Image Sender**.

## Load unpacked (dev)

1. Clone this repo.
2. Chrome → `chrome://extensions` → enable **Developer mode**.
3. **Load unpacked** → select the repo root (folder with `manifest.json`).
4. After code changes, click **Reload** on the extension card, then refresh any open AI chat tabs (content scripts / injectors cache old code).

Inspect the service worker: extension card → **Service worker** / **Inspect views**.

## How adapters work

Built-in targets live under `src/adapters/`:

- `grok.js`, `chatgpt.js`, `gemini.js`, `claude.js` — each exports `{ id, name, chatUrl, selectors, ... }`
- `index.js` — registry + custom targets from storage
- `custom.js` — builds an adapter from user options (URL + CSS selectors)

Injection into the AI page is done by `src/content/target-injector.js` (classic script, **no ES imports** — keep it self-contained). The background service worker (`src/background/service-worker.js`) fetches the image, opens the tab, and schedules inject.

When a site UI breaks:

1. Open DevTools on the AI chat page.
2. Update selectors in the matching adapter and/or `target-injector.js`.
3. Prefer resilient queries (role/placeholder) over brittle class hashes when possible.

## PR tips

- Keep PRs focused (one site fix or one feature).
- Do not commit secrets, `.pem`, packed `.crx`, or personal Chrome profiles.
- Test at least: right-click image → target opens → prompt fills (and upload if the site allows automation).
- Update README / adapter comments if selectors or behavior change.
- Match existing code style (ES modules in extension pages / SW; classic script for injector).

## License

By contributing, you agree your contributions are licensed under the MIT License (see `LICENSE`).
