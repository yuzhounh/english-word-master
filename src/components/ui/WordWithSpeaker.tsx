import React from 'react';
import { SpeakerIcon } from '../SpeakerIcon';

interface WordWithSpeakerProps {
  word: string;
  isSpeaking?: boolean;
  onSpeak?: (e: React.MouseEvent) => void;
  /** centered: 单词居中，喇叭紧跟右侧；inline: 左对齐横排 */
  variant?: 'centered' | 'inline';
  wordClassName?: string;
  iconClassName?: string;
  speakTitle?: string;
  as?: 'h1' | 'span';
}

const speakButtonClass =
  'inline-flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors shrink-0 cursor-pointer p-1 leading-none';

export const WordWithSpeaker: React.FC<WordWithSpeakerProps> = ({
  word,
  isSpeaking,
  onSpeak,
  variant = 'inline',
  wordClassName = 'text-2xl font-extrabold text-primary tracking-tight leading-none',
  iconClassName = 'w-5 h-5',
  speakTitle = '播放发音',
  as: WordTag = 'span',
}) => {
  const speakButton = onSpeak ? (
    <button type="button" onClick={onSpeak} title={speakTitle} className={speakButtonClass}>
      <SpeakerIcon isSpeaking={isSpeaking} className={iconClassName} />
    </button>
  ) : null;

  if (variant === 'centered') {
    return (
      <div className="flex justify-center w-full">
        <div className="relative inline-block max-w-full">
          <WordTag className={wordClassName}>{word}</WordTag>
          {speakButton && (
            <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 inline-flex items-center">
              {speakButton}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center max-w-full">
      <WordTag className={wordClassName}>{word}</WordTag>
      {speakButton && <span className="ml-1.5 inline-flex items-center shrink-0">{speakButton}</span>}
    </span>
  );
};
