import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, getRedirectResult, GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect, signOut, User } from 'firebase/auth';
import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  getFirestore,
  doc,
  collection,
  getDocs,
  query,
  orderBy,
  runTransaction
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { WrongWordItem, MasteredWordItem } from '../types';
import { signInWithPopupFallback, webAuthDomain } from './googleSignIn';
import { LearningSync, type LearningWord } from './learningSync';
import { writeLearningOperation } from './learningWrite';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp({
  ...firebaseConfig,
  authDomain: webAuthDomain(typeof window === 'undefined' ? undefined : window.location.hostname,
    Capacitor.isNativePlatform(), firebaseConfig.authDomain)
}) : getApp();
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

let redirectResult: ReturnType<typeof getRedirectResult> | undefined;
export const completeGoogleRedirectSignIn = () => {
  if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return Promise.resolve(null);
  return redirectResult ??= getRedirectResult(auth);
};

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      const { idToken } = await nativeGoogleAuth.signIn();
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      return result.user;
    }

    const result = await signInWithPopupFallback(
      () => signInWithPopup(auth, googleProvider),
      () => signInWithRedirect(auth, googleProvider)
    );
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

const learningSync = new LearningSync({
  getItem: key => typeof localStorage === 'undefined' ? null : localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
}, (uid, operation) => runTransaction(db, transaction => writeLearningOperation(operation, {
  get: async path => { const snapshot = await transaction.get(doc(db, 'users', uid, ...path.split('/'))); return snapshot.exists() ? snapshot.data() : null; },
  set: (path, data) => { transaction.set(doc(db, 'users', uid, ...path.split('/')), data); },
  delete: path => { transaction.delete(doc(db, 'users', uid, ...path.split('/'))); },
})));
export const subscribeLearningSync = learningSync.subscribe.bind(learningSync);
export const setLearningSyncUser = learningSync.setUser.bind(learningSync);
export const retryLearningSync = learningSync.flush.bind(learningSync);
export const reportLearningReadError = learningSync.reportReadError.bind(learningSync);
export const confirmedLearningChanges = learningSync.getConfirmedChanges.bind(learningSync);
export const clearConfirmedLearningChanges = learningSync.clearConfirmedChanges.bind(learningSync);
export const syncWrongWordToFirestore = (uid: string, word: LearningWord) => learningSync.enqueue(uid, 'wrong', word);
export const moveWordToMasteredInFirestore = (uid: string, word: LearningWord) => learningSync.enqueue(uid, 'move-mastered', word);
export const moveWordToWrongInFirestore = (uid: string, word: LearningWord) => learningSync.enqueue(uid, 'move-wrong', word);

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
    throw err;
  }
};

// Delete or remove wrong word from Firestore
export const removeWrongWordFromFirestore = (uid: string, wordId: string) => learningSync.enqueue(uid, 'delete-wrong', { word: wordId });

// Firestore helper functions for Mastered Words (熟词本)
export const syncMasteredWordToFirestore = (uid: string, word: LearningWord) => learningSync.enqueue(uid, 'mastered', word);

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
    throw err;
  }
};

export const removeMasteredWordFromFirestore = (uid: string, wordId: string) => learningSync.enqueue(uid, 'delete-mastered', { word: wordId });
