import React, { useState, useRef, useEffect } from 'react';
import { Play } from 'lucide-react';
import { useChromeActions, useChromeSearch } from './mobile/chrome';
import type { NotebookCommand } from '../types/navigation';
import { WordCard } from './ui/WordCard';
import { 
  Award, Search, Trash2, BookOpen, ArrowUpDown, ChevronLeft,
  CheckCircle2, RotateCcw, Download, Upload, FileText, X, 
  FileSpreadsheet, FileJson, Check, AlertTriangle, Sparkles, Loader2 
} from 'lucide-react';
import { MasteredWordItem, WordItem, SpeechAccent } from '../types';
import {
  parsePlainWordList,
  parseExportedWordMasterJson,
  parseExportedWordMasterCsv,
  parsedToWordItems,
  enrichParsedWords,
  enrichWordsWithDictionaryFallback
} from '../utils/wordParser';
import { Pagination } from './Pagination';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { speakEnglish } from '../lib/speech';
import { AiClientError } from '../lib/aiApi';
import { useBookLongPress } from '../hooks/useBookLongPress';
import { useBackHandler } from '../hooks/useBackHandler';
import { BookActionMenu } from './ui/BookActionMenu';
import { SortMenu } from './ui/SortMenu';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { saveTextFile } from '../lib/saveTextFile';

interface MasteredWordsListProps {
  /** Phone layout: the shell chooses the list ('all' | 'recent'). */
  externalTarget?: string;
  externalCommand?: NotebookCommand | null;
  onCommandHandled?: () => void;
  masteredWords: MasteredWordItem[];
  hideHeader?: boolean;
  onRemoveMasteredWord: (wordId: string) => void;
  onMoveToWrongWords: (word: MasteredWordItem) => void;
  onStartMasteredWordsQuiz: (words: WordItem[], bookName?: string) => void;
  onImportMasteredWords?: (words: MasteredWordItem[]) => void;
  speechAccent?: SpeechAccent;
}

export const MasteredWordsList: React.FC<MasteredWordsListProps> = ({
  externalTarget,
  externalCommand,
  onCommandHandled,
  masteredWords,
  hideHeader = false,
  onRemoveMasteredWord,
  onMoveToWrongWords,
  onStartMasteredWordsQuiz,
  onImportMasteredWords,
  speechAccent = 'en-US',
}) => {
  const compactLayout = useCompactLayout();
  const chrome = useChromeActions();
  const chromeSearch = useChromeSearch();
  const mobile = externalTarget !== undefined && !!chrome;
  const listCardSelectedGreen =
    'border border-emerald-200/80 dark:border-emerald-700/40 !bg-emerald-50/90 dark:!bg-emerald-950/25 shadow-sm ring-1 ring-emerald-200/60 dark:ring-emerald-600/20';
  const listCardUnselected =
    'surface-card shadow-xs hover:border-emerald-200/60 dark:hover:border-emerald-700/40 hover:shadow-sm';
  const listIconBoxLg =
    'p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors';
  const listIconSelectedLg = 'p-3 rounded-xl bg-emerald-500 text-white transition-colors';
  const listBadgeSelected = 'font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300';
  const listBadgeUnselected = 'font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
  const listTitleSelected = 'text-emerald-700 dark:text-emerald-300';
  const listTitleUnselected = 'text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400';
  const listFooterSelected = 'font-semibold text-emerald-600 dark:text-emerald-400';
  const listFooterUnselected = 'font-medium text-slate-500 dark:text-slate-400';

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical'>('recent');
  const [isListOpen, setIsListOpen] = useState(externalTarget !== undefined);
  const openList = () => {
    setIsListOpen(true);
    setSearchTerm('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);

  // Modals & Popups
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isBookMenuOpen, setIsBookMenuOpen] = useState(false);
  const [importText, setImportText] = useState<string>('');
  const [importFilePayload, setImportFilePayload] = useState<{ kind: 'json' | 'csv'; content: string } | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Dictionary-first enrichment state; AI is used by the fallback only for unknown words.
  const [enrichingWordId, setEnrichingWordId] = useState<string | null>(null);
  const [isBulkEnriching, setIsBulkEnriching] = useState<boolean>(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  const handleEnrichSingleWord = async (item: MasteredWordItem) => {
    setEnrichError(null);
    setEnrichingWordId(item.id);
    try {
      const enriched = await enrichWordsWithDictionaryFallback([{
        word: item.word,
        chinese: item.chinese,
        phonetic: item.phonetic
      }]);
      if (enriched && enriched.length > 0) {
        const enrichedWord = enriched[0];
        const updatedList = masteredWords.map(w => {
          if (w.id === item.id) {
            return {
              ...w,
              phonetic: enrichedWord.phonetic || w.phonetic,
              chinese: enrichedWord.chinese || w.chinese,
              exampleSentence: enrichedWord.exampleSentence || w.exampleSentence,
              exampleSentenceCn: enrichedWord.exampleSentenceCn || w.exampleSentenceCn
            };
          }
          return w;
        });
        if (onImportMasteredWords) {
          onImportMasteredWords(updatedList);
        }
      }
    } catch (err) {
      console.error('Enrich single word failed:', err);
      setEnrichError(err instanceof AiClientError ? err.message : 'AI 补全失败，请稍后重试。');
    } finally {
      setEnrichingWordId(null);
    }
  };

  const handleBulkEnrichWords = async () => {
    const missingWords = activeWordSet.filter(w => !w.exampleSentence || !w.exampleSentence.trim());
    if (missingWords.length === 0 || isBulkEnriching) return;
    setEnrichError(null);
    setIsBulkEnriching(true);
    try {
      const enriched = await enrichWordsWithDictionaryFallback(missingWords.map(w => ({
        word: w.word,
        chinese: w.chinese,
        phonetic: w.phonetic
      })));
      if (enriched && enriched.length > 0) {
        const enrichedMap = new Map(enriched.map(e => [e.word.toLowerCase().trim(), e]));
        const updatedList = masteredWords.map(w => {
          const match = enrichedMap.get(w.id.toLowerCase().trim());
          if (match) {
            return {
              ...w,
              phonetic: match.phonetic || w.phonetic,
              chinese: match.chinese || w.chinese,
              exampleSentence: match.exampleSentence || w.exampleSentence,
              exampleSentenceCn: match.exampleSentenceCn || w.exampleSentenceCn
            };
          }
          return w;
        });
        if (onImportMasteredWords) {
          onImportMasteredWords(updatedList);
        }
      }
    } catch (err) {
      console.error('Bulk enrich failed:', err);
      setEnrichError(err instanceof AiClientError ? err.message : 'AI 补全失败，请稍后重试。');
    } finally {
      setIsBulkEnriching(false);
    }
  };

  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  // Pronounce with Android native TTS in the APK and browser TTS on the web.
  const speakWord = (word: string, exampleSentence?: string) => {
    void speakEnglish([word, exampleSentence], {
      language: speechAccent,
      delayMs: 80,
      onTextStart: () => setSpeakingWord(word),
      onEnd: () => setSpeakingWord(null),
      onError: () => setSpeakingWord(null),
    });
  };

  const [selectedListFilter, setSelectedListFilter] = useState<'all' | 'recent'>(externalTarget === 'recent' ? 'recent' : 'all');

  // Computed sub-lists
  const recentMasteredWords = masteredWords.filter(w => Date.now() - (w.masteredAt || 0) <= 7 * 86400000);

  const getSelectedGroupLabel = (): string =>
    selectedListFilter === 'recent' ? '近期攻克熟词列表' : '全量熟词列表';

  // Active word set depending on filter selection
  const activeWordSet = selectedListFilter === 'recent' ? recentMasteredWords : masteredWords;

  const longPress = useBookLongPress(target => {
    setSelectedListFilter(target as 'all' | 'recent'); setIsBookMenuOpen(true);
  });
  useBackHandler(() => {
    if (isImportModalOpen) { if (!isEnriching) setIsImportModalOpen(false); return true; }
    if (isListOpen && !mobile) { setIsListOpen(false); window.scrollTo(0, 0); return true; }
    return false;
  });
  const exportWords = activeWordSet;

  // Filter & Sort
  const searchValue = mobile ? chromeSearch : searchTerm;
  const filteredWords = activeWordSet
    .filter((w) =>
      w.word.toLowerCase().includes(searchValue.toLowerCase().trim()) ||
      w.chinese.includes(searchValue.trim())
    )
    .sort((a, b) => {
      if (sortBy === 'recent') {
        return (b.masteredAt || 0) - (a.masteredAt || 0);
      } else {
        return a.word.localeCompare(b.word);
      }
    });

  const isAllMastered = pageSize <= 0 || pageSize >= filteredWords.length;
  const pageStartIndexMastered = isAllMastered ? 0 : (currentPage - 1) * pageSize;
  const paginatedWords = isAllMastered ? filteredWords : filteredWords.slice(pageStartIndexMastered, pageStartIndexMastered + pageSize);

  // Phone list selection (long press or avatar tap), driven from the shell's title bar and bottom bar.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const exitSelection = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const toggleSelect = (id: string) => {
    setSelectMode(true);
    setSelectedIds(previous => { const next = new Set(previous); if (!next.delete(id)) next.add(id); return next; });
  };
  const selectionApi = useRef({ run: (_: 'test' | 'unmaster' | 'delete') => {}, toggleAll: () => {} });
  selectionApi.current = {
    toggleAll: () => setSelectedIds(previous =>
      previous.size === filteredWords.length ? new Set() : new Set(filteredWords.map(w => w.id))),
    run: kind => {
      const chosen = filteredWords.filter(w => selectedIds.has(w.id));
      if (!chosen.length) return;
      if (kind === 'test') {
        onStartMasteredWordsQuiz(chosen.map(w => ({
          id: w.id, word: w.word, phonetic: w.phonetic, chinese: w.chinese,
          exampleSentence: w.exampleSentence, exampleSentenceCn: w.exampleSentenceCn,
        })), `${getSelectedGroupLabel()}（所选）`);
        exitSelection();
      } else if (kind === 'unmaster') {
        chosen.forEach(w => onMoveToWrongWords(w));
        exitSelection();
      } else if (window.confirm(`从熟词本删除所选的 ${chosen.length} 个单词？不会影响其他词本和生词本。`)) {
        chosen.forEach(w => onRemoveMasteredWord(w.id));
        exitSelection();
      }
    },
  };

  useEffect(() => {
    if (externalTarget === undefined) return;
    setSelectedListFilter(externalTarget === 'recent' ? 'recent' : 'all');
    setIsListOpen(true);
    setCurrentPage(1);
    exitSelection();
  }, [externalTarget]);
  useEffect(() => {
    if (!externalCommand) return;
    if (externalCommand.type === 'menu') {
      setSelectedListFilter((externalCommand.target ?? externalTarget) === 'recent' ? 'recent' : 'all');
      setIsBookMenuOpen(true);
    }
    onCommandHandled?.();
  }, [externalCommand?.id]);
  useEffect(() => {
    if (!mobile || !chrome) return;
    chrome.setSort({
      value: sortBy,
      options: [
        { value: 'recent', label: '最近掌握', description: '最近掌握的在前' },
        { value: 'alphabetical', label: '字母 A–Z', description: '按单词字母排列' },
      ],
      onChange: value => { setSortBy(value as typeof sortBy); setCurrentPage(1); },
    });
    return () => chrome.setSort(null);
  }, [mobile, sortBy]);
  useEffect(() => {
    if (!mobile || !chrome) return;
    if (!selectMode) { chrome.setSelection(null); return; }
    chrome.setSelection({
      count: selectedIds.size,
      total: filteredWords.length,
      toggleAll: () => selectionApi.current.toggleAll(),
      exit: exitSelection,
      actions: [
        { id: 'test', label: '测试', icon: Play, onClick: () => selectionApi.current.run('test') },
        { id: 'unmaster', label: '移回生词本', icon: RotateCcw, onClick: () => selectionApi.current.run('unmaster') },
      ],
      more: [{ id: 'delete', label: '从熟词本删除', danger: true, onClick: () => selectionApi.current.run('delete') }],
    });
  }, [mobile, selectMode, selectedIds, filteredWords.length]);
  useEffect(() => () => chrome?.setSelection(null), []);
  useBackHandler(() => { if (!selectMode) return false; exitSelection(); return true; }, 15);

  // Convert MasteredWordItem to WordItem for Quiz
  const handleStartQuiz = () => {
    const wordItems: WordItem[] = masteredWords.map((w) => ({
      id: w.id,
      word: w.word,
      phonetic: w.phonetic,
      chinese: w.chinese,
      exampleSentence: w.exampleSentence,
      exampleSentenceCn: w.exampleSentenceCn
    }));
    onStartMasteredWordsQuiz(wordItems);
  };

  const handleStartActiveListQuiz = () => {
    const wordItems: WordItem[] = activeWordSet.map((w) => ({
      id: w.id,
      word: w.word,
      phonetic: w.phonetic,
      chinese: w.chinese,
      exampleSentence: w.exampleSentence,
      exampleSentenceCn: w.exampleSentenceCn
    }));
    if (wordItems.length > 0) {
      onStartMasteredWordsQuiz(wordItems, getSelectedGroupLabel());
    }
  };

  // Export handlers
  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(exportWords, null, 2);
    void saveTextFile(jsonStr, `${getSelectedGroupLabel()}_WordMaster_${new Date().toISOString().slice(0, 10)}.json`, 'application/json').catch(() => window.alert('导出失败，请重新选择保存位置。'));
    setIsBookMenuOpen(false);
  };

  const handleExportCSV = () => {
    let csvContent = '\uFEFF单词,音标,中文释义,例句,中文例句,掌握时间\n';
    exportWords.forEach((item) => {
      const word = `"${(item.word || '').replace(/"/g, '""')}"`;
      const phonetic = `"${(item.phonetic || '').replace(/"/g, '""')}"`;
      const chinese = `"${(item.chinese || '').replace(/"/g, '""')}"`;
      const example = `"${(item.exampleSentence || '').replace(/"/g, '""')}"`;
      const exampleCn = `"${(item.exampleSentenceCn || '').replace(/"/g, '""')}"`;
      const dateStr = item.masteredAt ? new Date(item.masteredAt).toLocaleString() : '';
      csvContent += `${word},${phonetic},${chinese},${example},${exampleCn},${dateStr}\n`;
    });

    void saveTextFile(csvContent, `${getSelectedGroupLabel()}_WordMaster_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv').catch(() => window.alert('导出失败，请重新选择保存位置。'));
    setIsBookMenuOpen(false);
  };

  const [isEnriching, setIsEnriching] = useState<boolean>(false);
  const [importAutoEnrich, setImportAutoEnrich] = useState<boolean>(true);

  const resetImportModal = () => {
    setImportText('');
    setImportFilePayload(null);
    setImportStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const parseImportFile = (content: string, kind: 'json' | 'csv') =>
    kind === 'json' ? parseExportedWordMasterJson(content) : parseExportedWordMasterCsv(content);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lower = file.name.toLowerCase();
    const kind = lower.endsWith('.json') ? 'json' : lower.endsWith('.csv') ? 'csv' : null;
    if (!kind) {
      setImportStatus({ type: 'error', message: '仅支持 .json 或 .csv 文件（与导出格式一致）' });
      return;
    }

    setImportText('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const parsed = parseImportFile(content, kind);
      if (parsed.length > 0) {
        setImportFilePayload({ kind, content });
        setImportStatus({
          type: 'success',
          message: `已读取 ${parsed.length} 个单词（${kind.toUpperCase()}）`
        });
      } else {
        setImportFilePayload(null);
        setImportStatus({ type: 'error', message: '未能从文件中解析出有效单词，请检查文件格式。' });
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    const rawParsed = importFilePayload
      ? parseImportFile(importFilePayload.content, importFilePayload.kind)
      : parsePlainWordList(importText);

    if (rawParsed.length === 0) {
      setImportStatus({
        type: 'error',
        message: importFilePayload
          ? '未能从文件中解析出有效单词。'
          : '未能解析出有效单词。请确保每行仅包含一个英文单词。'
      });
      return;
    }

    setIsEnriching(true);
    try {
      let wordItems: WordItem[];

      if (importFilePayload && !importAutoEnrich) {
        wordItems = parsedToWordItems(rawParsed);
      } else if (importAutoEnrich) {
        wordItems = await enrichParsedWords(rawParsed, (msg) => {
          setImportStatus({ type: 'success', message: msg });
        });
      } else {
        wordItems = parsedToWordItems(rawParsed);
      }

      const finalWords: MasteredWordItem[] = wordItems.map((item) => ({
        id: item.id,
        word: item.word,
        phonetic: item.phonetic || '',
        chinese: item.chinese || item.word,
        exampleSentence: item.exampleSentence || '',
        exampleSentenceCn: item.exampleSentenceCn || '',
        masteredAt: Date.now()
      }));

      if (onImportMasteredWords) {
        onImportMasteredWords(finalWords);
      }

      resetImportModal();
      setIsImportModalOpen(false);
    } catch (err) {
      console.error('Import error:', err);
      setImportStatus({ type: 'error', message: err instanceof AiClientError ? err.message : '导入失败，请检查网络后重试。' });
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <div className={hideHeader ? 'space-y-6' : 'page-container space-y-6'}>
      {enrichError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{enrichError}</p>}
      
      {!hideHeader && (
      <PageHeader
        badge="已掌握词汇库"
        badgeIcon={Award}
        title={`熟词本 (${masteredWords.length})`}
        description={<>在测试中<b>连续答对 3 次</b>或手动标记的词汇均会收录于熟词本中。随时可发起温故知新强化复习！</>}
        action={
          masteredWords.length > 0 ? (
            <Button variant="success" onClick={handleStartQuiz}>
              <BookOpen className="w-4 h-4" />
              <span>对熟词发起巩固复习</span>
            </Button>
          ) : undefined
        }
      />
      )}


      {/* Word List Cards Grid */}
      {!isListOpen && <div className="notebook-list-cards space-y-4" {...longPress}>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            熟词本 · 系统分组
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Card 1: All Mastered Words List */}
            <div 
              data-book-target="all" role="button" tabIndex={0}
                onClick={() => { setSelectedListFilter('all'); setCurrentPage(1); openList(); }}
              className={`rounded-2xl p-5 transition-all cursor-pointer group space-y-3 ${
                selectedListFilter === 'all' ? listCardSelectedGreen : listCardUnselected
              }`}
            >
              <div className="notebook-card-heading flex items-center justify-between">
                <div className={selectedListFilter === 'all' ? listIconSelectedLg : listIconBoxLg}>
                  <Award className="w-5 h-5" />
                </div>
                <span className={`notebook-card-count px-2 py-0.5 text-xs rounded-full ${
                  selectedListFilter === 'all' ? listBadgeSelected : listBadgeUnselected
                }`}>
                  {masteredWords.length} 词
                </span>
              </div>
              <div className="notebook-card-content">
                <h3 className={`font-bold text-base transition-colors ${
                  selectedListFilter === 'all' ? listTitleSelected : listTitleUnselected
                }`}>
                  全量熟词列表
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  包含所有在测试中攻克并标记为已掌握的单词
                </p>
              </div>
              <div className={`pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs ${
                selectedListFilter === 'all' ? listFooterSelected : listFooterUnselected
              }`}>
                <span>进入列表明细</span>
                <span>→</span>
              </div>
            </div>

            {/* Card 2: Recent Mastered List */}
            <div 
              data-book-target="recent" role="button" tabIndex={0}
                onClick={() => { setSelectedListFilter('recent'); setCurrentPage(1); openList(); }}
              className={`rounded-2xl p-5 transition-all cursor-pointer group space-y-3 ${
                selectedListFilter === 'recent' ? listCardSelectedGreen : listCardUnselected
              }`}
            >
              <div className="notebook-card-heading flex items-center justify-between">
                <div className={selectedListFilter === 'recent' ? listIconSelectedLg : listIconBoxLg}>
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className={`notebook-card-count px-2 py-0.5 text-xs rounded-full ${
                  selectedListFilter === 'recent' ? listBadgeSelected : listBadgeUnselected
                }`}>
                  {recentMasteredWords.length} 词
                </span>
              </div>
              <div className="notebook-card-content">
                <h3 className={`font-bold text-base transition-colors ${
                  selectedListFilter === 'recent' ? listTitleSelected : listTitleUnselected
                }`}>
                  近期攻克熟词列表
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  近 7 天内成功攻克并加入熟词本的最新词汇
                </p>
              </div>
              <div className={`pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs ${
                selectedListFilter === 'recent' ? listFooterSelected : listFooterUnselected
              }`}>
                <span>巩固近 7 天战果</span>
                <span>→</span>
              </div>
            </div>

          </div>
        </div>}

      {isListOpen && <>
      {!mobile && <div className="notebook-detail-heading flex items-center gap-2">
        <button type="button" aria-label="返回词本" onClick={() => { setIsListOpen(false); setIsBookMenuOpen(false); window.scrollTo({ top: 0, behavior: 'instant' }); }} className="w-10 h-10 shrink-0 surface-card rounded-xl flex items-center justify-center text-secondary cursor-pointer">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-primary min-w-0 truncate">{getSelectedGroupLabel()}</h2>
      </div>}
      {/* Filter and Toolbar Bar */}
      {!mobile && <div className="notebook-toolbar flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 surface-card p-3.5 rounded-2xl shadow-card">

        {/* Search */}
        <div className="notebook-search-row contents">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="搜索熟词或中文解释..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl surface-input focus:outline-none focus:border-emerald-500 transition-all"
          />
        </div>

        {compactLayout && <SortMenu value={sortBy} onChange={value => { setSortBy(value); setCurrentPage(1); }} options={[
          { value: 'recent', label: '最近掌握', description: '最近掌握的在前' },
          { value: 'alphabetical', label: '字母 A–Z', description: '按单词字母排列' },
        ]} />}
        </div>

        {/* Action buttons share one compact Android row. */}
        <div className="notebook-actions flex flex-wrap items-center gap-2 justify-end">
          
          {/* Sort selector */}
          {!compactLayout && <div className="flex items-center gap-1.5 surface-muted px-2.5 py-1.5 border border-slate-200 dark:border-slate-600 rounded-xl">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e: any) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs font-medium bg-transparent text-primary focus:outline-none cursor-pointer"
            >
              <option value="recent">按最新掌握时间排序</option>
              <option value="alphabetical">按字母顺序 A-Z 排序</option>
            </select>
          </div>}

          {(activeWordSet.length > 0 || compactLayout) && (
            <button
              disabled={activeWordSet.length === 0}
              onClick={handleStartActiveListQuiz}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-xs rounded-xl shadow-xs hover:opacity-95 transition-all cursor-pointer"
              title={`对当前选中的「${getSelectedGroupLabel()}」发起测试`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>测试词本</span>
            </button>
          )}

        </div>
      </div>}

      {/* Words Grid */}
      {filteredWords.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={searchValue ? '未找到符合条件的熟词' : '熟词本暂无单词'}
          description={searchValue ? '尝试更换搜索关键字' : '在单词测试中连续答对 3 次即可将词汇自动录入熟词本，也可直接在此【导入词汇】！'}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedWords.map((item) => (
              <WordCard
                key={item.id}
                variant="emerald"
                word={item.word}
                phonetic={item.phonetic}
                phoneticUs={item.phoneticUs}
                phoneticUk={item.phoneticUk}
                speechAccent={speechAccent}
                chinese={item.chinese}
                exampleSentence={item.exampleSentence}
                exampleSentenceCn={item.exampleSentenceCn}
                isSpeaking={speakingWord === item.word}
                onSpeak={(e) => {
                  e?.stopPropagation();
                  speakWord(item.word, item.exampleSentence);
                }}
                onClick={() => speakWord(item.word, item.exampleSentence)}
                selectionMode={mobile && selectMode}
                selected={selectedIds.has(item.id)}
                onToggleSelect={mobile ? () => toggleSelect(item.id) : undefined}
                badge={
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>已掌握</span>
                  </div>
                }
                footer={
                  !item.exampleSentence ? (
                    <div className="flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-900/20 p-2.5 rounded-xl border border-dashed border-emerald-200/80 dark:border-emerald-700/50">
                      <span className="text-xs text-emerald-700/80 dark:text-emerald-300/80 italic font-medium">暂无例句与音标</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEnrichSingleWord(item);
                        }}
                        disabled={enrichingWordId === item.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-xs font-bold hover:shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        {enrichingWordId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        )}
                        <span>{enrichingWordId === item.id ? '补全中...' : '补全例句'}</span>
                      </button>
                    </div>
                  ) : undefined
                }
                actionsClassName="flex items-center justify-between w-full text-xs"
                actions={
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveToWrongWords(item);
                      }}
                      className="flex items-center gap-1.5 text-slate-500 hover:text-amber-600 transition-colors p-1 cursor-pointer font-medium"
                      title="移回待测试生词本重新练习"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                      <span>移回待测试生词本</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveMasteredWord(item.id);
                      }}
                      className="flex items-center gap-1 text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                      title="彻底删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>删除</span>
                    </button>
                  </>
                }
              />
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={filteredWords.length}
            onPageChange={(p) => {
              setCurrentPage(p);
              window.scrollTo({ top: compactLayout ? 0 : 150, behavior: 'smooth' });
            }}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
          />
        </div>
      )}

      </>}
      {isBookMenuOpen && <BookActionMenu name={getSelectedGroupLabel()} count={exportWords.length}
        onClose={() => setIsBookMenuOpen(false)} onImport={() => setIsImportModalOpen(true)}
        onExportJSON={handleExportJSON} onExportCSV={handleExportCSV} onTest={handleStartActiveListQuiz} />}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="surface-card rounded-2xl max-w-xl w-full p-6 shadow-elevated space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xl">
                <Upload className="w-5 h-5" />
                <span>批量导入到熟词本</span>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  resetImportModal();
                }}
                className="w-9 h-9 rounded-full border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 shadow-xs hover:border-brand-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">方法 1：上传 JSON / CSV 文件</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-emerald-300 dark:border-emerald-700 hover:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/20 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 p-4 rounded-xl text-center cursor-pointer transition-all space-y-1.5"
                >
                  <Upload className="w-7 h-7 text-emerald-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">点击上传文件 (.json, .csv)</p>
                  <p className="text-xs text-slate-400">与「导出词汇」格式一致：WordMaster 导出的 JSON 或 CSV</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">方法 2：粘贴纯单词列表</label>
                <textarea
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    setImportFilePayload(null);
                    if (importStatus) setImportStatus(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  rows={6}
                  placeholder={`每行一个英文单词，例如：

explore
curious
discover`}
                  className="w-full p-3.5 text-sm font-mono surface-input rounded-xl focus:outline-none focus:border-emerald-500 transition-all leading-relaxed"
                />
              </div>

              {/* Status Notice */}
              {importStatus && (
                <div className={`p-3.5 rounded-xl text-sm flex items-center gap-2 border ${
                  importStatus.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {isEnriching ? (
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
                  ) : importStatus.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{importStatus.message}</span>
                </div>
              )}

            </div>

            <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-3.5 py-2.5 rounded-lg border border-emerald-100 dark:border-emerald-800 shrink-0">
              导入单词至：{getSelectedGroupLabel()}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                disabled={isEnriching}
                onClick={() => {
                  setIsImportModalOpen(false);
                  resetImportModal();
                }}
                className="flex-1 px-5 py-2.5 text-sm font-semibold text-secondary surface-muted hover:opacity-90 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isEnriching || (!importFilePayload && !importText.trim())}
                className="flex-1 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isEnriching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>正在查询并补全...</span>
                  </>
                ) : (
                  <span>{importAutoEnrich ? '确认' : '快捷直接导入熟词本'}</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
