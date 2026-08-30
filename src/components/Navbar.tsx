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
        </div>
      </button>
    );
  };

  return (
    <header data-app-navbar className="app-navbar-safe-area sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-700/80">
      <div className="page-container h-14 sm:h-16 flex items-center justify-between gap-2">
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
            <span className="font-bold text-sm sm:text-lg tracking-tight text-slate-900 dark:text-slate-100">WordMaster</span>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-0.5 bg-slate-100/70 dark:bg-slate-800/60 p-1 rounded-xl text-sm font-medium">
          {navItems.map((item) => renderNavButton(item))}
        </nav>

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
      </div>

      {isMobileMenuOpen && createPortal(
        <div className="lg:hidden fixed inset-0 z-[100] flex">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="app-panel-safe-area relative w-72 max-w-[80vw] bg-white dark:bg-slate-900 h-screen shadow-elevated z-10 flex flex-col justify-between p-5 overflow-y-auto">
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
              <button
                onClick={onToggleTheme}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer"
                title={isDark ? '当前深色模式，点击切换浅色' : '当前浅色模式，点击切换深色'}
              >
                <span>{isDark ? '深色模式' : '浅色模式'}</span>
                {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
              <button
                onClick={onToggleSpeechAccent}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer"
                title={speechAccent === 'en-US' ? '当前美音，点击切换英音' : '当前英音，点击切换美音'}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>朗读发音</span>
                </span>
                <span>{speechAccent === 'en-US' ? '美' : '英'}</span>
              </button>
              {user && !user.isGuest ? (
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || 'User'} className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 flex items-center justify-center font-bold text-xs">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user.displayName || '用户'}</p>
                      {user.email && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>退出登录</span>
                  </button>
                </div>
              ) : (
                <button onClick={() => { setIsMobileMenuOpen(false); onOpenAuthModal(); }} className="w-full py-2.5 gradient-brand text-white rounded-xl text-xs font-bold cursor-pointer">
                  登录
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
