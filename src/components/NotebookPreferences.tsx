import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Settings, Volume2, X } from 'lucide-react';
import { useBackHandler } from '../hooks/useBackHandler';
import { SpeechVoiceSettings } from './SpeechVoiceSettings';
import { LangSelect, useI18n } from '../i18n';
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
  const { t } = useI18n();
  const [page, setPage] = useState<'help' | 'voice' | null>(null);
  const helpOpen = page !== null;
  const pageTitle = page === 'voice' ? t('朗读声音') : t('使用说明');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useBackHandler(() => { if (page) { setPage(null); return true; } if (settingsOpen) { setSettingsOpen(false); return true; } return false; }, 35);
  React.useEffect(() => {
    if (!helpOpen && !settingsOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [helpOpen, settingsOpen]);
  const rows = <>
    <label className={desktop ? 'flex min-h-12 w-full items-center justify-between gap-4 rounded-xl px-3 text-sm' : 'm-nav-row w-full'}>
      <span className="flex-1 text-left">{t('语言 / Language')}</span>
      <LangSelect />
    </label>
    <button type="button" role="switch" aria-checked={rememberLast} onClick={toggleRemember}
      className={desktop ? 'flex min-h-12 w-full items-center justify-between gap-4 rounded-xl px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-700' : 'm-nav-row w-full'}>
      <Settings width={22} height={22} strokeWidth={1.8} aria-hidden /><span className="flex-1 text-left">{t('保持上次使用词本')}</span><span>{rememberLast ? t('开') : t('关')}</span>
    </button>
    <button type="button" onClick={() => setPage('voice')} className={desktop ? 'flex min-h-12 w-full items-center gap-4 rounded-xl px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-700' : 'm-nav-row w-full'}>
      <Volume2 width={22} height={22} strokeWidth={1.8} aria-hidden /><span>{t('朗读声音')}</span>
    </button>
    <button type="button" onClick={() => setPage('help')} className={desktop ? 'flex min-h-12 w-full items-center gap-4 rounded-xl px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-700' : 'm-nav-row w-full'}>
      <BookOpen width={22} height={22} strokeWidth={1.8} aria-hidden /><span>{t('使用说明')}</span>
    </button>
  </>;
  const closePanel = () => { if (page) setPage(null); else setSettingsOpen(false); };
  const modal = (helpOpen || (desktop && settingsOpen)) && createPortal(<div
    className={helpOpen ? (desktop ? 'fixed inset-0 z-[70] bg-white dark:bg-slate-900' : 'm-page') : 'fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4'}
    style={helpOpen ? (desktop ? { paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top, 0px))', paddingBottom: 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))', paddingLeft: 'var(--safe-area-inset-left, env(safe-area-inset-left, 0px))', paddingRight: 'var(--safe-area-inset-right, env(safe-area-inset-right, 0px))' } : { zIndex: 70 }) : undefined}
    onClick={helpOpen ? undefined : closePanel}>
    <div ref={panel} tabIndex={-1} role={helpOpen ? 'region' : 'dialog'} aria-modal={helpOpen ? undefined : true} aria-label={helpOpen ? pageTitle : t('设置')}
      className={helpOpen ? (desktop ? 'flex h-full min-h-0 w-full flex-col text-primary outline-none' : 'flex min-h-0 w-full flex-1 flex-col outline-none') : 'surface-card max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl p-5 text-primary shadow-xl outline-none'}
      onClick={event => event.stopPropagation()} onKeyDown={event => {
        if (event.key === 'Escape') closePanel();
        if (event.key !== 'Tab') return;
        const elements = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)');
        if (!elements?.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <div className={helpOpen ? (desktop ? 'flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-700' : 'm-page-bar') : 'mb-3 flex items-center justify-between'}>
        <h2 className={helpOpen && !desktop ? 'm-title' : 'text-lg font-bold'}>{helpOpen ? pageTitle : t('设置')}</h2>
        <button type="button" aria-label={t('关闭')} className={helpOpen && !desktop ? 'm-icon-btn' : 'flex min-h-10 min-w-10 items-center justify-center'} onClick={closePanel}>
          <X width={24} height={24} strokeWidth={helpOpen && !desktop ? 1.8 : 2} />
        </button>
      </div>
      {page === 'voice' ? <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"><SpeechVoiceSettings standalone /></div> : helpOpen ? <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4"><ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
        <li>{t('在官方词库打开词书后，点击“加入词本”，即可加入自己的词本列表；仅浏览不会自动加入。词本中的单词不会直接进入生词本，测试答错后才会加入。')}</li>
        <li>{t('点击词本右侧齿轮，选择“设为默认词本”。名称后会显示“默认”，同时关闭“保持上次使用词本”。')}</li>
        <li>{t('“保持上次使用词本”开启时，启动使用最近使用的词本；关闭时，使用默认词本。启动后直接进入该词本的新一轮测试。')}</li>
        <li>{t('例如：默认词本为大学四级，最近使用大学六级。开关为“开”时启动打开大学六级，为“关”时打开大学四级。')}</li>
        <li>{t('浏览词本时，右下角“列表＋勾选”按钮与菜单“单词测试”都测试当前词本；空词本暂不可测试。新建词本在菜单内操作。所选词测试重启后恢复整本；官方词库的词书需要联网重新加载。')}</li>
        <li>{t('默认或上次使用的词本已删除时，启动打开“全量生词”。启动偏好分别保存在各设备。')}</li>
      </ol></div> : rows}
    </div>
  </div>, document.body);
  return <>{desktop ? <button type="button" title={t('设置与使用说明')} aria-label={t('设置与使用说明')} onClick={() => setSettingsOpen(true)} className="flex min-h-10 min-w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Settings className="h-4 w-4" /></button> : rows}{modal}</>;
}
