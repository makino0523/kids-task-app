import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC3aaCCGz9assEjxI7mcAjvchFIsoEeVeQ",
  authDomain: "kids-task-app-92292.firebaseapp.com",
  projectId: "kids-task-app-92292",
  messagingSenderId: "420924002308",
  appId: "1:420924002308:web:35396e95a9713baeb72551"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);