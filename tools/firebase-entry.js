// Bygges til js/vendor/firebase.js med: npm run build  (se tools/package.json)
// Samler kun de Firebase-funktioner appen bruger i én lokal fil, så appen
// ikke afhænger af et CDN og virker offline via service workeren.
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, initializeAuth, inMemoryPersistence, browserLocalPersistence, indexedDBLocalPersistence,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  sendPasswordResetEmail, deleteUser, connectAuthEmulator
} from 'firebase/auth';
import {
  getDatabase, ref, child, onValue, get, set, update, push, remove,
  query, limitToLast, orderByKey, serverTimestamp, onDisconnect, connectDatabaseEmulator
} from 'firebase/database';

window.FBSDK = {
  initializeApp, deleteApp,
  getAuth, initializeAuth, inMemoryPersistence, browserLocalPersistence, indexedDBLocalPersistence,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  sendPasswordResetEmail, deleteUser, connectAuthEmulator,
  getDatabase, ref, child, onValue, get, set, update, push, remove,
  query, limitToLast, orderByKey, serverTimestamp, onDisconnect, connectDatabaseEmulator
};
