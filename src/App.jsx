import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import Login from "./pages/Login";
import Register from "./pages/Register";
import FamilySetup from "./pages/FamilySetup";
import ChildHome from "./pages/ChildHome";
import ParentHome from "./pages/ParentHome";

function Loading() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Nunito',sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 52 }}>🌟</div>
        <p style={{ color: "#94a3b8", fontWeight: 700, marginTop: 12 }}>読み込み中…</p>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser]         = useState(undefined);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    let unsubFirestore = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // 前回のFirestore監視を解除
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        // Firestoreのユーザー情報をリアルタイム監視
        // コイン残高の変化が即座に画面に反映される
        unsubFirestore = onSnapshot(
          doc(db, "users", firebaseUser.uid),
          (snap) => {
            if (snap.exists()) {
              setUserData(snap.data());
            }
          },
          (error) => {
            console.error("Firestoreの監視エラー:", error);
          }
        );
      } else {
        setUser(null);
        setUserData(null);
      }
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  if (user === undefined) return <Loading />;

  return (
    <BrowserRouter>
      <Routes>
        {/* 未ログイン専用ページ */}
        <Route path="/login" element={
          !user ? <Login /> : <Navigate to="/" replace />
        } />
        <Route path="/register" element={
          !user ? <Register /> : <Navigate to="/" replace />
        } />

        {/* 家族グループ設定 */}
        <Route path="/family-setup" element={
          !user ? <Navigate to="/login" replace /> :
          <FamilySetup role={userData?.role} />
        } />

        {/* メイン画面 */}
        <Route path="/" element={
          !user                ? <Navigate to="/login" replace /> :
          !userData            ? <Loading /> :
          !userData.familyId   ? <Navigate to="/family-setup" replace /> :
          userData.role === "parent"
            ? <ParentHome userData={userData} />
            : <ChildHome  userData={userData} />
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}