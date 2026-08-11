import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, FileText, BrainCircuit, Bookmark, Award, LogIn, LogOut, Layers, Volume2, Menu, X } from 'lucide-react';
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

  const handleTabClick = (tab: 'quiz' | 'extract' | 'library' | 'masteredWords' | 'wrongWords') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 sm:h-16 flex items-center justify-between gap-2">
        
        {/* Left Section: Hamburger Menu (Mobile) + Brand Logo */}
        <div className="flex items-center gap-2">
          {/* Hamburger Button for Mobile */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-1.5 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="打开导航菜单"
            aria-label="打开导航菜单"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Brand Logo */}
          <div 
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group shrink-0"
            onClick={() => handleTabClick('quiz')}
          >
            <img 
              src="/logo.svg" 
              alt="WordMaster Logo" 
              className="w-7 h-7 sm:w-9 sm:h-9 object-contain group-hover:scale-105 transition-transform drop-shadow-xs" 
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm sm:text-lg tracking-tight text-slate-800">WordMaster</span>
                <span className="px-1.5 py-0.2 text-[9px] sm:text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">AI</span>
              </div>
              <p className="hidden sm:block text-xs text-slate-400 font-normal">智能英文背单词 & 词库管理</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Desktop only) */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl text-xs sm:text-sm font-medium">
          
          {/* 1. 单词测试 - Amber */}
          <button
            onClick={() => setActiveTab('quiz')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'quiz'
                ? 'bg-white text-amber-600 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <BookOpen className={`w-4 h-4 ${activeTab === 'quiz' ? 'text-amber-600' : 'text-amber-500'}`} />
            <span>单词测试</span>
          </button>

          {/* 2. 文本提取 - Pink/Rose */}
          <button
            onClick={() => setActiveTab('extract')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'extract'
                ? 'bg-white text-pink-600 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileText className={`w-4 h-4 ${activeTab === 'extract' ? 'text-pink-600' : 'text-pink-500'}`} />
            <span>文本提取</span>
            {extractedWordsCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 text-[11px] bg-pink-100 text-pink-700 font-bold rounded-full">
                {extractedWordsCount}
              </span>
            )}
          </button>

          {/* 3. 词库 - Cyan/Sky */}
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'library'
                ? 'bg-white text-cyan-600 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Layers className={`w-4 h-4 ${activeTab === 'library' ? 'text-cyan-600' : 'text-cyan-500'}`} />
            <span>词库</span>
            <span className="px-1.5 py-0.2 text-[10px] bg-cyan-100 text-cyan-800 font-bold rounded-md">
              900+本
            </span>
          </button>

          {/* 4. 熟词本 - Emerald */}
          <button
            onClick={() => setActiveTab('masteredWords')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'masteredWords'
                ? 'bg-white text-emerald-600 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Award className={`w-4 h-4 ${activeTab === 'masteredWords' ? 'text-emerald-600' : 'text-emerald-500'}`} />
            <span>熟词本</span>
            {masteredWordsCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 text-[11px] bg-emerald-100 text-emerald-800 font-bold rounded-full">
                {masteredWordsCount}
              </span>
            )}
          </button>

          {/* 5. 生词本 - Indigo */}
          <button
            onClick={() => setActiveTab('wrongWords')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'wrongWords'
                ? 'bg-white text-indigo-600 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${activeTab === 'wrongWords' ? 'text-indigo-600' : 'text-indigo-500'}`} />
            <span>生词本</span>
            {wrongWordsCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 text-[11px] bg-indigo-100 text-indigo-800 font-bold rounded-full">
                {wrongWordsCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right Section: Accent Selector & Auth (Desktop only, mobile version is in hamburger drawer) */}
        <div className="hidden lg:flex items-center gap-2 sm:gap-3">
          
          {/* Accent Toggle Button */}
          <button
            onClick={onToggleSpeechAccent}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-full transition-all border border-slate-200 cursor-pointer"
            title="切换单词朗读发音 (美音 / 英音)"
          >
            <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>{speechAccent === 'en-US' ? '🇺🇸 美音' : '🇬🇧 英音'}</span>
          </button>

          {/* User Profile / Login */}
          {user && !user.isGuest ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-slate-700 max-w-[80px] sm:max-w-[100px] truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="退出登录"
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-all border border-slate-200 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Google 登录</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Side Drawer */}
      {isMobileMenuOpen && createPortal(
        <div className="lg:hidden fixed inset-0 z-[100] flex">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Side Drawer Content from Left */}
          <div className="relative w-72 max-w-[80vw] bg-white h-screen shadow-2xl z-10 flex flex-col justify-between p-5 overflow-y-auto animate-in slide-in-from-left duration-200 rounded-r-3xl">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <img src="/logo.svg" alt="WordMaster Logo" className="w-8 h-8 object-contain drop-shadow-xs" />
                  <div>
                    <span className="font-bold text-base text-slate-800">WordMaster</span>
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">AI</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Navigation Links */}
              <div className="mt-4 space-y-1">
                {/* 1. 单词测试 */}
                <button
                  onClick={() => handleTabClick('quiz')}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'quiz'
                      ? 'bg-amber-50 text-amber-600 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-amber-500" />
                    <span>单词测试</span>
                  </div>
                </button>

                {/* 2. 文本提取 */}
                <button
                  onClick={() => handleTabClick('extract')}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'extract'
                      ? 'bg-pink-50 text-pink-600 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-pink-500" />
                    <span>文本提取</span>
                  </div>
                  {extractedWordsCount > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-pink-100 text-pink-700 font-bold rounded-full">
                      {extractedWordsCount}
                    </span>
                  )}
                </button>

                {/* 3. 词库 */}
                <button
                  onClick={() => handleTabClick('library')}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'library'
                      ? 'bg-cyan-50 text-cyan-600 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-cyan-500" />
                    <span>词库</span>
                  </div>
                  <span className="px-1.5 py-0.5 text-[11px] bg-cyan-100 text-cyan-800 font-bold rounded-md">
                    900+本
                  </span>
                </button>

                {/* 4. 熟词本 */}
                <button
                  onClick={() => handleTabClick('masteredWords')}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'masteredWords'
                      ? 'bg-emerald-50 text-emerald-600 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Award className="w-5 h-5 text-emerald-500" />
                    <span>熟词本</span>
                  </div>
                  {masteredWordsCount > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 font-bold rounded-full">
                      {masteredWordsCount}
                    </span>
                  )}
                </button>

                {/* 5. 生词本 */}
                <button
                  onClick={() => handleTabClick('wrongWords')}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'wrongWords'
                      ? 'bg-indigo-50 text-indigo-600 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Bookmark className="w-5 h-5 text-indigo-500" />
                    <span>生词本</span>
                  </div>
                  {wrongWordsCount > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-800 font-bold rounded-full">
                      {wrongWordsCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Drawer Footer info */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <button
                onClick={onToggleSpeechAccent}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-indigo-600" />
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
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
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
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-700 transition-all cursor-pointer"
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

