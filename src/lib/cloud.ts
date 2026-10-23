import { LearningSync, type LearningWord } from './learningSync';
import { lazyModule } from './lazyModule';

// The local learning UI and durable queue do not import either Firebase SDK.
const firebase = lazyModule(() => import('./firebase'));
export const loadFirebaseAuth = firebase.load;
export const currentFirebaseUser = () => firebase.current?.auth.currentUser ?? null;
export const signInWithGoogle = () => firebase.current
  ? firebase.current.signInWithGoogle() : firebase.load().then(client => client.signInWithGoogle());
export const logOut = () => firebase.current
  ? firebase.current.logOut() : firebase.load().then(client => client.logOut());

const learningSync = new LearningSync({
  getItem: key => typeof localStorage === 'undefined' ? null : localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
}, async (uid, operation) => (await firebase.load()).applyLearningOperation(uid, operation));
export const subscribeLearningSync = learningSync.subscribe.bind(learningSync);
export const setLearningSyncUser = learningSync.setUser.bind(learningSync);
export const retryLearningSync = learningSync.flush.bind(learningSync);
export const reportLearningReadError = learningSync.reportReadError.bind(learningSync);
export const confirmedLearningChanges = learningSync.getConfirmedChanges.bind(learningSync);
export const clearConfirmedLearningChanges = learningSync.clearConfirmedChanges.bind(learningSync);
export const syncWrongWordToFirestore = (uid: string, word: LearningWord) => learningSync.enqueue(uid, 'wrong', word);
export const moveWordToMasteredInFirestore = (uid: string, word: LearningWord) => learningSync.enqueue(uid, 'move-mastered', word);
export const moveWordToWrongInFirestore = (uid: string, word: LearningWord) => learningSync.enqueue(uid, 'move-wrong', word);
export const syncMasteredWordToFirestore = (uid: string, word: LearningWord) => learningSync.enqueue(uid, 'mastered', word);
export const removeWrongWordFromFirestore = (uid: string, wordId: string) => learningSync.enqueue(uid, 'delete-wrong', { word: wordId });
export const removeMasteredWordFromFirestore = (uid: string, wordId: string) => learningSync.enqueue(uid, 'delete-mastered', { word: wordId });
export const fetchWrongWordsFromFirestore = async (uid: string) => (await firebase.load()).fetchWrongWordsFromFirestore(uid);
export const fetchMasteredWordsFromFirestore = async (uid: string) => (await firebase.load()).fetchMasteredWordsFromFirestore(uid);
