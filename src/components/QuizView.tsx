import React, { useState, useEffect, useRef } from 'react';
import { SpeakerIcon } from './SpeakerIcon';
import { CheckCircle, XCircle, RefreshCw, Bookmark, Award, RotateCcw, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { WordItem, QuizQuestion, SpeechAccent } from '../types';
import { ProgressBar } from './ui/ProgressBar';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { PageHeader } from './ui/PageHeader';

interface QuizViewProps {
  wordPool: WordItem[];
  onRecordWrongWord: (word: WordItem) => void;
  onRecordMasteredWord?: (wordId: string) => void;
  onGoToWrongWords: () => void;
  wrongWordsCount: number;
  speechAccent?: SpeechAccent;
}

// Default high-frequency learning vocabulary if pool is empty
const DEFAULT_VOCABULARY: WordItem[] = [
  { id: 'abandon', word: 'abandon', phonetic: '/əˈbændən/', chinese: 'vt. 放弃，抛弃；离弃', exampleSentence: 'He decided to abandon his car by the road.', exampleSentenceCn: '他决定把车弃在路边。', options: ['vt. 放弃，抛弃；离弃', 'vt. 吸收，同化', 'adj. 丰富的大量的', 'n. 敏锐，聪慧'] },
  { id: 'resilient', word: 'resilient', phonetic: '/rɪˈzɪliənt/', chinese: 'adj. 适应力强的；有韧性的', exampleSentence: 'She is a resilient woman who overcomes difficulties.', exampleSentenceCn: '她是个适应力强、能克服困难的女性。', options: ['adj. 适应力强的；有韧性的', 'adj. 繁重的；沉重的', 'adj. 随机的，任意的', 'adj. 犹豫不决的'] },
  { id: 'meticulous', word: 'meticulous', phonetic: '/mɪˈtɪkjələs/', chinese: 'adj. 严谨的；一丝不苟的', exampleSentence: 'He is meticulous in his work.', exampleSentenceCn: '他对待工作一丝不苟。', options: ['adj. 严谨的；一丝不苟的', 'adj. 模棱两可的', 'adj. 恶毒的，有害的', 'adj. 繁荣的，兴旺的'] },
  { id: 'pragmatic', word: 'pragmatic', phonetic: '/præɡˈmætɪk/', chinese: 'adj. 务实的，重实效的', exampleSentence: 'We need a pragmatic solution to this issue.', exampleSentenceCn: '我们需要一个解决这个问题的务实方案。', options: ['adj. 务实的，重实效的', 'adj. 傲慢的，自大的', 'adj. 脆弱的，易碎的', 'adj. 系统的，有条理的'] },
  { id: 'scrutinize', word: 'scrutinize', phonetic: '/ˈskruːtənaɪz/', chinese: 'v. 仔细检查，审视', exampleSentence: 'Inspectors scrutinize all safety equipment carefully.', exampleSentenceCn: '检查员仔细检查所有安全设备。', options: ['v. 仔细检查，审视', 'v. 包含，包容', 'v. 加速，促进', 'v. 延迟，耽搁'] },
  { id: 'foster', word: 'foster', phonetic: '/ˈfɔːstər/', chinese: 'v. 培养，促进；抚育', exampleSentence: 'Teachers foster creative thinking in students.', exampleSentenceCn: '教师培养学生的创造性思维。', options: ['v. 培养，促进；抚育', 'v. 阻碍，妨碍', 'v. 废除，取消', 'v. 吞没，淹没'] },
  { id: 'elucidate', word: 'elucidate', phonetic: '/ɪˈluːsɪdeɪt/', chinese: 'v. 阐明，说明', exampleSentence: 'The scientist gave a talk to elucidate the research.', exampleSentenceCn: '这位科学家做讲座阐明了研究。', options: ['v. 阐明，说明', 'v. 模糊，混淆', 'v. 伪造，模仿', 'v. 消耗，耗尽'] },
  { id: 'lucid', word: 'lucid', phonetic: '/ˈluːsɪd/', chinese: 'adj. 表达清晰的；易懂的', exampleSentence: 'She provided a lucid explanation of the concept.', exampleSentenceCn: '她对这一概念作了清晰易懂的解释。', options: ['adj. 表达清晰的；易懂的', 'adj. 阴暗的，晦涩的', 'adj. 冲动的，鲁莽的', 'adj. 遥远的，疏远的'] },
  { id: 'subtle', word: 'subtle', phonetic: '/ˈsʌtl/', chinese: 'adj. 微妙的，不易察觉的', exampleSentence: 'There are subtle differences between the two words.', exampleSentenceCn: '这两个词之间有微妙的差异。', options: ['adj. 微妙的，不易察觉的', 'adj. 显著的，巨大的', 'adj. 粗鲁的，无礼的', 'adj. 固执的，顽固的'] },
  { id: 'thrive', word: 'thrive', phonetic: '/θraɪv/', chinese: 'v. 繁荣，茁壮成长', exampleSentence: 'Plants thrive in well-drained soil.', exampleSentenceCn: '植物在排水良好的土壤中茁壮成长。', options: ['v. 繁荣，茁壮成长', 'v. 衰退，减少', 'v. 忽视，忽略', 'v. 模仿，复制'] },
  { id: 'coherent', word: 'coherent', phonetic: '/kəʊˈhɪərənt/', chinese: 'adj. 连贯的，条理分明的', exampleSentence: 'He put forward a coherent argument.', exampleSentenceCn: '他提出了一个连贯有力的论点。', options: ['adj. 连贯的，条理分明的', 'adj. 混乱的，散乱的', 'adj. 极端的，剧烈的', 'adj. 偶然的，意外的'] },
  { id: 'ambiguous', word: 'ambiguous', phonetic: '/æmˈbɪɡjuəs/', chinese: 'adj. 模棱两可的，含糊的', exampleSentence: 'His answer was ambiguous and unclear.', exampleSentenceCn: '他的回答模棱两可，不明确。', options: ['adj. 模棱两可的，含糊的', 'adj. 明确的，直截了当的', 'adj. 友好的，和蔼的', 'adj. 雄心勃勃的'] },
  { id: 'versatile', word: 'versatile', phonetic: '/ˈvɜːsətaɪl/', chinese: 'adj. 多才多艺的；多用途的', exampleSentence: 'This software is versatile and easy to use.', exampleSentenceCn: '这款软件功能多样且易于使用。', options: ['adj. 多才多艺的；多用途的', 'adj. 单一的，局限的', 'adj. 固执的，不变的', 'adj. 昂贵的，奢侈的'] },
  { id: 'imperative', word: 'imperative', phonetic: '/ɪmˈperətɪv/', chinese: 'adj. 极重要的；紧急的', exampleSentence: 'It is imperative that we act immediately.', exampleSentenceCn: '我们必须立即行动，这至关重要。', options: ['adj. 极重要的；紧急的', 'adj. 可有可无的', 'adj. 休闲的，轻松的', 'adj. 历史悠久的'] },
  { id: 'mitigate', word: 'mitigate', phonetic: '/ˈmɪtɪɡeɪt/', chinese: 'v. 减轻，缓和', exampleSentence: 'Trees help mitigate the impact of climate change.', exampleSentenceCn: '树木有助于减轻气候变化的影响。', options: ['v. 减轻，缓和', 'v. 加剧，恶化', 'v. 预测，预报', 'v. 批准，认可'] },
  { id: 'adversity', word: 'adversity', phonetic: '/ədˈvɜːsəti/', chinese: 'n. 逆境，不幸', exampleSentence: 'She showed great courage in the face of adversity.', exampleSentenceCn: '面对逆境，她表现出了极大的勇气。', options: ['n. 逆境，不幸', 'n. 顺境，好运', 'n. 复杂性，繁琐', 'n. 多样性，差异'] },
  { id: 'culminate', word: 'culminate', phonetic: '/ˈkʌlmɪneɪt/', chinese: 'v. 达到高潮；以...告终', exampleSentence: 'Years of research culminated in a major discovery.', exampleSentenceCn: '多年的研究最终带来了一项重大发现。', options: ['v. 达到高潮；以...告终', 'v. 刚开始，启动', 'v. 停滞，卡住', 'v. 分离，隔开'] },
  { id: 'tangible', word: 'tangible', phonetic: '/ˈtændʒəbl/', chinese: 'adj. 有形的；可感知的', exampleSentence: 'We need tangible proof of progress.', exampleSentenceCn: '我们需要进度的有形证据。', options: ['adj. 有形的；可感知的', 'adj. 虚幻的，抽象的', 'adj. 昂贵的，高价的', 'adj. 琐碎的，无足轻重的'] },
  { id: 'indispensable', word: 'indispensable', phonetic: '/ˌɪndɪˈspensəbl/', chinese: 'adj. 不可或缺的，绝对必要的', exampleSentence: 'Air and water are indispensable to human life.', exampleSentenceCn: '空气和水对人类生存而言是不可或缺的。', options: ['adj. 不可或缺的，绝对必要的', 'adj. 多余的，可替代的', 'adj. 暂时的，临时的', 'adj. 令人困惑的'] },
  { id: 'empirical', word: 'empirical', phonetic: '/ɪmˈpɪrɪkl/', chinese: 'adj. 实证的，以经验为依据的', exampleSentence: 'The theory is supported by empirical evidence.', exampleSentenceCn: '该理论得到了实证证据的支持。', options: ['adj. 实证的，以经验为依据的', 'adj. 纯主观的，凭空的', 'adj. 理论化的，推测的', 'adj. 传说的，神话的'] },
  { id: 'profound', word: 'profound', phonetic: '/prəˈfaʊnd/', chinese: 'adj. 深刻的；深远的', exampleSentence: 'The book had a profound effect on my life.', exampleSentenceCn: '这本书对我的人生有着深刻的影响。', options: ['adj. 深刻的；深远的', 'adj. 肤浅的，表面上的', 'adj. 狭隘的，偏执的', 'adj. 简短的，短暂的'] },
  { id: 'persevere', word: 'persevere', phonetic: '/ˌpɜːsəˈvɪər/', chinese: 'v. 坚持不懈，不屈不挠', exampleSentence: 'If you persevere, you will eventually succeed.', exampleSentenceCn: '如果你坚持不懈，你最终会成功。', options: ['v. 坚持不懈，不屈不挠', 'v. 半途而废，放弃', 'v. 犹豫，观望', 'v. 抱怨，诉苦'] },
  { id: 'paramount', word: 'paramount', phonetic: '/ˈpærəmaʊnt/', chinese: 'adj. 最重要的；至高无上的', exampleSentence: 'Safety is of paramount importance during flight.', exampleSentenceCn: '飞行过程中安全是重中之重。', options: ['adj. 最重要的；至高无上的', 'adj. 次要的，平庸的', 'adj. 隐藏的，秘密的', 'adj. 繁琐的，复杂的'] },
  { id: 'eloquent', word: 'eloquent', phonetic: '/ˈeləkwənt/', chinese: 'adj. 雄辩的；有说服力的', exampleSentence: 'He delivered an eloquent speech.', exampleSentenceCn: '他发表了富有说服力的精彩演说。', options: ['adj. 雄辩的；有说服力的', 'adj. 口拙的，结巴的', 'adj. 沉闷的，乏味的', 'adj. 虚伪的，假装的'] },
  { id: 'compliment', word: 'compliment', phonetic: '/ˈkɒmplɪmənt/', chinese: 'n./v. 赞美，恭维', exampleSentence: 'She paid him a lovely compliment.', exampleSentenceCn: '她给了他一个真诚的赞美。', options: ['n./v. 赞美，恭维', 'n./v. 批评，谴责', 'n./v. 妥协，让步', 'n./v. 忽视，轻视'] },
  { id: 'autonomous', word: 'autonomous', phonetic: '/ɔːˈtɒnəməs/', chinese: 'adj. 自主的，自治的', exampleSentence: 'Autonomous vehicles are being tested in cities.', exampleSentenceCn: '自动驾驶汽车正在城市中接受测试。', options: ['adj. 自主的，自治的', 'adj. 受控的，依赖的', 'adj. 统一的，集中的', 'adj. 传统的手工的'] },
  { id: 'exemplary', word: 'exemplary', phonetic: '/ɪɡˈzempləri/', chinese: 'adj. 典范的，值得效仿的', exampleSentence: 'His conduct was exemplary.', exampleSentenceCn: '他的行为堪称典范。', options: ['adj. 典范的，值得效仿的', 'adj. 恶劣的，令人发指的', 'adj. 普通的，平庸的', 'adj. 罕见的，特异的'] },
  { id: 'innovative', word: 'innovative', phonetic: '/ˈɪnəveɪtɪv/', chinese: 'adj. 创新的，革新的', exampleSentence: 'They came up with an innovative solution.', exampleSentenceCn: '他们出了一个创新的解决方案。', options: ['adj. 创新的，革新的', 'adj. 守旧的，因循守旧的', 'adj. 笨拙的，不灵便的', 'adj. 模仿的，照搬的'] },
  { id: 'pivotal', word: 'pivotal', phonetic: '/ˈpɪvətl/', chinese: 'adj. 关键的，枢纽的', exampleSentence: 'He played a pivotal role in the negotiations.', exampleSentenceCn: '他在谈判中发挥了关键作用。', options: ['adj. 关键的，枢纽的', 'adj. 无关紧要的', 'adj. 边缘的，附带的', 'adj. 停滞的，无生气的'] },
  { id: 'comprehensive', word: 'comprehensive', phonetic: '/ˌkɒmprɪˈhensɪv/', chinese: 'adj. 全面的，广泛的', exampleSentence: 'The report gives a comprehensive overview of the market.', exampleSentenceCn: '该报告对市场作出了全面的概述。', options: ['adj. 全面的，广泛的', 'adj. 局部的，片面的', 'adj. 难以理解的', 'adj. 临时的，打补丁的'] }
];

export const QuizView: React.FC<QuizViewProps> = ({
  wordPool,
  onRecordWrongWord,
  onRecordMasteredWord,
  onGoToWrongWords,
  wrongWordsCount,
  speechAccent
}) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState<number>(0);
  const [wrongInRound, setWrongInRound] = useState<WordItem[]>([]);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Correct answer count map (persisted in localStorage)
  const [correctCounts, setCorrectCounts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('wordmaster_correct_counts');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('wordmaster_correct_counts', JSON.stringify(correctCounts));
    } catch (e) {
      console.error('Failed to save correct counts:', e);
    }
  }, [correctCounts]);

  // Derive current question answer state
  const selectedOption = userAnswers[currentIndex] ?? null;
  const isAnswered = selectedOption !== null;

  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pronounce word or text with a small delay to prevent browser TTS audio clipping
  const speakText = (text: string, delayMs = 80, onEndCallback?: () => void) => {
    if ('speechSynthesis' in window && text) {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }
      window.speechSynthesis.cancel();

      speechTimeoutRef.current = setTimeout(() => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = speechAccent || 'en-US';
        utterance.rate = 0.9;
        
        utterance.onstart = () => setSpeakingText(text);
        utterance.onend = () => {
          setSpeakingText(null);
          if (onEndCallback) {
            onEndCallback();
          }
        };
        utterance.onerror = () => setSpeakingText(null);

        // Pick an English voice if available for smoother pronunciation
        const voices = window.speechSynthesis.getVoices();
        const targetLang = speechAccent || 'en-US';
        const enVoice = voices.find(v => v.lang === targetLang || v.lang.startsWith(targetLang.split('-')[0]));
        if (enVoice) {
          utterance.voice = enVoice;
        }

        window.speechSynthesis.speak(utterance);
      }, delayMs);
    }
  };

  const speakWord = (word: string, exampleSentence?: string, delayMs = 80) => {
    if (!exampleSentence || !exampleSentence.trim()) {
      speakText(word, delayMs);
    } else {
      speakText(word, delayMs, () => {
        speakText(exampleSentence.trim(), 120);
      });
    }
  };

  // Initialize or Restart Quiz (Randomly select 30 words)
  const initQuiz = () => {
    const activePool = wordPool && wordPool.length > 0 ? wordPool : DEFAULT_VOCABULARY;
    
    // Shuffle and pick up to 30 words
    const shuffled = [...activePool].sort(() => Math.random() - 0.5);
    const selected30 = shuffled.slice(0, 30);

    const quizQuestions: QuizQuestion[] = selected30.map((item) => {
      // Create options if not available or build options
      let options = item.options && item.options.length === 4 ? [...item.options] : [item.chinese];
      
      if (options.length < 4) {
        // Collect distractors from other words
        const distractors = activePool
          .filter(w => w.word !== item.word)
          .map(w => w.chinese)
          .sort(() => Math.random() - 0.5);
        
        for (const dist of distractors) {
          if (!options.includes(dist)) {
            options.push(dist);
          }
          if (options.length === 4) break;
        }
      }

      // Shuffle options and remember correctIndex
      options = options.sort(() => Math.random() - 0.5);
      const correctIndex = options.indexOf(item.chinese);

      return {
        id: item.id || item.word.toLowerCase(),
        word: item.word,
        phonetic: item.phonetic || '',
        chinese: item.chinese,
        exampleSentence: item.exampleSentence || '',
        exampleSentenceCn: item.exampleSentenceCn || '',
        options,
        correctIndex: correctIndex >= 0 ? correctIndex : 0
      };
    });

    setQuestions(quizQuestions);
    setCurrentIndex(0);
    setUserAnswers({});
    setScore(0);
    setWrongInRound([]);
    setIsFinished(false);

    // Speak first word automatically after view renders and audio engine warms up (ONLY word before answering)
    if (quizQuestions.length > 0) {
      speakText(quizQuestions[0].word, 300);
    }
  };

  useEffect(() => {
    initQuiz();
    return () => {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [wordPool]);

  // Handle Answer Click
  const handleSelectOption = (index: number) => {
    if (userAnswers[currentIndex] !== undefined) return; // Already answered

    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    setUserAnswers(prev => ({ ...prev, [currentIndex]: index }));

    const isCorrect = index === currentQ.correctIndex;
    const wordId = (currentQ.id || currentQ.word).toLowerCase().trim();

    if (isCorrect) {
      setScore(prev => prev + 1);
      const prevCount = correctCounts[wordId] || 0;
      const newCount = prevCount + 1;
      setCorrectCounts(prev => ({ ...prev, [wordId]: newCount }));

      if (newCount >= 3) {
        if (onRecordMasteredWord) {
          onRecordMasteredWord(currentQ.id);
        }
      }
    } else {
      // Reset correct count on wrong answer
      setCorrectCounts(prev => ({ ...prev, [wordId]: 0 }));

      // Register into wrong words book!
      const wrongItem: WordItem = {
        id: currentQ.id,
        word: currentQ.word,
        phonetic: currentQ.phonetic,
        chinese: currentQ.chinese,
        exampleSentence: currentQ.exampleSentence,
        exampleSentenceCn: currentQ.exampleSentenceCn,
        options: currentQ.options
      };

      onRecordWrongWord(wrongItem);
      setWrongInRound(prev => {
        if (prev.some(w => w.word.toLowerCase() === currentQ.word.toLowerCase())) {
          return prev;
        }
        return [...prev, wrongItem];
      });
    }

    // Automatically speak the word and example sentence upon selection!
    speakWord(currentQ.word, currentQ.exampleSentence, 120);
  };

  // Navigation handlers
  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex > 0) {
      const nextIdx = currentIndex - 1;
      setCurrentIndex(nextIdx);
      if (questions[nextIdx]) {
        if (userAnswers[nextIdx] !== undefined) {
          speakWord(questions[nextIdx].word, questions[nextIdx].exampleSentence);
        } else {
          speakText(questions[nextIdx].word);
        }
      }
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (questions[nextIdx]) {
        if (userAnswers[nextIdx] !== undefined) {
          speakWord(questions[nextIdx].word, questions[nextIdx].exampleSentence);
        } else {
          speakText(questions[nextIdx].word);
        }
      }
    } else {
      setIsFinished(true);
    }
  };

  // Keyboard shortcut support (Left/Right arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (isFinished) return;

      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, questions.length, isFinished]);

  const currentQ = questions[currentIndex];

  if (isFinished) {
    const accuracy = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    return (
      <div className="w-full max-w-2xl mx-auto px-4 space-y-6">
        <Card padding="lg" className="text-center space-y-6 shadow-elevated">
          <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto">
            <Award className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900">本轮 30 词测试完成！</h2>
            <p className="text-slate-500 text-sm mt-1">坚持练习，词汇量稳步提升</p>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
              <div className="text-xs text-slate-500 font-medium">答对单词</div>
              <div className="text-xl font-bold text-emerald-600">{score} / {questions.length}</div>
            </div>
            <div className="border-x border-slate-200">
              <div className="text-xs text-slate-500 font-medium">准确率</div>
              <div className="text-xl font-bold text-brand-600">{accuracy}%</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">进入生词本</div>
              <div className="text-xl font-bold text-rose-600">{wrongInRound.length}</div>
            </div>
          </div>

          {wrongInRound.length > 0 && (
            <div className="text-left space-y-3 pt-2">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5" />
                <span>本轮未掌握生词 ({wrongInRound.length})</span>
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
                {wrongInRound.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{item.word}</span>
                      <span className="text-slate-400 font-mono">{item.phonetic}</span>
                    </div>
                    <span className="text-slate-600 font-medium">{item.chinese}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="primary" size="lg" className="flex-1" onClick={initQuiz}>
              <RotateCcw className="w-4 h-4" />
              <span>再测一轮 (随机30词)</span>
            </Button>
            <Button variant="secondary" size="lg" className="flex-1" onClick={onGoToWrongWords}>
              <Bookmark className="w-4 h-4" />
              <span>查看生词本 ({wrongWordsCount})</span>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!currentQ) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        正在加载测试词库...
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 space-y-5">
      <PageHeader
        badge="词汇测试"
        badgeIcon={BookOpen}
        title="四选一单词测验"
        description="听音辨义，连续答对 3 次自动标记为已掌握"
      />

      <ProgressBar value={currentIndex + 1} max={questions.length} showLabel />

      <Card
        padding="lg"
        className="space-y-6 hover:border-brand-200 transition-colors cursor-pointer"
        onClick={() => {
          if (isAnswered) {
            speakWord(currentQ.word, currentQ.exampleSentence);
          } else {
            speakText(currentQ.word);
          }
        }}
      >
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-between w-full pb-4 border-b border-slate-100">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>上一词</span>
          </button>

          <div className="text-sm font-semibold text-slate-500">
            <span className="text-brand-600 font-bold">{currentIndex + 1}</span> / {questions.length}
          </div>

          <button
            type="button"
            onClick={handleNext}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              isAnswered
                ? 'gradient-brand text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            <span>{currentIndex < questions.length - 1 ? '下一词' : '查看结算'}</span>
            {currentIndex < questions.length - 1 ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <Award className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center gap-3 flex-wrap">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
              {currentQ.word}
            </h1>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isAnswered) {
                  speakWord(currentQ.word, currentQ.exampleSentence);
                } else {
                  speakText(currentQ.word);
                }
              }}
              title={isAnswered ? "播放发音（单词+例句）" : "播放单词发音"}
              className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              <SpeakerIcon isSpeaking={speakingText === currentQ.word} className="w-5 h-5" />
            </button>
          </div>

          {currentQ.phonetic && (
            <div className="text-sm font-mono text-slate-400 tracking-wide">
              {currentQ.phonetic}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          {currentQ.options.map((option, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrect = idx === currentQ.correctIndex;

            let btnStyle = "border border-slate-200 hover:border-brand-400 hover:bg-brand-50/50 text-slate-800";
            let badgeStyle = "bg-slate-100 text-slate-500 group-hover:bg-brand-600 group-hover:text-white";
            let icon = null;

            if (isAnswered) {
              if (isCorrect) {
                btnStyle = "bg-emerald-50 text-emerald-900 border-2 border-emerald-500 font-semibold";
                badgeStyle = "bg-emerald-500 text-white";
                icon = <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />;
              } else if (isSelected && !isCorrect) {
                btnStyle = "bg-rose-50 text-rose-900 border-2 border-rose-500 font-semibold";
                badgeStyle = "bg-rose-500 text-white";
                icon = <XCircle className="w-4 h-4 shrink-0 text-rose-600" />;
              } else {
                btnStyle = "bg-slate-50 text-slate-400 border border-slate-100 opacity-60";
                badgeStyle = "bg-slate-100 text-slate-400";
              }
            }

            return (
              <button
                key={idx}
                disabled={isAnswered}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectOption(idx);
                }}
                className={`p-4 text-left rounded-xl transition-all cursor-pointer flex flex-col justify-between group ${btnStyle}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors ${badgeStyle}`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  {icon}
                </div>
                <p className="text-sm sm:text-base font-medium leading-snug">{option}</p>
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className={`w-full p-4 rounded-xl border text-sm leading-relaxed space-y-2 transition-all ${
            selectedOption === currentQ.correctIndex
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
              : 'bg-rose-50/80 border-rose-200 text-rose-800'
          }`}>
            <div className="font-semibold flex items-center gap-1.5">
              {selectedOption === currentQ.correctIndex ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  {(() => {
                    const wordId = (currentQ.id || currentQ.word).toLowerCase().trim();
                    const currentCount = correctCounts[wordId] || 0;
                    if (currentCount >= 3) {
                      return <span>回答正确！已累计答对 3 次，已标记【已掌握】</span>;
                    }
                    return (
                      <span>
                        回答正确！进度 <b className="text-emerald-700">{currentCount}/3</b>（还需 {3 - currentCount} 次）
                      </span>
                    );
                  })()}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>回答错误，已记入生词本</span>
                </>
              )}
            </div>

            {currentQ.exampleSentence && (
              <div className="pt-3 flex items-start justify-between gap-3 border-t border-slate-200/60 mt-1 bg-white/80 p-3 rounded-xl">
                <div className="space-y-1">
                  <div className="text-sm sm:text-base font-medium italic text-slate-900 leading-snug">
                    "{currentQ.exampleSentence}"
                  </div>
                  {currentQ.exampleSentenceCn && (
                    <div className="text-sm text-slate-600 leading-normal">
                      {currentQ.exampleSentenceCn}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speakText(currentQ.exampleSentence);
                  }}
                  title="朗读例句"
                  className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg shrink-0 cursor-pointer transition-colors"
                >
                  <SpeakerIcon isSpeaking={speakingText === currentQ.exampleSentence} className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between text-sm font-medium text-slate-500 bg-white px-5 py-3 rounded-xl border border-slate-200/80 shadow-card">
        <div className="flex items-center gap-3">
          <span className="text-emerald-600 font-semibold">正确 {score}</span>
          <span className="text-slate-300">|</span>
          <span className="text-rose-600 font-semibold">错误 {wrongInRound.length}</span>
        </div>
        <button
          onClick={initQuiz}
          title="换一轮随机30词"
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
