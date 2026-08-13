import React from 'react';
import { SpeakerIcon } from '../SpeakerIcon';

interface WordCardProps {
  word: string;
  phonetic?: string;
  phoneticUk?: string;
  phoneticUs?: string;
  chinese: string;
  exampleSentence?: string;
  exampleSentenceCn?: string;
  isSpeaking?: boolean;
  onSpeak?: (e?: React.MouseEvent) => void;
  onClick?: () => void;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  indexLabel?: string | number;
  className?: string;
  actions?: React.ReactNode;
}

export const WordCard: React.FC<WordCardProps> = ({
  word,
  phonetic,
  phoneticUk,
  phoneticUs,
  chinese,
  exampleSentence,
  exampleSentenceCn,
  isSpeaking,
  onSpeak,
  onClick,
  badge,
  footer,
  indexLabel,
  className = '',
  actions,
}) => (
  <div
    onClick={onClick}
    className={`rounded-[var(--radius-card)] border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 p-4 shadow-card hover:shadow-card-hover hover:border-brand-200 dark:hover:border-brand-700 transition-all space-y-3 relative group cursor-pointer active:scale-[0.99] ${className}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
            {word}
          </span>
          {onSpeak && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSpeak(e);
              }}
              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors cursor-pointer shrink-0"
              title="播放发音"
            >
              <SpeakerIcon isSpeaking={isSpeaking} className="w-5 h-5" />
            </button>
          )}
        </div>
        {(phoneticUs || phoneticUk || phonetic) && (
          <div className="text-sm font-mono text-slate-500 dark:text-slate-400 font-medium mt-1 space-x-2">
            {phoneticUs && <span><span className="text-slate-400 text-xs">美</span> {phoneticUs}</span>}
            {phoneticUk && <span><span className="text-slate-400 text-xs">英</span> {phoneticUk}</span>}
            {!phoneticUs && !phoneticUk && phonetic && <span>{phonetic}</span>}
          </div>
        )}
      </div>
      <div className="flex items-start gap-2 shrink-0">
        {badge}
        {indexLabel !== undefined && (
          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-mono font-bold rounded-lg">
            #{indexLabel}
          </span>
        )}
      </div>
    </div>

    <div className="text-base font-bold text-brand-900 dark:text-brand-200 bg-brand-50/80 dark:bg-brand-900/20 py-2.5 px-3 rounded-xl border border-brand-100/80 dark:border-brand-800/50 leading-snug">
      {chinese}
    </div>

    {exampleSentence ? (
      <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50/80 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 space-y-1">
        <p className="font-medium text-slate-800 dark:text-slate-200 italic leading-snug">"{exampleSentence}"</p>
        {exampleSentenceCn && (
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-snug">{exampleSentenceCn}</p>
        )}
      </div>
    ) : footer ? (
      footer
    ) : null}

    {actions && (
      <div className="flex items-center justify-end pt-1 border-t border-slate-100 dark:border-slate-700/50">
        {actions}
      </div>
    )}
  </div>
);
