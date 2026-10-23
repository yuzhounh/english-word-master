import React, { useState, useRef, useEffect } from 'react';
import { 
  Bookmark, Search, Trash2, BookOpen, AlertTriangle, ChevronLeft,
  ArrowUpDown, CheckCircle2, Download, Upload, FileText, X, Plus,
  FileSpreadsheet, FileJson, Check, Sparkles, Loader2 
} from 'lucide-react';
import { WrongWordItem, WordItem, WordListGroup, SpeechAccent } from '../types';
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
import { WordCard } from './ui/WordCard';
import { EmptyState } from './ui/EmptyState';
import { speakEnglish } from '../lib/speech';
import { AiClientError } from '../lib/aiApi';
import { useBookLongPress } from '../hooks/useBookLongPress';
import { useBackHandler } from '../hooks/useBackHandler';
import { BookActionMenu } from './ui/BookActionMenu';
import { SortMenu } from './ui/SortMenu';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { saveTextFile } from '../lib/saveTextFile';
import { Play } from 'lucide-react';
import { useChromeActions, useChromeSearch } from './mobile/chrome';
import type { NotebookCommand } from '../types/navigation';

const parseNotebookTarget = (target: string): { filter: 'all' | 'high_error' | 'recent' | 'custom'; listId: string | null } =>
  target.startsWith('custom:') ? { filter: 'custom', listId: target.slice(7) }
    : { filter: target === 'high_error' || target === 'recent' ? target : 'all', listId: null };

interface WrongWordsListProps {
  /** Phone layout: the shell chooses the list ('all' | 'high_error' | 'recent' | 'custom:<id>'). */
  externalTarget?: string;
  externalCommand?: NotebookCommand | null;
  onCommandHandled?: () => void;
  /** Phone layout: switch the shell to another list (e.g. the one just created). */
  onNavigate?: (target: string) => void;
  wrongWords: WrongWordItem[];
  masteredWordIds?: string[];
  customWordLists?: WordListGroup[];
  hideHeader?: boolean;
  onRemoveWrongWord: (wordId: string) => void;
  onStartWrongWordsQuiz: (words: WordItem[], bookName?: string) => void;
  onImportWrongWords?: (words: WrongWordItem[]) => void;
  onImportToWordList?: (words: WordItem[], listName: string, listId?: string | null) => void;
  onDeleteCustomList?: (listId: string) => void;
  onCreateCustomList?: (listName: string) => string | null;
  speechAccent?: SpeechAccent;
}

export const WrongWordsList: React.FC<WrongWordsListProps> = ({
  externalTarget,
  externalCommand,
  onCommandHandled,
  onNavigate,
  wrongWords,
  masteredWordIds = [],
  customWordLists = [],
  hideHeader = false,
  onRemoveWrongWord,
  onStartWrongWordsQuiz,
  onImportWrongWords,
  onImportToWordList,
  onDeleteCustomList,
  onCreateCustomList,
  speechAccent = 'en-US',
}) => {
  const compactLayout = useCompactLayout();
  const chrome = useChromeActions();
  const chromeSearch = useChromeSearch();
  const mobile = externalTarget !== undefined && !!chrome;
  const listCardSelectedBlue =
    'border border-brand-200/80 dark:border-brand-700/40 !bg-brand-50/90 dark:!bg-brand-900/30 shadow-sm ring-1 ring-brand-200/60 dark:ring-brand-600/20';
  const listCardUnselected =
    'surface-card shadow-xs hover:border-brand-200/60 dark:hover:border-brand-700/40 hover:shadow-sm';
  const listIconBoxLg =
    'p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors';
  const listIconBoxSm =
    'p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors';
  const listIconSelectedLg = 'p-3 rounded-xl bg-brand-600 text-white transition-colors';
  const listIconSelectedSm = 'p-2.5 rounded-xl bg-brand-600 text-white transition-colors';
  const listBadgeSelected = 'font-semibold bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300';
  const listBadgeUnselected = 'font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
  const listTitleSelected = 'text-brand-700 dark:text-brand-300';
  const listTitleUnselected = 'text-slate-700 dark:text-slate-300 group-hover:text-brand-600 dark:group-hover:text-brand-400';
  const listFooterSelected = 'font-semibold text-brand-600 dark:text-brand-400';
  const listFooterUnselected = 'font-medium text-slate-500 dark:text-slate-400';

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'errorCount' | 'recent' | 'alphabetical'>('errorCount');
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
  const [deletingListForConfirm, setDeletingListForConfirm] = useState<WordListGroup | null>(null);
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [createListError, setCreateListError] = useState<string | null>(null);

  const handleConfirmCreateList = () => {
    const name = newListName.trim();
    if (!name) {
      setCreateListError('请输入词本名称');
      return;
    }
    if (!onCreateCustomList) return;
    const newId = onCreateCustomList(name);
    if (!newId) {
      setCreateListError('该词本名称已存在，请换一个名称');
      return;
    }
    setSelectedCustomListId(newId);
    setSelectedListFilter('custom');
    setCurrentPage(1);
    if (externalTarget !== undefined) onNavigate?.(`custom:${newId}`);
    setIsCreateListModalOpen(false);
    setNewListName('');
    setCreateListError(null);
  };

  const handleEnrichSingleWord = async (item: WrongWordItem) => {
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
        const updatedList = wrongWords.map(w => {
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
        if (onImportWrongWords) {
          onImportWrongWords(updatedList);
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
        const updatedList = wrongWords.map(w => {
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
        if (onImportWrongWords) {
          onImportWrongWords(updatedList);
        }
      }
    } catch (err) {
      console.error('Bulk enrich failed:', err);
      setEnrichError(err instanceof AiClientError ? err.message : 'AI 补全失败，请稍后重试。');
    } finally {
      setIsBulkEnriching(false);
    }
  };

  // Pronounce with Android native TTS in the APK and browser TTS on the web.
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  const speakWord = (word: string, exampleSentence?: string) => {
    void speakEnglish([word, exampleSentence], {
      language: speechAccent,
      delayMs: 80,
      onTextStart: () => setSpeakingWord(word),
      onEnd: () => setSpeakingWord(null),
      onError: () => setSpeakingWord(null),
    });
  };

  const initialTarget = externalTarget !== undefined ? parseNotebookTarget(externalTarget) : null;
  const [selectedListFilter, setSelectedListFilter] = useState<'all' | 'high_error' | 'recent' | 'custom'>(initialTarget?.filter ?? 'all');
  const [selectedCustomListId, setSelectedCustomListId] = useState<string | null>(initialTarget?.listId ?? null);
  const [isListOpen, setIsListOpen] = useState(externalTarget !== undefined);
  const openList = () => {
    setIsListOpen(true);
    setSearchTerm('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Computed sub-lists
  const highErrorWords = wrongWords.filter(w => w.errorCount >= 2);
  const recentWords = wrongWords.filter(
    w => (w.errorCount || 0) > 0 && Date.now() - (w.lastErrorAt || w.createdAt) <= 7 * 86400000,
  );
  const selectedCustomList = customWordLists.find(l => l.id === selectedCustomListId);

  const getSelectedGroupLabel = (): string => {
    if (selectedListFilter === 'custom' && selectedCustomList) return selectedCustomList.name;
    if (selectedListFilter === 'high_error') return '顽固高频难词列表';
    if (selectedListFilter === 'recent') return '近期新增错题列表';
    return '全量生词列表';
  };

  // Active word set depending on filter selection
  let activeWordSet: WrongWordItem[] = wrongWords;
  if (selectedListFilter === 'high_error') {
    activeWordSet = highErrorWords;
  } else if (selectedListFilter === 'recent') {
    activeWordSet = recentWords;
  } else if (selectedListFilter === 'custom' && selectedCustomList) {
    const listWordsMap = new Map<string, WordItem>(selectedCustomList.words.map(w => [(w.id || w.word).toLowerCase().trim(), w]));
    
    // Merge existing wrongWords with selectedCustomList words so new AI example sentences appear
    const matchedWrong = wrongWords
      .filter(w => listWordsMap.has(w.id.toLowerCase().trim()))
      .map(w => {
        const customW = listWordsMap.get(w.id.toLowerCase().trim());
        return {
          ...w,
          phonetic: w.phonetic || customW?.phonetic || '',
          chinese: w.chinese || customW?.chinese || '',
          exampleSentence: w.exampleSentence || customW?.exampleSentence || '',
          exampleSentenceCn: w.exampleSentenceCn || customW?.exampleSentenceCn || ''
        };
      });

    const unMatchedListWords: WrongWordItem[] = selectedCustomList.words
      .filter(w => !wrongWords.some(mw => mw.id.toLowerCase().trim() === (w.id || w.word).toLowerCase().trim()))
      .map(w => ({
        id: (w.id || w.word).toLowerCase().trim(),
        word: w.word,
        phonetic: w.phonetic || '',
        chinese: w.chinese || w.word,
        exampleSentence: w.exampleSentence || '',
        exampleSentenceCn: w.exampleSentenceCn || '',
        errorCount: (w as any).errorCount || 0,
        lastErrorAt: Date.now(),
        createdAt: Date.now()
      }));
    activeWordSet = [...matchedWrong, ...unMatchedListWords];
  }

  if (selectedCustomList?.sourceType === 'built_in') {
    const masteredIds = new Set(masteredWordIds);
    activeWordSet = activeWordSet.filter(word => !masteredIds.has(word.id));
  }

  const longPress = useBookLongPress(target => {
    if (target.startsWith('custom:')) {
      setSelectedCustomListId(target.slice(7)); setSelectedListFilter('custom');
    } else {
      setSelectedCustomListId(null); setSelectedListFilter(target as 'all' | 'high_error' | 'recent');
    }
    setIsBookMenuOpen(true);
  });
  useBackHandler(() => {
    if (deletingListForConfirm) { setDeletingListForConfirm(null); return true; }
    if (isCreateListModalOpen) { setIsCreateListModalOpen(false); return true; }
    if (isImportModalOpen) { if (!isEnriching) setIsImportModalOpen(false); return true; }
    if (isListOpen && !mobile) { setIsListOpen(false); window.scrollTo(0, 0); return true; }
    return false;
  });
  const exportWords = selectedListFilter === 'custom' && selectedCustomList ? selectedCustomList.words : activeWordSet;

  // Filter & Sort
  const searchValue = mobile ? chromeSearch : searchTerm;
  const filteredWords = activeWordSet
    .filter((w) =>
      w.word.toLowerCase().includes(searchValue.toLowerCase().trim()) ||
      w.chinese.includes(searchValue.trim())
    )
    .sort((a, b) => {
      if (sortBy === 'errorCount') {
        return b.errorCount - a.errorCount;
      } else if (sortBy === 'recent') {
        return (b.lastErrorAt || b.createdAt) - (a.lastErrorAt || a.createdAt);
      } else {
        return a.word.localeCompare(b.word);
      }
    });

  const isAllWrong = pageSize <= 0 || pageSize >= filteredWords.length;
  const pageStartIndexWrong = isAllWrong ? 0 : (currentPage - 1) * pageSize;
  const paginatedWords = isAllWrong ? filteredWords : filteredWords.slice(pageStartIndexWrong, pageStartIndexWrong + pageSize);

  // Phone list selection (long press or avatar tap), driven from the shell's title bar and bottom bar.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const exitSelection = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const toggleSelect = (id: string) => {
    setSelectMode(true);
    setSelectedIds(previous => { const next = new Set(previous); if (!next.delete(id)) next.add(id); return next; });
  };
  const toWordItems = (items: WrongWordItem[]): WordItem[] => items.map(w => ({
    id: w.id, word: w.word, phonetic: w.phonetic, chinese: w.chinese,
    exampleSentence: w.exampleSentence, exampleSentenceCn: w.exampleSentenceCn,
  }));
  const selectionApi = useRef({ run: (_: 'test' | 'master' | 'enrich') => {}, toggleAll: () => {} });
  selectionApi.current = {
    toggleAll: () => setSelectedIds(previous =>
      previous.size === filteredWords.length ? new Set() : new Set(filteredWords.map(w => w.id))),
    run: kind => {
      const chosen = filteredWords.filter(w => selectedIds.has(w.id));
      if (!chosen.length) return;
      if (kind === 'test') { onStartWrongWordsQuiz(toWordItems(chosen), `${getSelectedGroupLabel()}（所选）`); exitSelection(); }
      else if (kind === 'master') { chosen.forEach(w => onRemoveWrongWord(w.id)); exitSelection(); }
      else void (async () => {
        setEnrichError(null);
        try {
          const missing = chosen.filter(w => !w.exampleSentence?.trim());
          if (!missing.length) return;
          const enriched = await enrichWordsWithDictionaryFallback(missing.map(w => ({ word: w.word, chinese: w.chinese, phonetic: w.phonetic })));
          const byWord = new Map(enriched.map(e => [e.word.toLowerCase().trim(), e]));
          onImportWrongWords?.(wrongWords.map(w => {
            const match = byWord.get(w.id.toLowerCase().trim());
            return match ? {
              ...w, phonetic: match.phonetic || w.phonetic, chinese: match.chinese || w.chinese,
              exampleSentence: match.exampleSentence || w.exampleSentence, exampleSentenceCn: match.exampleSentenceCn || w.exampleSentenceCn,
            } : w;
          }));
          exitSelection();
        } catch (err) {
          setEnrichError(err instanceof AiClientError ? err.message : 'AI 补全失败，请稍后重试。');
        }
      })();
    },
  };

  useEffect(() => {
    if (externalTarget === undefined) return;
    const target = parseNotebookTarget(externalTarget);
    setSelectedListFilter(target.filter);
    setSelectedCustomListId(target.listId);
    setIsListOpen(true);
    setCurrentPage(1);
    exitSelection();
  }, [externalTarget]);
  useEffect(() => {
    if (!externalCommand) return;
    if (externalCommand.type === 'menu') {
      const target = parseNotebookTarget(externalCommand.target ?? externalTarget ?? 'all');
      setSelectedListFilter(target.filter);
      setSelectedCustomListId(target.listId);
      setIsBookMenuOpen(true);
    } else {
      setNewListName('');
      setCreateListError(null);
      setIsCreateListModalOpen(true);
    }
    onCommandHandled?.();
  }, [externalCommand?.id]);
  useEffect(() => {
    if (!mobile || !chrome) return;
    chrome.setSort({
      value: sortBy,
      options: [
        { value: 'errorCount', label: '出错次数', description: '次数多的在前' },
        { value: 'recent', label: '最近出错', description: '最近出错的在前' },
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
        { id: 'master', label: '已掌握', icon: CheckCircle2, onClick: () => selectionApi.current.run('master') },
      ],
      more: [{ id: 'enrich', label: '补全例句与音标', onClick: () => selectionApi.current.run('enrich') }],
    });
  }, [mobile, selectMode, selectedIds, filteredWords.length]);
  useEffect(() => () => chrome?.setSelection(null), []);
  useBackHandler(() => { if (!selectMode) return false; exitSelection(); return true; }, 15);

  // Convert WrongWordItem to WordItem for Quiz
  const handleStartQuiz = () => {
    const wordItems: WordItem[] = wrongWords.map((w) => ({
      id: w.id,
      word: w.word,
      phonetic: w.phonetic,
      chinese: w.chinese,
      exampleSentence: w.exampleSentence,
      exampleSentenceCn: w.exampleSentenceCn
    }));
    onStartWrongWordsQuiz(wordItems);
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
      onStartWrongWordsQuiz(wordItems, getSelectedGroupLabel());
    }
  };

  // Export handlers
  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(exportWords, null, 2);
    void saveTextFile(jsonStr, `${getSelectedGroupLabel()}_WordMaster_${new Date().toISOString().slice(0, 10)}.json`, 'application/json').catch(() => window.alert('导出失败，请重新选择保存位置。'));
    setIsBookMenuOpen(false);
  };

  const handleExportCSV = () => {
    let csvContent = '\uFEFF单词,音标,中文释义,例句,中文例句,出错次数\n';
    exportWords.forEach((item) => {
      const word = `"${(item.word || '').replace(/"/g, '""')}"`;
      const phonetic = `"${(item.phonetic || '').replace(/"/g, '""')}"`;
      const chinese = `"${(item.chinese || '').replace(/"/g, '""')}"`;
      const example = `"${(item.exampleSentence || '').replace(/"/g, '""')}"`;
      const exampleCn = `"${(item.exampleSentenceCn || '').replace(/"/g, '""')}"`;
      const count = item.errorCount ?? 0;
      csvContent += `${word},${phonetic},${chinese},${example},${exampleCn},${count}\n`;
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

      const importErrorCount = selectedListFilter === 'high_error' ? 2 : 0;

      const finalWords: WrongWordItem[] = wordItems.map((item) => ({
        id: item.id,
        word: item.word,
        phonetic: item.phonetic || '',
        chinese: item.chinese || item.word,
        exampleSentence: item.exampleSentence || '',
        exampleSentenceCn: item.exampleSentenceCn || '',
        errorCount: importErrorCount,
        lastErrorAt: Date.now(),
        createdAt: Date.now()
      }));

      if (selectedListFilter === 'custom' && selectedCustomList && onImportToWordList) {
        onImportToWordList(wordItems, selectedCustomList.name, selectedCustomList.id);
      }
      if (onImportWrongWords) {
        onImportWrongWords(finalWords);
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
        badge="待测试生词本"
        badgeIcon={Bookmark}
        title={`待测试生词本 (${wrongWords.length})`}
        description={<>文本提取的词汇与测试答错的单词均会自动收录于此。<b>在测试中答对即可标记【已掌握】并自动移出生词本</b>！</>}
        action={
          wrongWords.length > 0 ? (
            <Button onClick={handleStartQuiz}>
              <BookOpen className="w-4 h-4" />
              <span>对生词发起强化测试</span>
            </Button>
          ) : undefined
        }
      />
      )}


      {/* Word List Cards Grid */}
      {!isListOpen && <div className="notebook-list-cards space-y-6" {...longPress}>
          
          {/* Smart Classification Lists */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>生词本 · 系统分组</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Card 1: All Wrong Words List */}
              <div 
                data-book-target="all" role="button" tabIndex={0}
                onClick={() => { setSelectedListFilter('all'); setSelectedCustomListId(null); setCurrentPage(1); openList(); }}
                className={`rounded-2xl p-5 transition-all cursor-pointer group space-y-3 ${
                  selectedListFilter === 'all' ? listCardSelectedBlue : listCardUnselected
                }`}
              >
                <div className="notebook-card-heading flex items-center justify-between">
                  <div className={selectedListFilter === 'all' ? listIconSelectedLg : listIconBoxLg}>
                    <Bookmark className="w-5 h-5" />
                  </div>
                  <span className={`notebook-card-count px-2 py-0.5 text-xs rounded-full ${
                    selectedListFilter === 'all' ? listBadgeSelected : listBadgeUnselected
                  }`}>
                    {wrongWords.length} 词
                  </span>
                </div>
                <div className="notebook-card-content">
                  <h3 className={`font-bold text-base transition-colors ${
                    selectedListFilter === 'all' ? listTitleSelected : listTitleUnselected
                  }`}>
                    全量生词列表
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    包含文章提取与测试答错的所有待掌握生词
                  </p>
                </div>
                <div className={`pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs ${
                  selectedListFilter === 'all' ? listFooterSelected : listFooterUnselected
                }`}>
                  <span>进入列表明细</span>
                  <span>→</span>
                </div>
              </div>

              {/* Card 2: High Error List */}
              <div 
                data-book-target="high_error" role="button" tabIndex={0}
                onClick={() => { setSelectedListFilter('high_error'); setSelectedCustomListId(null); setCurrentPage(1); openList(); }}
                className={`rounded-2xl p-5 transition-all cursor-pointer group space-y-3 ${
                  selectedListFilter === 'high_error'
                    ? 'border border-rose-200 dark:border-rose-800/50 !bg-rose-50/90 dark:!bg-rose-950/25 shadow-sm ring-1 ring-rose-200/70 dark:ring-rose-700/25'
                    : listCardUnselected
                }`}
              >
                <div className="notebook-card-heading flex items-center justify-between">
                  <div className={`p-3 rounded-xl transition-colors ${
                    selectedListFilter === 'high_error'
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:text-rose-500 dark:group-hover:text-rose-400'
                  }`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <span className={`notebook-card-count px-2 py-0.5 text-xs rounded-full ${
                    selectedListFilter === 'high_error'
                      ? 'font-semibold bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300'
                      : 'font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {highErrorWords.length} 词
                  </span>
                </div>
                <div className="notebook-card-content">
                  <h3 className={`font-bold text-base transition-colors ${
                    selectedListFilter === 'high_error'
                      ? 'text-rose-700 dark:text-rose-300'
                      : 'text-slate-700 dark:text-slate-300 group-hover:text-rose-600/90'
                  }`}>
                    顽固高频难词列表
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    连续错2次及以上的难记高频易错词集
                  </p>
                </div>
                <div className={`pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs ${
                  selectedListFilter === 'high_error'
                    ? 'font-semibold text-rose-600 dark:text-rose-400'
                    : 'font-medium text-slate-500 dark:text-slate-400'
                }`}>
                  <span>专项攻克难词</span>
                  <span>→</span>
                </div>
              </div>

              {/* Card 3: Recent List */}
              <div 
                data-book-target="recent" role="button" tabIndex={0}
                onClick={() => { setSelectedListFilter('recent'); setSelectedCustomListId(null); setCurrentPage(1); openList(); }}
                className={`rounded-2xl p-5 transition-all cursor-pointer group space-y-3 ${
                  selectedListFilter === 'recent' ? listCardSelectedBlue : listCardUnselected
                }`}
              >
                <div className="notebook-card-heading flex items-center justify-between">
                  <div className={selectedListFilter === 'recent' ? listIconSelectedLg : listIconBoxLg}>
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className={`notebook-card-count px-2 py-0.5 text-xs rounded-full ${
                    selectedListFilter === 'recent' ? listBadgeSelected : listBadgeUnselected
                  }`}>
                    {recentWords.length} 词
                  </span>
                </div>
                <div className="notebook-card-content">
                  <h3 className={`font-bold text-base transition-colors ${
                    selectedListFilter === 'recent' ? listTitleSelected : listTitleUnselected
                  }`}>
                    近期新增错题列表
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    近 7 天内测试答错收录的最新词汇
                  </p>
                </div>
                <div className={`pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs ${
                  selectedListFilter === 'recent' ? listFooterSelected : listFooterUnselected
                }`}>
                  <span>及时巩固复习</span>
                  <span>→</span>
                </div>
              </div>

            </div>
          </div>

          {/* Custom Word Lists Section */}
          <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex flex-col items-start gap-1">
                <span>词本 ({customWordLists.length})</span>
                {!compactLayout && <span className="text-xs text-slate-400 normal-case font-normal">内置词集、官方词库导入或自定义词本</span>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customWordLists.map((list) => {
                  const isSelected = selectedListFilter === 'custom' && selectedCustomListId === list.id;
                  return (
                  <div 
                    key={list.id}
                    data-book-target={`custom:${list.id}`} role="button" tabIndex={0}
                    onClick={() => {
                      setSelectedCustomListId(list.id);
                      setSelectedListFilter('custom');
                      setCurrentPage(1);
                      openList();
                    }}
                    className={`rounded-2xl p-5 transition-all group space-y-3 relative flex flex-col justify-between cursor-pointer ${
                      isSelected ? listCardSelectedBlue : listCardUnselected
                    }`}
                  >
                    <div className="notebook-card-content">
                      <div className="notebook-card-heading flex items-center justify-between mb-2">
                        <div className={isSelected ? listIconSelectedSm : listIconBoxSm}>
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="notebook-card-controls flex items-center gap-1.5">
                          <span className={`notebook-card-count px-2.5 py-0.5 text-xs rounded-full border ${
                            isSelected
                              ? `${listBadgeSelected} border-brand-200 dark:border-brand-800`
                              : 'font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700'
                          }`}>
                            {list.words.length} 词
                          </span>
                        </div>
                      </div>

                      <h3 className={`font-bold text-base transition-colors line-clamp-1 ${
                        isSelected ? listTitleSelected : listTitleUnselected
                      }`}>
                        {list.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {list.description || `包含 ${list.words.length} 个单词，导入于 ${new Date(list.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>

                    <div className={`pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs ${
                      isSelected ? listFooterSelected : listFooterUnselected
                    }`}>
                      <span>查看明细</span>
                      <span>→</span>
                    </div>
                  </div>
                  );
                })}

                {onCreateCustomList && (
                  <div
                    onClick={() => {
                      setNewListName('');
                      setCreateListError(null);
                      setIsCreateListModalOpen(true);
                    }}
                    className="rounded-2xl p-5 border-2 border-dashed border-slate-200/80 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/40 dark:bg-slate-800/20 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-all group space-y-3 relative flex flex-col justify-between cursor-pointer min-h-[168px]"
                  >
                    <div className="notebook-card-create flex flex-col items-center justify-center flex-1 text-center space-y-2 py-2">
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        <Plus className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-base text-slate-700 dark:text-slate-300">新建空白词本</h3>
                      <p className="text-xs text-slate-400 px-2">创建后可导入或粘贴单词</p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span>点击创建</span>
                      <span>→</span>
                    </div>
                  </div>
                )}
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
            placeholder="搜索单词或中文解释..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl surface-input focus:outline-none focus:border-brand-500 transition-all"
          />
        </div>

        {compactLayout && <SortMenu value={sortBy} onChange={value => { setSortBy(value); setCurrentPage(1); }} options={[
          { value: 'errorCount', label: '出错次数', description: '次数多的在前' },
          { value: 'recent', label: '最近出错', description: '最近出错的在前' },
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
              <option value="errorCount">按出错次数排序</option>
              <option value="recent">按最新出错时间排序</option>
              <option value="alphabetical">按字母顺序 A-Z 排序</option>
            </select>
          </div>}

          {(activeWordSet.length > 0 || compactLayout) && (
            <button
              disabled={activeWordSet.length === 0}
              onClick={handleStartActiveListQuiz}
              className="flex items-center gap-1.5 px-3 py-2 gradient-brand text-white font-semibold text-xs rounded-xl shadow-xs hover:opacity-95 transition-all cursor-pointer"
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
          title={searchValue ? '未找到符合条件的生词' : '生词本暂无记录'}
          description={searchValue ? '尝试更换搜索关键字' : '在单词测试中答错的词汇会自动记录在这里，也可以通过【导入词汇】快捷批量添加。'}
          descriptionClassName={searchTerm ? undefined : 'max-w-none whitespace-nowrap overflow-x-auto text-xs sm:text-sm px-2'}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedWords.map((item) => (
              <WordCard
                key={item.id}
                word={item.word}
                phonetic={item.phonetic}
                phoneticUs={item.phoneticUs}
                phoneticUk={item.phoneticUk}
                speechAccent={speechAccent}
                chinese={item.chinese}
                exampleSentence={item.exampleSentence}
                exampleSentenceCn={item.exampleSentenceCn}
                isSpeaking={speakingWord === item.word}
                onSpeak={() => speakWord(item.word, item.exampleSentence)}
                onClick={() => speakWord(item.word, item.exampleSentence)}
                selectionMode={mobile && selectMode}
                selected={selectedIds.has(item.id)}
                onToggleSelect={mobile ? () => toggleSelect(item.id) : undefined}
                badge={
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    (item.errorCount || 0) > 0
                      ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-800'
                      : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800'
                  }`}>
                    {(item.errorCount || 0) > 0 ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{(item.errorCount || 0) > 0 ? `选错 ${item.errorCount} 次` : '新词'}</span>
                  </div>
                }
                footer={
                  !item.exampleSentence ? (
                    <div className="flex items-center justify-between bg-brand-50/50 dark:bg-brand-900/20 p-2.5 rounded-xl border border-dashed border-brand-200/80 dark:border-brand-700/50">
                      <span className="text-xs text-brand-800/80 dark:text-brand-300 italic font-medium">暂无例句与音标</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEnrichSingleWord(item); }}
                        disabled={enrichingWordId === item.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 gradient-brand text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        {enrichingWordId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>补全信息</span>
                      </button>
                    </div>
                  ) : undefined
                }
                actions={
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveWrongWord(item.id);
                    }}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-600 transition-colors p-1 cursor-pointer font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>标记已掌握</span>
                  </button>
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
        onExportJSON={handleExportJSON} onExportCSV={handleExportCSV} onTest={handleStartActiveListQuiz}
        onDelete={selectedCustomList && onDeleteCustomList ? () => setDeletingListForConfirm(selectedCustomList) : undefined} />}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="surface-card rounded-2xl max-w-xl w-full p-6 shadow-elevated space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-brand-700 font-bold text-xl">
                <Upload className="w-5 h-5" />
                <span>批量导入到生词本</span>
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

              {/* File upload prompt */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">方法 1：上传 JSON / CSV 文件</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-brand-300 dark:border-brand-700 hover:border-brand-500 dark:hover:border-brand-500 bg-brand-50/40 dark:bg-brand-900/20 hover:bg-brand-50 dark:hover:bg-brand-900/40 p-4 rounded-xl text-center cursor-pointer transition-all space-y-1.5"
                >
                  <Upload className="w-7 h-7 text-brand-600 mx-auto" />
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

              {/* Text input prompt */}
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
                  className="w-full p-3.5 text-sm font-mono surface-input rounded-xl focus:outline-none focus:border-brand-500 transition-all leading-relaxed"
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
                    <Loader2 className="w-4 h-4 text-brand-600 animate-spin shrink-0" />
                  ) : importStatus.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{importStatus.message}</span>
                </div>
              )}

            </div>

            <div className="text-sm font-medium text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 px-3.5 py-2.5 rounded-lg border border-brand-100 dark:border-brand-800 shrink-0">
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
                className="flex-1 px-5 py-2.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isEnriching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>正在查询并补全...</span>
                  </>
                ) : (
                  <span>{importAutoEnrich ? '确认' : '直接导入'}</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Create Custom List Modal */}
      {isCreateListModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="surface-card rounded-3xl p-6 max-w-md w-full shadow-elevated space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-brand-700 font-bold text-lg">
                <Plus className="w-5 h-5" />
                <span>新建空白词本</span>
              </div>
              <button
                onClick={() => {
                  setIsCreateListModalOpen(false);
                  setNewListName('');
                  setCreateListError(null);
                }}
                className="p-1 text-muted hover:text-primary rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">词本名称</label>
              <input
                type="text"
                value={newListName}
                onChange={(e) => {
                  setNewListName(e.target.value);
                  if (createListError) setCreateListError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmCreateList()}
                placeholder="例如：七年级上册"
                autoFocus
                className="w-full px-3.5 py-2.5 text-sm rounded-xl surface-input focus:outline-none focus:border-brand-500 transition-all"
              />
              {createListError && (
                <p className="text-sm text-rose-600">{createListError}</p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setIsCreateListModalOpen(false);
                  setNewListName('');
                  setCreateListError(null);
                }}
                className="flex-1 px-5 py-2.5 text-sm font-semibold text-secondary surface-muted hover:opacity-90 rounded-xl transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleConfirmCreateList}
                disabled={!newListName.trim()}
                className="flex-1 px-5 py-2.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md transition-all cursor-pointer"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Custom List Confirmation Modal */}
      {deletingListForConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setDeletingListForConfirm(null)}>
          <div role="dialog" aria-modal="true" aria-label="删除词本" className="surface-card rounded-3xl p-5 max-w-sm w-full shadow-elevated space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-primary">删除词本《{deletingListForConfirm.name}》？</h3>
            <p className="text-sm text-secondary">删除此词本及其中的 {deletingListForConfirm.words.length} 个词条。其他词本中的相同单词及学习记录会保留。</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeletingListForConfirm(null)} className="px-4 py-2 rounded-xl surface-muted text-secondary">取消</button>
              <button type="button" onClick={() => { onDeleteCustomList?.(deletingListForConfirm.id); setDeletingListForConfirm(null); setSelectedCustomListId(null); setSelectedListFilter('all'); if (externalTarget !== undefined) onNavigate?.('all'); else setIsListOpen(false); }} className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold">确认删除</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
