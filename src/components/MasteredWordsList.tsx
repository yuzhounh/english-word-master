import React, { useState, useRef, useCallback } from 'react';
import { WordCard } from './ui/WordCard';
import { 
  Award, Search, Trash2, BookOpen, ArrowUpDown, 
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
  enrichWordsWithAI
} from '../utils/wordParser';
import { Pagination } from './Pagination';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { speakEnglish } from '../lib/speech';
import { useClickOutside } from '../hooks/useClickOutside';

interface MasteredWordsListProps {
  masteredWords: MasteredWordItem[];
  hideHeader?: boolean;
  onRemoveMasteredWord: (wordId: string) => void;
  onMoveToWrongWords: (word: MasteredWordItem) => void;
  onStartMasteredWordsQuiz: (words: WordItem[]) => void;
  onClearAllMasteredWords?: () => void;
  onImportMasteredWords?: (words: MasteredWordItem[]) => void;
  speechAccent?: SpeechAccent;
}

export const MasteredWordsList: React.FC<MasteredWordsListProps> = ({
  masteredWords,
  hideHeader = false,
  onRemoveMasteredWord,
  onMoveToWrongWords,
  onStartMasteredWordsQuiz,
  onClearAllMasteredWords,
  onImportMasteredWords,
  speechAccent = 'en-US',
}) => {
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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);

  // Modals & Popups
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importFilePayload, setImportFilePayload] = useState<{ kind: 'json' | 'csv'; content: string } | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const closeExportMenu = useCallback(() => setIsExportMenuOpen(false), []);
  useClickOutside(exportMenuRef, closeExportMenu, isExportMenuOpen);

  // AI enrichment state
  const [enrichingWordId, setEnrichingWordId] = useState<string | null>(null);
  const [isBulkEnriching, setIsBulkEnriching] = useState<boolean>(false);

  const handleEnrichSingleWord = async (item: MasteredWordItem) => {
    setEnrichingWordId(item.id);
    try {
      const enriched = await enrichWordsWithAI([{
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
    } finally {
      setEnrichingWordId(null);
    }
  };

  const handleBulkEnrichWords = async () => {
    const missingWords = activeWordSet.filter(w => !w.exampleSentence || !w.exampleSentence.trim());
    if (missingWords.length === 0 || isBulkEnriching) return;
    setIsBulkEnriching(true);
    try {
      const enriched = await enrichWordsWithAI(missingWords.map(w => ({
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

  const [selectedListFilter, setSelectedListFilter] = useState<'all' | 'recent'>('all');

  // Computed sub-lists
  const recentMasteredWords = masteredWords.filter(w => Date.now() - (w.masteredAt || 0) <= 7 * 86400000);

  const getSelectedGroupLabel = (): string =>
    selectedListFilter === 'recent' ? '近期攻克熟词列表' : '全量熟词列表';

  // Active word set depending on filter selection
  const activeWordSet = selectedListFilter === 'recent' ? recentMasteredWords : masteredWords;

  // Filter & Sort
  const filteredWords = activeWordSet
    .filter((w) =>
      w.word.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      w.chinese.includes(searchTerm.trim())
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
      onStartMasteredWordsQuiz(wordItems);
    }
  };

  // Export handlers
  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(masteredWords, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `熟词本_WordMaster_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
  };

  const handleExportCSV = () => {
    let csvContent = '\uFEFF单词,音标,中文释义,例句,中文例句,掌握时间\n';
    masteredWords.forEach((item) => {
      const word = `"${(item.word || '').replace(/"/g, '""')}"`;
      const phonetic = `"${(item.phonetic || '').replace(/"/g, '""')}"`;
      const chinese = `"${(item.chinese || '').replace(/"/g, '""')}"`;
      const example = `"${(item.exampleSentence || '').replace(/"/g, '""')}"`;
      const exampleCn = `"${(item.exampleSentenceCn || '').replace(/"/g, '""')}"`;
      const dateStr = item.masteredAt ? new Date(item.masteredAt).toLocaleString() : '';
      csvContent += `${word},${phonetic},${chinese},${example},${exampleCn},${dateStr}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `熟词本_WordMaster_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
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
      setImportStatus({ type: 'error', message: '导入失败，请检查网络后重试。' });
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <div className={hideHeader ? 'space-y-6' : 'page-container space-y-6'}>
      
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
      <div className="space-y-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            熟词本 · 系统分组
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Card 1: All Mastered Words List */}
            <div 
              onClick={() => { setSelectedListFilter('all'); setCurrentPage(1); }}
              className={`rounded-2xl p-5 transition-all cursor-pointer group space-y-3 ${
                selectedListFilter === 'all' ? listCardSelectedGreen : listCardUnselected
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={selectedListFilter === 'all' ? listIconSelectedLg : listIconBoxLg}>
                  <Award className="w-5 h-5" />
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  selectedListFilter === 'all' ? listBadgeSelected : listBadgeUnselected
                }`}>
                  {masteredWords.length} 词
                </span>
              </div>
              <div>
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
              onClick={() => { setSelectedListFilter('recent'); setCurrentPage(1); }}
              className={`rounded-2xl p-5 transition-all cursor-pointer group space-y-3 ${
                selectedListFilter === 'recent' ? listCardSelectedGreen : listCardUnselected
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={selectedListFilter === 'recent' ? listIconSelectedLg : listIconBoxLg}>
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  selectedListFilter === 'recent' ? listBadgeSelected : listBadgeUnselected
                }`}>
                  {recentMasteredWords.length} 词
                </span>
              </div>
              <div>
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
        </div>

      {/* Filter and Toolbar Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 surface-card p-3.5 rounded-2xl shadow-card">
        
        {/* Search */}
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

        {/* Right side controls: Sort + Import + Export + Clear */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          
          {/* Sort selector */}
          <div className="flex items-center gap-1.5 surface-muted px-2.5 py-1.5 border border-slate-200 dark:border-slate-600 rounded-xl">
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
          </div>

          {/* Bulk AI Enrich Button */}
          {activeWordSet.some(w => !w.exampleSentence || !w.exampleSentence.trim()) && (
            <button
              onClick={handleBulkEnrichWords}
              disabled={isBulkEnriching}
              className="flex items-center gap-1.5 px-3 py-2 gradient-brand text-white font-bold text-xs rounded-xl shadow-sm hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
              title="自动调用 DeepSeek AI 补全缺乏例句与音标的熟词"
            >
              {isBulkEnriching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-brand-200 animate-pulse" />
              )}
              <span>
                {isBulkEnriching 
                  ? '补全中...' 
                  : `补全例句 (${activeWordSet.filter(w => !w.exampleSentence || !w.exampleSentence.trim()).length})`}
              </span>
            </button>
          )}

          {/* Import Button */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 surface-muted hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-secondary hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-600 transition-all cursor-pointer"
            title="导入词汇到熟词本"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>导入词汇</span>
          </button>

          {/* Export Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-2 surface-muted hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-secondary hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-600 transition-all cursor-pointer"
              title="导出熟词本"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>导出词汇</span>
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-44 surface-card rounded-xl shadow-elevated py-1 z-30 animate-in fade-in zoom-in-95">
                <button
                  onClick={handleExportJSON}
                  disabled={masteredWords.length === 0}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-secondary hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FileJson className="w-3.5 h-3.5 text-emerald-600" />
                  <span>导出 JSON 文件</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  disabled={masteredWords.length === 0}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-secondary hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed border-t border-slate-100 dark:border-slate-700"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" />
                  <span>导出 CSV 表格</span>
                </button>
              </div>
            )}
          </div>

          {/* Clear Button */}
          {masteredWords.length > 0 && (
            <button
              onClick={() => setIsClearModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 btn-danger-soft font-semibold text-xs rounded-xl transition-all cursor-pointer"
              title="清空整个熟词本"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清空熟词本</span>
            </button>
          )}

          {activeWordSet.length > 0 && (
            <button
              onClick={handleStartActiveListQuiz}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-xs rounded-xl shadow-xs hover:opacity-95 transition-all cursor-pointer"
              title={`对当前选中的「${getSelectedGroupLabel()}」发起测试`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>测试此词本</span>
            </button>
          )}

        </div>
      </div>

      {/* Words Grid */}
      {filteredWords.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={searchTerm ? '未找到符合条件的熟词' : '熟词本暂无单词'}
          description={searchTerm ? '尝试更换搜索关键字' : '在单词测试中连续答对 3 次即可将词汇自动录入熟词本，也可直接在此【导入词汇】！'}
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
                        <span>{enrichingWordId === item.id ? '生成中...' : '补全例句'}</span>
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
              window.scrollTo({ top: 300, behavior: 'smooth' });
            }}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
          />
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="surface-card rounded-2xl max-w-md w-full p-6 shadow-elevated space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">清空熟词本？</h3>
                <p className="text-xs text-slate-500">此操作将移除熟词本中的全部 {masteredWords.length} 个单词。</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-rose-50/60 p-3 rounded-xl border border-rose-100">
              ⚠️ 注意：清空后已掌握单词记录将被移除，若已登录将同步清除云端数据库。
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-secondary surface-muted hover:opacity-90 rounded-xl transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (onClearAllMasteredWords) onClearAllMasteredWords();
                  setIsClearModalOpen(false);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all cursor-pointer"
              >
                确认清空熟词
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="p-1 text-muted hover:text-primary rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
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
                    <span>AI 正在生成与补全...</span>
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
