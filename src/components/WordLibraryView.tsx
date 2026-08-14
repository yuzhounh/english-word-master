import React, { useState, useEffect } from 'react';
import { WordCard } from './ui/WordCard';
import { 
  Folder, BookOpen, Search, Download, Play, 
  Sparkles, RefreshCw, ChevronRight, Check, FileSpreadsheet, Layers, Loader2, ListPlus,
  Github, ExternalLink
} from 'lucide-react';
import { WordItem, LibraryCategoryNode, SpeechAccent } from '../types';
import { enrichWordsWithAI, enrichWordsWithDictionaryFallback } from '../utils/wordParser';
import { Pagination } from './Pagination';
import { LibraryTreeSkeleton, WordGridSkeleton } from './ui/Skeleton';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface WordLibraryViewProps {
  onStartQuizWithWords: (words: WordItem[], bookName: string) => void;
  onImportCustomList: (words: WordItem[], listName: string) => void;
  onGoToNotebook?: () => void;
  speechAccent: SpeechAccent;
}

export const WordLibraryView: React.FC<WordLibraryViewProps> = ({
  onStartQuizWithWords,
  onImportCustomList,
  onGoToNotebook,
  speechAccent
}) => {
  const libraryNodeIconClass =
    'p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 shrink-0 transition-colors';
  const libraryNodeIconSmClass =
    'p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 shrink-0 transition-colors';
  const breadcrumbIconClass = 'w-4 h-4 shrink-0';

  const [tree, setTree] = useState<LibraryCategoryNode[]>([]);
  const [loadingTree, setLoadingTree] = useState<boolean>(true);
  const [treeError, setTreeError] = useState<string | null>(null);

  // Path navigation stack
  const [navPath, setNavPath] = useState<LibraryCategoryNode[]>([]);
  
  // Search query for global book search
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Selected book state
  const [selectedBook, setSelectedBook] = useState<{ name: string; path: string } | null>(null);
  const [bookWords, setBookWords] = useState<WordItem[]>([]);
  const [loadingBook, setLoadingBook] = useState<boolean>(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [bookSearch, setBookSearch] = useState<string>('');
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);

  // AI enrichment state
  const [isEnrichingBook, setIsEnrichingBook] = useState<boolean>(false);
  const [enrichProgress, setEnrichProgress] = useState<string>('');
  const [enrichingWordId, setEnrichingWordId] = useState<string | null>(null);

  const handleEnrichSingleWord = async (item: WordItem, index: number) => {
    setEnrichingWordId(item.word);
    try {
      const enriched = await enrichWordsWithAI([{
        word: item.word,
        chinese: item.chinese,
        phonetic: item.phonetic || item.phoneticUs || item.phoneticUk
      }]);
      if (enriched && enriched.length > 0) {
        const enrichedWord = enriched[0];
        setBookWords(prev => prev.map((w, i) => {
          if (i === index || w.word.toLowerCase() === item.word.toLowerCase()) {
            return {
              ...w,
              phonetic: enrichedWord.phonetic || w.phonetic,
              phoneticUs: enrichedWord.phoneticUs || w.phoneticUs,
              phoneticUk: enrichedWord.phoneticUk || w.phoneticUk,
              chinese: enrichedWord.chinese || w.chinese,
              exampleSentence: enrichedWord.exampleSentence || w.exampleSentence,
              exampleSentenceCn: enrichedWord.exampleSentenceCn || w.exampleSentenceCn
            };
          }
          return w;
        }));
      }
    } catch (err) {
      console.error('Enrich single word failed:', err);
    } finally {
      setEnrichingWordId(null);
    }
  };

  const isWordEnriched = (w: WordItem) =>
    !!(w.phonetic || w.phoneticUs || w.phoneticUk) && !!w.chinese && !!w.exampleSentence;

  const isBookFullyEnriched = bookWords.length > 0 && bookWords.every(isWordEnriched);

  const importBookToList = async (words: WordItem[]) => {
    if (!selectedBook || words.length === 0) return;
    setIsEnrichingBook(true);
    setEnrichProgress('正在从词库词典补全...');
    try {
      const parsed = words.map((w) => ({
        word: w.word,
        chinese: w.chinese,
        phonetic: w.phonetic || w.phoneticUs || w.phoneticUk,
        exampleSentence: w.exampleSentence,
        exampleSentenceCn: w.exampleSentenceCn
      }));
      const enriched = await enrichWordsWithDictionaryFallback(parsed, (processed, total) => {
        setEnrichProgress(`词典补全中... ${processed}/${total}`);
      });
      onImportCustomList(enriched, selectedBook.name);
      setBookWords(enriched);
      setImportSuccess(true);
    } finally {
      setIsEnrichingBook(false);
      setEnrichProgress('');
    }
  };

  const enrichCurrentBookWithAI = async (autoImportAfterEnrich = true) => {
    if (!bookWords || bookWords.length === 0 || isEnrichingBook) return;
    setIsEnrichingBook(true);
    setEnrichProgress(`AI 正在智能生成中英双语例句与音标... (0/${bookWords.length})`);
    try {
      const parsed = bookWords.map((w) => ({
        word: w.word,
        chinese: w.chinese,
        phonetic: w.phonetic || w.phoneticUs || w.phoneticUk,
        exampleSentence: w.exampleSentence,
        exampleSentenceCn: w.exampleSentenceCn
      }));
      const enriched = await enrichWordsWithDictionaryFallback(parsed, (processed, total) => {
        const percent = Math.round((processed / total) * 100);
        setEnrichProgress(`AI 正在智能生成例句与音标... 已完成 ${processed} / ${total} 词 (${percent}%)`);
      });
      if (enriched && enriched.length > 0) {
        setBookWords(enriched);
        if (autoImportAfterEnrich && selectedBook) {
          onImportCustomList(enriched, selectedBook.name);
          setImportSuccess(true);
        }
      }
    } catch (err) {
      console.error('Enrich book failed:', err);
    } finally {
      setIsEnrichingBook(false);
      setEnrichProgress('');
    }
  };

  // Load Word Library Tree on mount
  useEffect(() => {
    fetchTree();
  }, []);

  const fetchTree = async () => {
    setLoadingTree(true);
    setTreeError(null);
    try {
      const res = await fetch('/api/wordlibrary/tree');
      const data = await res.json();
      if (data.success && Array.isArray(data.tree)) {
        setTree(data.tree);
      } else {
        setTreeError(data.error || '无法加载词库树结构');
      }
    } catch (err: any) {
      setTreeError(err.message || '网络连接失败');
    } finally {
      setLoadingTree(false);
    }
  };

  // Load specific book content
  const findFolderPathToBook = (
    nodes: LibraryCategoryNode[],
    bookPath: string,
    acc: LibraryCategoryNode[] = [],
  ): LibraryCategoryNode[] | null => {
    for (const node of nodes) {
      if (node.type === 'book' && node.path === bookPath) return acc;
      if (node.type === 'folder' && node.children) {
        const found = findFolderPathToBook(node.children, bookPath, [...acc, node]);
        if (found) return found;
      }
    }
    return null;
  };

  const navigateToRoot = () => {
    setNavPath([]);
    setSelectedBook(null);
    setGlobalSearch('');
  };

  const navigateToFolder = (index: number) => {
    setNavPath(navPath.slice(0, index + 1));
    setSelectedBook(null);
  };

  const handleSelectBook = async (book: { name: string; path: string }) => {
    setGlobalSearch('');
    const folderPath = findFolderPathToBook(tree, book.path);
    if (folderPath) setNavPath(folderPath);

    setSelectedBook(book);
    setLoadingBook(true);
    setBookError(null);
    setBookSearch('');
    setImportSuccess(false);
    setCurrentPage(1);

    try {
      const res = await fetch(`/api/wordlibrary/book?path=${encodeURIComponent(book.path)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.words)) {
        setBookWords(data.words);
      } else {
        setBookError(data.error || '加载词书内容失败');
      }
    } catch (err: any) {
      setBookError(err.message || '网络请求错误');
    } finally {
      setLoadingBook(false);
    }
  };

  // Pronounce word with timeout ref to avoid audio clipping / stalling
  const speechTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
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
        
        const targetLang = speechAccent || 'en-US';
        const voices = window.speechSynthesis.getVoices();
        const enVoice = voices.find(v => 
          v.lang.toLowerCase().replace('_', '-').startsWith(targetLang.toLowerCase().slice(0, 2)) && 
          (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Karen') || v.name.includes('Alex'))
        ) || voices.find(v => v.lang.toLowerCase().startsWith('en'));

        // Speak word first as primary utterance so word is never skipped/cut off
        const wordUtterance = new SpeechSynthesisUtterance(word);
        wordUtterance.lang = targetLang;
        wordUtterance.rate = 0.9;
        if (enVoice) wordUtterance.voice = enVoice;
        
        wordUtterance.onstart = () => setSpeakingWord(word);
        wordUtterance.onend = () => setSpeakingWord(null);
        wordUtterance.onerror = () => setSpeakingWord(null);

        window.speechSynthesis.speak(wordUtterance);

        // Queue example sentence if present
        if (exampleSentence && exampleSentence.trim()) {
          const sentenceUtterance = new SpeechSynthesisUtterance(exampleSentence.trim());
          sentenceUtterance.lang = targetLang;
          sentenceUtterance.rate = 0.9;
          if (enVoice) sentenceUtterance.voice = enVoice;
          sentenceUtterance.onend = () => setSpeakingWord(null);
          sentenceUtterance.onerror = () => setSpeakingWord(null);
          window.speechSynthesis.speak(sentenceUtterance);
        }
      }, 80);
    }
  };

  // Flatten all books in tree for global search
  const getAllBooks = (nodes: LibraryCategoryNode[]): { name: string; path: string; category: string }[] => {
    let result: { name: string; path: string; category: string }[] = [];
    nodes.forEach(node => {
      if (node.type === 'book') {
        result.push({ name: node.name, path: node.path, category: node.path.split('/')[0] || '' });
      } else if (node.children) {
        result = result.concat(getAllBooks(node.children));
      }
    });
    return result;
  };

  const allBooks = getAllBooks(tree);
  const filteredGlobalBooks = globalSearch.trim()
    ? allBooks.filter(b => b.name.toLowerCase().includes(globalSearch.toLowerCase().trim()) || b.path.toLowerCase().includes(globalSearch.toLowerCase().trim()))
    : [];

  // Get current active folder nodes
  const currentNodes = navPath.length > 0 ? (navPath[navPath.length - 1].children || []) : tree;

  // Filtered words inside open book
  const filteredBookWords = bookWords.filter(w => 
    w.word.toLowerCase().includes(bookSearch.toLowerCase().trim()) ||
    w.chinese.toLowerCase().includes(bookSearch.toLowerCase().trim())
  );

  const isAllBook = pageSize <= 0 || pageSize >= filteredBookWords.length;
  const pageStartIndex = isAllBook ? 0 : (currentPage - 1) * pageSize;
  const paginatedBookWords = isAllBook ? filteredBookWords : filteredBookWords.slice(pageStartIndex, pageStartIndex + pageSize);

  return (
    <div className="page-container space-y-6">
      
      <PageHeader
        badge="全量内置词库 · 900+ 权威词书"
        badgeIcon={Layers}
        title="官方权威词库 (Word Library)"
        description="内置全国各大教材同步词汇、高考、四六级、考研英语、雅思托福及专业词汇词书。支持分类多级检索、词书在线预览、一键专项背诵与自定义导入。"
        stats={
          <div className="flex flex-col items-stretch gap-3 shrink-0">
            <div className="surface-stat rounded-xl p-4 text-center shrink-0 min-w-[140px]">
              <FileSpreadsheet className="w-6 h-6 text-brand-600 dark:text-brand-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-primary">{allBooks.length}</div>
              <div className="text-xs text-muted">内置分级词书</div>
            </div>
            <a
              href="https://github.com/yuzhounh/english-word-enriched"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl surface-muted hover:bg-brand-50 dark:hover:bg-brand-900/30 border border-slate-200 dark:border-slate-600 text-secondary hover:text-brand-700 dark:hover:text-brand-300 text-xs font-medium transition-colors"
              title="前往 GitHub 查看词库开源来源"
            >
              <Github className="w-3.5 h-3.5" />
              <span>数据来源：yuzhounh/english-word-enriched</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        }
      />

      {/* Breadcrumbs — folders + open book name */}
      {!globalSearch.trim() && (
        <div className="flex items-center gap-2.5 text-sm font-medium text-secondary overflow-x-auto pb-1">
          <button
            onClick={navigateToRoot}
            className={`text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1.5 shrink-0 transition-colors ${navPath.length === 0 && !selectedBook ? 'text-brand-600 dark:text-brand-400 font-bold' : ''}`}
          >
            <span aria-hidden="true"><Folder className={breadcrumbIconClass} /></span>
            <span>根目录</span>
          </button>
          {navPath.map((node, index) => (
            <React.Fragment key={node.path}>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <button
                onClick={() => navigateToFolder(index)}
                className={`text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1.5 shrink-0 transition-colors ${!selectedBook && index === navPath.length - 1 ? 'text-brand-600 dark:text-brand-400 font-bold' : ''}`}
              >
                <span aria-hidden="true"><Folder className={breadcrumbIconClass} /></span>
                <span>{node.name}</span>
              </button>
            </React.Fragment>
          ))}
          {selectedBook && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-brand-600 dark:text-brand-400 font-bold shrink-0 flex items-center gap-1.5">
                <BookOpen className={breadcrumbIconClass} aria-hidden="true" />
                <span>{selectedBook.name}</span>
              </span>
            </>
          )}
        </div>
      )}

      {!selectedBook ? (
        <div className="space-y-6">
          
          {/* Global Search Bar */}
          <div className="surface-card rounded-2xl p-4 shadow-xs flex items-center gap-3">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input 
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="搜索所有 900+ 词书名称（如：人教版、高考、考研英语一、雅思核心、四级...）"
              className="w-full bg-transparent text-sm text-primary placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
            {globalSearch && (
              <button 
                onClick={() => setGlobalSearch('')}
                className="text-xs text-muted hover:text-primary px-2 py-1 rounded-md surface-muted"
              >
                清除
              </button>
            )}
          </div>

          {/* Directory Loading / Error States */}
          {loadingTree && <LibraryTreeSkeleton />}

          {treeError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
              <p className="text-sm text-red-600 font-medium">{treeError}</p>
              <button 
                onClick={fetchTree}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors shadow-xs"
              >
                重试加载
              </button>
            </div>
          )}

          {/* Display Global Search Results */}
          {!loadingTree && globalSearch.trim() !== '' && (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-slate-500">
                找到 {filteredGlobalBooks.length} 本相关词书
              </div>

              {filteredGlobalBooks.length === 0 ? (
                <div className="surface-card rounded-2xl p-8 text-center text-slate-400 text-sm">
                  未找到包含 "{globalSearch}" 的词书
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredGlobalBooks.map((book) => (
                    <div
                      key={book.path}
                      onClick={() => handleSelectBook(book)}
                      className="surface-card rounded-2xl p-4 shadow-xs hover:border-brand-400 hover:shadow-md transition-all cursor-pointer group flex items-start gap-3"
                    >
                      <div className={libraryNodeIconSmClass}>
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-primary text-sm truncate group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">
                          {book.name}
                        </div>
                        <div className="text-xs text-slate-400 truncate mt-0.5">
                          {book.category}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Normal Folder Grid View */}
          {!loadingTree && !globalSearch.trim() && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentNodes.map((node) => {
                if (node.type === 'folder') {
                  return (
                    <div
                      key={node.path}
                      onClick={() => setNavPath([...navPath, node])}
                      className="surface-card rounded-2xl p-5 shadow-xs hover:border-brand-400 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={libraryNodeIconClass}>
                          <Folder className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-primary text-sm truncate group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">
                            {node.name}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {node.bookCount} 本词书
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  );
                } else {
                  return (
                    <div
                      key={node.path}
                      onClick={() => handleSelectBook({ name: node.name, path: node.path })}
                      className="surface-card rounded-2xl p-5 shadow-xs hover:border-brand-400 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={libraryNodeIconClass}>
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-primary text-sm truncate group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">
                            {node.name}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  );
                }
              })}
            </div>
          )}

        </div>
      ) : (
        /* Detailed Book View */
        <div className="space-y-6">

          {/* Search + actions toolbar */}
          <div className="surface-card rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={bookSearch}
                onChange={(e) => {
                  setBookSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="在当前词书中搜索单词或释义..."
                disabled={loadingBook}
                className="w-full pl-10 pr-4 py-2.5 text-xs surface-input rounded-xl focus:outline-none focus:border-brand-400 disabled:opacity-50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500 font-medium px-1">
                共 {bookWords.length} 词{bookSearch ? ` · 筛选 ${filteredBookWords.length}` : ''}
              </span>

              <button
                onClick={() => {
                  if (bookWords.length > 0) {
                    onStartQuizWithWords(bookWords, selectedBook.name);
                  }
                }}
                disabled={loadingBook || isEnrichingBook || bookWords.length === 0}
                className="flex items-center gap-2 px-4 py-2 surface-muted border border-slate-200 dark:border-slate-600 text-secondary rounded-xl text-xs font-bold hover:opacity-95 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Play className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>开始测试</span>
              </button>

              <button
                onClick={() => importBookToList(bookWords)}
                disabled={loadingBook || isEnrichingBook || bookWords.length === 0}
                className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-xl text-xs font-bold hover:opacity-95 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                title={isBookFullyEnriched ? '词书已含完整释义与例句，直接加入词本' : '加入词本（缺失词条将尝试从词库词典补全）'}
              >
                <ListPlus className="w-4 h-4" />
                <span>{isBookFullyEnriched ? '加入词本' : '加入词本（词典补全）'}</span>
              </button>

              {!isBookFullyEnriched && (
                <button
                  onClick={() => enrichCurrentBookWithAI(true)}
                  disabled={loadingBook || isEnrichingBook || bookWords.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  title="对词典中未收录的单词调用 DeepSeek AI 补全"
                >
                  {isEnrichingBook ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-brand-200 animate-pulse" />
                  )}
                  <span>{isEnrichingBook ? '正在生成例句...' : 'AI 补全并导入'}</span>
                </button>
              )}
            </div>
          </div>

          {/* AI Enriching Loading Banner */}
          {isEnrichingBook && (
            <div className="bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 rounded-xl p-4 flex items-center gap-3 shadow-card animate-pulse">
              <Loader2 className="w-5 h-5 text-brand-600 animate-spin shrink-0" />
              <div>
                <div className="font-bold text-brand-900 text-sm">{enrichProgress || 'AI 正在处理中...'}</div>
                <div className="text-xs text-brand-700 mt-0.5">DeepSeek AI 正在智能生成中英双语表达例句、标准音标及词性说明，生成完毕后将自动保存并导入至生词本！</div>
              </div>
            </div>
          )}

          {/* Import Success Banner */}
          {importSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500 text-white rounded-xl">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-emerald-900 text-sm">
                    已成功导入自定义词表《{selectedBook.name}》({bookWords.length} 个单词)！
                  </div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    该词表已成功加入生词本。你可以随时进入【生词本】查看自定义词表、管理单词或发起专项练习。
                  </div>
                </div>
              </div>
              {onGoToNotebook && (
                <button
                  onClick={onGoToNotebook}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
                >
                  前往生词本查看词表 →
                </button>
              )}
            </div>
          )}

          {/* Book Content Loading / Error / Table */}
          {loadingBook ? (
            <WordGridSkeleton count={4} />
          ) : bookError ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
              <p className="text-sm text-red-600 font-medium">{bookError}</p>
              <button 
                onClick={() => handleSelectBook(selectedBook)}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors shadow-xs"
              >
                重试加载词书
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {paginatedBookWords.map((item, idx) => (
                  <WordCard
                    key={`${item.word}-${idx}`}
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
                    indexLabel={pageStartIndex + idx + 1}
                  />
                ))}
              </div>

              {/* Bottom Pagination */}
              <Pagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={filteredBookWords.length}
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

        </div>
      )}

      {/* End of content */}

    </div>
  );
};
