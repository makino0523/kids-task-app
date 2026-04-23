import { useState, useEffect } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, doc, updateDoc, increment, getDoc, orderBy
} from "firebase/firestore";
import { auth, db } from "../firebase";

export default function CoinTransfer({ userData }) {
  const [members, setMembers]       = useState([]); // 家族メンバー
  const [transfers, setTransfers]   = useState([]); // 送受信履歴
  const [toUserId, setToUserId]     = useState("");  // 送り先
  const [amount, setAmount]         = useState(10);  // 送る金額
  const [sending, setSending]       = useState(false);
  const [done, setDone]             = useState(false);

  const uid      = auth.currentUser?.uid;
  const familyId = userData?.familyId;
  const coins    = userData?.coins || 0;

  // 家族メンバーを取得（自分以外）
  useEffect(() => {
    if (!familyId) return;
    const unsubList = [];
    const unsubFamily = onSnapshot(doc(db, "families", familyId), (familySnap) => {
      if (!familySnap.exists()) return;
      const memberIds = (familySnap.data().members || []).filter(id => id !== uid);
      unsubList.forEach(fn => fn());
      unsubList.length = 0;
      setMembers([]);
      memberIds.forEach(memberId => {
        const unsub = onSnapshot(doc(db, "users", memberId), (userSnap) => {
          if (!userSnap.exists()) return;
          const data = userSnap.data();
          setMembers(prev => {
            const others = prev.filter(m => m.id !== memberId);
            return [...others, { id: memberId, ...data }];
          });
        });
        unsubList.push(unsub);
      });
    });
    return () => { unsubFamily(); unsubList.forEach(fn => fn()); };
  }, [familyId, uid]);

  // 送受信履歴を取得
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "coinTransfers"),
      where("familyId", "==", familyId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, snap => {
      setTransfers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.error("送受信履歴取得エラー:", err));
  }, [uid, familyId]);

  // コインを送る
async function handleSend() {
  if (!toUserId)   { alert("送り先を選んでください"); return; }
  if (amount <= 0) { alert("1以上の金額を入力してください"); return; }

  const toUser   = members.find(m => m.id === toUserId);
  if (!toUser) return;

  // 子供が送る場合のみコイン不足チェック
  const isParentSending = userData.role === "parent";
  if (!isParentSending && amount > coins) {
    alert(`コインが足りません。\nもってるコイン: ${coins}`);
    return;
  }

  if (!window.confirm(
    `${toUser.name} さんに coin ${amount} を送りますか？`
  )) return;

  setSending(true);
  try {
    // 送り主のコインを減算（親の場合はマイナスになってもOK）
    await updateDoc(doc(db, "users", uid), {
      coins: increment(-amount),
    });
    // 受け取り側のコインを加算
    await updateDoc(doc(db, "users", toUserId), {
      coins: increment(amount),
    });
    // 送受信履歴を保存
    await addDoc(collection(db, "coinTransfers"), {
      fromUserId:   uid,
      fromName:     userData.name,
      fromRole:     userData.role,
      toUserId,
      toName:       toUser.name,
      toRole:       toUser.role,
      amount,
      familyId,
      createdAt:    new Date(),
    });
    setAmount(10);
    setToUserId("");
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  } catch (e) {
    alert("送信に失敗しました: " + e.message);
  } finally {
    setSending(false);
  }
}

  return (
    <div style={{ fontFamily: "'Nunito','Hiragino Maru Gothic Pro',sans-serif" }}>

      {/* コイン残高 */}
      <div style={{
        background: "linear-gradient(135deg,#1e1b4b,#312e81)",
        borderRadius: 20, padding: "20px", marginBottom: 16, textAlign: "center",
        boxShadow: "0 8px 30px rgba(79,70,229,0.3)",
      }}>
        <p style={{ color: "#a5b4fc", fontSize: 13, margin: "0 0 4px" }}>
          あなたのコイン
        </p>
        <div style={{ color: "#fde68a", fontSize: 32, fontWeight: 900 }}>
          coin {coins}
        </div>
      </div>

      {/* 送金フォーム */}
      <div style={{
        background: "white", borderRadius: 24, padding: "24px 20px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 16,
      }}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 900, color: "#1e293b" }}>
          コインをおくる
        </h2>

        {/* 送り先選択 */}
        <label style={S.label}>おくる相手</label>
        {members.length === 0 ? (
          <p style={{ fontSize: 13, color: "#94a3b8" }}>家族メンバーがいません</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {members.map(member => (
              <button key={member.id}
                onClick={() => setToUserId(member.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 14, cursor: "pointer",
                  border: `2px solid ${toUserId === member.id ? "#7c3aed" : "#e2e8f0"}`,
                  background: toUserId === member.id ? "#ede9fe" : "#f8fafc",
                  textAlign: "left",
                }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: member.role === "child"
                    ? "linear-gradient(135deg,#fde68a,#f59e0b)"
                    : "linear-gradient(135deg,#7c3aed,#4f46e5)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                }}>
                  {member.role === "child" ? "👦" : "👨"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b" }}>
                    {member.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {member.role === "child" ? "子供" : "親"} · coin {member.coins ?? 0}
                  </div>
                </div>
                {toUserId === member.id && (
                  <span style={{ fontSize: 20 }}>✅</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* 金額入力 */}
        <label style={S.label}>おくる金額</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[10, 30, 50, 100].map(preset => (
            <button key={preset} onClick={() => setAmount(preset)} style={{
              flex: 1, padding: "10px 4px", borderRadius: 12,
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: `2px solid ${amount === preset ? "#7c3aed" : "#e2e8f0"}`,
              background: amount === preset ? "#ede9fe" : "#f8fafc",
              color: amount === preset ? "#7c3aed" : "#94a3b8",
            }}>coin {preset}</button>
          ))}
        </div>
        <input
          type="number" min={1} max={coins}
          style={S.input} value={amount}
          onChange={e => setAmount(Number(e.target.value))}
        />
        {userData.role !== "parent" && amount > coins && (
          <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 700, marginTop: 6 }}>
            コインが足りません！（もってるコイン: {coins}）
          </p>
        )}

<button onClick={handleSend}
  disabled={sending || !toUserId || amount <= 0
    || (userData.role !== "parent" && amount > coins)}
  style={{
    ...S.btn, marginTop: 20,
    opacity: (sending || !toUserId || amount <= 0
      || (userData.role !== "parent" && amount > coins)) ? 0.5 : 1,
  }}>
  {done ? "おくりました！" : sending ? "おくり中..." : "コインをおくる"}
</button>
      </div>

      {/* 送受信履歴 */}
      <h3 style={{ fontWeight: 900, fontSize: 15, color: "#1e293b", marginBottom: 10 }}>
        おくり・うけとり履歴
      </h3>
      {transfers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
          <p style={{ fontWeight: 700 }}>履歴がまだありません</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {transfers.map(t => {
            const isSent     = t.fromUserId === uid;
            const dateStr    = t.createdAt?.toDate
              ? (() => {
                  const d = t.createdAt.toDate();
                  return `${d.getMonth()+1}/${d.getDate()}`;
                })()
              : "";
            return (
              <div key={t.id} style={{
                background: "white", borderRadius: 14, padding: "12px 14px",
                border: `2px solid ${isSent ? "#fca5a5" : "#86efac"}`,
                display: "flex", alignItems: "center", gap: 10,
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: isSent
                    ? "linear-gradient(135deg,#fca5a5,#ef4444)"
                    : "linear-gradient(135deg,#86efac,#22c55e)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                }}>
                  {isSent ? "↑" : "↓"}
                </div>
                <div style={{ flex: 1 }}>
<div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>
  {isSent
    ? `${t.toName}（${t.toRole === "child" ? "子供" : "親"}）へ送った`
    : `${t.fromName}（${t.fromRole === "child" ? "子供" : "親"}）から受け取った`}
</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {dateStr}
                  </div>
                </div>
                <span style={{
                  fontWeight: 900, fontSize: 15,
                  color: isSent ? "#ef4444" : "#22c55e",
                }}>
                  {isSent ? "-" : "+"}coin {t.amount}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const S = {
  label: { display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 8, marginTop: 8 },
  input: {
    width: "100%", padding: "12px 14px", borderRadius: 14,
    border: "2px solid #e2e8f0", fontSize: 15, outline: "none",
    boxSizing: "border-box",
  },
  btn: {
    width: "100%", padding: "14px", borderRadius: 16, border: "none",
    background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
    color: "white", fontWeight: 800, fontSize: 16, cursor: "pointer",
    boxShadow: "0 4px 15px rgba(124,58,237,0.35)",
  },
};