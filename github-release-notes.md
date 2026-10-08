# AI Image Sender v0.1.0

First public open-source release.

## Highlights

- Right-click any webpage image → **Send to…** Grok, ChatGPT, Gemini, or Claude
- Editable default “anime/2D → photorealistic” prompt (popup + options)
- Custom AI chat targets (URL + CSS selectors), optional host permissions
- Settings via `chrome.storage.sync` (prompt, autoSubmit, custom sites)
- Fallback: clipboard paste hint when automated upload fails
- Manifest V3, no bundler required for daily use

## Install

Load unpacked from the repository root (`manifest.json`). See README.

## Notes

- Not affiliated with xAI, OpenAI, Google, or Anthropic
- Site DOM changes may break selectors — adapters live in `src/adapters/`
- `autoSubmit` is off by default

## License

MIT © 2026 yakumo y
