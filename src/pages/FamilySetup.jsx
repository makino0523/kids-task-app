import { useState } from "react";
import {
  doc, setDoc, updateDoc, getDoc,
  collection, query, where, getDocs, arrayUnion
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";

// ランダムな6桁の招待コードを生成
function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function FamilySetup({ role }) {
  const [tab, setTab]           = useState(role === "parent" ? "create" : "join");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  // 家族グループを新規作成（親のみ）
  async function handleCreate() {
    setError("");
    if (!familyName.trim()) { setError("家族の名前を入力してください"); return; }
    setLoading(true);
    try {
      const code     = generateInviteCode();
      const familyId = doc(collection(db, "families")).id; // 自動ID生成

      // families コレクションに保存
      await setDoc(doc(db, "families", familyId), {
        name: familyName,
        inviteCode: code,
        members: [uid],
        createdAt: new Date(),
      });

      // users コレクションに familyId を紐付け
      await updateDoc(doc(db, "users", uid), { familyId });

      navigate("/");
    } catch (e) {
      setError("作成に失敗しました: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  // 招待コードで家族グループに参加（子供・親どちらも可）
  async function handleJoin() {
    setError("");
    if (!inviteCode.trim()) { setError("招待コードを入力してください"); return; }
    setLoading(true);
    try {
      const code = inviteCode.trim().toUpperCase();

      // 招待コードで families を検索
      const q    = query(collection(db, "families"), where("inviteCode", "==", code));
      const snap = await getDocs(q);

      if (snap.empty) {
        setError("招待コードが見つかりません。確認してください");
        setLoading(false);
        return;
      }

      const familyDoc = snap.docs[0];
      const familyId  = familyDoc.id;

      // families の members に自分を追加
      await updateDoc(doc(db, "families", familyId), {
        members: arrayUnion(uid),
      });

      // users に familyId を紐付け
      await updateDoc(doc(db, "users", uid), { familyId });

      navigate("/");
    } catch (e) {
      setError("参加に失敗しました: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.bg}>
      <div style={styles.card}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 52 }}>👨‍👩‍👦</div>
          <h1 style={styles.title}>家族グループの設定</h1>
          <p style={styles.sub}>家族みんなでつながろう！</p>
        </div>

        {/* タブ */}
        <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 14, padding: 4, marginBottom: 24 }}>
          {role === "parent" && (
            <button onClick={() => setTab("create")} style={{
              ...styles.tab, ...(tab === "create" ? styles.tabActive : {})
            }}>
              🏠 グループを作る
            </button>
          )}
          <button onClick={() => setTab("join")} style={{
            ...styles.tab, ...(tab === "join" ? styles.tabActive : {}),
            flex: role === "parent" ? 1 : 2,
          }}>
            🔑 コードで参加
          </button>
        </div>

        {/* グループ作成（親のみ） */}
        {tab === "create" && role === "parent" && (
          <div>
            <label style={styles.label}>家族の名前</label>
            <input style={styles.input} value={familyName}
              onChange={e => setFamilyName(e.target.value)}
              placeholder="例：田中家" />
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
              グループを作ると招待コードが発行されます。<br />
              子供にそのコードを伝えて参加してもらってください。
            </p>
            {error && <p style={styles.error}>{error}</p>}
            <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
              onClick={handleCreate} disabled={loading}>
              {loading ? "作成中…" : "グループを作成する"}
            </button>
          </div>
        )}

        {/* コードで参加 */}
        {tab === "join" && (
          <div>
            <label style={styles.label}>招待コード（6桁）</label>
            <input style={{ ...styles.input, textTransform: "uppercase", letterSpacing: 4,
              fontSize: 22, textAlign: "center", fontWeight: 900 }}
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              placeholder="ABC123" maxLength={6} />
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
              親からもらった6桁のコードを入力してください。
            </p>
            {error && <p style={styles.error}>{error}</p>}
            <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
              onClick={handleJoin} disabled={loading}>
              {loading ? "参加中…" : "参加する"}
            </button>
          </div>
        )}
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
  title: { fontSize: 22, fontWeight: 900, color: "#1e293b", margin: "8px 0 4px" },
  sub:   { fontSize: 13, color: "#94a3b8" },
  label: { display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 6, marginTop: 8 },
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
  tab: {
    flex: 1, padding: "10px", borderRadius: 10, border: "none",
    background: "transparent", color: "#94a3b8", fontWeight: 700,
    fontSize: 13, cursor: "pointer",
  },
  tabActive: {
    background: "white", color: "#7c3aed",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  error: { color: "#ef4444", fontSize: 13, marginTop: 10, fontWeight: 700 },
};