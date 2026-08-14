import React, { useState, useRef, useMemo } from 'react';
import { Upload, ListPlus, ArrowRight, CheckCircle2, AlertCircle, Loader2, BookOpen, Layers } from 'lucide-react';
import { WordItem, WordListGroup } from '../types';
import { parsePlainWordList, resolveWordsWithDictionary, enrichWordsWithAI } from '../utils/wordParser';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { WordCard } from './ui/WordCard';

interface TextAnalyzerProps {
  onWordsExtracted: (words: WordItem[], listName?: string) => void;
  onStartQuiz: (words: WordItem[]) => void;
  extractedWords: WordItem[];
  customWordLists?: WordListGroup[];
}

export const TextAnalyzer: React.FC<TextAnalyzerProps> = ({
  onWordsExtracted,
  onStartQuiz,
  extractedWords,
  customWordLists = [],
}) => {
  const [wordText, setWordText] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [listName, setListName] = useState<string>('默认词本');
  const [isNewListName, setIsNewListName] = useState<boolean>(false);
  const [newListName, setNewListName] = useState<string>('');

  const existingListNames = useMemo(() => {
    const names = new Set<string>(['默认词本']);
    customWordLists.forEach((list) => {
      names.add(list.name === '默认单词列表' ? '默认词本' : list.name);
    });
    return Array.from(names);
  }, [customWordLists]);

  const resolveTargetListName = () => {
    if (isNewListName) {
      return newListName.trim() || '默认词本';
    }
    const resolved = listName.trim() || '默认词本';
    return resolved === '默认单词列表' ? '默认词本' : resolved;
  };

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setWordText(content);
      }
    };
    reader.onerror = () => {
      setErrorMessage('无法读取该文件内容，请重试或直接粘贴文本。');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

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
        const enVoice = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel'))
        );
        if (enVoice) utterance.voice = enVoice;
        window.speechSynthesis.speak(utterance);
      }, 80);
    }
  };

  const handleImport = async () => {
    if (!wordText.trim()) {
      setErrorMessage('请输入或粘贴单词列表');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const targetListName = resolveTargetListName();
    const parsed = parsePlainWordList(wordText);

    if (parsed.length === 0) {
      setErrorMessage('未能解析出有效单词。请确保每行仅包含一个英文单词，例如：\ntrain\ntest\nsince');
      return;
    }

    setIsLoading(true);
    setProgressStatus(`正在查询词库… (0/${parsed.length})`);

    try {
      const { resolved, needsAi } = await resolveWordsWithDictionary(parsed);

      let aiEnriched: WordItem[] = [];
      if (needsAi.length > 0) {
        setProgressStatus(`词库已匹配 ${resolved.length} 个，AI 补全中 (0/${needsAi.length})…`);
        aiEnriched = await enrichWordsWithAI(needsAi, (processed, total) => {
          setProgressStatus(`AI 补全中… ${processed} / ${total}`);
        });
      }

      const enrichedWords = [...resolved, ...aiEnriched];
      onWordsExtracted(enrichedWords, targetListName);
      setSuccessMessage(
        `成功导入 ${enrichedWords.length} 个单词至「${targetListName}」。` +
          ` 词库命中 ${resolved.length} 个` +
          (aiEnriched.length > 0 ? `，AI 补全 ${aiEnriched.length} 个。` : '。')
      );
    } catch (err: unknown) {
      console.error('Import error:', err);
      setErrorMessage('导入失败，请检查网络后重试。');
    } finally {
      setIsLoading(false);
      setProgressStatus('');
    }
  };

  const wordCount = wordText.trim() ? parsePlainWordList(wordText).length : 0;

  return (
    <div className="page-container space-y-6">
      <PageHeader
        badge="快捷导入"
        badgeIcon={ListPlus}
        title="导入词本"
        description="粘贴或上传纯单词列表（每行一个英文单词）。词库中已有的词条直接引用，仅对缺失词条调用 AI 补全。"
      />

      <Card padding="md" className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="font-semibold text-primary text-sm flex items-center gap-2">
              <ListPlus className="w-4 h-4 text-slate-500" />
              <span>单词列表（每行一个）</span>
            </label>
            <div className="flex items-center gap-3 text-xs text-muted">
              {wordCount > 0 && <span>{wordCount} 个单词</span>}
              <button
                type="button"
                onClick={() => {
                  setWordText('');
                  setFileName(null);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                清空
              </button>
            </div>
          </div>

          <textarea
            value={wordText}
            onChange={(e) => {
              setWordText(e.target.value);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            placeholder={`每行一个英文单词，例如：

train
test
since
explore
curious`}
            rows={12}
            className="w-full p-3.5 rounded-xl surface-input focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 outline-none resize-none text-sm leading-relaxed font-mono transition-all"
          />
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors flex items-center justify-center gap-3 ${
            isDragOver
              ? 'border-slate-400 bg-slate-50 dark:bg-slate-800/50'
              : 'border-slate-200 dark:border-slate-600 surface-muted hover:opacity-90'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.text"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />
          <Upload className="w-5 h-5 text-slate-500" />
          <div className="text-xs text-secondary text-left">
            <span className="font-medium text-primary">点击上传</span> 或拖拽 .txt 文件到这里
            {fileName && <span className="block font-semibold text-slate-600 dark:text-slate-300 mt-0.5">已选中: {fileName}</span>}
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-secondary flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>保存至词本：</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={isNewListName ? '__new__' : listName}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setIsNewListName(true);
                  } else {
                    setIsNewListName(false);
                    setListName(e.target.value);
                  }
                }}
                className="w-full sm:w-56 px-3 py-1.5 text-xs rounded-lg surface-input focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 outline-none font-medium transition-all cursor-pointer shrink-0"
              >
                <option value="__new__">＋ 新建词本...</option>
                {existingListNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {isNewListName && (
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="输入新词本名称"
                  className="w-full sm:flex-1 sm:min-w-0 px-3 py-1.5 text-xs rounded-lg surface-input focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 outline-none font-medium transition-all"
                />
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleImport} disabled={isLoading || !wordText.trim()} size="lg">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{progressStatus || '正在导入…'}</span>
                </>
              ) : (
                <>
                  <ListPlus className="w-4 h-4" />
                  <span>导入词本</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}
      </Card>

      {extractedWords.length > 0 && (
        <Card padding="lg" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-slate-500" />
                <h2 className="text-lg font-bold text-primary">已导入词本</h2>
                <span className="px-2.5 py-0.5 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full border border-slate-200 dark:border-slate-600">
                  {extractedWords.length} 个单词
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                已自动加入待测试生词本。测试中连续答对 3 次即可自动标记已掌握并移出生词本。
              </p>
            </div>

            <Button onClick={() => onStartQuiz(extractedWords)}>
              <BookOpen className="w-4 h-4" />
              <span>以此词库发起测试 (最多30词)</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[520px] overflow-y-auto pr-1">
            {extractedWords.map((item, idx) => (
              <WordCard
                key={item.id || idx}
                word={item.word}
                phonetic={item.phonetic}
                chinese={item.chinese}
                exampleSentence={item.exampleSentence}
                exampleSentenceCn={item.exampleSentenceCn}
                isSpeaking={speakingWord === item.word}
                onSpeak={() => speakWord(item.word, item.exampleSentence)}
                onClick={() => speakWord(item.word, item.exampleSentence)}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
