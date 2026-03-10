import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCgu5mqCAvl9Z7ST5ZQmMXc7LCTi49fngA",
  authDomain: "ai-survey-site.firebaseapp.com",
  projectId: "ai-survey-site",
  storageBucket: "ai-survey-site.firebasestorage.app",
  messagingSenderId: "346334889127",
  appId: "1:346334889127:web:3bd0532b084b72f539c782"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
