import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bookmark, Award, BookOpen } from 'lucide-react';
import { NotebookSubTab } from '../types/navigation';
import { WrongWordsList } from './WrongWordsList';
import { MasteredWordsList } from './MasteredWordsList';
import { PageHeader } from './ui/PageHeader';
import { WrongWordItem, MasteredWordItem, WordItem, WordListGroup, SpeechAccent } from '../types';

interface NotebookViewProps {
  subTab: NotebookSubTab;
  onSubTabChange: (tab: NotebookSubTab) => void;
  wrongWords: WrongWordItem[];
  masteredWords: MasteredWordItem[];
  customWordLists?: WordListGroup[];
  onRemoveWrongWord: (wordId: string) => void;
  onStartWrongWordsQuiz: (words: WordItem[]) => void;
  onClearAllWrongWords?: () => void;
  onImportWrongWords?: (words: WrongWordItem[]) => void;
  onImportToWordList?: (words: WordItem[], listName: string, listId?: string | null) => void;
  onCreateCustomList?: (listName: string) => string | null;
  onDeleteCustomList?: (listId: string, removeWords?: boolean) => void;
  onRemoveMasteredWord: (wordId: string) => void;
  onMoveToWrongWords: (word: MasteredWordItem) => void;
  onStartMasteredWordsQuiz: (words: WordItem[]) => void;
  onClearAllMasteredWords?: () => void;
  onImportMasteredWords?: (words: MasteredWordItem[]) => void;
  speechAccent?: SpeechAccent;
}

export const NotebookView: React.FC<NotebookViewProps> = ({
  subTab,
  onSubTabChange,
  wrongWords,
  masteredWords,
  customWordLists,
  onRemoveWrongWord,
  onStartWrongWordsQuiz,
  onClearAllWrongWords,
  onImportWrongWords,
  onImportToWordList,
  onCreateCustomList,
  onDeleteCustomList,
  onRemoveMasteredWord,
  onMoveToWrongWords,
  onStartMasteredWordsQuiz,
  onClearAllMasteredWords,
  onImportMasteredWords,
  speechAccent = 'en-US',
}) => (
    <div className="page-container space-y-6">
    <PageHeader
      badge="我的词本"
      badgeIcon={BookOpen}
      title="生词本 · 熟词本"
      description="生词本收录待掌握词汇，熟词本记录已攻克单词。测试中连续答对 3 次自动移入熟词本。"
      compactOnMobile
    />

    <div className="grid grid-cols-2 gap-2 bg-slate-100/80 dark:bg-slate-800/60 p-1.5 rounded-2xl w-full">
      <button
        type="button"
        onClick={() => onSubTabChange('wrong')}
        className={`min-w-0 flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 sm:px-5 py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-bold transition-all cursor-pointer ${
          subTab === 'wrong'
            ? 'surface-tab-active text-brand-600 dark:text-brand-300'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
      >
        <Bookmark className="w-4.5 h-4.5 sm:w-5 sm:h-5 shrink-0" />
        <span className="whitespace-nowrap">生词本</span>
        {wrongWords.length > 0 && (
          <span className="shrink-0 px-1.5 sm:px-2 py-0.5 text-xs sm:text-sm bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-full font-bold">
            {wrongWords.length}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => onSubTabChange('mastered')}
        className={`min-w-0 flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 sm:px-5 py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-bold transition-all cursor-pointer ${
          subTab === 'mastered'
            ? 'surface-tab-active text-emerald-600 dark:text-emerald-400'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
      >
        <Award className="w-4.5 h-4.5 sm:w-5 sm:h-5 shrink-0" />
        <span className="whitespace-nowrap">熟词本</span>
        {masteredWords.length > 0 && (
          <span className="shrink-0 px-1.5 sm:px-2 py-0.5 text-xs sm:text-sm bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full font-bold">
            {masteredWords.length}
          </span>
        )}
      </button>
    </div>

    <AnimatePresence mode="wait">
      <motion.div
        key={subTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
      >
        {subTab === 'wrong' ? (
          <WrongWordsList
            hideHeader
            wrongWords={wrongWords}
            customWordLists={customWordLists}
            onRemoveWrongWord={onRemoveWrongWord}
            onStartWrongWordsQuiz={onStartWrongWordsQuiz}
            onClearAllWrongWords={onClearAllWrongWords}
            onImportWrongWords={onImportWrongWords}
            onImportToWordList={onImportToWordList}
            onCreateCustomList={onCreateCustomList}
            onDeleteCustomList={onDeleteCustomList}
            speechAccent={speechAccent}
          />
        ) : (
          <MasteredWordsList
            hideHeader
            masteredWords={masteredWords}
            onRemoveMasteredWord={onRemoveMasteredWord}
            onMoveToWrongWords={onMoveToWrongWords}
            onStartMasteredWordsQuiz={onStartMasteredWordsQuiz}
            onClearAllMasteredWords={onClearAllMasteredWords}
            onImportMasteredWords={onImportMasteredWords}
            speechAccent={speechAccent}
          />
        )}
      </motion.div>
    </AnimatePresence>
  </div>
);
