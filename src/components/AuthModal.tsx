import React from 'react';
import { LogIn, X, ShieldCheck, Cloud } from 'lucide-react';
import { Button } from './ui/Button';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleSignIn: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onGoogleSignIn
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-elevated relative border border-slate-200/80 dark:border-slate-700 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 rounded-2xl flex items-center justify-center mx-auto border border-brand-100/50 dark:border-brand-700/50">
            <LogIn className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">登录账号 (Google 账号)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            使用 Google 账号登录以解锁多端同步与永久存储生词本功能
          </p>
        </div>

        <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700/60 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex items-start gap-2.5">
            <Cloud className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
            <span><b className="text-slate-800 dark:text-slate-200">云端协同同步：</b>生词本与练习记录实时同步至 Firebase 数据库。</span>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span><b className="text-slate-800 dark:text-slate-200">安全保障：</b>基于 Google OAuth 官方安全授权，无须担心密码泄露。</span>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              onGoogleSignIn();
              onClose();
            }}
          >
            <LogIn className="w-4 h-4" />
            <span>使用 Google 账号一键登录</span>
          </Button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-center"
          >
            暂不登录，以游客身份体验 (使用本地存储)
          </button>
        </div>
      </div>
    </div>
  );
};
