import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  async function handleLogin() {
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (e) {
      setError("メールアドレスまたはパスワードが違います");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.bg}>
      <div style={styles.card}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 56 }}>🌟</div>
          <h1 style={styles.title}>がんばりボード</h1>
          <p style={styles.sub}>ログイン</p>
        </div>

        <label style={styles.label}>メールアドレス</label>
        <input style={styles.input} type="email" value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="example@email.com" />

        <label style={styles.label}>パスワード</label>
        <input style={styles.input} type="password" value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="6文字以上"
          onKeyDown={e => e.key === "Enter" && handleLogin()} />

        {error && <p style={styles.error}>{error}</p>}

        <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
          onClick={handleLogin} disabled={loading}>
          {loading ? "ログイン中…" : "ログイン"}
        </button>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#64748b" }}>
          アカウントをお持ちでない方は{" "}
          <Link to="/register" style={{ color: "#7c3aed", fontWeight: 700 }}>
            新規登録
          </Link>
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
  title: { fontSize: 26, fontWeight: 900, color: "#1e293b", margin: "8px 0 4px" },
  sub:   { fontSize: 14, color: "#94a3b8" },
  label: { display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 6, marginTop: 16 },
  input: {
    width: "100%", padding: "12px 14px", borderRadius: 14,
    border: "2px solid #e2e8f0", fontSize: 15, outline: "none",
    transition: "border-color 0.2s",
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