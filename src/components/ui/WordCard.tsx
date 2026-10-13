import React, { useLayoutEffect, useRef, useState } from 'react';
import { useCompactLayout } from '../../hooks/useCompactLayout';
import { SpeechAccent } from '../../types';
import { WordWithSpeaker } from './WordWithSpeaker';
import { PhoneticDisplay } from './PhoneticDisplay';

interface WordCardProps {
  word: string;
  phonetic?: string;
  phoneticUk?: string;
  phoneticUs?: string;
  speechAccent?: SpeechAccent;
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
  /** brand: 生词本默认；emerald: 熟词本 */
  variant?: 'brand' | 'emerald';
  actionsClassName?: string;
}

export const WordCard: React.FC<WordCardProps> = ({
  word,
  phonetic,
  phoneticUk,
  phoneticUs,
  speechAccent = 'en-US',
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
  variant = 'brand',
  actionsClassName = 'flex items-center justify-end',
}) => {
  const compact = useCompactLayout();
  const [meaningOpen, setMeaningOpen] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [meaningOverflow, setMeaningOverflow] = useState(false);
  const meaningRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!compact || meaningOpen || !meaningRef.current) return;
    const element = meaningRef.current;
    const measure = () => setMeaningOverflow(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [compact, chinese, meaningOpen]);
  const isEmerald = variant === 'emerald';
  const cardHover = isEmerald
    ? 'hover:border-emerald-400 dark:hover:border-emerald-600'
    : 'hover:border-brand-200 dark:hover:border-brand-700';
  const chineseBox = isEmerald
    ? 'text-emerald-800 dark:text-emerald-200 bg-emerald-50/60 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800'
    : 'text-brand-900 dark:text-brand-200 bg-brand-50/80 dark:bg-brand-900/20 border-brand-100/80 dark:border-brand-800/50';

  if (compact) return (
    <div onClick={onClick} className={`word-card word-card-compact surface-card ${className}`}>
      <div className="word-card-inline-heading">
        <WordWithSpeaker word={word} isSpeaking={isSpeaking} onSpeak={onSpeak ? e => onSpeak(e) : undefined}
          wordClassName="word-card-word font-extrabold text-primary tracking-tight [overflow-wrap:anywhere]" />
        {(phoneticUs || phoneticUk || phonetic) && <PhoneticDisplay item={{ phonetic, phoneticUs, phoneticUk }} accent={speechAccent} className="word-card-phonetic text-secondary" />}
        {badge}
        {indexLabel !== undefined && <span className="word-card-index text-muted">#{indexLabel}</span>}
      </div>
      <div ref={meaningRef} className={`word-card-meaning ${meaningOpen ? '' : 'word-card-meaning-preview'} text-primary`}>{chinese}</div>
      {(meaningOverflow || meaningOpen || exampleSentence || actions) && (
        <div className="word-card-tools">
          {(meaningOverflow || meaningOpen) && <button type="button" aria-expanded={meaningOpen} onClick={e => { e.stopPropagation(); setMeaningOpen(!meaningOpen); }} className="word-card-expand text-brand-600 dark:text-brand-300">{meaningOpen ? '收起释义' : '完整释义'}</button>}
          {exampleSentence && <button type="button" aria-expanded={exampleOpen} onClick={e => { e.stopPropagation(); setExampleOpen(!exampleOpen); }} className="word-card-expand text-secondary">{exampleOpen ? '收起例句' : '例句'}</button>}
          {actions && <div className={`word-card-actions ${actionsClassName}`}>{actions}</div>}
        </div>
      )}
      {exampleOpen && exampleSentence && <div className="word-card-example text-secondary"><p>{exampleSentence}</p>{exampleSentenceCn && <p>{exampleSentenceCn}</p>}</div>}
      {!exampleSentence && footer}
    </div>
  );

  return (
  <div
    onClick={onClick}
    className={`word-card rounded-[var(--radius-card)] border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 p-4 shadow-card hover:shadow-card-hover ${cardHover} transition-all space-y-3 relative group cursor-pointer active:scale-[0.99] ${className}`}
  >
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
      <div className="min-w-0 max-w-full flex flex-col">
        <WordWithSpeaker
          word={word}
          isSpeaking={isSpeaking}
          onSpeak={onSpeak ? (e) => onSpeak(e) : undefined}
          wordClassName="word-card-word min-w-0 text-[1.65rem] sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight [overflow-wrap:anywhere]"
        />
        {(phoneticUs || phoneticUk || phonetic) && (
          <PhoneticDisplay
            item={{ phonetic, phoneticUs, phoneticUk }}
            accent={speechAccent}
            className="word-card-phonetic block text-sm font-sans text-slate-500 dark:text-slate-400 font-medium mt-1"
          />
        )}
      </div>
      <div className="ml-auto flex items-start gap-2 shrink-0">
        {badge}
        {indexLabel !== undefined && (
          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-mono font-bold rounded-lg">
            #{indexLabel}
          </span>
        )}
      </div>
    </div>

    <div className={`word-card-meaning text-base font-bold py-2.5 px-3 rounded-xl border leading-snug ${chineseBox}`}>
      {chinese}
    </div>

    {exampleSentence ? (
      <div className="word-card-example text-sm text-slate-700 dark:text-slate-300 bg-slate-50/80 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 space-y-1">
        <p className="font-medium text-slate-800 dark:text-slate-200 italic leading-snug">"{exampleSentence}"</p>
        {exampleSentenceCn && (
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-snug">{exampleSentenceCn}</p>
        )}
      </div>
    ) : footer ? (
      footer
    ) : null}

    {actions && (
      <div className={`pt-1 border-t border-slate-100 dark:border-slate-700/50 ${actionsClassName}`}>
        {actions}
      </div>
    )}
  </div>
  );
};
