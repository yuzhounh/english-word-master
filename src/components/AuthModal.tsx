import React from 'react';
import { LogIn, X, ShieldCheck, Cloud, Sparkles } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative border border-slate-100 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <LogIn className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">登录账号 (Google 账号)</h2>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">
            使用 Google 账号登录以解锁多端同步与永久存储生词本功能
          </p>
        </div>

        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <Cloud className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span><b>云端协同同步：</b>生词本与练习记录实时同步至 Firebase 数据库。</span>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span><b>安全保障：</b>基于 Google OAuth 官方安全授权，无须担心密码泄露。</span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={() => {
              onGoogleSignIn();
              onClose();
            }}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>使用 Google 账号一键登录</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors text-center"
          >
            暂不登录，以游客身份体验 (使用本地存储)
          </button>
        </div>
      </div>
    </div>
  );
};
