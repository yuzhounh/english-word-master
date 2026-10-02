<p align="center">
  <img src="public/logo.svg" width="112" alt="English Word Master logo">
</p>

<h1 align="center">English Word Master</h1>

<p align="center"><strong>从阅读中积累词汇，用互动测验与错题复习巩固记忆。</strong></p>

<p align="center">
  <a href="https://english-word-master.pages.dev/"><img src="https://img.shields.io/badge/Website-Cloudflare%20Pages-f38020?style=flat&amp;logo=cloudflare&amp;logoColor=white" alt="Website: Cloudflare Pages"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-f59e0b?style=flat" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat&amp;logo=react&amp;logoColor=white" alt="React: 19">
</p>

<p align="center">
  <a href="https://english-word-master.pages.dev/">在线体验</a> · <a href="https://github.com/yuzhounh/english-word-master/releases/latest">发布版本</a> · <a href="#快速开始">快速开始</a> · <a href="LICENSE">开源协议</a>
</p>

**English Word Master** 是一款基于 AI 驱动的高效英文单词学习与综合词库管理平台。集成了文本智能分析、词干还原（Lemmatization）、四选一互动测验、错题本复习系统以及 Firebase 云端同步功能，帮助用户从阅读中积累词汇，高效巩固与高效复习。

🌐 **在线体验：[https://english-word-master.pages.dev/](https://english-word-master.pages.dev/)**

---

## 功能特点

- 🤖 **AI 文本分析与原型提取 (Text Analysis & Lemmatization)**
  - 自由粘贴英文文章、新闻或段落，AI 自动提取生词并还原至词干原型（Lemmatization）。
  - 自动生成准确音标、双语释义、权威例句与上下文用法。
- 📚 **智能词库与多格式导入导出 (Vocabulary Management)**
  - 内置丰富的分类词库（如 CET-4/6、IELTS、TOEFL、GRE、商务英语等）。
  - 支持导入/导出自定义词库（Excel `.xlsx` / `.csv` / `.json`）。
- 🎯 **四选一互动测验 (Interactive 4-Choice Quizzes)**
  - 提供听音辨义、看英选中、看中选英等多种测验模式。
  - 结合流畅的动画交互与即时反馈，大幅提升记词趣味性与效率。
- 📖 **错题本与针对性复习 (Wrong Words Notebook)**
  - 自动归集测验与练习中的错题，支持按错误次数过滤与二次巩固。
  - 掌握词汇可一键标记熟知，针对薄弱词汇反复锤炼。
- ☁️ **云端同步与 Google 登录 (Firebase Auth & Cloud Sync)**
  - 基于 Firebase Authentication 实现一键 Google 账号安全登录。
  - 使用 Cloud Firestore 实时同步多端词库、背词进度与错题记录。
- 🎨 **现代极简与极致 UI 设计 (Modern Responsive Design)**
  - 采用优雅的 iOS/Apple 风格设计语言，辅以细腻的动画渐变与自适应响应式布局。

---

## 🛠️ 技术栈 (Tech Stack)

### 前端 (Frontend)
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS v4 + Motion (Framer Motion)
- **Icons**: Lucide React
- **Data Export**: XLSX (SheetJS)

### 后端与 API (Backend & Services)
- **Server**: Node.js + Express
- **AI Engine**: DeepSeek V4 Flash（OpenAI 兼容 API）
- **Database & Auth**: Firebase Firestore & Firebase Authentication
- **Build Tool**: Esbuild + Tsx

---

## 快速开始

### 1. 克隆项目 (Clone Repository)

```bash
git clone https://github.com/yuzhounh/english-word-master.git
cd english-word-master
```

### 2. 安装依赖 (Install Dependencies)

```bash
npm ci
```

### 3. 配置环境变量 (Environment Variables)

根目录下复制或创建 `.env` 文件（可参考 `.env.example`）：

```env
# DeepSeek API Key
DEEPSEEK_API_KEY=your_deepseek_api_key_here
WORD_LIBRARY_REPO=yuzhounh/english-word-enriched
WORD_LIBRARY_FORMAT=enriched
```

### 4. 启动开发服务器 (Development Server)

```bash
npm run dev
```

打开浏览器访问 `http://localhost:3000` 即可体验应用。

### Google 网页登录

生产站点使用同域 Firebase 登录助手，Vercel 将 `/__/auth/*` 反向代理到项目的 Firebase Auth 域名。Google 登录弹窗被拦截时自动改为当前页面跳转登录；返回网站后接收登录结果并显示回调错误。Android 保留原生 Google 登录，开发与预览域名保留默认 Firebase Auth 域名。

上线前，在现有 Google OAuth 网页客户端的授权重定向 URI 中添加 `https://english-word-master.vercel.app/__/auth/handler`，并在 Firebase Authentication 的授权域名中保留 `english-word-master.vercel.app`。保留已有回调地址和客户端凭据。新增回调配置生效后再部署前端与 `vercel.json`。配置方式见 [Firebase 跳转登录说明](https://firebase.google.com/docs/auth/web/redirect-best-practices#option-3-proxy-auth-requests-to-firebaseappcom)。

### AI 身份与费用控制

服务端需要 Node.js 22 或更新版本。AI 文本分析与单词补全必须携带当前 Firebase 用户的 ID token；网页和 APK 会自动发送并刷新令牌。未登录、匿名、失效或撤销的身份不能调用 AI；词库浏览、词典查询和本地学习仍可使用。

在 Vercel 等环境中，设置服务端 `FIREBASE_SERVICE_ACCOUNT_JSON`（项目 `english-word-master-app` 的服务账号 JSON），或配置 Application Default Credentials。该账号需要 Firebase Authentication 用户读取与 Firestore 读写权限。部署仓库中的 `firestore.rules`，确保客户端无法读写 `/aiUsage` 的配额数据。密钥与服务账号凭据只能存放在服务端，不能放入 `VITE_*` 变量。配置、身份服务或配额存储不可用时，AI 请求返回 503，不调用付费模型。

两个 AI 路由共享以下服务端限制：

- 默认每用户每日 50 次、全站每日 1000 次模型调用额度，可用 `AI_USER_DAILY_CALLS` / `AI_GLOBAL_DAILY_CALLS` 调整；设为 0 可关闭付费调用。配额按 UTC 零点重置，通过 Firestore 事务在所有实例间共享。
- 每次请求先预留最多 6 次模型调用容量；失败、取消、超时与未使用的预留容量不退回。此配额按调用次数计量，不代表精确金额预算；每次模型输出最多 4096 tokens。
- 每用户每分钟最多 10 个已接纳请求、全站每分钟最多 60 个；每用户同时最多 1 个 AI 请求、全站最多 2 个。超限返回 429 和 `Retry-After`；崩溃遗留的并发占位在 70 秒后过期。
- 每次文本请求最多 30000 字符，单段最多 1500 字符；每次补全最多 200 个单词，并限制单词字段长度。续传请求重新校验输入、身份与配额；客户端自动串行分批。
- 分块最多 15 个词（完整模式）或 35 个词（轻量模式），单请求模型并发最多 3。`ENRICH_*` 服务端配置只能在硬上限内调整；所有客户端 `_bench*` 参数均被拒绝，包括开发环境。

部署前运行 `npm test`、`npm run lint` 和 `npm run build`。构建会自动运行 `test:runtime`，以禁用 CommonJS 加载 ESM 的环境检查实际 API bundle，提前拦截 Vercel 模块加载不兼容。Firebase Admin 固定在兼容此部署方式的 13.10.x；升级时需通过该运行检查。测试使用模拟身份、事务存储与模型，不产生 DeepSeek 费用。远程 benchmark 参数接口已关闭，性能试验请使用 `scripts/benchmark-enrich-sim.ts`，或在服务端硬上限内修改配置。

---

## 📦 生产构建与部署 (Build & Deployment)

```bash
# 编译前端静态资源与服务端代码
npm run build

# 启动生产环境服务器（PowerShell）
$env:NODE_ENV = "production"
npm start

# macOS / Linux
NODE_ENV=production npm start
```

---

## 相关项目

部署入口：Vercel 承载完整应用和 API；Cloudflare Pages 使用 `npm run pack:pages` 生成 `.pages` 网关并转发到 Vercel；GitHub Pages 使用 `npm run build:landing` 生成 `dist_pages` 跳转入口。单独上传普通 `dist` 只提供前端，不能提供相对路径下的 `/api`。GitHub 入口保留路径、查询参数和片段。

- [english-word-enriched](https://github.com/yuzhounh/english-word-enriched)：本项目使用的预处理词库；`.env.example` 的上游 `lilinji/English` 仍可作为原始 XLSX 数据源。

## 开源协议

本项目遵循 [MIT License](LICENSE) 开源协议。
