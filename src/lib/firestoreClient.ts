import { getFirestore, doc, collection, getDocs, query, orderBy, runTransaction } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

/** Named imports keep unused Firestore APIs out of the deferred bundle. */
export function createStore(app: FirebaseApp) {
  return { db: getFirestore(app), doc, collection, getDocs, query, orderBy, runTransaction };
}
