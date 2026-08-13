import React from 'react';
import { BookOpen, FileText, Layers, Notebook } from 'lucide-react';
import { createPortal } from 'react-dom';
import { LogIn, LogOut, Volume2, Menu, X, Moon, Sun } from 'lucide-react';
import { UserProfile, SpeechAccent } from '../types';
import { AppTab } from '../types/navigation';

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  user: UserProfile | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  wrongWordsCount: number;
  masteredWordsCount: number;
  extractedWordsCount: number;
  speechAccent: SpeechAccent;
  onToggleSpeechAccent: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

const navItems = [
  { id: 'quiz' as const, label: '单词测试', icon: BookOpen },
  { id: 'extract' as const, label: '文本提取', icon: FileText, countKey: 'extracted' as const },
  { id: 'library' as const, label: '词库', icon: Layers, badge: '900+本' },
  { id: 'notebook' as const, label: '我的词本', icon: Notebook, countKey: 'notebook' as const },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onOpenAuthModal,
  onLogout,
  wrongWordsCount,
  masteredWordsCount,
  extractedWordsCount,
  speechAccent,
  onToggleSpeechAccent,
  isDark,
  onToggleTheme,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState<boolean>(false);

  const counts = {
    extracted: extractedWordsCount,
    notebook: wrongWordsCount + masteredWordsCount,
  };

  const handleTabClick = (tab: AppTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const renderNavButton = (item: typeof navItems[number], mobile = false) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const count = item.countKey ? counts[item.countKey] : 0;

    const baseClass = mobile
      ? 'w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer'
      : 'flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all cursor-pointer';

    const activeClass = mobile
      ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-semibold'
      : 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm font-semibold';

    const inactiveClass = mobile
      ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50';

    return (
      <button
        key={item.id}
        onClick={() => handleTabClick(item.id)}
        className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
      >
        <div className={`flex items-center ${mobile ? 'gap-3' : 'gap-1.5'}`}>
          <Icon className={`${mobile ? 'w-5 h-5' : 'w-4 h-4'} ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`} />
          <span>{item.label}</span>
          {!mobile && item.badge && (
            <span className="px-1.5 py-0.5 text-[10px] bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold rounded-md">
              {item.badge}
            </span>
          )}
        </div>
        {item.badge && mobile && (
          <span className="px-1.5 py-0.5 text-[11px] bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold rounded-md">
            {item.badge}
          </span>
        )}
        {item.countKey && count > 0 && (
          <span className={`${mobile ? 'px-2 py-0.5 text-xs' : 'ml-0.5 px-1.5 py-0.5 text-[11px]'} bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold rounded-full`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-700/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="打开导航菜单"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 cursor-pointer group shrink-0" onClick={() => handleTabClick('quiz')}>
            <img src="/logo.svg" alt="WordMaster Logo" className="w-8 h-8 sm:w-9 sm:h-9 object-contain group-hover:scale-105 transition-transform" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm sm:text-lg tracking-tight text-slate-900 dark:text-slate-100">WordMaster</span>
                <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 rounded-md border border-brand-100 dark:border-brand-800">AI</span>
              </div>
              <p className="hidden sm:block text-xs text-slate-400">智能英文背单词 & 词库管理</p>
            </div>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-0.5 bg-slate-100/70 dark:bg-slate-800/60 p-1 rounded-xl text-sm font-medium">
          {navItems.map((item) => renderNavButton(item))}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-full transition-colors cursor-pointer"
            title={isDark ? '切换浅色模式' : '切换深色模式'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={onToggleSpeechAccent}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-900/30 hover:text-brand-600 rounded-full transition-all border border-slate-200/80 dark:border-slate-700 cursor-pointer"
            title="切换单词朗读发音"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{speechAccent === 'en-US' ? '🇺🇸 美音' : '🇬🇧 英音'}</span>
          </button>

          {user && !user.isGuest ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2.5 py-1 rounded-full">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 flex items-center justify-center font-bold text-xs">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[100px] truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </div>
              <button onClick={onLogout} title="退出登录" className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white gradient-brand rounded-full transition-all cursor-pointer shadow-sm hover:opacity-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Google 登录</span>
            </button>
          )}
        </div>
      </div>

      {isMobileMenuOpen && createPortal(
        <div className="lg:hidden fixed inset-0 z-[100] flex">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[80vw] bg-white dark:bg-slate-900 h-screen shadow-elevated z-10 flex flex-col justify-between p-5 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-900 dark:text-slate-100">WordMaster</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 space-y-1">{navItems.map((item) => renderNavButton(item, true))}</div>
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <button onClick={onToggleTheme} className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer">
                <span>{isDark ? '浅色模式' : '深色模式'}</span>
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={onToggleSpeechAccent} className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer">
                <span>朗读发音</span>
                <span>{speechAccent === 'en-US' ? '🇺🇸 美音' : '🇬🇧 英音'}</span>
              </button>
              {user && !user.isGuest ? (
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl">
                  <span className="text-xs font-medium truncate">{user.displayName || user.email?.split('@')[0]}</span>
                  <button onClick={onLogout} className="p-1 text-slate-400 hover:text-rose-600"><LogOut className="w-4 h-4" /></button>
                </div>
              ) : (
                <button onClick={() => { setIsMobileMenuOpen(false); onOpenAuthModal(); }} className="w-full py-2.5 gradient-brand text-white rounded-xl text-xs font-bold cursor-pointer">
                  Google 登录
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};
