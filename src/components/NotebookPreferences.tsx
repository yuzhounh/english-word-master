import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Globe, Settings, Volume2, X } from 'lucide-react';
import { useBackHandler } from '../hooks/useBackHandler';
import { SpeechVoiceSettings } from './SpeechVoiceSettings';
import { useI18n } from '../i18n';
import { BookVisit, StartupPreferences, STARTUP_STORAGE_KEY, parseStartupPreferences, startupVisit } from '../lib/startupPreferences';

interface PreferencesContext {
  defaultKey: string; rememberLast: boolean; initialVisit: BookVisit; ready: boolean;
  finishStartup: () => void; recordVisit: (visit: BookVisit) => void;
  setQuizSource: (visit: BookVisit) => void; recordCurrentQuiz: () => void;
  setDefault: (key: string) => void; toggleRemember: () => void; forgetBook: (key: string) => void;
}
const Context = createContext<PreferencesContext | null>(null);
export function useNotebookPreferences() { return useContext(Context)!; }

export function NotebookPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [initial] = useState(() => {
    try { return parseStartupPreferences(localStorage.getItem(STARTUP_STORAGE_KEY)); }
    catch { return parseStartupPreferences(null); }
  });
  const [prefs, setPrefs] = useState(initial);
  const current = useRef(initial);
  const quizSource = useRef<BookVisit>({ ...startupVisit(initial), mode: 'quiz' });
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const [notice, setNotice] = useState('');
  const save = useCallback((next: StartupPreferences, render = true) => {
    current.current = next;
    try { localStorage.setItem(STARTUP_STORAGE_KEY, JSON.stringify(next)); }
    catch { setNotice('启动设置未能保存，请检查设备可用空间。'); }
    if (render) setPrefs(next);
  }, []);
  const recordVisit = useCallback((visit: BookVisit) => {
    if (visit.mode === 'quiz') quizSource.current = visit;
    if (!readyRef.current || JSON.stringify(current.current.lastVisit) === JSON.stringify(visit)) return;
    save({ ...current.current, lastVisit: visit }, false);
  }, [save]);
  const setQuizSource = useCallback((visit: BookVisit) => { quizSource.current = { ...visit, mode: 'quiz' }; }, []);
  const recordCurrentQuiz = useCallback(() => recordVisit(quizSource.current), [recordVisit]);
  const finishStartup = useCallback(() => { readyRef.current = true; setReady(true); }, []);
  const setDefault = useCallback((key: string) => {
    setNotice('已设为默认词本，启动时将打开此词本。');
    save({ ...current.current, defaultKey: key, rememberLast: false });
  }, [save]);
  const toggleRemember = useCallback(() => save({ ...current.current, rememberLast: !current.current.rememberLast }), [save]);
  const forgetBook = useCallback((key: string) => {
    const old = current.current;
    if (old.defaultKey !== key && old.lastVisit?.key !== key) return;
    if (old.defaultKey === key) setNotice('默认词本已删除，已改为全量生词。');
    save({ ...old, defaultKey: old.defaultKey === key ? 'wrong:all' : old.defaultKey,
      lastVisit: old.lastVisit?.key === key ? { key: 'wrong:all', mode: 'browse' } : old.lastVisit });
  }, [save]);
  const initialVisit = useMemo(() => startupVisit(initial), [initial]);
  const value = useMemo(() => ({ defaultKey: prefs.defaultKey, rememberLast: prefs.rememberLast, initialVisit,
    ready, finishStartup, recordVisit, setQuizSource, recordCurrentQuiz, setDefault, toggleRemember, forgetBook }),
  [prefs.defaultKey, prefs.rememberLast, initialVisit, ready, finishStartup, recordVisit, setQuizSource, recordCurrentQuiz, setDefault, toggleRemember, forgetBook]);
  return <Context.Provider value={value}>{children}{notice && <div role="status" className="fixed bottom-24 left-4 right-4 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-800 px-4 py-3 text-sm text-white shadow-lg">
    <span className="flex-1">{notice}</span><button type="button" aria-label="关闭提示" className="min-h-10 min-w-10" onClick={() => setNotice('')}><X className="mx-auto h-5 w-5" /></button>
  </div>}</Context.Provider>;
}

export function DefaultBookBadge({ bookKey }: { bookKey: string }) {
  const { defaultKey } = useNotebookPreferences();
  return defaultKey === bookKey ? <span className="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-900/60 dark:text-brand-200">默认</span> : null;
}

export function StartupSettings({ desktop = false }: { desktop?: boolean }) {
  const { rememberLast, toggleRemember } = useNotebookPreferences();
  const { t, lang, setLang } = useI18n();
  const [page, setPage] = useState<'help' | 'voice' | null>(null);
  const helpOpen = page !== null;
  const pageTitle = page === 'voice' ? t('朗读声音') : t('使用说明');
  const panel = useRef<HTMLDivElement>(null);
  useBackHandler(() => { if (page) { setPage(null); return true; } return false; }, 35);
  
  React.useEffect(() => {
    const handleOpenHelp = () => setPage('help');
    const handleOpenVoice = () => setPage('voice');
    window.addEventListener('wordmaster:open-help', handleOpenHelp);
    window.addEventListener('wordmaster:open-voice', handleOpenVoice);
    window.addEventListener('wordmaster:open-settings', handleOpenHelp);
    return () => {
      window.removeEventListener('wordmaster:open-help', handleOpenHelp);
      window.removeEventListener('wordmaster:open-voice', handleOpenVoice);
      window.removeEventListener('wordmaster:open-settings', handleOpenHelp);
    };
  }, []);

  React.useEffect(() => {
    if (!helpOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [helpOpen]);

  const rows = <>
    {desktop && <button type="button" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
      className="flex min-h-12 w-full items-center justify-between gap-4 rounded-xl px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
      <Globe width={22} height={22} strokeWidth={1.8} aria-hidden />
      <span className="flex-1 text-left">{t('界面语言')}</span>
      <span className="text-slate-500 dark:text-slate-400">{lang === 'zh' ? '简体中文' : 'English'}</span>
    </button>}
    <button type="button" role="switch" aria-checked={rememberLast} onClick={toggleRemember}
      className={desktop ? 'flex min-h-12 w-full items-center justify-between gap-4 rounded-xl px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer' : 'm-nav-row w-full'}>
      <Settings width={22} height={22} strokeWidth={1.8} aria-hidden /><span className="flex-1 text-left">{t('保持上次使用词本')}</span><span>{rememberLast ? t('开') : t('关')}</span>
    </button>
    <button type="button" onClick={() => setPage('voice')} className={desktop ? 'flex min-h-12 w-full items-center gap-4 rounded-xl px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer' : 'm-nav-row w-full'}>
      <Volume2 width={22} height={22} strokeWidth={1.8} aria-hidden /><span>{t('朗读声音')}</span>
    </button>
    <button type="button" onClick={() => setPage('help')} className={desktop ? 'flex min-h-12 w-full items-center gap-4 rounded-xl px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer' : 'm-nav-row w-full'}>
      <BookOpen width={22} height={22} strokeWidth={1.8} aria-hidden /><span>{t('使用说明')}</span>
    </button>
  </>;

  const closePanel = () => setPage(null);
  
  // In desktop mode, Help and Voice are rendered as centered popup modal dialogs
  const isDialogMode = desktop;
  const modal = helpOpen && createPortal(
    <div
      className={isDialogMode ? 'fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4' : 'm-page'}
      style={!isDialogMode ? { paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top, 0px))', paddingBottom: 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))', paddingLeft: 'var(--safe-area-inset-left, env(safe-area-inset-left, 0px))', paddingRight: 'var(--safe-area-inset-right, env(safe-area-inset-right, 0px))' } : undefined}
      onClick={isDialogMode ? closePanel : undefined}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={pageTitle}
        className={isDialogMode ? 'surface-card max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl p-5 text-primary shadow-2xl outline-none' : 'flex min-h-0 w-full flex-1 flex-col outline-none'}
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Escape') closePanel();
          if (event.key !== 'Tab') return;
          const elements = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)');
          if (!elements?.length) return;
          const first = elements[0], last = elements[elements.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}
      >
        <div className={isDialogMode ? 'mb-3 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 pb-2.5' : 'm-page-bar'}>
          <h2 className={isDialogMode ? 'text-lg font-bold' : 'm-title'}>{pageTitle}</h2>
          <button
            type="button"
            aria-label={t('关闭')}
            className={isDialogMode ? 'flex min-h-9 min-w-9 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer' : 'm-icon-btn'}
            onClick={closePanel}
          >
            <X width={20} height={20} strokeWidth={2} />
          </button>
        </div>
        {page === 'voice' ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <SpeechVoiceSettings standalone />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
            <ol className="list-decimal space-y-3.5 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <li>{t('在官方词库打开词书后，点击“加入词本”，即可加入自己的词本列表；仅浏览不会自动加入。词本中的单词不会直接进入生词本，测试答错后才会加入。')}</li>
              <li>{t('点击词本右侧齿轮，选择“设为默认词本”。名称后会显示“默认”，同时关闭“保持上次使用词本”。')}</li>
              <li>{t('“保持上次使用词本”开启时，启动使用最近使用的词本；关闭时，使用默认词本。启动后直接进入该词本的新一轮测试。')}</li>
              <li>{t('例如：默认词本为大学四级，最近使用大学六级。开关为“开”时启动打开大学六级，为“关”时打开大学四级。')}</li>
              <li>{t('浏览词本时，右下角“列表＋勾选”按钮与菜单“单词测试”都测试当前词本；空词本暂不可测试。新建词本在菜单内操作。所选词测试重启后恢复整本；官方词库的词书需要联网重新加载。')}</li>
              <li>{t('默认或上次使用的词本已删除时，启动打开“全量生词”。启动偏好分别保存在各设备。')}</li>
            </ol>
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  return <>{desktop ? null : rows}{modal}</>;
}
