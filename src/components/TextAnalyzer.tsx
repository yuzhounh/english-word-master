import React, { useState, useRef } from 'react';
import { SpeakerIcon } from './SpeakerIcon';
import { Upload, FileText, Sparkles, ArrowRight, CheckCircle2, AlertCircle, Loader2, BookOpen, Layers, ListPlus, Zap, Check, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { WordItem } from '../types';
import { parseWordListText, enrichWordsWithAI } from '../utils/wordParser';

interface TextAnalyzerProps {
  onWordsExtracted: (words: WordItem[], listName?: string) => void;
  onStartQuiz: (words: WordItem[]) => void;
  extractedWords: WordItem[];
}

const PRESET_SAMPLES = [
  {
    title: '🤖 科技与AI发展',
    description: '关于人工智能、深度学习与未来科技发展的短文',
    content: `Artificial intelligence is rapidly transforming modern technology. Machine learning algorithms analyze vast amounts of data to detect subtle patterns and make accurate predictions. Researchers are continuously overcoming technical challenges, striving to enhance model efficiency, resilience, and ethical safeguards in daily applications.`
  },
  {
    title: '📖 经典名著名言',
    description: '精选英文名著与名言警句选段',
    content: `It is a truth universally acknowledged that a single man in possession of a good fortune must be in want of a wife. Great ambition is the passion of a great character. Those endowed with it may perform very good or very bad actions. All depends on the principles which guide them.`
  },
  {
    title: '💼 商务与职场沟通',
    description: '涵盖会议、项目协作与战略规划的实用表达',
    content: `Our quarterly performance demonstrated exceptional growth across international markets. We must execute strategic initiatives to streamline operational workflows and foster sustainable client relationships while adapting dynamically to volatile economic conditions.`
  },
  {
    title: '🌍 环球新闻与探索',
    description: '关于地理、自然探险与环境生态的叙述',
    content: `Scientists embarking on marine expeditions discovered fascinating underwater ecosystems flourishing in extreme pressure and dark environments. These resilient organisms produce unique bioluminescent signals to navigate and communicate across depths.`
  },
  {
    title: '🌱 心理学与自我提升',
    description: '关于专注力、习惯培养与个人成长的洞察',
    content: `Developing sustainable habits requires mindfulness, self-discipline, and consistent practice. Cognitive flexibility allows individuals to reframe adversity, foster emotional resilience, and cultivate creative problem-solving skills in high-pressure environments.`
  },
  {
    title: '🎨 艺术与美学生活',
    description: '探索建筑设计、审美体验与历史文化碰撞',
    content: `Architectural innovation seamlessly integrates historical craftsmanship with modern minimalism. Aesthetic appreciation evokes profound emotional responses, reflecting cultural heritage while inspiring contemporary artists to challenge traditional boundaries.`
  }
];

export const TextAnalyzer: React.FC<TextAnalyzerProps> = ({
  onWordsExtracted,
  onStartQuiz,
  extractedWords
}) => {
  const [inputMode, setInputMode] = useState<'analyze' | 'directList'>('analyze');
  const [inputText, setInputText] = useState<string>('');
  const [directText, setDirectText] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [listName, setListName] = useState<string>('默认单词列表');
  const [maxWords, setMaxWords] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [autoEnrich, setAutoEnrich] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle File Upload (.txt, .md, .xlsx, .xls, .csv, .json)
  const handleFileUpload = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setErrorMessage(null);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet);

          if (rows.length === 0) {
            setErrorMessage('Excel 文件为空，未能找到有效的行数据。');
            return;
          }

          setIsLoading(true);

          const parsedWords = rows.map((row) => {
            const word = (row['单词'] || row['word'] || row['Word'] || '').toString().trim();
            const phoneticUk = (row['英音'] || row['phonetic_uk'] || '').toString().trim();
            const phoneticUs = (row['美音'] || row['phonetic_us'] || '').toString().trim();
            const chinese = (row['释义'] || row['翻译'] || row['chinese'] || row['meaning'] || '').toString().trim();
            const example = (row['例句'] || row['example'] || '').toString().trim();
            const exampleCn = (row['例句翻译'] || row['example_cn'] || '').toString().trim();

            return {
              word,
              chinese,
              phonetic: phoneticUs || phoneticUk || '',
              exampleSentence: example,
              exampleSentenceCn: exampleCn
            };
          }).filter((w) => w.word.length > 0);

          if (parsedWords.length === 0) {
            setErrorMessage('未能在 Excel 列（单词/word）中读取到有效的英文单词');
            setIsLoading(false);
            return;
          }

          // Automatically enrich words with AI if example sentences or definitions are missing
          const targetListName = listName.trim() || fileName || '默认单词列表';
          const needsEnrichment = parsedWords.some((w) => !w.exampleSentence || !w.chinese);
          if (needsEnrichment && autoEnrich) {
            setProgressStatus(`AI 正在智能补全中英双语例句与音标 (0/${parsedWords.length})...`);
            const enriched = await enrichWordsWithAI(parsedWords, (processed, total) => {
              const percent = Math.round((processed / total) * 100);
              setProgressStatus(`AI 正在智能生成例句与音标... 已完成 ${processed} / ${total} 词 (${percent}%)`);
            });
            onWordsExtracted(enriched, targetListName);
            setSuccessMessage(`解析 Excel 文件成功！AI 已自动补全例句与音标，共加入 ${enriched.length} 个单词至「${targetListName}」！`);
          } else {
            const formattedWords: WordItem[] = parsedWords.map((w) => ({
              id: w.word.toLowerCase().trim(),
              word: w.word,
              phonetic: w.phonetic,
              chinese: w.chinese || w.word,
              exampleSentence: w.exampleSentence || '',
              exampleSentenceCn: w.exampleSentenceCn || ''
            }));
            onWordsExtracted(formattedWords, targetListName);
            setSuccessMessage(`成功导入 Excel 文件！共加载 ${formattedWords.length} 个单词到「${targetListName}」！`);
          }
        } catch (err: any) {
          console.error('Excel parse error:', err);
          setErrorMessage('解析 Excel 文件失败，请确认文件格式正确。');
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          if (inputMode === 'directList') {
            setDirectText(content);
          } else {
            setInputText(content);
          }
        }
      };
      reader.onerror = () => {
        setErrorMessage('无法读取该文件内容，请重试或直接粘贴文本。');
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  // Speak word and example sentence with micro-delay to prevent audio clipping
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

  // Submit Text for AI Analysis
  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      setErrorMessage('请输入或上传一段英文文本');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProgressStatus('AI 正在分析文章并提取核心词汇...');

    const targetListName = listName.trim() || '默认单词列表';

    const allWords: WordItem[] = [];
    let resume: string | null = null;
    let isFirstCall = true;
    let finished = false;
    let hasError = false;
    let loopCount = 0;

    try {
      while (!finished && loopCount < 100) {
        loopCount++;
        const body = isFirstCall ? { text: inputText, maxWords } : { resume };
        const response = await fetch('/api/analyze-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await response.json();

        if (data.success && Array.isArray(data.words)) {
          allWords.push(...data.words);
          isFirstCall = false;
          finished = !!data.done;
          resume = data.resume || null;
          if (!finished && !resume) finished = true;
          setProgressStatus(`AI 正在提取核心词汇...（已提取 ${allWords.length} 个单词，长文分段处理中）`);
        } else {
          setErrorMessage(data.error || '分析提取失败，请重试。');
          hasError = true;
          break;
        }
      }
    } catch (err: any) {
      console.error('Analysis API error:', err);
      setErrorMessage('无法连接到分析服务，请检查网络或稍后重试。');
      hasError = true;
    }

    setProgressStatus('');

    if (!hasError && allWords.length > 0) {
      const deduped = Array.from(new Map(allWords.map(w => [w.id, w])).values());
      onWordsExtracted(deduped, targetListName);
      setSuccessMessage(`文章提取完成，成功提取 ${deduped.length} 个核心词汇并保存至生词本（单词列表：「${targetListName}」）！`);
    } else if (!hasError && allWords.length === 0) {
      setErrorMessage('未能从文本中提取出有效词汇，请尝试更换文章或增加目标词量。');
    }

    setIsLoading(false);
  };

  // Direct Word List Import (Skipping AI Analysis, with smart parsing & optional AI enrichment)
  const handleDirectImport = async () => {
    if (!directText.trim()) {
      setErrorMessage('请输入或粘贴单词列表');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const targetListName = listName.trim() || '默认单词列表';
    const parsed = parseWordListText(directText);

    if (parsed.length === 0) {
      setErrorMessage('未能从文本中解析出有效的英文单词，请检查输入内容。');
      return;
    }

    if (autoEnrich) {
      setIsLoading(true);
      setProgressStatus(`AI 正在智能生成中英双语例句与音标 (0/${parsed.length})...`);
      try {
        const enrichedWords = await enrichWordsWithAI(parsed, (processed, total) => {
          const percent = Math.round((processed / total) * 100);
          setProgressStatus(`AI 正在智能生成例句与音标... 已完成 ${processed} / ${total} 词 (${percent}%)`);
        });
        onWordsExtracted(enrichedWords, targetListName);
        setSuccessMessage(`解析成功！AI 已自动补充词性与例句，并将 ${enrichedWords.length} 个单词保存至生词本（单词列表：「${targetListName}」）！`);
      } catch (err: any) {
        console.error('Enrichment error:', err);
        const fallbackWords: WordItem[] = parsed.map((p) => ({
          id: p.word.toLowerCase(),
          word: p.word,
          phonetic: p.phonetic || '',
          chinese: p.chinese || p.word,
          exampleSentence: p.exampleSentence || '',
          exampleSentenceCn: p.exampleSentenceCn || ''
        }));
        onWordsExtracted(fallbackWords, targetListName);
        setSuccessMessage(`成功将 ${fallbackWords.length} 个单词保存至生词本（单词列表：「${targetListName}」）！`);
      } finally {
        setIsLoading(false);
      }
    } else {
      const basicWords: WordItem[] = parsed.map((p) => ({
        id: p.word.toLowerCase(),
        word: p.word,
        phonetic: p.phonetic || '',
        chinese: p.chinese || p.word,
        exampleSentence: p.exampleSentence || '',
        exampleSentenceCn: p.exampleSentenceCn || ''
      }));
      onWordsExtracted(basicWords, targetListName);
      setSuccessMessage(`已将 ${basicWords.length} 个单词保存至生词本（单词列表：「${targetListName}」）！`);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 py-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-pink-900 to-rose-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/20 text-pink-200 text-xs font-medium mb-3 border border-pink-400/30">
            <Sparkles className="w-3.5 h-3.5 text-pink-300" />
            <span>智能文本分析 & 快捷生词导入</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            导入文本提取核心词，或直接导入单词列表
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            既可通过 AI 分析短文还原词干，也可<b>直接粘贴单词列表（由 AI 自动补充例句与测验）</b>批量加入生词本！
          </p>
        </div>
      </div>

      {/* Input Mode Tabs & Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Main Text Input & File Upload */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex-1 flex flex-col justify-between space-y-4">
            
            {/* Mode Switcher */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => { setInputMode('analyze'); setErrorMessage(null); setSuccessMessage(null); }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  inputMode === 'analyze'
                    ? 'bg-pink-600 text-white shadow-sm shadow-pink-100'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>提取核心词汇</span>
              </button>

              <button
                type="button"
                onClick={() => { setInputMode('directList'); setErrorMessage(null); setSuccessMessage(null); }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  inputMode === 'directList'
                    ? 'bg-pink-600 text-white shadow-sm shadow-pink-100'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>导入单词列表</span>
              </button>
            </div>

            {inputMode === 'analyze' ? (
              <>
                {/* AI Textarea Mode */}
                <div className="space-y-3">
                  <div className="grid grid-cols-3 items-center text-xs">
                    <label className="font-semibold text-slate-800 text-sm flex items-center gap-2 justify-start">
                      <FileText className="w-4 h-4 text-pink-600 shrink-0" />
                      <span className="truncate">英文文章 / 段落内容</span>
                    </label>
                    <div className="text-center text-slate-400 font-normal">
                      {inputText.length} 字符
                    </div>
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setInputText('');
                          setFileName(null);
                          setErrorMessage(null);
                          setSuccessMessage(null);
                        }}
                        className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        清空文本
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    placeholder={`在此粘贴任意英文文章、新闻、阅读理解段落...

💡 提示：系统会自动过滤文章标题与非词汇干扰，准确提取有效英文单词；分析时将由 AI 智能补全词性、音标、精美例句与测验题。`}
                    rows={8}
                    className="w-full p-3.5 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 outline-none resize-none text-slate-700 text-sm leading-relaxed transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Drag and Drop File Upload Area */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors flex items-center justify-center gap-3 ${
                    isDragOver ? 'border-pink-500 bg-pink-50/50' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/80'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.doc,.docx,.pdf,.csv,.json"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  />
                  <Upload className="w-5 h-5 text-pink-600" />
                  <div className="text-xs text-slate-600 text-left">
                    <span className="font-medium text-slate-800">点击上传文件</span> 或拖拽 txt, md, csv 到这里
                    {fileName && <span className="block font-semibold text-pink-600 mt-0.5">已选中: {fileName}</span>}
                  </div>
                </div>

                {/* Extraction Quantity Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 pb-1 border-t border-slate-100">
                  <span className="text-xs font-medium text-slate-500">目标提取词量：</span>
                  <div className="inline-flex rounded-lg bg-slate-100 p-1 gap-1">
                    {[
                      { count: 20, label: '20 核心词' },
                      { count: 30, label: '30 标准词' },
                      { count: 50, label: '50 深度全量' }
                    ].map((opt) => (
                      <button
                        key={opt.count}
                        type="button"
                        onClick={() => setMaxWords(opt.count)}
                        className={`px-3 py-1 text-xs rounded-md transition-all cursor-pointer font-medium ${
                          maxWords === opt.count
                            ? 'bg-white text-pink-600 shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Direct Word List Mode */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="font-semibold text-slate-800 text-sm flex items-center gap-2 shrink-0">
                        <ListPlus className="w-4 h-4 text-pink-600" />
                        <span>粘贴单词列表（自动兼容各种格式）</span>
                      </label>
                      <span className="text-xs text-slate-400 font-normal">
                        支持教材词表 / 纯单词 / 编号释义列表
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDirectText('');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors shrink-0 cursor-pointer"
                    >
                      清空文本
                    </button>
                  </div>

                  <textarea
                    value={directText}
                    onChange={(e) => {
                      setDirectText(e.target.value);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    placeholder={`支持以下多种导入格式（自动兼容过滤）：

格式 1 & 2 (纯单词列表/含单元标题):
### Welcome Unit
exchange
lecture
registration

格式 3 & 4 (编号带词性释义列表/Markdown):
1. **exchange** n. 交换；交流 vt. 交换；交流；兑换
2. **lecture** n. 讲座；讲课 vi. 讲座 vt. 训斥
3.  registration n. 登记；注册；挂号

💡 提示：系统会自动忽略“Welcome Unit”、“按通用教材整理”等非词汇行，准确提取有效英文单词；系统将由 AI 智能自动补全词性、音标、精美例句与测验题。`}
                    rows={9}
                    className="w-full p-3.5 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 outline-none resize-none text-slate-700 text-xs sm:text-sm leading-relaxed transition-all placeholder:text-slate-400 font-mono"
                  />
                </div>
              </>
            )}

            {/* Target Custom List Name Input & Action Button in one row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0">
                  <Layers className="w-3.5 h-3.5 text-pink-600" />
                  <span>保存至单词列表：</span>
                </label>
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="默认单词列表"
                  className="w-44 sm:w-56 px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 outline-none text-slate-700 font-medium transition-all"
                />
              </div>

              <div>
                {inputMode === 'analyze' ? (
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={isLoading || !inputText.trim()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:opacity-50 text-white font-medium text-sm rounded-xl shadow-md shadow-pink-200 transition-all cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{progressStatus || 'AI 正在提取文章核心词汇...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>提取核心词汇</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDirectImport}
                    disabled={isLoading || !directText.trim()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:opacity-50 text-white font-medium text-sm rounded-xl shadow-md shadow-pink-200 transition-all cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{progressStatus || 'AI 正在补全词性、例句与音标...'}</span>
                      </>
                    ) : (
                      <>
                        <ListPlus className="w-4 h-4" />
                        <span>导入单词列表</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Error message */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success message */}
            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Preset Sample Text Cards */}
        <div className="flex flex-col">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex-1 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <BookOpen className="w-4 h-4 text-pink-600" />
                <h3 className="font-bold text-slate-800 text-sm">预置阅读素材样张</h3>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                点击下方示例快速填入进行测试：
              </p>
            </div>

            <div className="space-y-2 flex-1 flex flex-col justify-around">
              {PRESET_SAMPLES.map((sample, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setInputMode('analyze');
                    setInputText(sample.content);
                    setFileName(null);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="p-2.5 rounded-xl border border-slate-100 hover:border-pink-200 hover:bg-pink-50/40 transition-all cursor-pointer group flex-1 flex flex-col justify-center"
                >
                  <div className="font-semibold text-xs text-slate-800 group-hover:text-pink-600 transition-colors">
                    {sample.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1.5 line-clamp-1">
                    {sample.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Extracted Words List Section */}
      {extractedWords && extractedWords.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-pink-500" />
                <h2 className="text-lg font-bold text-slate-800">已提取/导入单词列表</h2>
                <span className="px-2.5 py-0.5 text-xs font-bold bg-pink-50 text-pink-700 rounded-full border border-pink-100">
                  {extractedWords.length} 个核心词汇
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                已自动加入待测试生词本。测试中<b>连续答对 3 次即可自动标记已掌握并移出生词本</b>。
              </p>
            </div>

            <button
              onClick={() => onStartQuiz(extractedWords)}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium text-sm rounded-xl shadow-md shadow-amber-100 transition-all cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>以此词库发起测试 (最多30词)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Word Table Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[520px] overflow-y-auto pr-1">
            {extractedWords.map((item, idx) => (
              <div
                key={item.id || idx}
                onClick={() => speakWord(item.word, item.exampleSentence)}
                className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs hover:shadow-md hover:border-pink-300 transition-all space-y-2 relative group cursor-pointer active:scale-[0.99]"
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
                        className="p-1 text-slate-400 hover:text-pink-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer translate-y-[3.5px]"
                        title="发音（单词+例句）"
                      >
                        <SpeakerIcon isSpeaking={speakingWord === item.word} className="w-5 h-5" />
                      </button>
                    </div>
                    {item.phonetic && (
                      <span className="text-sm font-mono text-slate-500 font-medium">{item.phonetic}</span>
                    )}
                  </div>
                </div>

                {/* Chinese definition */}
                <div className="text-base font-bold text-pink-900 bg-pink-50/70 py-2 px-3 rounded-xl border border-pink-100/80 leading-snug">
                  {item.chinese}
                </div>

                {/* Example sentence */}
                {item.exampleSentence && (
                  <div className="text-sm text-slate-700 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 space-y-0.5">
                    <p className="font-medium text-slate-800 italic leading-snug">“{item.exampleSentence}”</p>
                    {item.exampleSentenceCn && (
                      <p className="text-slate-500 text-sm leading-snug">{item.exampleSentenceCn}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
