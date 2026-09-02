import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { collection, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCgXlgtmSDv4ofHkFQg1_gOfoCvpwLavkM',
  authDomain: 'dentalnotemaker-react.firebaseapp.com',
  projectId: 'dentalnotemaker-react',
  storageBucket: 'dentalnotemaker-react.firebasestorage.app',
  messagingSenderId: '516438799005',
  appId: '1:516438799005:web:80707584b8cab647a89a74',
  measurementId: 'G-94EE9VJ4TR',
};

const firebaseApp = initializeApp(firebaseConfig);
export const firestore = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
export const archivedNotesCollection = collection(firestore, 'archivedNotes');
export const layoutPreferencesCollection = collection(firestore, 'layoutPreferences');

