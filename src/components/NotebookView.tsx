import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bookmark, Award, BookOpen } from 'lucide-react';
import { NotebookSubTab } from '../types/navigation';
import { WrongWordsList } from './WrongWordsList';
import { MasteredWordsList } from './MasteredWordsList';
import { PageHeader } from './ui/PageHeader';
import { WrongWordItem, MasteredWordItem, WordItem, WordListGroup } from '../types';

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
  onDeleteCustomList?: (listId: string, removeWords?: boolean) => void;
  onRemoveMasteredWord: (wordId: string) => void;
  onMoveToWrongWords: (word: MasteredWordItem) => void;
  onStartMasteredWordsQuiz: (words: WordItem[]) => void;
  onClearAllMasteredWords?: () => void;
  onImportMasteredWords?: (words: MasteredWordItem[]) => void;
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
  onDeleteCustomList,
  onRemoveMasteredWord,
  onMoveToWrongWords,
  onStartMasteredWordsQuiz,
  onClearAllMasteredWords,
  onImportMasteredWords,
}) => (
  <div className="max-w-5xl mx-auto px-4 space-y-6">
    <PageHeader
      badge="我的词本"
      badgeIcon={BookOpen}
      title={`生词 ${wrongWords.length} · 熟词 ${masteredWords.length}`}
      description="生词本收录待掌握词汇，熟词本记录已攻克单词。测试中连续答对 3 次自动移入熟词本。"
    />

    <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/60 p-1 rounded-xl w-full sm:w-auto">
      <button
        type="button"
        onClick={() => onSubTabChange('wrong')}
        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
          subTab === 'wrong'
            ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
      >
        <Bookmark className="w-4 h-4" />
        <span>生词本</span>
        {wrongWords.length > 0 && (
          <span className="px-1.5 py-0.5 text-xs bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-full font-bold">
            {wrongWords.length}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => onSubTabChange('mastered')}
        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
          subTab === 'mastered'
            ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
      >
        <Award className="w-4 h-4" />
        <span>熟词本</span>
        {masteredWords.length > 0 && (
          <span className="px-1.5 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full font-bold">
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
            onDeleteCustomList={onDeleteCustomList}
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
          />
        )}
      </motion.div>
    </AnimatePresence>
  </div>
);
