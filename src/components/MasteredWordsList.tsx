import React, { useState, useRef } from 'react';
import { SpeakerIcon } from './SpeakerIcon';
import { 
  Award, Search, Trash2, BookOpen, ArrowUpDown, 
  CheckCircle2, RotateCcw, Download, Upload, FileText, X, 
  FileSpreadsheet, FileJson, Check, AlertTriangle, Sparkles, Loader2 
} from 'lucide-react';
import { MasteredWordItem, WordItem } from '../types';
import { parseWordListText, enrichWordsWithAI } from '../utils/wordParser';
import { Pagination } from './Pagination';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';

interface MasteredWordsListProps {
  masteredWords: MasteredWordItem[];
  hideHeader?: boolean;
  onRemoveMasteredWord: (wordId: string) => void;
  onMoveToWrongWords: (word: MasteredWordItem) => void;
  onStartMasteredWordsQuiz: (words: WordItem[]) => void;
  onClearAllMasteredWords?: () => void;
  onImportMasteredWords?: (words: MasteredWordItem[]) => void;
}

export const MasteredWordsList: React.FC<MasteredWordsListProps> = ({
  masteredWords,
  hideHeader = false,
  onRemoveMasteredWord,
  onMoveToWrongWords,
  onStartMasteredWordsQuiz,
  onClearAllMasteredWords,
  onImportMasteredWords
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical'>('recent');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Modals & Popups
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Pronounce word and example sentence with micro-delay to prevent audio clipping
  const speakWord = (word: string, exampleSentence?: string) => {
    if ('speechSynthesis' in window && word) {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }
      window.speechSynthesis.cancel();
      const textToSpeak = exampleSentence ? `${word}. ... ${exampleSentence}` : word;
      speechTimeoutRef.current = setTimeout(() => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;

        utterance.onstart = () => setSpeakingWord(word);
        utterance.onend = () => setSpeakingWord(null);
        utterance.onerror = () => setSpeakingWord(null);

        const voices = window.speechSynthesis.getVoices();
        const enVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel')));
        if (enVoice) {
          utterance.voice = enVoice;
        }
        window.speechSynthesis.speak(utterance);
      }, 80);
    }
  };

  const [viewMode, setViewMode] = useState<'lists' | 'details'>('lists');
  const [selectedListFilter, setSelectedListFilter] = useState<'all' | 'recent'>('all');

  // Computed sub-lists
  const recentMasteredWords = masteredWords.filter(w => Date.now() - (w.masteredAt || 0) <= 7 * 86400000);

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

  // Parse text/JSON string to MasteredWordItem[]
  const parseWords = (text: string): MasteredWordItem[] => {
    const rawParsed = parseWordListText(text);
    return rawParsed.map((p) => ({
      id: p.word.toLowerCase(),
      word: p.word,
      phonetic: p.phonetic || '',
      chinese: p.chinese || p.word,
      exampleSentence: p.exampleSentence || '',
      exampleSentenceCn: p.exampleSentenceCn || '',
      masteredAt: Date.now()
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
        const parsed = parseWords(content);
        if (parsed.length > 0) {
          setImportStatus({
            type: 'success',
            message: `已提取出 ${parsed.length} 个单词，可开启 AI 补全或直接导入！`
          });
        } else {
          setImportStatus({
            type: 'error',
            message: '未能在文件内容中解析出有效英文单词，请检查文件格式。'
          });
        }
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    const rawParsed = parseWordListText(importText);
    if (rawParsed.length === 0) {
      setImportStatus({
        type: 'error',
        message: '未发现有效英文单词，请输入教材格式、纯单词列表或“单词: 释义”。'
      });
      return;
    }

    let finalWords: MasteredWordItem[] = [];

    if (importAutoEnrich) {
      setIsEnriching(true);
      setImportStatus({
        type: 'success',
        message: `AI 正在智能补充 ${rawParsed.length} 个单词的词性、音标与例句...`
      });

      try {
        const enriched = await enrichWordsWithAI(rawParsed);
        finalWords = enriched.map((item) => ({
          id: item.word.toLowerCase(),
          word: item.word,
          phonetic: item.phonetic || '',
          chinese: item.chinese || item.word,
          exampleSentence: item.exampleSentence || '',
          exampleSentenceCn: item.exampleSentenceCn || '',
          masteredAt: Date.now()
        }));
      } catch (err) {
        console.error('Enrichment error in MasteredWordsList:', err);
        finalWords = rawParsed.map((p) => ({
          id: p.word.toLowerCase(),
          word: p.word,
          phonetic: p.phonetic || '',
          chinese: p.chinese || p.word,
          exampleSentence: p.exampleSentence || '',
          exampleSentenceCn: p.exampleSentenceCn || '',
          masteredAt: Date.now()
        }));
      } finally {
        setIsEnriching(false);
      }
    } else {
      finalWords = rawParsed.map((p) => ({
        id: p.word.toLowerCase(),
        word: p.word,
        phonetic: p.phonetic || '',
        chinese: p.chinese || p.word,
        exampleSentence: p.exampleSentence || '',
        exampleSentenceCn: p.exampleSentenceCn || '',
        masteredAt: Date.now()
      }));
    }

    if (onImportMasteredWords) {
      onImportMasteredWords(finalWords);
    }
    setImportStatus(null);
    setImportText('');
    setIsImportModalOpen(false);
  };

  return (
    <div className={hideHeader ? 'space-y-6' : 'max-w-5xl mx-auto px-4 space-y-6'}>
      
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

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-100/80 dark:bg-slate-800/60 p-1.5 rounded-2xl">
        <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl">
          <button
            onClick={() => { setViewMode('lists'); setSelectedListFilter('all'); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'lists'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>按单词列表浏览</span>
          </button>
          <button
            onClick={() => setViewMode('details')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'details'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-500" />
            <span>查看全部熟词明细 ({activeWordSet.length})</span>
          </button>
        </div>

        {selectedListFilter !== 'all' && (
          <div className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 flex items-center justify-between gap-2">
            <span>正在筛选：近期攻克熟词列表 ({activeWordSet.length}词)</span>
            <button onClick={() => setSelectedListFilter('all')} className="underline hover:text-emerald-900 font-bold cursor-pointer">清除筛选</button>
          </div>
        )}
      </div>

      {/* Word List Cards Grid (Shown when viewMode === 'lists') */}
      {viewMode === 'lists' && (
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            熟词本 · 专属单词列表
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Card 1: All Mastered Words List */}
            <div 
              onClick={() => { setSelectedListFilter('all'); setViewMode('details'); setCurrentPage(1); }}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <Award className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full">
                  {masteredWords.length} 词
                </span>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base group-hover:text-emerald-600 transition-colors">
                  全量熟词列表
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  包含所有在测试中攻克并标记为已掌握的单词
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
                <span>进入列表明细</span>
                <span>→</span>
              </div>
            </div>

            {/* Card 2: Recent Mastered List */}
            <div 
              onClick={() => { setSelectedListFilter('recent'); setViewMode('details'); setCurrentPage(1); }}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-teal-400 hover:shadow-md transition-all cursor-pointer group space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-xl bg-teal-50 text-teal-600 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 text-xs font-bold bg-teal-100 text-teal-800 rounded-full">
                  {recentMasteredWords.length} 词
                </span>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base group-hover:text-teal-600 transition-colors">
                  近期攻克熟词列表
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  近 7 天内成功攻克并加入熟词本的最新词汇
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-teal-600">
                <span>巩固近 7 天战果</span>
                <span>→</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Filter and Toolbar Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        
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
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-emerald-500 focus:bg-white text-slate-700 transition-all"
          />
        </div>

        {/* Right side controls: Sort + Import + Export + Clear */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          
          {/* Sort selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 border border-slate-200 rounded-xl">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e: any) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs font-medium bg-transparent text-slate-700 focus:outline-none cursor-pointer"
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
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-semibold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
            title="导入词汇到熟词本"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>导入词汇</span>
          </button>

          {/* Export Menu */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-semibold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
              title="导出熟词本"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>导出词汇</span>
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95">
                <button
                  onClick={handleExportJSON}
                  disabled={masteredWords.length === 0}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FileJson className="w-3.5 h-3.5 text-emerald-600" />
                  <span>导出 JSON 文件</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  disabled={masteredWords.length === 0}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed border-t border-slate-100"
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
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-xs rounded-xl border border-rose-200/80 transition-all cursor-pointer"
              title="清空整个熟词本"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清空熟词本</span>
            </button>
          )}

        </div>
      </div>

      {/* Words Grid */}
      {filteredWords.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-700 text-base">
            {searchTerm ? '未找到符合条件的熟词' : '熟词本暂无单词'}
          </h3>
          <p className="text-slate-400 text-xs max-w-sm mx-auto">
            {searchTerm ? '尝试更换搜索关键字' : '在单词测试中连续答对 3 次即可将词汇自动录入熟词本，也可直接在此【导入词汇】！'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedWords.map((item) => (
              <div
                key={item.id}
                onClick={() => speakWord(item.word, item.exampleSentence)}
                className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all space-y-2 relative group cursor-pointer active:scale-[0.99]"
              >
                {/* Top info */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">{item.word}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          speakWord(item.word, item.exampleSentence);
                        }}
                        className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer translate-y-[3.5px]"
                        title="发音（单词+例句）"
                      >
                        <SpeakerIcon isSpeaking={speakingWord === item.word} className="w-5 h-5" />
                      </button>
                    </div>
                    {item.phonetic && (
                      <span className="text-sm font-mono text-slate-500 font-medium">{item.phonetic}</span>
                    )}
                  </div>

                  {/* Mastered badge */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>已掌握</span>
                  </div>
                </div>

                {/* Chinese definition */}
                <div className="text-base font-bold text-emerald-800 bg-emerald-50/60 py-2 px-3 rounded-xl border border-emerald-100 leading-snug">
                  {item.chinese}
                </div>

                {/* Example sentence or AI Enrich trigger */}
                {item.exampleSentence ? (
                  <div className="text-sm text-slate-700 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 space-y-0.5">
                    <p className="font-medium text-slate-800 italic leading-snug">“{item.exampleSentence}”</p>
                    {item.exampleSentenceCn && (
                      <p className="text-slate-500 text-sm leading-snug">{item.exampleSentenceCn}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-emerald-50/50 p-2.5 rounded-xl border border-dashed border-emerald-200/80">
                    <span className="text-xs text-emerald-700/80 italic font-medium">暂无例句与音标</span>
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
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
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
                </div>
              </div>
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95">
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
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
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
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-lg">
                <Upload className="w-5 h-5" />
                <span>批量导入到熟词本</span>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportStatus(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              
              {/* File upload prompt */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">方法 1：上传 JSON / CSV / TXT 文件</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50 p-4 rounded-xl text-center cursor-pointer transition-all space-y-1"
                >
                  <Upload className="w-6 h-6 text-emerald-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">点击上传文件 (.json, .csv, .txt)</p>
                  <p className="text-[11px] text-slate-400">支持 WordMaster 导出的 JSON，或每行单词 CSV 格式</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Text input prompt */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">方法 2：直接粘贴文本（自动兼容教材词表与纯词表）</label>
                <textarea
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    if (importStatus) setImportStatus(null);
                  }}
                  rows={6}
                  placeholder={`自动支持多种常见格式：

1. 纯单词列表 (可带单元标题):
### Welcome Unit
exchange
lecture
registration

2. 编号释义列表 (人教版新课标/Markdown):
1. **exchange** n. 交换；交流 vt. 交换；交流；兑换
2. **lecture** n. 讲座；讲课 vi. 讲座 vt. 训斥

3. 各种分隔符:
abandon : 放弃；抛弃
apple - 苹果`}
                  className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white text-slate-800 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* AI Enrich Toggle */}
              <div className="flex items-center justify-between bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/60">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-emerald-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={importAutoEnrich}
                    onChange={(e) => setImportAutoEnrich(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>✨ AI 智能补全词性、音标与精美例句</span>
                </label>
                <span className="text-[11px] text-emerald-700/80 hidden sm:inline">
                  {importAutoEnrich ? '自动补全缺失例句与词性' : '快捷导入原数据'}
                </span>
              </div>

              {/* Status Notice */}
              {importStatus && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
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

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                disabled={isEnriching}
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportStatus(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isEnriching || !importText.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isEnriching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>AI 正在生成与补全...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>{importAutoEnrich ? '确认并由 AI 智能补全导入' : '快捷直接导入熟词本'}</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
