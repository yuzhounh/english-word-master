import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { Navbar } from './components/Navbar';
import { QuizView } from './components/QuizView';
import { NotebookView } from './components/NotebookView';
import { WordLibraryView } from './components/WordLibraryView';
import { AuthModal } from './components/AuthModal';
import { WordItem, WrongWordItem, MasteredWordItem, UserProfile, SpeechAccent, WordListGroup } from './types';
import { AppTab, NotebookSubTab } from './types/navigation';
import { useTheme } from './hooks/useTheme';
import { useCompactLayout } from './hooks/useCompactLayout';
import { loadOfflineVocabulary } from './lib/offlineVocabulary';
import { exclusiveDeletedWordIds } from './lib/notebookDeletion';
import { useBackHandler } from './hooks/useBackHandler';
import {
  auth,
  completeGoogleRedirectSignIn,
  signInWithGoogle,
  logOut,
  syncWrongWordToFirestore,
  fetchWrongWordsFromFirestore,
  removeWrongWordFromFirestore,
  syncMasteredWordToFirestore,
  fetchMasteredWordsFromFirestore,
  removeMasteredWordFromFirestore,
  moveWordToMasteredInFirestore, moveWordToWrongInFirestore,
  subscribeLearningSync, setLearningSyncUser, retryLearningSync, reportLearningReadError,
  confirmedLearningChanges, clearConfirmedLearningChanges
} from './lib/firebase';
import type { LearningSyncState } from './lib/learningSync';

const LOCAL_STORAGE_WRONG_WORDS_KEY = 'wordmaster_wrong_words_v1';
const LOCAL_STORAGE_MASTERED_WORDS_KEY = 'wordmaster_mastered_words_v1';
const LOCAL_STORAGE_SPEECH_ACCENT_KEY = 'wordmaster_speech_accent_v1';
const LOCAL_STORAGE_CUSTOM_LISTS_KEY = 'wordmaster_custom_lists_v1';
const DELETED_LISTS_KEY = 'wordmaster_deleted_lists_v1';

export default function App() {
  const compactLayout = useCompactLayout();
  React.useLayoutEffect(() => { document.documentElement.classList.toggle('compact-layout', compactLayout); }, [compactLayout]);
  const { resolved, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<AppTab>('quiz');
  const [notebookSubTab, setNotebookSubTab] = useState<NotebookSubTab>('wrong');
  const [speechAccent, setSpeechAccent] = useState<SpeechAccent>(() => {
    return (localStorage.getItem(LOCAL_STORAGE_SPEECH_ACCENT_KEY) as SpeechAccent) || 'en-US';
  });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [learningSyncState, setLearningSyncState] = useState<LearningSyncState>({ pending: 0, busy: false, error: null, durable: true });
  const authGeneration = React.useRef(0);
  const refreshLearning = React.useRef<(user: typeof auth.currentUser) => Promise<void>>(async () => {});
  useEffect(() => subscribeLearningSync(setLearningSyncState), []);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  useBackHandler(() => { if (!isAuthModalOpen) return false; setIsAuthModalOpen(false); return true; }, 30);
  useBackHandler(() => { if (activeTab === 'quiz') return false; setActiveTab('quiz'); return true; }, -10);
  const [authRedirectError, setAuthRedirectError] = useState('');
  const [quizPool, setQuizPool] = useState<WordItem[]>([]);
  const [quizPoolName, setQuizPoolName] = useState('大学四级');
  const [defaultQuizWords, setDefaultQuizWords] = useState<WordItem[]>([]);
  const [builtInLists, setBuiltInLists] = useState<WordListGroup[]>([]);
  const [offlineStatus, setOfflineStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const loadBuiltIns = async () => {
    setOfflineStatus('loading');
    try {
      const { lists, defaultWords } = await loadOfflineVocabulary();
      setBuiltInLists(lists);
      setDefaultQuizWords(defaultWords);
      setQuizPool(current => current.length ? current : defaultWords);
      setOfflineStatus('ready');
    } catch (error) {
      console.error('内置词集读取失败', error);
      setOfflineStatus('error');
    }
  };
  useEffect(() => { void loadBuiltIns(); }, []);

  const toggleSpeechAccent = () => {
    const next = speechAccent === 'en-US' ? 'en-GB' : 'en-US';
    setSpeechAccent(next);
    localStorage.setItem(LOCAL_STORAGE_SPEECH_ACCENT_KEY, next);
  };
  
  const [wrongWords, setWrongWords] = useState<WrongWordItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_WRONG_WORDS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [masteredWords, setMasteredWords] = useState<MasteredWordItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_MASTERED_WORDS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [customWordLists, setCustomWordLists] = useState<WordListGroup[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CUSTOM_LISTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [deletedBuiltInIds, setDeletedBuiltInIds] = useState<string[]>(() => {
    try { const saved = JSON.parse(localStorage.getItem(DELETED_LISTS_KEY) || '[]'); return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : []; }
    catch { return []; }
  });
  useEffect(() => { localStorage.setItem(DELETED_LISTS_KEY, JSON.stringify(deletedBuiltInIds)); }, [deletedBuiltInIds]);

  const availableWordLists = React.useMemo(() => {
    const builtInIds = new Set(builtInLists.map(list => list.id));
    return builtInLists.filter(list => !deletedBuiltInIds.includes(list.id)).map(list => {
      const extra = customWordLists.find(custom => custom.id === list.id);
      if (!extra) return list;
      const merged = new Map(list.words.map(word => [word.id, word]));
      extra.words.forEach(word => merged.set(word.id, word));
      return { ...list, words: [...merged.values()], wordCount: merged.size };
    }).concat(customWordLists.filter(list => !builtInIds.has(list.id)));
  }, [builtInLists, customWordLists, deletedBuiltInIds]);

  // Store only user additions; bundled vocabulary stays in the packaged asset.
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CUSTOM_LISTS_KEY, JSON.stringify(customWordLists));
    } catch (err) {
      console.error('Failed to save customWordLists to localStorage:', err);
    }
  }, [customWordLists]);

  const handleImportCustomList = (words: WordItem[], listName: string) => {
    const cleanName = listName || `自定义词表 ${customWordLists.length + 1}`;
    const newList: WordListGroup = {
      id: 'list-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      name: cleanName,
      description: words.length > 0 ? `从词库导入，包含 ${words.length} 个单词` : '空白词本，可通过导入词汇添加单词',
      words: words,
      wordCount: words.length,
      createdAt: Date.now(),
      sourceType: 'custom'
    };

    setCustomWordLists((prev) => [newList, ...prev.filter((l) => l.name !== cleanName)]);
    if (words.length > 0) {
      handleAddWordsToNotebook(words);
    }
    return newList.id;
  };

  const handleCreateEmptyWordList = (listName: string): string | null => {
    const cleanName = listName.trim();
    if (!cleanName) return null;
    if (availableWordLists.some((l) => l.name === cleanName)) return null;
    return handleImportCustomList([], cleanName);
  };

  const handleMergeWordsIntoWordList = (words: WordItem[], listName: string, listId?: string | null) => {
    const cleanName = listName || '默认词本';
    const builtIn = builtInLists.find(list => !deletedBuiltInIds.includes(list.id) && (listId ? list.id === listId : list.name === cleanName));
    if (builtIn) {
      const extra = customWordLists.find(list => list.id === builtIn.id);
      const merged = new Map((extra?.words || []).map(word => [word.id, word]));
      words.forEach(word => merged.set(word.id, word));
      const additions = { ...builtIn, sourceType: 'custom' as const, words: [...merged.values()], wordCount: merged.size };
      setCustomWordLists(previous => [...previous.filter(list => list.id !== builtIn.id), additions]);
      handleAddWordsToNotebook(words);
      return;
    }
    const existing = listId
      ? customWordLists.find((l) => l.id === listId)
      : customWordLists.find((l) => l.name === cleanName);

    if (existing) {
      const map = new Map(existing.words.map((w) => [(w.id || w.word).toLowerCase().trim(), w]));
      words.forEach((w) => map.set((w.id || w.word).toLowerCase().trim(), w));
      const mergedWords = Array.from(map.values());
      setCustomWordLists((prev) =>
        prev.map((l) =>
          l.id === existing.id
            ? {
                ...l,
                words: mergedWords,
                wordCount: mergedWords.length,
                description: `包含 ${mergedWords.length} 个单词`
              }
            : l
        )
      );
    } else {
      handleImportCustomList(words, cleanName);
      return;
    }

    handleAddWordsToNotebook(words);
  };

  const handleDeleteCustomList = (listId: string) => {
    const removed = exclusiveDeletedWordIds(availableWordLists, listId);
    setWrongWords(previous => previous.filter(word => !removed.has(word.id.toLowerCase().trim())));
    setMasteredWords(previous => previous.filter(word => !removed.has(word.id.toLowerCase().trim())));
    if (builtInLists.some(list => list.id === listId)) {
      setDeletedBuiltInIds(previous => [...new Set([...previous, listId])]);
    }
    if (user?.uid) {
      wrongWords.filter(word => removed.has(word.id.toLowerCase().trim())).forEach(word => {
        void removeWrongWordFromFirestore(user.uid, word.id).catch(console.error);
      });
      masteredWords.filter(word => removed.has(word.id.toLowerCase().trim())).forEach(word => {
        void removeMasteredWordFromFirestore(user.uid, word.id).catch(console.error);
      });
    }
    setCustomWordLists((prev) => prev.filter((l) => l.id !== listId));
  };

  // Save wrong words to LocalStorage whenever modified
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_WRONG_WORDS_KEY, JSON.stringify(wrongWords));
    } catch (err) {
      console.error('Failed to save wrongWords to localStorage:', err);
    }
  }, [wrongWords]);

  // Save mastered words to LocalStorage whenever modified
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_MASTERED_WORDS_KEY, JSON.stringify(masteredWords));
    } catch (err) {
      console.error('Failed to save masteredWords to localStorage:', err);
    }
  }, [masteredWords]);

  // Auth Listener
  useEffect(() => {
    let cancelled = false;
    completeGoogleRedirectSignIn().catch((error) => {
      if (cancelled) return;
      setAuthRedirectError(error?.message || 'Google 登录未完成，请重新尝试。');
      setIsAuthModalOpen(true);
    });
    const refresh = async (firebaseUser: typeof auth.currentUser) => {
      const generation = ++authGeneration.current;
      const current = () => generation === authGeneration.current && auth.currentUser?.uid === firebaseUser?.uid;
      setLearningSyncUser(firebaseUser?.uid || null);
      if (firebaseUser) {
        const uProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL
        };
        setUser(uProfile);
        try { await retryLearningSync(); } catch { return; }
        if (!current()) return;
        const confirmed = confirmedLearningChanges();
        let readFailed = false;

        // Fetch user's wrong words from Firestore and merge
        try {
          const fsWrongWords = await fetchWrongWordsFromFirestore(firebaseUser.uid);
          if (!current()) return;
          if (fsWrongWords.length > 0 || confirmed.size > 0) {
            setWrongWords((prevLocal) => {
              if (!current()) return prevLocal;
              const map = new Map<string, WrongWordItem>();
              
              // Load Firestore first
              fsWrongWords.forEach(w => map.set(w.id, w));
              
              // Merge local items if not present or has higher count
              prevLocal.forEach(w => {
                if (['move-mastered', 'delete-wrong'].includes(confirmed.get(w.id) || '')) return;
                const existing = map.get(w.id);
                if (!existing) {
                  map.set(w.id, w);
                  void syncWrongWordToFirestore(firebaseUser.uid, w).catch(console.error);
                } else if (w.errorCount > existing.errorCount) {
                  map.set(w.id, { ...existing, errorCount: w.errorCount });
                }
              });

              return Array.from(map.values());
            });
          }
        } catch (err) {
          readFailed = true;
          console.error('Error fetching Firestore wrong words:', err);
          if (current()) reportLearningReadError();
        }

        // Fetch user's mastered words from Firestore and merge
        try {
          const fsMasteredWords = await fetchMasteredWordsFromFirestore(firebaseUser.uid);
          if (!current()) return;
          if (fsMasteredWords.length > 0 || confirmed.size > 0) {
            setMasteredWords((prevLocal) => {
              if (!current()) return prevLocal;
              const map = new Map<string, MasteredWordItem>();
              fsMasteredWords.forEach(w => map.set(w.id, w));
              prevLocal.forEach(w => {
                if (['move-wrong', 'delete-mastered'].includes(confirmed.get(w.id) || '')) return;
                if (!map.has(w.id)) {
                  map.set(w.id, w);
                  void syncMasteredWordToFirestore(firebaseUser.uid, w).catch(console.error);
                }
              });
              return Array.from(map.values());
            });
          }
        } catch (err) {
          readFailed = true;
          console.error('Error fetching Firestore mastered words:', err);
          if (current()) reportLearningReadError();
        }
        if (!readFailed && current()) clearConfirmedLearningChanges();

      } else {
        setUser(null);
      }
    };
    refreshLearning.current = refresh;
    const unsubscribe = onAuthStateChanged(auth, refresh);
    const online = () => { if (auth.currentUser) void refresh(auth.currentUser); };
    window.addEventListener('online', online);
    return () => { cancelled = true; authGeneration.current++; unsubscribe(); window.removeEventListener('online', online); setLearningSyncUser(null); };
  }, []);

  // Google Sign In
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google Sign In failed:', err);
      throw err;
    }
  };

  // Sign Out
  const handleLogout = async () => {
    try {
      await logOut();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Add newly extracted words directly into the pending notebook
  const handleAddWordsToNotebook = (words: WordItem[]) => {
    setWrongWords((prev) => {
      const map = new Map<string, WrongWordItem>();
      prev.forEach((w) => map.set(w.id, w));

      words.forEach((wordItem) => {
        const wordId = (wordItem.id || wordItem.word).toLowerCase().trim();
        const existing = map.get(wordId);
        if (!existing) {
          const newItem: WrongWordItem = {
            id: wordId,
            word: wordItem.word,
            phonetic: wordItem.phonetic || '',
            chinese: wordItem.chinese || '',
            exampleSentence: wordItem.exampleSentence || '',
            exampleSentenceCn: wordItem.exampleSentenceCn || '',
            errorCount: 0,
            lastErrorAt: Date.now(),
            createdAt: Date.now()
          };
          map.set(wordId, newItem);

          if (user && user.uid) {
            syncWrongWordToFirestore(user.uid, wordItem).catch((err) => {
              console.error('Error syncing extracted word to Firestore:', err);
            });
          }
        } else {
          // If word already exists, merge and enrich with new example sentence, phonetic or chinese definition
          const updatedItem: WrongWordItem = {
            ...existing,
            word: wordItem.word || existing.word,
            phonetic: wordItem.phonetic || existing.phonetic,
            chinese: wordItem.chinese || existing.chinese,
            exampleSentence: wordItem.exampleSentence || existing.exampleSentence,
            exampleSentenceCn: wordItem.exampleSentenceCn || existing.exampleSentenceCn
          };
          map.set(wordId, updatedItem);

          if (user && user.uid && (wordItem.exampleSentence || wordItem.phonetic)) {
            syncWrongWordToFirestore(user.uid, updatedItem).catch((err) => {
              console.error('Error syncing updated word to Firestore:', err);
            });
          }
        }
      });

      return Array.from(map.values());
    });
  };

  // Record Wrong Word (Increments error count)
  const handleRecordWrongWord = (wordItem: WordItem) => {
    const wordId = (wordItem.id || wordItem.word).toLowerCase().trim();

    setWrongWords((prev) => {
      const idx = prev.findIndex((w) => w.id === wordId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          errorCount: updated[idx].errorCount + 1,
          lastErrorAt: Date.now()
        };
        return updated;
      } else {
        const newItem: WrongWordItem = {
          id: wordId,
          word: wordItem.word,
          phonetic: wordItem.phonetic || '',
          chinese: wordItem.chinese || '',
          exampleSentence: wordItem.exampleSentence || '',
          exampleSentenceCn: wordItem.exampleSentenceCn || '',
          errorCount: 1,
          lastErrorAt: Date.now(),
          createdAt: Date.now()
        };
        return [newItem, ...prev];
      }
    });

    // If it was in masteredWords, remove it since user got it wrong
    setMasteredWords((prev) => prev.filter((w) => w.id !== wordId));

    // Sync to Firestore if user logged in
    if (user && user.uid) {
      moveWordToWrongInFirestore(user.uid, {
        word: wordItem.word,
        phonetic: wordItem.phonetic || '',
        chinese: wordItem.chinese || '',
        exampleSentence: wordItem.exampleSentence || '',
        exampleSentenceCn: wordItem.exampleSentenceCn || '',
        errorCount: 1
      }).catch(err => {
        console.error('Error syncing wrong word to Firestore:', err);
      });
    }
  };

  // Record Mastered Word (Move from wrongWords to masteredWords)
  const handleRecordMasteredWord = (wordId: string) => {
    const cleanId = wordId.toLowerCase().trim();
    let wordItemToMaster: MasteredWordItem | null = null;

    // Find details from wrongWords
    const existingWrong = wrongWords.find(w => w.id === cleanId);
    if (existingWrong) {
      wordItemToMaster = {
        id: existingWrong.id,
        word: existingWrong.word,
        phonetic: existingWrong.phonetic || '',
        chinese: existingWrong.chinese || '',
        exampleSentence: existingWrong.exampleSentence || '',
        exampleSentenceCn: existingWrong.exampleSentenceCn || '',
        masteredAt: Date.now()
      };
    } else {
      // Find from quizPool
      const foundPool = quizPool.find(w => (w.id || w.word).toLowerCase().trim() === cleanId)
        || availableWordLists.flatMap(list => list.words).find(w => w.id.toLowerCase() === cleanId);
      if (foundPool) {
        wordItemToMaster = {
          id: cleanId,
          word: foundPool.word,
          phonetic: foundPool.phonetic || '',
          chinese: foundPool.chinese || '',
          exampleSentence: foundPool.exampleSentence || '',
          exampleSentenceCn: foundPool.exampleSentenceCn || '',
          masteredAt: Date.now()
        };
      }
    }

    // Remove from wrongWords
    setWrongWords((prev) => prev.filter((w) => w.id !== cleanId));
    if (user && user.uid && !wordItemToMaster) {
      removeWrongWordFromFirestore(user.uid, cleanId).catch(err => {
        console.error('Error removing wrong word from Firestore:', err);
      });
    }

    // Add to masteredWords
    if (wordItemToMaster) {
      setMasteredWords((prev) => {
        if (prev.some(m => m.id === cleanId)) return prev;
        return [wordItemToMaster!, ...prev];
      });

      if (user && user.uid) {
        moveWordToMasteredInFirestore(user.uid, wordItemToMaster).catch(err => {
          console.error('Error syncing mastered word to Firestore:', err);
        });
      }
    }
  };

  // Remove Wrong Word directly
  const handleRemoveWrongWord = (wordId: string) => {
    // Mark as mastered when manually removed from wrong words list
    handleRecordMasteredWord(wordId);
  };

  // Move Mastered Word back to Wrong Words notebook
  const handleMoveMasteredToWrongWords = (masteredItem: MasteredWordItem) => {
    const wordId = masteredItem.id;

    // Remove from mastered
    setMasteredWords((prev) => prev.filter((w) => w.id !== wordId));

    // Add back to wrongWords / pending list
    const newItem: WrongWordItem = {
      id: wordId,
      word: masteredItem.word,
      phonetic: masteredItem.phonetic || '',
      chinese: masteredItem.chinese || '',
      exampleSentence: masteredItem.exampleSentence || '',
      exampleSentenceCn: masteredItem.exampleSentenceCn || '',
      errorCount: 1,
      lastErrorAt: Date.now(),
      createdAt: Date.now()
    };

    setWrongWords((prev) => {
      if (prev.some(w => w.id === wordId)) return prev;
      return [newItem, ...prev];
    });

    if (user && user.uid) {
      moveWordToWrongInFirestore(user.uid, newItem).catch(err => {
        console.error('Error syncing word back to wrongWords in Firestore:', err);
      });
    }
  };

  // Delete Mastered Word permanently
  const handleRemoveMasteredWord = (wordId: string) => {
    setMasteredWords((prev) => prev.filter((w) => w.id !== wordId));
    if (user && user.uid) {
      removeMasteredWordFromFirestore(user.uid, wordId).catch(err => {
        console.error('Error deleting mastered word from Firestore:', err);
      });
    }
  };

  // Import wrong words
  const handleImportWrongWords = (newItems: WrongWordItem[]) => {
    setWrongWords((prev) => {
      const map = new Map<string, WrongWordItem>();
      prev.forEach((w) => map.set(w.id, w));

      newItems.forEach((item) => {
        const id = (item.id || item.word).toLowerCase().trim();
        const existing = map.get(id);
        if (!existing) {
          const formatted: WrongWordItem = {
            id,
            word: item.word,
            phonetic: item.phonetic || '',
            chinese: item.chinese || item.word,
            exampleSentence: item.exampleSentence || '',
            exampleSentenceCn: item.exampleSentenceCn || '',
            errorCount: item.errorCount || 0,
            lastErrorAt: item.lastErrorAt || Date.now(),
            createdAt: item.createdAt || Date.now()
          };
          map.set(id, formatted);
          if (user && user.uid) {
            syncWrongWordToFirestore(user.uid, formatted).catch(err => console.error(err));
          }
        } else {
          const formatted: WrongWordItem = {
            ...existing,
            word: item.word || existing.word,
            phonetic: item.phonetic || existing.phonetic,
            chinese: item.chinese || existing.chinese,
            exampleSentence: item.exampleSentence || existing.exampleSentence,
            exampleSentenceCn: item.exampleSentenceCn || existing.exampleSentenceCn
          };
          map.set(id, formatted);
          if (user && user.uid) {
            syncWrongWordToFirestore(user.uid, formatted).catch(err => console.error(err));
          }
        }
      });

      return Array.from(map.values());
    });
  };

  // Import mastered words
  const handleImportMasteredWords = (newItems: MasteredWordItem[]) => {
    setMasteredWords((prev) => {
      const map = new Map<string, MasteredWordItem>();
      prev.forEach((w) => map.set(w.id, w));

      newItems.forEach((item) => {
        const id = (item.id || item.word).toLowerCase().trim();
        if (!map.has(id)) {
          const formatted: MasteredWordItem = {
            id,
            word: item.word,
            phonetic: item.phonetic || '',
            chinese: item.chinese || item.word,
            exampleSentence: item.exampleSentence || '',
            exampleSentenceCn: item.exampleSentenceCn || '',
            masteredAt: item.masteredAt || Date.now()
          };
          map.set(id, formatted);
          if (user && user.uid) {
            syncMasteredWordToFirestore(user.uid, formatted).catch(err => console.error(err));
          }
        }
      });

      return Array.from(map.values());
    });
  };

  return (
    <div className="min-h-screen bg-surface text-slate-800 dark:text-slate-100 flex flex-col font-sans">
      
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        speechAccent={speechAccent}
        onToggleSpeechAccent={toggleSpeechAccent}
        isDark={resolved === 'dark'}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 py-4 sm:py-8">
        {user && (learningSyncState.pending > 0 || learningSyncState.error || learningSyncState.busy) && (
          <div role="status" className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 px-4 py-2 text-sm dark:bg-slate-800/80">
            <span>{learningSyncState.error || (learningSyncState.busy ? '正在同步学习记录…' : `${learningSyncState.pending} 项学习记录待同步`)}</span>
            <button type="button" disabled={learningSyncState.busy} onClick={() => void refreshLearning.current(auth.currentUser)}
              className="min-h-10 min-w-10 rounded-xl px-3 text-brand-600 disabled:opacity-50 dark:text-brand-400">重试同步</button>
          </div>
        )}
        {/* Keep library mounted so folder navigation survives tab switches */}
        <div className={activeTab === 'library' ? undefined : 'hidden'} aria-hidden={activeTab !== 'library'}>
          <WordLibraryView
            speechAccent={speechAccent}
            onStartQuizWithWords={(words, bookName) => {
              setQuizPool(words);
              setQuizPoolName(bookName);
              setActiveTab('quiz');
            }}
            onImportCustomList={(words, bookName) => {
              handleImportCustomList(words, bookName);
            }}
            onGoToNotebook={() => {
              setNotebookSubTab('wrong');
              setActiveTab('notebook');
            }}
          />
        </div>

        <AnimatePresence mode="wait">
          {activeTab !== 'library' && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'quiz' && (offlineStatus === 'ready' ?
              <QuizView
                wordPool={quizPool}
                wordPoolName={quizPoolName}
                fallbackWordPool={defaultQuizWords}
                onRecordWrongWord={handleRecordWrongWord}
                onRecordMasteredWord={handleRecordMasteredWord}
                onGoToWrongWords={() => {
                  setNotebookSubTab('wrong');
                  setActiveTab('notebook');
                }}
                wrongWordsCount={wrongWords.length}
                speechAccent={speechAccent}
              />
              : <div className="quiz-container"><div className="surface-card p-6 rounded-2xl text-center text-sm text-secondary">
                {offlineStatus === 'error' ? <><p>内置词集加载失败。</p><button type="button" onClick={() => void loadBuiltIns()} className="mt-3 px-4 py-2 gradient-brand text-white rounded-xl">重试</button></> : '正在读取内置词集…'}
              </div></div>
            )}

            {activeTab === 'notebook' && (
              <NotebookView
                subTab={notebookSubTab}
                onSubTabChange={setNotebookSubTab}
                wrongWords={wrongWords}
                masteredWords={masteredWords}
                customWordLists={availableWordLists}
                onRemoveWrongWord={handleRemoveWrongWord}
                onStartWrongWordsQuiz={(words, bookName) => {
                  setQuizPool(words);
                  setQuizPoolName(bookName || '生词本');
                  setActiveTab('quiz');
                }}
                onImportWrongWords={handleImportWrongWords}
                onImportToWordList={handleMergeWordsIntoWordList}
                onCreateCustomList={handleCreateEmptyWordList}
                onDeleteCustomList={handleDeleteCustomList}
                onRemoveMasteredWord={handleRemoveMasteredWord}
                onMoveToWrongWords={handleMoveMasteredToWrongWords}
                onStartMasteredWordsQuiz={(words, bookName) => {
                  setQuizPool(words);
                  setQuizPoolName(bookName || '熟词本');
                  setActiveTab('quiz');
                }}
                onImportMasteredWords={handleImportMasteredWords}
                speechAccent={speechAccent}
              />
            )}

          </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm py-6">
        <div className="page-container text-center">
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            四选一测验 · 80,470 完整词条 · 949 本内置词书
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialErrorMessage={authRedirectError}
        onClose={() => { setIsAuthModalOpen(false); setAuthRedirectError(''); }}
        onGoogleSignIn={handleGoogleSignIn}
      />
    </div>
  );
}
