import React from 'react';
import { BookOpen, Layers, Notebook, LogIn, LogOut, Volume2, Menu, X, Moon, Sun } from 'lucide-react';
import { createPortal } from 'react-dom';
import { UserProfile, SpeechAccent } from '../types';
import { AppTab } from '../types/navigation';
import { useClickOutside } from '../hooks/useClickOutside';

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  user: UserProfile | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  speechAccent: SpeechAccent;
  onToggleSpeechAccent: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

const navItems = [
  { id: 'quiz' as const, label: '单词测试', icon: BookOpen },
  { id: 'library' as const, label: '官方词库', icon: Layers },
  { id: 'notebook' as const, label: '我的词本', icon: Notebook },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onOpenAuthModal,
  onLogout,
  speechAccent,
  onToggleSpeechAccent,
  isDark,
  onToggleTheme,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState<boolean>(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  useClickOutside(userMenuRef, () => setIsUserMenuOpen(false), isUserMenuOpen);

  const handleTabClick = (tab: AppTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const renderNavButton = (item: typeof navItems[number], mobile = false) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;

    const baseClass = mobile
      ? 'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer'
      : 'flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all cursor-pointer';

    const activeClass = mobile
      ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800/60 font-semibold shadow-xs'
      : 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm font-semibold';

    const inactiveClass = mobile
      ? 'text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 hover:bg-white dark:hover:bg-slate-800 hover:border-brand-300'
      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50';

    return (
      <button
        key={item.id}
        onClick={() => handleTabClick(item.id)}
        className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
      >
        <div className={`flex items-center ${mobile ? 'gap-2.5' : 'gap-1.5'}`}>
          <Icon className={`${mobile ? 'w-4 h-4' : 'w-4 h-4'} ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`} />
          <span>{item.label}</span>
        </div>
      </button>
    );
  };

  return (
    <header data-app-navbar className="app-navbar-safe-area sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-700/80">
      <div className="page-container h-14 sm:h-16 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 cursor-pointer group shrink-0" onClick={() => handleTabClick('quiz')}>
          <img src="/logo.svg" alt="WordMaster Logo" className="w-8 h-8 sm:w-9 sm:h-9 object-contain group-hover:scale-105 transition-transform" />
          <span className="font-bold text-sm sm:text-lg tracking-tight text-slate-900 dark:text-slate-100">WordMaster</span>
        </div>

        <nav className="hidden lg:flex items-center gap-0.5 bg-slate-100/70 dark:bg-slate-800/60 p-1 rounded-xl text-sm font-medium">
          {navItems.map((item) => renderNavButton(item))}
        </nav>

        {/* Desktop Controls */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            className="flex items-center justify-center px-2.5 py-1.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-900/30 hover:text-brand-600 rounded-full transition-all border border-slate-200/80 dark:border-slate-700 shadow-sm cursor-pointer"
            title={isDark ? '当前深色模式，点击切换浅色' : '当前浅色模式，点击切换深色'}
            aria-label={isDark ? '当前深色模式' : '当前浅色模式'}
          >
            {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onToggleSpeechAccent}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-900/30 hover:text-brand-600 rounded-full transition-all border border-slate-200/80 dark:border-slate-700 shadow-sm cursor-pointer"
            title={speechAccent === 'en-US' ? '当前美音，点击切换英音' : '当前英音，点击切换美音'}
            aria-label={speechAccent === 'en-US' ? '当前美音' : '当前英音'}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{speechAccent === 'en-US' ? '美' : '英'}</span>
          </button>

          {user && !user.isGuest ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center justify-center p-0.5 rounded-full hover:ring-2 hover:ring-brand-500/50 dark:hover:ring-brand-400/50 focus-ring transition-all cursor-pointer"
                title={user.displayName || user.email || '用户菜单'}
                aria-label="用户菜单"
                aria-expanded={isUserMenuOpen}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200/80 dark:border-slate-700 shadow-xs"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-600 dark:text-brand-300 flex items-center justify-center font-bold text-xs border border-brand-200/80 dark:border-brand-700 shadow-xs">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-800 shadow-elevated border border-slate-200/80 dark:border-slate-700 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-3">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200/80 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-600 dark:text-brand-300 flex items-center justify-center font-bold text-xs shrink-0 border border-brand-200 dark:border-brand-700">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {user.displayName || '用户'}
                      </p>
                      {user.email && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={user.email}>
                          {user.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>退出登录</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white gradient-brand rounded-full transition-all cursor-pointer shadow-sm hover:opacity-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>登录</span>
            </button>
          )}
        </div>

        {/* Mobile Top-Right Hamburger Button */}
        <div className="lg:hidden flex items-center">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-9 h-9 rounded-full border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-xs hover:border-brand-500 hover:text-brand-600 transition-colors cursor-pointer"
            aria-label="打开导航菜单"
            title="打开导航菜单"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer (min(72vw, 248px), Right-Aligned, 72px Header) */}
      {isMobileMenuOpen && createPortal(
        <div className="lg:hidden fixed inset-0 z-[1000] flex justify-end">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-xs cursor-pointer" onClick={() => setIsMobileMenuOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="导航菜单"
            className="relative w-[min(72vw,248px)] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 rounded-l-2xl shadow-elevated z-10 flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200"
          >
            {/* Drawer Header (Height: 72px, padding: 26px 16px 18px) */}
            <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-2">
                <img src="/logo.svg" alt="WordMaster Logo" className="w-7 h-7 object-contain rounded-lg" />
                <span className="font-bold text-[17px] tracking-tight text-slate-900 dark:text-slate-100">WordMaster</span>
              </div>
              <button
                type="button"
                aria-label="关闭导航菜单"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-brand-600 hover:border-brand-500 flex items-center justify-center text-xl leading-none transition-colors cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Drawer Body (Single-column list of tabs, pinned to top) */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider">功能导航</span>
                <div className="flex flex-col gap-1.5">
                  {navItems.map((item) => renderNavButton(item, true))}
                </div>
              </div>
            </div>

            {/* Drawer Footer (Unified rows for Theme, Speech, Account) */}
            <div className="px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-col gap-2 shrink-0 bg-white dark:bg-slate-900">
              {/* 外观主题 */}
              <div className="flex items-center justify-between px-3.5 h-[44px] rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 box-border">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">外观主题</span>
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="w-[34px] h-[34px] min-w-[34px] min-h-[34px] rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-brand-600 transition-colors cursor-pointer shadow-2xs"
                  title={isDark ? '切换浅色模式' : '切换深色模式'}
                  aria-label={isDark ? '切换浅色模式' : '切换深色模式'}
                >
                  {isDark ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-5 h-5" />}
                </button>
              </div>

              {/* 朗读发音 */}
              <div className="flex items-center justify-between px-3.5 h-[44px] rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 box-border">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">朗读发音</span>
                <button
                  type="button"
                  onClick={onToggleSpeechAccent}
                  className="w-[34px] h-[34px] min-w-[34px] min-h-[34px] rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-[14px] font-bold leading-none text-slate-800 dark:text-slate-200 hover:text-brand-600 transition-colors cursor-pointer shadow-2xs"
                  title={speechAccent === 'en-US' ? '当前美音，点击切换英音' : '当前英音，点击切换美音'}
                  aria-label={speechAccent === 'en-US' ? '当前美音' : '当前英音'}
                >
                  {speechAccent === 'en-US' ? '美' : '英'}
                </button>
              </div>

              {/* 账户与同步 */}
              <div className="flex items-center justify-between px-3.5 h-[44px] rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 box-border">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">账户状态</span>
                {user && !user.isGuest ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 max-w-[90px] truncate" title={user.displayName || user.email || '用户'}>
                      {user.displayName || '用户'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onLogout();
                      }}
                      className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      退出
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenAuthModal();
                    }}
                    className="h-[34px] px-4 text-xs font-semibold text-white gradient-brand rounded-full shadow-xs cursor-pointer inline-flex items-center justify-center transition-opacity hover:opacity-95"
                  >
                    登录
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};
