import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential, signInWithPopup, signOut, User } from 'firebase/auth';
import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  deleteDoc,
  increment,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { WrongWordItem, MasteredWordItem } from '../types';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

interface NativeGoogleAuthPlugin {
  signIn(): Promise<{ idToken: string }>;
  clearCredentialState(): Promise<void>;
}

const nativeGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>('NativeGoogleAuth');

// Initialize Firestore with the default (default) database
export const db = getFirestore(app);

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      const { idToken } = await nativeGoogleAuth.signIn();
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      return result.user;
    }

    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

// Sign out
export const logOut = async () => {
  try {
    await signOut(auth);
    if (Capacitor.isNativePlatform()) {
      await nativeGoogleAuth.clearCredentialState().catch((error) => {
        console.warn('Failed to clear native Google credential state:', error);
      });
    }
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Firestore helper functions for Wrong Words
export const syncWrongWordToFirestore = async (userId: string, wordItem: {
  word: string;
  phonetic?: string;
  chinese?: string;
  exampleSentence?: string;
  exampleSentenceCn?: string;
  errorCount?: number;
}) => {
  if (!userId) return;
  const wordId = wordItem.word.toLowerCase().trim();
  const wordRef = doc(db, 'users', userId, 'wrongWords', wordId);
  const snap = await getDoc(wordRef);

  if (snap.exists()) {
    if (typeof wordItem.errorCount === 'number' && wordItem.errorCount > 0) {
      await updateDoc(wordRef, {
        errorCount: increment(wordItem.errorCount),
        lastErrorAt: Date.now(),
        ...(wordItem.phonetic ? { phonetic: wordItem.phonetic } : {}),
        ...(wordItem.chinese ? { chinese: wordItem.chinese } : {}),
        ...(wordItem.exampleSentence ? { exampleSentence: wordItem.exampleSentence } : {}),
        ...(wordItem.exampleSentenceCn ? { exampleSentenceCn: wordItem.exampleSentenceCn } : {})
      });
    } else {
      await updateDoc(wordRef, {
        ...(wordItem.phonetic ? { phonetic: wordItem.phonetic } : {}),
        ...(wordItem.chinese ? { chinese: wordItem.chinese } : {}),
        ...(wordItem.exampleSentence ? { exampleSentence: wordItem.exampleSentence } : {}),
        ...(wordItem.exampleSentenceCn ? { exampleSentenceCn: wordItem.exampleSentenceCn } : {})
      });
    }
  } else {
    await setDoc(wordRef, {
      id: wordId,
      word: wordItem.word,
      phonetic: wordItem.phonetic || '',
      chinese: wordItem.chinese || '',
      exampleSentence: wordItem.exampleSentence || '',
      exampleSentenceCn: wordItem.exampleSentenceCn || '',
      errorCount: typeof wordItem.errorCount === 'number' ? wordItem.errorCount : 0,
      lastErrorAt: Date.now(),
      createdAt: Date.now()
    });
  }
};

// Fetch user's wrong words list from Firestore
export const fetchWrongWordsFromFirestore = async (userId: string): Promise<WrongWordItem[]> => {
  if (!userId) return [];
  try {
    const q = query(collection(db, 'users', userId, 'wrongWords'), orderBy('errorCount', 'desc'));
    const querySnapshot = await getDocs(q);
    const words: WrongWordItem[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      words.push({
        id: doc.id,
        word: data.word,
        phonetic: data.phonetic || '',
        chinese: data.chinese || '',
        exampleSentence: data.exampleSentence || '',
        exampleSentenceCn: data.exampleSentenceCn || '',
        errorCount: typeof data.errorCount === 'number' ? data.errorCount : 0,
        lastErrorAt: data.lastErrorAt || Date.now(),
        createdAt: data.createdAt || Date.now()
      });
    });
    return words;
  } catch (err) {
    console.error('Failed to fetch wrong words from firestore:', err);
    return [];
  }
};

// Delete or remove wrong word from Firestore
export const removeWrongWordFromFirestore = async (userId: string, wordId: string) => {
  if (!userId) return;
  try {
    await deleteDoc(doc(db, 'users', userId, 'wrongWords', wordId));
  } catch (err) {
    console.error('Failed to delete wrong word from firestore:', err);
  }
};

// Firestore helper functions for Mastered Words (熟词本)
export const syncMasteredWordToFirestore = async (userId: string, wordItem: {
  id?: string;
  word: string;
  phonetic?: string;
  chinese?: string;
  exampleSentence?: string;
  exampleSentenceCn?: string;
}) => {
  if (!userId) return;
  const wordId = (wordItem.id || wordItem.word).toLowerCase().trim();
  const wordRef = doc(db, 'users', userId, 'masteredWords', wordId);

  try {
    await setDoc(wordRef, {
      id: wordId,
      word: wordItem.word,
      phonetic: wordItem.phonetic || '',
      chinese: wordItem.chinese || '',
      exampleSentence: wordItem.exampleSentence || '',
      exampleSentenceCn: wordItem.exampleSentenceCn || '',
      masteredAt: Date.now()
    });
  } catch (err) {
    console.error('Error syncing mastered word to firestore:', err);
  }
};

export const fetchMasteredWordsFromFirestore = async (userId: string): Promise<MasteredWordItem[]> => {
  if (!userId) return [];
  try {
    const q = query(collection(db, 'users', userId, 'masteredWords'), orderBy('masteredAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const words: MasteredWordItem[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      words.push({
        id: doc.id,
        word: data.word,
        phonetic: data.phonetic || '',
        chinese: data.chinese || '',
        exampleSentence: data.exampleSentence || '',
        exampleSentenceCn: data.exampleSentenceCn || '',
        masteredAt: data.masteredAt || Date.now()
      });
    });
    return words;
  } catch (err) {
    console.error('Failed to fetch mastered words from firestore:', err);
    return [];
  }
};

export const removeMasteredWordFromFirestore = async (userId: string, wordId: string) => {
  if (!userId) return;
  try {
    await deleteDoc(doc(db, 'users', userId, 'masteredWords', wordId));
  } catch (err) {
    console.error('Failed to delete mastered word from firestore:', err);
  }
};
