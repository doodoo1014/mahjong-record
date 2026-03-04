import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 방금 Firebase 웹사이트에서 복사한 본인의 firebaseConfig로 덮어쓰세요!
const firebaseConfig = {
  apiKey: "AIzaSyCEeb0xnwu6Deq-4SWGLqhuTxtPcxoIz18",
  authDomain: "mahjong-record-f857d.firebaseapp.com",
  projectId: "mahjong-record-f857d",
  storageBucket: "mahjong-record-f857d.firebasestorage.app",
  messagingSenderId: "12860375237",
  appId: "1:12860375237:web:0d873336792cccb03730ac"
};

// 파이어베이스 초기화 및 DB 연결
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
