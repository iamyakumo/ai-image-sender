# Privacy Policy / 隐私政策

**AI Image Sender** (“the Extension”)

Last updated: 2026-10-08

## Summary / 摘要

This extension processes images **locally in your browser**. It does **not** operate a backend server that receives your images or prompts. Settings may sync via **Chrome Sync** if you are signed into Chrome.

本扩展在你的**浏览器本地**处理图片，**没有**自建服务器接收图片或提示词。若你登录了 Chrome 并开启同步，部分设置可能通过 **Chrome Sync** 同步。

## Data we handle / 处理的数据

| Data | Where | Purpose |
|------|--------|---------|
| Selected image (temporary) | Browser memory / `chrome.storage.session` (or short-lived local fallback) | Attach to the AI chat page you chose |
| Default prompt, autoSubmit, last target, custom site configs | `chrome.storage.sync` (and optionally `chrome.storage.local` for prompt fallback) | Remember your preferences |
| Clipboard (optional) | System clipboard | Fallback if automatic upload fails |

We do **not** collect analytics accounts, sell data, or upload images to developer-controlled servers.

## Third parties / 第三方

When you send an image to Grok, ChatGPT, Gemini, Claude, or a custom URL, that **destination site** receives the image and prompt under **their** terms and privacy policies. This project is **not affiliated with** xAI, OpenAI, Google, or Anthropic.

你把图片发到目标网站后，由该网站按其自身政策处理。本项目与 xAI / OpenAI / Google / Anthropic **无隶属关系**。

## Permissions / 权限

- `contextMenus`, `storage`, `scripting`, `activeTab`, `tabs`, `clipboardWrite`
- Host access for built-in AI sites and `<all_urls>` to fetch webpage images
- Optional hosts for user-defined custom sites (requested at runtime)

## Contact / 联系

Open an issue on the GitHub repository for privacy questions.

For Chrome Web Store listings, this document may be linked as the extension privacy policy.
