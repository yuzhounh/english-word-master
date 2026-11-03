import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// Lightweight bilingual (Simplified Chinese / English) layer for English Word
// Master. Default language is Simplified Chinese; the choice is stored in
// localStorage and switched from the Settings panel or the navigation menu.

export type Lang = 'zh' | 'en';

const STORAGE_KEY = 'ewm-lang';

const DICT: Record<string, string> = {
  '界面语言': 'Language',
  'Switch to English': 'Switch to English',
  '切换为中文': 'Switch to Chinese',
  '功能导航': 'Navigation',
  '朗读发音': 'Speech accent',
  '外观主题': 'Theme',
  '美音': 'US',
  '英音': 'UK',

  // Settings panel (NotebookPreferences / StartupSettings)
  '设置': 'Settings',
  '设置与使用说明': 'Settings & help',
  '保持上次使用词本': 'Remember last used book',
  '开': 'On',
  '关': 'Off',
  '朗读声音': 'Voice',
  '使用说明': 'Help',
  '关闭': 'Close',
  '关闭提示': 'Dismiss',
  '默认': 'Default',
  '语言 / Language': 'Language',
  '在官方词库打开词书后，点击“加入词本”，即可加入自己的词本列表；仅浏览不会自动加入。词本中的单词不会直接进入生词本，测试答错后才会加入。':
    'Open a book in the official library and tap “Add to notebook” to add it to your list; browsing alone does not add it. Words in a notebook do not go to the wrong-words list until you answer them wrong in a quiz.',
  '点击词本右侧齿轮，选择“设为默认词本”。名称后会显示“默认”，同时关闭“保持上次使用词本”。':
    'Tap the gear next to a notebook and choose “Set as default”. A “Default” badge appears after its name, and “Remember last used book” turns off.',
  '“保持上次使用词本”开启时，启动使用最近使用的词本；关闭时，使用默认词本。启动后直接进入该词本的新一轮测试。':
    'When “Remember last used book” is on, startup opens the most recently used notebook; when off, it opens the default one. Startup goes straight into a new quiz for that notebook.',
  '例如：默认词本为大学四级，最近使用大学六级。开关为“开”时启动打开大学六级，为“关”时打开大学四级。':
    'Example: default is CET-4 and most recent is CET-6. With the switch On, startup opens CET-6; with Off, it opens CET-4.',
  '浏览词本时，右下角“列表＋勾选”按钮与菜单“单词测试”都测试当前词本；空词本暂不可测试。新建词本在菜单内操作。所选词测试重启后恢复整本；官方词库的词书需要联网重新加载。':
    'While browsing a notebook, both the bottom-right “list + check” button and the menu “Quiz” test the current notebook; empty notebooks cannot be quizzed. Create notebooks from the menu. A selected-word quiz reverts to the whole book after restart; official library books need a network reload.',
  '默认或上次使用的词本已删除时，启动打开“全量生词”。启动偏好分别保存在各设备。':
    'If the default or last-used notebook was deleted, startup opens “All wrong words”. Startup preferences are saved separately on each device.',
  // Navbar
  '单词测试': 'Quiz',
  '官方词库': 'Library',
  '我的词本': 'My Notebooks',
  '当前深色模式，点击切换浅色': 'Dark mode on, click for light',
  '当前浅色模式，点击切换深色': 'Light mode on, click for dark',
  '当前深色模式': 'Dark mode',
  '当前浅色模式': 'Light mode',
  '当前美音，点击切换英音': 'US accent, click for UK',
  '当前英音，点击切换美音': 'UK accent, click for US',
  '当前美音': 'US accent',
  '当前英音': 'UK accent',
  '美': 'US',
  '英': 'UK',
  '用户菜单': 'User menu',
  '用户': 'User',
  '退出登录': 'Sign out',
  '登录': 'Sign in',
  '打开导航菜单': 'Open navigation menu',
  '导航菜单': 'Navigation menu',
  '关闭导航菜单': 'Close navigation menu',
  '切换浅色模式': 'Switch to light mode',
  '切换深色模式': 'Switch to dark mode',
  '登录 Google 账号': 'Sign in with Google',
  // SpeechVoiceSettings
  '暂时无法读取声音，请稍后刷新重试。': 'Could not read voices; please refresh and try again later.',
  '声音选择未能保存，请检查设备可用空间。': 'Could not save the voice choice; check available storage.',
  '刷新': 'Refresh',
  '正在读取可用声音…': 'Reading available voices…',
  '当前提供 {n} 个英语声音。': '{n} English voice(s) available.',
  '此引擎仅提供一种英语声音。': 'This engine provides only one English voice.',
  '暂未列出英语声音，仍可尝试自动选择。': 'No English voices listed yet; auto-select will still be tried.',
  ' · 需联网': ' · online required',
  '美音模式声音': 'US-accent voice',
  '英音模式声音': 'UK-accent voice',
  '自动选择': 'Auto-select',
  '已选声音暂不可用（自动回退）': 'Selected voice unavailable (auto fallback)',
  '其他英语口音': 'Other English accents',
  '试听': 'Preview',
  '试听失败，请尝试其他声音或检查系统语音设置。': 'Preview failed; try another voice or check system speech settings.',
  '声音由当前设备和语音引擎提供，选择仅保存在本机。实际口音以所选声音为准；通用英语声音可能不区分英音和美音。':
    'Voices come from this device and speech engine; the choice is saved only on this device. The actual accent depends on the selected voice; generic English voices may not distinguish US/UK.',
  // App.tsx shell
  '内置词集读取失败。': 'Failed to read built-in word sets.',
  '正在打开词本…': 'Opening notebook…',
  '重试': 'Retry',
  '打开全量生词': 'Open all wrong words',
  '全量生词': 'All wrong words',
  '顽固难词': 'Stubborn words',
  '近期新增': 'Recently added',
  '全量熟词': 'All mastered words',
  '近期掌握': 'Recently mastered',
  '词本': 'Notebook',
  '生词本': 'Wrong words',
  '熟词本': 'Mastered words',
  '搜索全部词书（如：高考、四级、雅思）': 'Search all books (e.g. Gaokao, CET-4, IELTS)',
  '搜索单词或中文解释': 'Search words or Chinese meanings',
  '搜索熟词或中文解释': 'Search mastered words or Chinese meanings',
  '正在同步学习记录…': 'Syncing learning records…',
  '{n} 项学习记录待同步': '{n} learning records to sync',
  '内置词集加载失败。': 'Failed to load built-in word sets.',
  '当前词本暂无可测试的单词。': 'This notebook has no words to quiz yet.',
  '正在读取内置词集…': 'Reading built-in word sets…',
  '重试同步': 'Retry sync',
  '单词测试 · {name}': 'Quiz · {name}',
  '四选一测验 · 80,470 完整词条 · 949 本内置词书': 'Multiple-choice quiz · 80,470 entries · 949 built-in books',
  // AuthModal
  '浏览器阻止了登录窗口，请允许本站弹出窗口后重试。': 'The browser blocked the sign-in window. Please allow pop-ups for this site and try again.',
  '登录窗口已关闭，请重新尝试。': 'The sign-in window was closed. Please try again.',
  '当前网站域名尚未加入 Firebase 授权域名。': 'This site domain is not yet an authorized Firebase domain.',
  '网络连接失败，请检查网络或 VPN 后重试。': 'Network connection failed. Check your network or VPN and try again.',
  '已取消 Google 登录。': 'Google sign-in was cancelled.',
  '手机系统未能完成 Google 登录，请检查 Google Play 服务和网络后重试。': 'The phone system could not complete Google sign-in. Check Google Play services and network, then try again.',
  '登录失败，请稍后重试。': 'Sign-in failed. Please try again later.',
  '登录账号': 'Sign in',
  '关闭登录窗口': 'Close sign-in window',
  '登录账号 (Google 账号)': 'Sign in (Google account)',
  '使用 Google 账号登录以解锁多端同步与永久存储生词本功能': 'Sign in with Google to unlock multi-device sync and permanent storage of your notebooks',
  '云端协同同步：': 'Cloud sync: ',
  '生词本与练习记录实时同步至 Firebase 数据库。': 'Notebooks and practice records sync to Firebase in real time.',
  '安全保障：': 'Security: ',
  '基于 Google OAuth 官方安全授权，无须担心密码泄露。': 'Official Google OAuth authorization — no need to worry about password leaks.',
  '正在登录…': 'Signing in…',
  '使用 Google 账号一键登录': 'Sign in with one tap using Google',
  '暂不登录，以游客身份体验 (使用本地存储)': 'Continue as guest (use local storage)',
  // MobileMenu
  '词库与设置': 'Library & settings',
  '关闭菜单': 'Close menu',
  '生词本管理': 'Manage wrong words',
  '熟词本管理': 'Manage mastered words',
  '{name}管理': 'Manage {name}',
  '新建词本': 'New notebook',
  '深色': 'Dark',
  '浅色': 'Light',
  '已登录': 'Signed in',
  '{n} 本': '{n} books',
  // NotebookView
  '生词本 · 熟词本': 'Wrong words · Mastered words',
  '生词本收录待掌握词汇，熟词本记录已攻克单词。测试中连续答对 3 次自动移入熟词本。':
    'The wrong-words list holds words to learn; the mastered list records conquered words. Answering correctly 3 times in a row moves a word into the mastered list.',
  // View UI strings (translated at runtime by the overlay, no file edits needed)
  '80,470 完整词条 · 949 本权威词书': '80,470 entries · 949 authoritative books',
  '按出错次数排序': 'Sort by error count',
  '按单词字母排列': 'Order by word letters',
  '按字母顺序 A-Z 排序': 'Sort A–Z',
  '按最新出错时间排序': 'Sort by latest error time',
  '按最新掌握时间排序': 'Sort by latest mastered time',
  '包含所有在测试中攻克并标记为已掌握的单词': 'Includes all words conquered in quizzes and marked as mastered',
  '包含文章提取与测试答错的所有待掌握生词': 'Includes all words extracted from text and answered wrong in quizzes',
  '本轮 30 词测试完成！': 'This 30-word quiz is complete!',
  '标记已掌握': 'Mark as mastered',
  '播放单词发音': 'Play word pronunciation',
  '播放发音（单词+例句）': 'Play pronunciation (word + example)',
  '补全例句': 'Complete example',
  '补全例句与音标': 'Complete example and phonetics',
  '补全信息': 'Complete info',
  '补全中...': 'Completing...',
  '测试': 'Quiz',
  '测试词本': 'Quiz notebook',
  '测试当前词本': 'Quiz this notebook',
  '查看结算': 'View results',
  '查看明细': 'View details',
  '尝试更换搜索关键字': 'Try a different search keyword',
  '彻底删除': 'Delete permanently',
  '出错次数': 'Error count',
  '创建': 'Create',
  '创建后可导入或粘贴单词': 'After creating, you can import or paste words',
  '词本名称': 'Notebook name',
  '词汇测试': 'Vocabulary quiz',
  '词库来源': 'Library source',
  '词库来源：yuzhounh/english-word-enriched': 'Library source: yuzhounh/english-word-enriched',
  '词数未知': 'Unknown word count',
  '次数多的在前': 'Most frequent first',
  '从熟词本删除': 'Remove from mastered',
  '答对单词': 'Correct words',
  '待测试生词本': 'Wrong words to quiz',
  '导出失败，请重新选择保存位置。': 'Export failed; please choose another save location.',
  '导入失败，请检查网络后重试。': 'Import failed; check your network and try again.',
  '点击创建': 'Click to create',
  '点击上传文件 (.json, .csv)': 'Click to upload file (.json, .csv)',
  '对生词发起强化测试': 'Start an intensive quiz on wrong words',
  '对熟词发起巩固复习': 'Review mastered words',
  '返回词本': 'Back to notebook',
  '方法 1：上传 JSON / CSV 文件': 'Method 1: upload a JSON / CSV file',
  '方法 2：粘贴纯单词列表': 'Method 2: paste a plain word list',
  '该词本名称已存在，请换一个名称': 'That notebook name already exists; choose another',
  '根目录': 'Root',
  '巩固近 7 天战果': 'Review the last 7 days',
  '官方权威词库 (Word Library)': 'Official Word Library',
  '换一轮随机30词': 'Another random 30 words',
  '回答错误，已记入生词本': 'Wrong — added to wrong words',
  '回答正确': 'Correct',
  '或手动标记的词汇均会收录于熟词本中。随时可发起温故知新强化复习！': 'or manually marked words are collected in the mastered list. Start a review anytime!',
  '及时巩固复习': 'Review promptly',
  '加入词本': 'Add to notebook',
  '加载词书内容失败': 'Failed to load book content',
  '坚持练习，词汇量稳步提升': 'Keep practicing — your vocabulary keeps growing',
  '仅支持 .json 或 .csv 文件（与导出格式一致）': 'Only .json or .csv files (matching the export format)',
  '近 7 天内测试答错收录的最新词汇': 'Latest words answered wrong in the last 7 days',
  '近 7 天内成功攻克并加入熟词本的最新词汇': 'Latest words mastered in the last 7 days',
  '近期攻克熟词列表': 'Recently mastered list',
  '近期新增错题列表': 'Recently added wrong words',
  '进入列表明细': 'Open list details',
  '进入生词本': 'Open wrong words',
  '开始测试': 'Start quiz',
  '可在【生词本】的词本列表中查看和测试；测试中答错的单词会自动加入生词本。': 'View and quiz them from the notebook list in Wrong words; words answered wrong in a quiz are added automatically.',
  '快捷直接导入熟词本': 'Quickly import into mastered',
  '朗读例句': 'Read example aloud',
  '例如：七年级上册': 'e.g. Grade 7, Volume 1',
  '连续错2次及以上的难记高频易错词集': 'Words missed 2+ times in a row — hard, high-frequency, error-prone',
  '连续答对 3 次': '3 correct in a row',
  '内置词集、官方词库导入或自定义词本': 'Built-in sets, imported official books or custom notebooks',
  '内置分级词书': 'Built-in graded books',
  '内置全国各大教材同步词汇、高考、四六级、考研英语、雅思托福及专业词汇词书。支持分类多级检索、词书在线预览、一键专项背诵与自定义导入。': 'Built-in books synced with major textbook series, Gaokao, CET-4/6, postgraduate English, IELTS/TOEFL and professional vocabulary. Supports multi-level browsing, online preview, one-tap focused memorization and custom import.',
  '批量导入到生词本': 'Bulk import into wrong words',
  '批量导入到熟词本': 'Bulk import into mastered',
  '前往 GitHub 查看词库开源来源': 'View the open-source library on GitHub',
  '前往生词本查看词表 →': 'Go to wrong words to view the list →',
  '清除': 'Clear',
  '请输入词本名称': 'Please enter a notebook name',
  '取消': 'Cancel',
  '全量生词列表': 'All wrong words',
  '全量熟词列表': 'All mastered words',
  '确认': 'Confirm',
  '确认删除': 'Confirm delete',
  '删除': 'Delete',
  '删除词本': 'Delete notebook',
  '上一词': 'Previous word',
  '生词本 · 系统分组': 'Wrong words · System groups',
  '生词本暂无记录': 'No wrong words yet',
  '熟词本 · 系统分组': 'Mastered · System groups',
  '熟词本暂无单词': 'No mastered words yet',
  '数据来源：yuzhounh/english-word-enriched': 'Data source: yuzhounh/english-word-enriched',
  '四选一单词测验': 'Multiple-choice quiz',
  '搜索单词或中文解释...': 'Search words or Chinese meanings...',
  '搜索全部 949 本词书（如：人教版、高考、考研英语一、雅思核心、四级...）': 'Search all 949 books (e.g. PEP, Gaokao, Postgrad English I, IELTS core, CET-4...)',
  '搜索熟词或中文解释...': 'Search mastered words or Chinese meanings...',
  '听音辨义，连续答对 3 次自动标记为已掌握': 'Listen and pick the meaning; 3 correct in a row auto-marks as mastered',
  '顽固高频难词列表': 'Stubborn high-frequency hard words',
  '网络连接失败': 'Network connection failed',
  '网络请求错误': 'Network request error',
  '未能从文件中解析出有效单词，请检查文件格式。': 'No valid words found in the file; check its format.',
  '未能从文件中解析出有效单词。': 'No valid words found in the file.',
  '未能解析出有效单词。请确保每行仅包含一个英文单词。': 'No valid words found. Ensure each line has one English word.',
  '未找到符合条件的生词': 'No matching wrong words',
  '未找到符合条件的熟词': 'No matching mastered words',
  '文本提取的词汇与测试答错的单词均会自动收录于此。': 'Words extracted from text and answered wrong are collected here automatically.',
  '无法加载词库树结构': 'Failed to load the library tree',
  '下一词': 'Next word',
  '新词': 'New word',
  '新建空白词本': 'New blank notebook',
  '移回待测试生词本': 'Move back to wrong words to quiz',
  '移回待测试生词本重新练习': 'Move back to quiz for more practice',
  '移回生词本': 'Move back to wrong words',
  '已掌握': 'Mastered',
  '已掌握词汇库': 'Mastered vocabulary',
  '与「导出词汇」格式一致：WordMaster 导出的 JSON 或 CSV': 'Same format as Export words: JSON or CSV exported by WordMaster',
  '再测一轮 (随机30词)': 'Quiz again (random 30 words)',
  '在测试中': 'In quiz',
  '在测试中答对即可标记【已掌握】并自动移出生词本': 'Answer correctly in a quiz to mark as Mastered and remove from wrong words',
  '在单词测试中答错的词汇会自动记录在这里，也可以通过【导入词汇】快捷批量添加。': 'Words answered wrong in quizzes are recorded here automatically; you can also bulk-add via Import words.',
  '在单词测试中连续答对 3 次即可将词汇自动录入熟词本，也可直接在此【导入词汇】！': 'Answer correctly 3 times in a row to auto-add to mastered; you can also Import words here!',
  '在当前词书中搜索单词或释义': 'Search words or meanings in this book',
  '在当前词书中搜索单词或释义...': 'Search words or meanings in this book...',
  '暂无例句与音标': 'No example or phonetics yet',
  '正在查询并补全...': 'Looking up and completing...',
  '正在加载测试词库...': 'Loading quiz library...',
  '直接导入': 'Import directly',
  '重试加载': 'Retry loading',
  '重试加载词书': 'Retry loading book',
  '专项攻克难词': 'Target hard words',
  '准确率': 'Accuracy',
  '字母 A–Z': 'A–Z',
  '最近出错': 'Recently wrong',
  '最近出错的在前': 'Most recently wrong first',
  '最近掌握': 'Recently mastered',
  '最近掌握的在前': 'Most recently mastered first',
  'AI 补全失败，请稍后重试。': 'AI completion failed; please try again later.',
};

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (zh: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('zh');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh') setLangState(saved);
    } catch {
      /* ignore */
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'en' || e.newValue === 'zh')) {
        setLangState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    }
  }, [lang]);

  // Runtime overlay: translate any remaining hard-coded Chinese text/attributes
  // in views that were not converted to t() calls, without touching them.
  const origTextRef = useRef<WeakMap<Node, string>>(new WeakMap());
  const origAttrRef = useRef<WeakMap<Element, Map<string, string>>>(new WeakMap());
  useEffect(() => {
    if (typeof document === 'undefined' || typeof NodeFilter === 'undefined') return;
    const en = lang === 'en';
    const origText = origTextRef.current;
    const origAttr = origAttrRef.current;

    const translateText = (node: Node) => {
      if (node.nodeType !== 3) return;
      const parent = node.parentNode;
      if (!parent) return;
      const tag = parent.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;
      if (origText.has(node)) {
        if (en) {
          const orig = origText.get(node) as string;
          const key = orig.trim();
          if (Object.prototype.hasOwnProperty.call(DICT, key)) {
            const next = orig.replace(key, DICT[key]);
            if (node.nodeValue !== next) node.nodeValue = next;
          }
        } else {
          const orig = origText.get(node) as string;
          if (node.nodeValue !== orig) node.nodeValue = orig;
          origText.delete(node);
        }
        return;
      }
      if (!en) return;
      const current = node.nodeValue;
      const key = current ? current.trim() : '';
      if (!key || !Object.prototype.hasOwnProperty.call(DICT, key)) return;
      origText.set(node, current as string);
      const next = (current as string).replace(key, DICT[key]);
      if (node.nodeValue !== next) node.nodeValue = next;
    };

    const translateAttr = (el: Element) => {
      ['placeholder', 'title', 'aria-label', 'alt'].forEach((attr) => {
        if (!el.hasAttribute(attr)) return;
        let map = origAttr.get(el);
        if (!map) {
          map = new Map();
          origAttr.set(el, map);
        }
        if (!map.has(attr)) map.set(attr, el.getAttribute(attr) || '');
        const orig = map.get(attr) || '';
        const key = orig.trim();
        const targetVal = en && Object.prototype.hasOwnProperty.call(DICT, key) ? DICT[key] : orig;
        if (el.getAttribute(attr) !== targetVal) {
          el.setAttribute(attr, targetVal);
        }
      });
    };

    const walk = (root: Node | null) => {
      if (!root) return;
      if (root.nodeType === 3) {
        translateText(root);
        return;
      }
      if (root.nodeType !== 1 && root.nodeType !== 11) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) translateText(n);
      if (root.nodeType === 1) translateAttr(root as Element);
      const elements = (root as Element).querySelectorAll?.('[placeholder],[title],[aria-label],[alt]');
      if (elements) elements.forEach(translateAttr);
    };

    walk(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => walk(node as Node));
        } else if (mutation.type === 'characterData') {
          const target = mutation.target;
          if (origText.has(target)) {
            const orig = origText.get(target) as string;
            const key = orig.trim();
            const expected = en && Object.prototype.hasOwnProperty.call(DICT, key) ? orig.replace(key, DICT[key]) : orig;
            if (target.nodeValue === expected) continue;
          } else if (!en) {
            continue;
          }
          translateText(target);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (zh: string, vars?: Record<string, string | number>) => {
      let text = lang === 'en' ? DICT[zh] ?? zh : zh;
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.split('{' + name + '}').join(String(value));
        }
      }
      return text;
    },
    [lang]
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function LangSelect({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <select
      className={className ?? 'ewm-lang-select'}
      aria-label={t('语言 / Language')}
      title={t('语言 / Language')}
      value={lang}
      onChange={(event) => setLang(event.target.value as Lang)}
    >
      <option value="zh">简体中文</option>
      <option value="en">English</option>
    </select>
  );
}
