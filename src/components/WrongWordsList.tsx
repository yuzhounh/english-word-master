import React, { useState, useRef } from 'react';
import { SpeakerIcon } from './SpeakerIcon';
import { 
  Bookmark, Search, Trash2, BookOpen, AlertTriangle, 
  ArrowUpDown, CheckCircle2, Download, Upload, FileText, X, 
  FileSpreadsheet, FileJson, Check, Sparkles, Loader2 
} from 'lucide-react';
import { WrongWordItem, WordItem, WordListGroup } from '../types';
import { parseWordListText, enrichWordsWithAI } from '../utils/wordParser';
import { Pagination } from './Pagination';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';
import { WordCard } from './ui/WordCard';
import { EmptyState } from './ui/EmptyState';

interface WrongWordsListProps {
  wrongWords: WrongWordItem[];
  customWordLists?: WordListGroup[];
  hideHeader?: boolean;
  onRemoveWrongWord: (wordId: string) => void;
  onStartWrongWordsQuiz: (words: WordItem[]) => void;
  onClearAllWrongWords?: () => void;
  onImportWrongWords?: (words: WrongWordItem[]) => void;
  onDeleteCustomList?: (listId: string, removeWords?: boolean) => void;
}

export const WrongWordsList: React.FC<WrongWordsListProps> = ({
  wrongWords,
  customWordLists = [],
  hideHeader = false,
  onRemoveWrongWord,
  onStartWrongWordsQuiz,
  onClearAllWrongWords,
  onImportWrongWords,
  onDeleteCustomList
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'errorCount' | 'recent' | 'alphabetical'>('errorCount');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);

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
  const [deletingListForConfirm, setDeletingListForConfirm] = useState<WordListGroup | null>(null);

  const handleEnrichSingleWord = async (item: WrongWordItem) => {
    setEnrichingWordId(item.id);
    try {
      const enriched = await enrichWordsWithAI([{
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
    } finally {
      setIsBulkEnriching(false);
    }
  };

  // Pronounce word and example sentence with micro-delay to prevent audio clipping
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  const speakWord = (word: string, exampleSentence?: string) => {
    if ('speechSynthesis' in window && word) {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }
      window.speechSynthesis.cancel();
      speechTimeoutRef.current = setTimeout(() => {
        window.speechSynthesis.cancel();
        
        const voices = window.speechSynthesis.getVoices();
        const enVoice = voices.find(v => 
          v.lang.toLowerCase().replace('_', '-').startsWith('en') && 
          (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Karen') || v.name.includes('Alex'))
        ) || voices.find(v => v.lang.toLowerCase().startsWith('en'));

        const wordUtterance = new SpeechSynthesisUtterance(word);
        wordUtterance.lang = 'en-US';
        wordUtterance.rate = 0.9;
        if (enVoice) wordUtterance.voice = enVoice;
        
        wordUtterance.onstart = () => setSpeakingWord(word);
        wordUtterance.onend = () => setSpeakingWord(null);
        wordUtterance.onerror = () => setSpeakingWord(null);

        window.speechSynthesis.speak(wordUtterance);

        if (exampleSentence && exampleSentence.trim()) {
          const sentenceUtterance = new SpeechSynthesisUtterance(exampleSentence.trim());
          sentenceUtterance.lang = 'en-US';
          sentenceUtterance.rate = 0.9;
          if (enVoice) sentenceUtterance.voice = enVoice;
          sentenceUtterance.onend = () => setSpeakingWord(null);
          sentenceUtterance.onerror = () => setSpeakingWord(null);
          window.speechSynthesis.speak(sentenceUtterance);
        }
      }, 80);
    }
  };

  const [viewMode, setViewMode] = useState<'lists' | 'details'>('lists');
  const [selectedListFilter, setSelectedListFilter] = useState<'all' | 'high_error' | 'recent' | 'custom'>('all');
  const [selectedCustomListId, setSelectedCustomListId] = useState<string | null>(null);

  // Computed sub-lists
  const highErrorWords = wrongWords.filter(w => w.errorCount >= 2);
  const recentWords = wrongWords.filter(w => Date.now() - (w.lastErrorAt || w.createdAt) <= 7 * 86400000);
  const selectedCustomList = customWordLists.find(l => l.id === selectedCustomListId);

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

  // Filter & Sort
  const filteredWords = activeWordSet
    .filter((w) => 
      w.word.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      w.chinese.includes(searchTerm.trim())
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

  // Export handlers
  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(wrongWords, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `生词本_WordMaster_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
  };

  const handleExportCSV = () => {
    let csvContent = '\uFEFF单词,音标,中文释义,例句,中文例句,出错次数\n';
    wrongWords.forEach((item) => {
      const word = `"${(item.word || '').replace(/"/g, '""')}"`;
      const phonetic = `"${(item.phonetic || '').replace(/"/g, '""')}"`;
      const chinese = `"${(item.chinese || '').replace(/"/g, '""')}"`;
      const example = `"${(item.exampleSentence || '').replace(/"/g, '""')}"`;
      const exampleCn = `"${(item.exampleSentenceCn || '').replace(/"/g, '""')}"`;
      const count = item.errorCount || 1;
      csvContent += `${word},${phonetic},${chinese},${example},${exampleCn},${count}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `生词本_WordMaster_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
  };

  const [isEnriching, setIsEnriching] = useState<boolean>(false);
  const [importAutoEnrich, setImportAutoEnrich] = useState<boolean>(true);

  // Helper to parse text/json string into WrongWordItem[]
  const parseWords = (text: string): WrongWordItem[] => {
    const rawParsed = parseWordListText(text);
    return rawParsed.map((p) => ({
      id: p.word.toLowerCase(),
      word: p.word,
      phonetic: p.phonetic || '',
      chinese: p.chinese || p.word,
      exampleSentence: p.exampleSentence || '',
      exampleSentenceCn: p.exampleSentenceCn || '',
      errorCount: 1,
      lastErrorAt: Date.now(),
      createdAt: Date.now()
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

    let finalWords: WrongWordItem[] = [];

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
          errorCount: 0,
          lastErrorAt: Date.now(),
          createdAt: Date.now()
        }));
      } catch (err) {
        console.error('Enrichment error in WrongWordsList:', err);
        finalWords = rawParsed.map((p) => ({
          id: p.word.toLowerCase(),
          word: p.word,
          phonetic: p.phonetic || '',
          chinese: p.chinese || p.word,
          exampleSentence: p.exampleSentence || '',
          exampleSentenceCn: p.exampleSentenceCn || '',
          errorCount: 0,
          lastErrorAt: Date.now(),
          createdAt: Date.now()
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
        errorCount: 0,
        lastErrorAt: Date.now(),
        createdAt: Date.now()
      }));
    }

    if (onImportWrongWords) {
      onImportWrongWords(finalWords);
    }
    setImportStatus(null);
    setImportText('');
    setIsImportModalOpen(false);
  };

  return (
    <div className={hideHeader ? 'space-y-6' : 'page-container space-y-6'}>
      
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

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-100/80 dark:bg-slate-800/60 p-1.5 rounded-2xl">
        <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-700/60 p-1 rounded-xl">
          <button
            onClick={() => { setViewMode('lists'); setSelectedListFilter('all'); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'lists'
                ? 'surface-tab-active text-brand-800 dark:text-brand-300'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-brand-500" />
            <span>按单词列表浏览</span>
          </button>
          <button
            onClick={() => setViewMode('details')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'details'
                ? 'surface-tab-active text-brand-800 dark:text-brand-300'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <BookOpen className="w-4 h-4 text-brand-500" />
            <span>查看全部生词明细 ({activeWordSet.length})</span>
          </button>
        </div>

        {selectedListFilter !== 'all' && (
          <div className="text-xs font-medium text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 px-3 py-1 rounded-lg border border-brand-200 dark:border-brand-800 flex items-center justify-between gap-2">
            <span>
              正在筛选：
              {selectedListFilter === 'high_error' && '顽固高频难词列表'}
              {selectedListFilter === 'recent' && '近期错题列表'}
              {selectedListFilter === 'custom' && `自定义词表《${selectedCustomList?.name || ''}》`} 
              ({activeWordSet.length}词)
            </span>
            <button 
              onClick={() => { setSelectedListFilter('all'); setSelectedCustomListId(null); }} 
              className="underline hover:text-brand-900 font-bold cursor-pointer"
            >
              清除筛选
            </button>
          </div>
        )}
      </div>

      {/* Word List Cards Grid (Shown when viewMode === 'lists') */}
      {viewMode === 'lists' && (
        <div className="space-y-6">
          
          {/* Smart Classification Lists */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>生词本 · 系统智能分组</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Card 1: All Wrong Words List */}
              <div 
                onClick={() => { setSelectedListFilter('all'); setSelectedCustomListId(null); setViewMode('details'); setCurrentPage(1); }}
                className="surface-card rounded-2xl p-5 shadow-xs hover:border-brand-400 hover:shadow-md transition-all cursor-pointer group space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl surface-icon group-hover:bg-brand-600 group-hover:text-white transition-colors">
                    <Bookmark className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 text-xs font-bold bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300 rounded-full">
                    {wrongWords.length} 词
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-primary text-base group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">
                    全量生词列表
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    包含文章提取与测试答错的所有待掌握生词
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs font-bold text-brand-600 dark:text-brand-400">
                  <span>进入列表明细</span>
                  <span>→</span>
                </div>
              </div>

              {/* Card 2: High Error List */}
              <div 
                onClick={() => { setSelectedListFilter('high_error'); setSelectedCustomListId(null); setViewMode('details'); setCurrentPage(1); }}
                className="surface-card rounded-2xl p-5 shadow-xs hover:border-red-400 hover:shadow-md transition-all cursor-pointer group space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 group-hover:bg-red-500 group-hover:text-white transition-colors">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 rounded-full">
                    {highErrorWords.length} 词
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base group-hover:text-red-600 transition-colors">
                    顽固高频难词列表
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    连续错2次及以上的难记高频易错词集
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs font-bold text-red-600 dark:text-red-400">
                  <span>专项攻克难词</span>
                  <span>→</span>
                </div>
              </div>

              {/* Card 3: Recent List */}
              <div 
                onClick={() => { setSelectedListFilter('recent'); setSelectedCustomListId(null); setViewMode('details'); setCurrentPage(1); }}
                className="surface-card rounded-2xl p-5 shadow-xs hover:border-brand-400 hover:shadow-md transition-all cursor-pointer group space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl surface-icon group-hover:bg-brand-600 group-hover:text-white transition-colors">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 text-xs font-bold bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300 rounded-full">
                    {recentWords.length} 词
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-primary text-base group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">
                    近期新增错题列表
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    近 7 天内收录进入生词本的最新词汇
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs font-bold text-brand-600 dark:text-brand-400">
                  <span>及时巩固复习</span>
                  <span>→</span>
                </div>
              </div>

            </div>
          </div>

          {/* Custom Imported Word Lists Section */}
          {customWordLists.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>导入的自定义单词列表 ({customWordLists.length})</span>
                <span className="text-xs text-slate-400 normal-case font-normal">来源于官方词库或自定义提取导入</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customWordLists.map((list) => (
                  <div 
                    key={list.id}
                    onClick={() => {
                      setSelectedCustomListId(list.id);
                      setSelectedListFilter('custom');
                      setViewMode('details');
                      setCurrentPage(1);
                    }}
                    className="surface-card rounded-2xl p-5 shadow-xs hover:border-brand-400 hover:shadow-md transition-all group space-y-3 relative flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2.5 rounded-xl surface-icon group-hover:bg-brand-600 group-hover:text-white transition-colors">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-0.5 text-xs font-bold bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-full border border-brand-100 dark:border-brand-800">
                            {list.words.length} 词
                          </span>
                          {onDeleteCustomList && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingListForConfirm(list);
                              }}
                              title="删除此自定义词表"
                              className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <h3 className="font-bold text-slate-800 text-base group-hover:text-brand-600 transition-colors line-clamp-1">
                        {list.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {list.description || `包含 ${list.words.length} 个单词，导入于 ${new Date(list.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomListId(list.id);
                          setSelectedListFilter('custom');
                          setViewMode('details');
                          setCurrentPage(1);
                        }}
                        className="flex-1 py-1.5 px-3 surface-muted hover:opacity-90 text-secondary text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
                      >
                        查看明细
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartWrongWordsQuiz(list.words);
                        }}
                        className="flex-1 py-1.5 px-3 surface-muted hover:opacity-90 text-secondary text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
                      >
                        测试此词表
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Filter and Toolbar Bar (Shown when viewing details or lists) */}
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
            placeholder="搜索单词或中文解释..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl surface-input focus:outline-none focus:border-brand-500 transition-all"
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
              <option value="errorCount">按出错次数排序</option>
              <option value="recent">按最新出错时间排序</option>
              <option value="alphabetical">按字母顺序 A-Z 排序</option>
            </select>
          </div>

          {/* Bulk AI Enrich Button */}
          {activeWordSet.some(w => !w.exampleSentence || !w.exampleSentence.trim()) && (
            <button
              onClick={handleBulkEnrichWords}
              disabled={isBulkEnriching}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-brand-600 via-brand-700 to-brand-800 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
              title="自动调用 DeepSeek AI 补全缺乏例句与音标的生词"
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
            className="flex items-center gap-1.5 px-3 py-2 surface-muted hover:bg-brand-50 dark:hover:bg-brand-900/30 text-secondary hover:text-brand-700 dark:hover:text-brand-300 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-600 transition-all cursor-pointer"
            title="导入词汇到生词本"
          >
            <Upload className="w-3.5 h-3.5 text-brand-600" />
            <span>导入词汇</span>
          </button>

          {/* Export Menu */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-2 surface-muted hover:bg-brand-50 dark:hover:bg-brand-900/30 text-secondary hover:text-brand-700 dark:hover:text-brand-300 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-600 transition-all cursor-pointer"
              title="导出生词本"
            >
              <Download className="w-3.5 h-3.5 text-brand-600" />
              <span>导出词汇</span>
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-44 surface-card rounded-xl shadow-elevated py-1 z-30 animate-in fade-in zoom-in-95">
                <button
                  onClick={handleExportJSON}
                  disabled={wrongWords.length === 0}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-secondary hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FileJson className="w-3.5 h-3.5 text-brand-600" />
                  <span>导出 JSON 文件</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  disabled={wrongWords.length === 0}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-secondary hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed border-t border-slate-100 dark:border-slate-700"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>导出 CSV 表格</span>
                </button>
              </div>
            )}
          </div>

          {/* Clear Button */}
          {wrongWords.length > 0 && (
            <button
              onClick={() => setIsClearModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 btn-danger-soft font-semibold text-xs rounded-xl transition-all cursor-pointer"
              title="清空整个生词本"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清空生词本</span>
            </button>
          )}

        </div>
      </div>

      {/* Words Grid */}
      {filteredWords.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={searchTerm ? '未找到符合条件的生词' : '生词本暂无记录'}
          description={searchTerm ? '尝试更换搜索关键字' : '在单词测试中答错的词汇会自动记录在这里，也可以通过【导入词汇】快捷批量添加。'}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedWords.map((item) => (
              <WordCard
                key={item.id}
                word={item.word}
                phonetic={item.phonetic}
                chinese={item.chinese}
                exampleSentence={item.exampleSentence}
                exampleSentenceCn={item.exampleSentenceCn}
                isSpeaking={speakingWord === item.word}
                onSpeak={() => speakWord(item.word, item.exampleSentence)}
                onClick={() => speakWord(item.word, item.exampleSentence)}
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
                    <span>选错 {item.errorCount || 0} 次</span>
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
                        <span>AI 补全</span>
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
                <h3 className="font-bold text-slate-900 text-base">清空待测试生词本？</h3>
                <p className="text-xs text-slate-500">此操作将移除生词本中的全部 {wrongWords.length} 个单词。</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-rose-50/60 p-3 rounded-xl border border-rose-100">
              ⚠️ 注意：清空后单词记录将被移除，若已登录将同步清除云端数据库。
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
                  if (onClearAllWrongWords) onClearAllWrongWords();
                  setIsClearModalOpen(false);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all cursor-pointer"
              >
                确认清空生词
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
              <div className="flex items-center gap-2 text-brand-700 font-bold text-lg">
                <Upload className="w-5 h-5" />
                <span>批量导入到生词本</span>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportStatus(null);
                }}
                className="p-1 text-muted hover:text-primary rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
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
                  className="border-2 border-dashed border-brand-300 dark:border-brand-700 hover:border-brand-500 dark:hover:border-brand-500 bg-brand-50/40 dark:bg-brand-900/20 hover:bg-brand-50 dark:hover:bg-brand-900/40 p-4 rounded-xl text-center cursor-pointer transition-all space-y-1"
                >
                  <Upload className="w-6 h-6 text-brand-600 mx-auto" />
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
                  className="w-full p-3 text-xs font-mono surface-input rounded-xl focus:outline-none focus:border-brand-500 transition-all"
                />
              </div>

              {/* AI Enrich Toggle */}
              <div className="flex items-center justify-between bg-brand-50/60 dark:bg-brand-900/30 p-3 rounded-xl border border-brand-200/60 dark:border-brand-800/60">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-brand-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={importAutoEnrich}
                    onChange={(e) => setImportAutoEnrich(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded border-brand-300 focus:ring-brand-500 cursor-pointer"
                  />
                  <Sparkles className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>✨ AI 智能补全词性、音标与精美例句</span>
                </label>
                <span className="text-[11px] text-brand-700/80 hidden sm:inline">
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

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                disabled={isEnriching}
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportStatus(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-secondary surface-muted hover:opacity-90 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isEnriching || !importText.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isEnriching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>AI 正在生成与补全...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>{importAutoEnrich ? '确认并由 AI 智能补全导入' : '快捷直接导入生词本'}</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Delete Custom List Confirmation Modal */}
      {deletingListForConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="surface-card rounded-3xl p-6 max-w-md w-full shadow-elevated space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600 font-bold text-base">
                <Trash2 className="w-5 h-5" />
                <span>删除自定义词表</span>
              </div>
              <button
                onClick={() => setDeletingListForConfirm(null)}
                className="p-1 text-muted hover:text-primary rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-800">
                您确定要删除词表《{deletingListForConfirm.name}》吗？
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                此词表共包含 <span className="font-bold text-amber-600">{deletingListForConfirm.words.length}</span> 个单词。请选择您的删除处理方式：
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <button
                onClick={() => {
                  if (onDeleteCustomList) {
                    onDeleteCustomList(deletingListForConfirm.id, false);
                  }
                  setDeletingListForConfirm(null);
                }}
                className="w-full p-3 surface-muted hover:opacity-90 text-primary text-xs font-bold rounded-2xl transition-all cursor-pointer text-left flex flex-col gap-1 border border-slate-200/80 dark:border-slate-600"
              >
                <span className="text-slate-900 font-bold">1. 仅删除词表卡片 (推荐)</span>
                <span className="text-slate-500 font-normal leading-normal">仅移除分类分组卡片，词表中的单词依然保留在全量生词本中。</span>
              </button>

              <button
                onClick={() => {
                  if (onDeleteCustomList) {
                    onDeleteCustomList(deletingListForConfirm.id, true);
                  }
                  setDeletingListForConfirm(null);
                }}
                className="w-full p-3 bg-red-50/70 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-900 dark:text-red-300 text-xs font-bold rounded-2xl transition-all cursor-pointer text-left flex flex-col gap-1 border border-red-200/80 dark:border-red-800/80"
              >
                <span className="text-red-700 font-bold">2. 同时从全量生词本中移除单词</span>
                <span className="text-red-600/80 font-normal leading-normal">删除分类卡片，并将该词表的 {deletingListForConfirm.words.length} 个单词同步从生词本清空。</span>
              </button>
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-100">
              <button
                onClick={() => setDeletingListForConfirm(null)}
                className="px-4 py-2 text-xs font-bold text-secondary surface-muted hover:opacity-90 rounded-xl cursor-pointer transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
