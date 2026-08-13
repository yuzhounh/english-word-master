import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { Navbar } from './components/Navbar';
import { TextAnalyzer } from './components/TextAnalyzer';
import { QuizView } from './components/QuizView';
import { NotebookView } from './components/NotebookView';
import { WordLibraryView } from './components/WordLibraryView';
import { AuthModal } from './components/AuthModal';
import { WordItem, WrongWordItem, MasteredWordItem, UserProfile, SpeechAccent, WordListGroup } from './types';
import { AppTab, NotebookSubTab } from './types/navigation';
import { useTheme } from './hooks/useTheme';
import {
  auth,
  signInWithGoogle,
  logOut,
  syncWrongWordToFirestore,
  fetchWrongWordsFromFirestore,
  removeWrongWordFromFirestore,
  syncMasteredWordToFirestore,
  fetchMasteredWordsFromFirestore,
  removeMasteredWordFromFirestore
} from './lib/firebase';

const LOCAL_STORAGE_WRONG_WORDS_KEY = 'wordmaster_wrong_words_v1';
const LOCAL_STORAGE_MASTERED_WORDS_KEY = 'wordmaster_mastered_words_v1';
const LOCAL_STORAGE_SPEECH_ACCENT_KEY = 'wordmaster_speech_accent_v1';
const LOCAL_STORAGE_CUSTOM_LISTS_KEY = 'wordmaster_custom_lists_v1';

export default function App() {
  const { resolved, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<AppTab>('quiz');
  const [notebookSubTab, setNotebookSubTab] = useState<NotebookSubTab>('wrong');
  const [speechAccent, setSpeechAccent] = useState<SpeechAccent>(() => {
    return (localStorage.getItem(LOCAL_STORAGE_SPEECH_ACCENT_KEY) as SpeechAccent) || 'en-US';
  });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [extractedWords, setExtractedWords] = useState<WordItem[]>([]);
  const [quizPool, setQuizPool] = useState<WordItem[]>([]);

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

  // Save custom word lists to LocalStorage whenever modified
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
      description: `从词库导入，包含 ${words.length} 个单词`,
      words: words,
      wordCount: words.length,
      createdAt: Date.now(),
      sourceType: 'custom'
    };

    setCustomWordLists((prev) => [newList, ...prev.filter((l) => l.name !== cleanName)]);
    handleAddWordsToNotebook(words);
  };

  const handleDeleteCustomList = (listId: string, removeWordsFromWrongWords: boolean = false) => {
    if (removeWordsFromWrongWords) {
      const targetList = customWordLists.find((l) => l.id === listId);
      if (targetList) {
        const listWordIds = new Set(targetList.words.map((w) => (w.id || w.word).toLowerCase().trim()));
        setWrongWords((prev) => prev.filter((w) => !listWordIds.has(w.id.toLowerCase().trim())));
      }
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const uProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL
        };
        setUser(uProfile);

        // Fetch user's wrong words from Firestore and merge
        try {
          const fsWrongWords = await fetchWrongWordsFromFirestore(firebaseUser.uid);
          if (fsWrongWords && fsWrongWords.length > 0) {
            setWrongWords((prevLocal) => {
              const map = new Map<string, WrongWordItem>();
              
              // Load Firestore first
              fsWrongWords.forEach(w => map.set(w.id, w));
              
              // Merge local items if not present or has higher count
              prevLocal.forEach(w => {
                const existing = map.get(w.id);
                if (!existing) {
                  map.set(w.id, w);
                  syncWrongWordToFirestore(firebaseUser.uid, w);
                } else if (w.errorCount > existing.errorCount) {
                  map.set(w.id, { ...existing, errorCount: w.errorCount });
                }
              });

              return Array.from(map.values());
            });
          }
        } catch (err) {
          console.error('Error fetching Firestore wrong words:', err);
        }

        // Fetch user's mastered words from Firestore and merge
        try {
          const fsMasteredWords = await fetchMasteredWordsFromFirestore(firebaseUser.uid);
          if (fsMasteredWords && fsMasteredWords.length > 0) {
            setMasteredWords((prevLocal) => {
              const map = new Map<string, MasteredWordItem>();
              fsMasteredWords.forEach(w => map.set(w.id, w));
              prevLocal.forEach(w => {
                if (!map.has(w.id)) {
                  map.set(w.id, w);
                  syncMasteredWordToFirestore(firebaseUser.uid, w);
                }
              });
              return Array.from(map.values());
            });
          }
        } catch (err) {
          console.error('Error fetching Firestore mastered words:', err);
        }

      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Google Sign In
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google Sign In failed:', err);
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
      syncWrongWordToFirestore(user.uid, {
        word: wordItem.word,
        phonetic: wordItem.phonetic || '',
        chinese: wordItem.chinese || '',
        exampleSentence: wordItem.exampleSentence || '',
        exampleSentenceCn: wordItem.exampleSentenceCn || '',
        errorCount: 1
      }).catch(err => {
        console.error('Error syncing wrong word to Firestore:', err);
      });
      removeMasteredWordFromFirestore(user.uid, wordId).catch(err => {
        console.error('Error removing mastered word from Firestore:', err);
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
      // Find from quizPool or extractedWords
      const foundPool = [...quizPool, ...extractedWords].find(w => (w.id || w.word).toLowerCase().trim() === cleanId);
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
    if (user && user.uid) {
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
        syncMasteredWordToFirestore(user.uid, wordItemToMaster).catch(err => {
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
    if (user && user.uid) {
      removeMasteredWordFromFirestore(user.uid, wordId).catch(err => {
        console.error('Error removing mastered word from Firestore:', err);
      });
    }

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
      syncWrongWordToFirestore(user.uid, newItem).catch(err => {
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

  // Clear all wrong words
  const handleClearAllWrongWords = () => {
    if (user && user.uid) {
      wrongWords.forEach((w) => {
        removeWrongWordFromFirestore(user.uid, w.id).catch(err => console.error(err));
      });
    }
    setWrongWords([]);
    localStorage.removeItem(LOCAL_STORAGE_WRONG_WORDS_KEY);
  };

  // Clear all mastered words
  const handleClearAllMasteredWords = () => {
    if (user && user.uid) {
      masteredWords.forEach((w) => {
        removeMasteredWordFromFirestore(user.uid, w.id).catch(err => console.error(err));
      });
    }
    setMasteredWords([]);
    localStorage.removeItem(LOCAL_STORAGE_MASTERED_WORDS_KEY);
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
        wrongWordsCount={wrongWords.length}
        masteredWordsCount={masteredWords.length}
        extractedWordsCount={extractedWords.length}
        speechAccent={speechAccent}
        onToggleSpeechAccent={toggleSpeechAccent}
        isDark={resolved === 'dark'}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 py-4 sm:py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'quiz' && (
              <QuizView
                wordPool={quizPool.length > 0 ? quizPool : extractedWords}
                onRecordWrongWord={handleRecordWrongWord}
                onRecordMasteredWord={handleRecordMasteredWord}
                onGoToWrongWords={() => {
                  setNotebookSubTab('wrong');
                  setActiveTab('notebook');
                }}
                wrongWordsCount={wrongWords.length}
                speechAccent={speechAccent}
              />
            )}

            {activeTab === 'extract' && (
              <TextAnalyzer
                onWordsExtracted={(words, listName) => {
                  setExtractedWords(words);
                  setQuizPool(words);
                  if (listName) {
                    handleImportCustomList(words, listName);
                  } else {
                    handleAddWordsToNotebook(words);
                  }
                }}
                onStartQuiz={(words) => {
                  setQuizPool(words);
                  setActiveTab('quiz');
                }}
                extractedWords={extractedWords}
              />
            )}

            {activeTab === 'library' && (
              <WordLibraryView
                speechAccent={speechAccent}
                onStartQuizWithWords={(words) => {
                  setQuizPool(words);
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
            )}

            {activeTab === 'notebook' && (
              <NotebookView
                subTab={notebookSubTab}
                onSubTabChange={setNotebookSubTab}
                wrongWords={wrongWords}
                masteredWords={masteredWords}
                customWordLists={customWordLists}
                onRemoveWrongWord={handleRemoveWrongWord}
                onStartWrongWordsQuiz={(words) => {
                  setQuizPool(words);
                  setActiveTab('quiz');
                }}
                onClearAllWrongWords={handleClearAllWrongWords}
                onImportWrongWords={handleImportWrongWords}
                onDeleteCustomList={handleDeleteCustomList}
                onRemoveMasteredWord={handleRemoveMasteredWord}
                onMoveToWrongWords={handleMoveMasteredToWrongWords}
                onStartMasteredWordsQuiz={(words) => {
                  setQuizPool(words);
                  setActiveTab('quiz');
                }}
                onClearAllMasteredWords={handleClearAllMasteredWords}
                onImportMasteredWords={handleImportMasteredWords}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm py-8 text-center">
        <div className="page-container flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-semibold gradient-brand-text">WordMaster AI</span>
            <span className="text-slate-400 mx-1.5">·</span>
            <span className="text-slate-500">智能英文文本提取、900+ 权威词库与词汇记忆平台</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center text-xs text-slate-400">
            <span>智能分词还原</span>
            <span className="text-slate-300">·</span>
            <span>900+ 内置词书</span>
            <span className="text-slate-300">·</span>
            <span>四选一强化测试</span>
            <span className="text-slate-300">·</span>
            <span>生词熟词云端同步</span>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onGoogleSignIn={handleGoogleSignIn}
      />
    </div>
  );
}
