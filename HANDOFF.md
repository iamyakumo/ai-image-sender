# Handoff: push AI Image Sender to GitHub

This document is for **another AI / human** that will create the GitHub repository and push. The open-source package is already prepared in the repo folder.

## Paths

| Where | Path |
|--------|------|
| User PC (load / push from here) | `C:\Users\real_\Downloads\ai-image-sender\ai-image-sender` |
| Agent box (source of truth prepared here) | `/workspace/ai-image-sender` |
| Packed archive on box | `/workspace/ai-image-sender.tar.gz` |

The folder that contains `manifest.json` is the **repository root**. Do **not** push the outer `Downloads\ai-image-sender` parent if it only wraps another `ai-image-sender` — push the inner project root.

## Suggested GitHub metadata

- **Repository name:** `ai-image-sender`
- **Visibility:** public (user preference; confirm before create)
- **Description (EN):** Chrome extension (MV3): right-click any webpage image and send it to Grok, ChatGPT, Gemini, Claude, or a custom AI chat with your prompt.
- **Description (ZH):** Chrome 扩展（MV3）：网页图片右键一键发送到 Grok / ChatGPT / Gemini / Claude 或自定义 AI 对话，并填入可编辑提示词。
- **Topics / tags:** `chrome-extension`, `grok`, `chatgpt`, `gemini`, `claude`, `manifest-v3`, `browser-extension`, `javascript`

## What is already prepared (do NOT redo unless needed)

- Extension source (`manifest.json`, `src/**`)
- `LICENSE` (MIT, Copyright (c) 2026 yakumo y)
- `README.md` (ZH primary + short EN)
- `CONTRIBUTING.md`
- `PRIVACY.md`
- `.gitignore`
- Version `0.1.0` in `manifest.json`
- This handoff + `/workspace/github-release-notes.md` on the box (release notes may also live only on the box unless copied into the repo)

Optional: copy `github-release-notes.md` into the repo as `CHANGELOG.md` or paste into GitHub Release body for `v0.1.0`.

## What YOU (the pushing AI) must do

1. Confirm the user’s GitHub auth (`gh auth status` or git credentials).
2. Create an empty remote repo (or use `gh repo create`).
3. `git init` / commit / set remote / push (commands below).
4. Do **not** commit secrets, `.pem`, packed `.crx`, Chrome profiles, or unrelated downloads.
5. Do **not** change license copyright without user approval.
6. After push: optionally create GitHub Release `v0.1.0` using `github-release-notes.md`.

## Exact git command sequence

Run inside the project root (the folder with `manifest.json`).

### Option A — `gh` CLI (recommended)

```bash
cd "C:/Users/real_/Downloads/ai-image-sender/ai-image-sender"

git init -b main
git add .
git status
git commit -m "Initial release: AI Image Sender Chrome extension v0.1.0"

gh repo create ai-image-sender --public --source=. --remote=origin --description "Chrome MV3: right-click webpage images → Grok / ChatGPT / Gemini / Claude (or custom chat) with your prompt" --push
```

If the repo already exists empty on GitHub under the user’s account:

```bash
cd "C:/Users/real_/Downloads/ai-image-sender/ai-image-sender"

git init -b main
git add .
git commit -m "Initial release: AI Image Sender Chrome extension v0.1.0"
git remote add origin https://github.com/<USERNAME>/ai-image-sender.git
git push -u origin main
```

### Option B — manual remote

1. User creates empty repo `ai-image-sender` on GitHub (no README/license if local already has them — avoid merge conflicts).
2. Then:

```bash
cd "C:/Users/real_/Downloads/ai-image-sender/ai-image-sender"
git init -b main
git add .
git commit -m "Initial release: AI Image Sender Chrome extension v0.1.0"
git remote add origin git@github.com:<USERNAME>/ai-image-sender.git
git push -u origin main
```

### Optional tag + release

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
gh release create v0.1.0 --title "v0.1.0" --notes-file github-release-notes.md
```

(If `github-release-notes.md` is only on the agent box, paste its contents into `--notes` or add the file to the repo first.)

## Suggested commit message

```
Initial release: AI Image Sender Chrome extension v0.1.0

Manifest V3 extension to right-click webpage images and send them to
Grok, ChatGPT, Gemini, Claude, or custom AI chats with an editable prompt.
Includes MIT license, privacy policy, and contributing guide.
```

## Sync note

If the user’s PC folder is stale, refresh it from `/workspace/ai-image-sender.tar.gz` (extract so that `manifest.json` lands at `...\ai-image-sender\ai-image-sender\manifest.json`), then push from that path.

## Checklist before push

- [ ] `manifest.json` present; version `0.1.0`
- [ ] `LICENSE`, `README.md`, `PRIVACY.md`, `CONTRIBUTING.md`, `.gitignore` present
- [ ] `git status` shows no secrets / no `node_modules` / no `*.pem`
- [ ] User approved public repo (or set `--private`)
- [ ] Remote created; `git push` succeeded
