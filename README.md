# English Word Master (智能英文背单词 & 词库管理)

[![React](https://img.shields.io/badge/React-19.0-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38B2AC.svg)](https://tailwindcss.com/)
[![DeepSeek API](https://img.shields.io/badge/DeepSeek-API-4D6BFE.svg)](https://platform.deepseek.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-FFCA28.svg)](https://firebase.google.com/)

**English Word Master** 是一款基于 AI 驱动的高效英文单词学习与综合词库管理平台。集成了文本智能分析、词干还原（Lemmatization）、四选一互动测验、错题本复习系统以及 Firebase 云端同步功能，帮助用户从阅读中积累词汇，高效巩固与高效复习。

🌐 **在线体验：[https://english-word-master.vercel.app/](https://english-word-master.vercel.app/)**

---

## ✨ 核心功能亮点 (Features)

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

## 🚀 快速开始 (Quick Start)

### 1. 克隆项目 (Clone Repository)

```bash
git clone https://github.com/your-username/english-word-master.git
cd english-word-master
```

### 2. 安装依赖 (Install Dependencies)

```bash
npm install
```

### 3. 配置环境变量 (Environment Variables)

根目录下复制或创建 `.env` 文件（可参考 `.env.example`）：

```env
# DeepSeek API Key
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

### 4. 启动开发服务器 (Development Server)

```bash
npm run dev
```

打开浏览器访问 `http://localhost:3000` 即可体验应用。

---

## 📦 生产构建与部署 (Build & Deployment)

```bash
# 编译前端静态资源与服务端代码
npm run build

# 启动生产环境服务器
npm start
```

---

## 📄 开源协议 (License)

本项目遵循 [MIT License](LICENSE) 开源协议。
