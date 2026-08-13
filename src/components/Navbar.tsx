import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, FileText, Bookmark, Award, LogIn, LogOut, Layers, Volume2, Menu, X } from 'lucide-react';
import { UserProfile, SpeechAccent } from '../types';

interface NavbarProps {
  activeTab: 'quiz' | 'extract' | 'library' | 'masteredWords' | 'wrongWords';
  setActiveTab: (tab: 'quiz' | 'extract' | 'library' | 'masteredWords' | 'wrongWords') => void;
  user: UserProfile | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  wrongWordsCount: number;
  masteredWordsCount: number;
  extractedWordsCount: number;
  speechAccent: SpeechAccent;
  onToggleSpeechAccent: () => void;
}

const navItems = [
  { id: 'quiz' as const, label: '单词测试', icon: BookOpen },
  { id: 'extract' as const, label: '文本提取', icon: FileText, countKey: 'extracted' as const },
  { id: 'library' as const, label: '词库', icon: Layers, badge: '900+本' },
  { id: 'masteredWords' as const, label: '熟词本', icon: Award, countKey: 'mastered' as const },
  { id: 'wrongWords' as const, label: '生词本', icon: Bookmark, countKey: 'wrong' as const },
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
  onToggleSpeechAccent
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const counts = {
    extracted: extractedWordsCount,
    mastered: masteredWordsCount,
    wrong: wrongWordsCount,
  };

  const handleTabClick = (tab: 'quiz' | 'extract' | 'library' | 'masteredWords' | 'wrongWords') => {
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
      ? 'bg-brand-50 text-brand-700 font-semibold'
      : 'bg-white text-brand-600 shadow-sm font-semibold';

    const inactiveClass = mobile
      ? 'text-slate-700 hover:bg-slate-50'
      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60';

    return (
      <button
        key={item.id}
        onClick={() => handleTabClick(item.id)}
        className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
      >
        <div className={`flex items-center ${mobile ? 'gap-3' : 'gap-1.5'}`}>
          <Icon className={`w-4 h-4 ${mobile ? 'w-5 h-5' : ''} ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
          <span>{item.label}</span>
          {!mobile && item.badge && (
            <span className="px-1.5 py-0.5 text-[10px] bg-brand-100 text-brand-700 font-bold rounded-md">
              {item.badge}
            </span>
          )}
        </div>
        {item.badge && mobile && (
          <span className="px-1.5 py-0.5 text-[11px] bg-brand-100 text-brand-700 font-bold rounded-md">
            {item.badge}
          </span>
        )}
        {item.countKey && count > 0 && (
          <span className={`${mobile ? 'px-2 py-0.5 text-xs' : 'ml-0.5 px-1.5 py-0.5 text-[11px]'} bg-brand-100 text-brand-700 font-bold rounded-full`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="打开导航菜单"
            aria-label="打开导航菜单"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div 
            className="flex items-center gap-2.5 cursor-pointer group shrink-0"
            onClick={() => handleTabClick('quiz')}
          >
            <img 
              src="/logo.svg" 
              alt="WordMaster Logo" 
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain group-hover:scale-105 transition-transform" 
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm sm:text-lg tracking-tight text-slate-900">WordMaster</span>
                <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold bg-brand-50 text-brand-600 rounded-md border border-brand-100">AI</span>
              </div>
              <p className="hidden sm:block text-xs text-slate-400">智能英文背单词 & 词库管理</p>
            </div>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-0.5 bg-slate-100/70 p-1 rounded-xl text-sm font-medium">
          {navItems.map((item) => renderNavButton(item))}
        </nav>

        <div className="hidden lg:flex items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleSpeechAccent}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-brand-50 hover:text-brand-600 rounded-full transition-all border border-slate-200/80 cursor-pointer"
            title="切换单词朗读发音 (美音 / 英音)"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{speechAccent === 'en-US' ? '🇺🇸 美音' : '🇬🇧 英音'}</span>
          </button>

          {user && !user.isGuest ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-full">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-xs">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-slate-700 max-w-[100px] truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="退出登录"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
              >
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
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <div className="relative w-72 max-w-[80vw] bg-white h-screen shadow-elevated z-10 flex flex-col justify-between p-5 overflow-y-auto animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <img src="/logo.svg" alt="WordMaster Logo" className="w-8 h-8 object-contain" />
                  <span className="font-bold text-base text-slate-900">WordMaster</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-brand-50 text-brand-600 rounded-md border border-brand-100">AI</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-1">
                {navItems.map((item) => renderNavButton(item, true))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <button
                onClick={onToggleSpeechAccent}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-brand-50 hover:text-brand-600 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-brand-600" />
                  <span>朗读发音</span>
                </div>
                <span>{speechAccent === 'en-US' ? '🇺🇸 美音' : '🇬🇧 英音'}</span>
              </button>

              {user && !user.isGuest ? (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                  <div className="flex items-center gap-2 truncate">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || 'User'} className="w-7 h-7 rounded-full" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-xs">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-medium text-slate-800 truncate">
                      {user.displayName || user.email?.split('@')[0]}
                    </span>
                  </div>
                  <button
                    onClick={onLogout}
                    title="退出登录"
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenAuthModal();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 gradient-brand text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-95 transition-all cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Google 登录</span>
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
