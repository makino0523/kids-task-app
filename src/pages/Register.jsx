import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole]         = useState("child"); // "parent" or "child"
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  async function handleRegister() {
    setError("");
    if (!name.trim()) { setError("なまえを入力してください"); return; }
    if (password.length < 6) { setError("パスワードは6文字以上です"); return; }
    setLoading(true);
    try {
      // Authにユーザー作成
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // 表示名を設定
      await updateProfile(cred.user, { displayName: name });
      // Firestoreにユーザー情報を保存
      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        email,
        role,           // "parent" or "child"
        coins: 0,
        cash: 0,
        createdAt: new Date(),
      });
      navigate("/");
    } catch (e) {
      if (e.code === "auth/email-already-in-use") {
        setError("このメールアドレスはすでに使われています");
      } else {
        setError("登録に失敗しました: " + e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.bg}>
      <div style={styles.card}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 52 }}>✨</div>
          <h1 style={styles.title}>アカウント登録</h1>
        </div>

        {/* 役割選択 */}
        <label style={styles.label}>あなたは？</label>
        <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
          {[["child","👦 子供"], ["parent","👨 親"]].map(([val, label]) => (
            <button key={val} onClick={() => setRole(val)} style={{
              flex: 1, padding: "12px", borderRadius: 14, fontWeight: 800, fontSize: 15,
              border: `2px solid ${role === val ? "#7c3aed" : "#e2e8f0"}`,
              background: role === val ? "#ede9fe" : "white",
              color: role === val ? "#7c3aed" : "#94a3b8",
            }}>{label}</button>
          ))}
        </div>

        <label style={styles.label}>なまえ</label>
        <input style={styles.input} value={name}
          onChange={e => setName(e.target.value)} placeholder="たろう" />

        <label style={styles.label}>メールアドレス</label>
        <input style={styles.input} type="email" value={email}
          onChange={e => setEmail(e.target.value)} placeholder="example@email.com" />

        <label style={styles.label}>パスワード（6文字以上）</label>
        <input style={styles.input} type="password" value={password}
          onChange={e => setPassword(e.target.value)} placeholder="••••••••" />

        {error && <p style={styles.error}>{error}</p>}

        <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
          onClick={handleRegister} disabled={loading}>
          {loading ? "登録中…" : "登録する"}
        </button>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#64748b" }}>
          すでにアカウントをお持ちの方は{" "}
          <Link to="/login" style={{ color: "#7c3aed", fontWeight: 700 }}>ログイン</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  bg: {
    minHeight: "100vh", display: "flex",
    alignItems: "center", justifyContent: "center", padding: 16,
  },
  card: {
    background: "white", borderRadius: 28, padding: "36px 28px",
    width: "100%", maxWidth: 400,
    boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
  },
  title: { fontSize: 24, fontWeight: 900, color: "#1e293b", margin: "8px 0 0" },
  label: { display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 6, marginTop: 16 },
  input: {
    width: "100%", padding: "12px 14px", borderRadius: 14,
    border: "2px solid #e2e8f0", fontSize: 15, outline: "none",
  },
  btn: {
    marginTop: 24, width: "100%", padding: "14px",
    borderRadius: 16, border: "none",
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    color: "white", fontWeight: 800, fontSize: 16,
    boxShadow: "0 4px 15px rgba(124,58,237,0.35)",
  },
  error: { color: "#ef4444", fontSize: 13, marginTop: 10, fontWeight: 700 },
};