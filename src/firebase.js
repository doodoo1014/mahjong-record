// import { initializeApp } from "firebase/app";
// import { getFirestore } from "firebase/firestore";

// // 방금 Firebase 웹사이트에서 복사한 본인의 firebaseConfig로 덮어쓰세요!
// const firebaseConfig = {
//   apiKey: "AIzaSyCEeb0xnwu6Deq-4SWGLqhuTxtPcxoIz18",
//   authDomain: "mahjong-record-f857d.firebaseapp.com",
//   projectId: "mahjong-record-f857d",
//   storageBucket: "mahjong-record-f857d.firebasestorage.app",
//   messagingSenderId: "12860375237",
//   appId: "1:12860375237:web:0d873336792cccb03730ac"
// };

// // 파이어베이스 초기화 및 DB 연결
// const app = initializeApp(firebaseConfig);
// export const db = getFirestore(app);



import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 👇 기존 라이브 서버 설정 (나중을 위해 /* 와 */ 로 감싸서 숨겨둡니다)

const firebaseConfig = {
  apiKey: "AIzaSyAn6wVGovGY9zVOmIb2tkEiglmFKa61IpE",
  authDomain: "mahjong-record-test-aa112.firebaseapp.com",
  projectId: "mahjong-record-test-aa112",
  storageBucket: "mahjong-record-test-aa112.firebasestorage.app",
  messagingSenderId: "373004459659",
  appId: "1:373004459659:web:5d97fc9dfcc5a55451fe8e"
};

// 아래 두 줄은 그대로 둡니다.
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);