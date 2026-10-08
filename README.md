# AI Image Sender

在任意网页图片上右键，一键发送到 **Grok / ChatGPT / Gemini / Claude**（或自定义 AI 对话页），并自动填入可编辑的转换提示词。

**Right-click any webpage image → send it to Grok / ChatGPT / Gemini / Claude (or a custom AI chat) with your prompt.** Chrome Extension · Manifest V3 · MIT.

> Screenshots: add images under `docs/` later (e.g. `docs/screenshot-menu.png`) and link them here. Optional for the first release.

---

## 功能 Features

- **内置适配器**：Grok (`grok.com`)、ChatGPT (`chatgpt.com` / `chat.openai.com`)、Gemini (`gemini.google.com`)、Claude (`claude.ai`)
- **自定义站点**：对话 URL + CSS 选择器（文件上传、拖放区、输入框、可选发送按钮）
- **右键菜单**：`Send to…` → 选择目标
- **工具栏弹窗**：默认目标、编辑提示词、开关自动发送
- **选项页**：自定义站点 CRUD、JSON 导入/导出、运行时申请 host 权限
- **设置同步**：偏好存 `chrome.storage.sync`（随 Chrome 账号同步；扩展本体需商店安装或手动加载才会跟设备走）

## 安装 Install（加载已解压）

1. 下载或克隆本仓库  
2. Chrome 打开 `chrome://extensions`  
3. 打开右上角 **开发者模式 / Developer mode**  
4. 点击 **加载已解压的扩展程序 / Load unpacked**  
5. 选择本仓库根目录（含 `manifest.json` 的文件夹）

**English:** Load the unpacked folder that contains `manifest.json` (the repository root).

## 使用 Usage

1. 先在目标 AI 网站**登录**（Grok / ChatGPT / Gemini / Claude）  
2. 打开任意网页，在图片上 **右键 → Send to… →** 选目标  
3. 扩展会抓取图片、打开对话页、尝试挂载文件并填入提示词  
4. 默认**不会**自动点击发送；可在弹窗中开启 `autoSubmit`（请谨慎）

若自动上传失败：会尝试写入剪贴板，并在页面上提示你手动粘贴。

## 默认提示词 Default prompt

可在扩展弹窗或选项页修改。默认内容：

```
Convert this anime/2D illustration into a photorealistic photograph of a real person.
Keep the exact same pose, framing, clothing, hairstyle, facial expression, accessories, and overall composition.
Realistic human anatomy, natural skin texture with pores and subtle imperfections, realistic hair strands, natural lighting, photographic depth of field, high detail, shot as a real camera photo.
No anime style, no illustration look, no cartoon features, no overly smooth plastic skin.
```

## 自定义站点 Custom sites

1. 扩展详情 → **扩展选项**，或弹窗里的 Options  
2. 填写名称、对话页 URL、文件选择器、提示词框选择器等  
3. 请求该 URL 的 host 权限并保存  
4. 右键菜单会出现新目标  

选择器会随网站改版失效，请用 DevTools 自行更新（或提 PR）。

## 限制与免责声明 Limitations / Disclaimer

- **必须已登录**目标站点；未登录时通常只能打开页面  
- **选择器会失效**：各站 SPA / DOM 改版后，上传与填词可能失败，需更新 `src/adapters/` 与 `target-injector.js`  
- **自动上传非 100%**：部分站点限制程序化选文件；失败时走剪贴板兜底  
- **跨域 / 防盗链**图片可能拉不到  
- **大图**经消息通道传递可能失败（约数 MB 级）  
- 本项目与 **xAI / OpenAI / Google / Anthropic** **无任何隶属或官方关系**  
- 软件按「原样」提供，**不提供任何担保**（详见 `LICENSE`）  
- 请遵守目标网站服务条款与当地法律；勿用于违法或侵权用途  

## 隐私 Privacy

图片与提示词在**本地浏览器**处理，无自建后端。详见 [PRIVACY.md](./PRIVACY.md)。

Settings use `chrome.storage.sync` when available.

## 目录结构 Development structure

```
ai-image-sender/
├── manifest.json
├── LICENSE
├── README.md
├── CONTRIBUTING.md
├── PRIVACY.md
└── src/
    ├── background/service-worker.js
    ├── content/
    │   ├── source-page.js      # grab image on source pages
    │   └── target-injector.js  # inject into AI chat (classic script)
    ├── adapters/               # grok, chatgpt, gemini, claude, custom
    ├── popup/
    ├── options/
    ├── lib/                    # storage, image, clipboard
    └── icons/
```

无需打包器：扩展页与 service worker 使用原生 ES modules（`"type": "module"`）。`target-injector.js` 为自包含经典脚本（`chrome.scripting.executeScript({ files })` 不支持 ES import）。

改完代码后在 `chrome://extensions` **重新加载**，并刷新已打开的 AI 标签页。

## 贡献 Contributing

欢迎修适配器、文档与小功能。请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## License

[MIT](./LICENSE) © 2026 yakumo y

---

### English (short)

**AI Image Sender** is a Manifest V3 Chrome extension: right-click a webpage image, send it to Grok / ChatGPT / Gemini / Claude or a custom chat URL, and fill an editable conversion prompt. Settings sync via `chrome.storage.sync`. Not affiliated with xAI, OpenAI, Google, or Anthropic. Site DOM changes may break selectors. See PRIVACY.md and LICENSE (MIT).
