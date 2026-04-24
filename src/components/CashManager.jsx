import { useState, useEffect } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, doc, updateDoc, increment, orderBy
} from "firebase/firestore";
import { auth, db } from "../firebase";

const RATE = 0.1; // 1コイン = 1円（必要に応じて変更）

export default function CashManager({ userData }) {
  const [cashLogs, setCashLogs]     = useState([]);
  const [children, setChildren]     = useState([]);
  const [coins, setCoins]           = useState(userData?.coins || 0);
  const [cash, setCash]             = useState(userData?.cash  || 0);
  const [exchangeCoins, setExchangeCoins] = useState(10);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [sending, setSending]       = useState(false);
  const [done, setDone]             = useState("");

  const uid      = auth.currentUser?.uid;
  const familyId = userData?.familyId;
  const isParent = userData?.role === "parent";

  // コイン・現金残高をリアルタイム監視
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid), snap => {
      if (snap.exists()) {
        setCoins(snap.data().coins || 0);
        setCash(snap.data().cash   || 0);
      }
    });
  }, [uid]);

  // 現金ログを取得
  useEffect(() => {
    if (!familyId) return;
    const q = isParent
      ? query(
          collection(db, "cashLogs"),
          where("familyId", "==", familyId),
          orderBy("createdAt", "desc")
        )
      : query(
          collection(db, "cashLogs"),
          where("userId", "==", uid),
          orderBy("createdAt", "desc")
        );
    return onSnapshot(q, snap => {
      setCashLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.error("現金ログ取得エラー:", err));
  }, [familyId, uid, isParent]);

  // 家族内の子供を取得（親のみ使用）
  useEffect(() => {
    if (!familyId || !isParent) return;
    const unsubList = [];
    const unsubFamily = onSnapshot(doc(db, "families", familyId), (familySnap) => {
      if (!familySnap.exists()) return;
      const members = familySnap.data().members || [];
      unsubList.forEach(fn => fn());
      unsubList.length = 0;
      setChildren([]);
      members.forEach(memberId => {
        const unsub = onSnapshot(doc(db, "users", memberId), (userSnap) => {
          if (!userSnap.exists()) return;
          const data = userSnap.data();
          if (data.role !== "child") return;
          setChildren(prev => {
            const others = prev.filter(c => c.id !== memberId);
            return [...others, { id: memberId, ...data }];
          });
        });
        unsubList.push(unsub);
      });
    });
    return () => { unsubFamily(); unsubList.forEach(fn => fn()); };
  }, [familyId, isParent]);

  // コイン→現金交換申請（子供）
  async function handleExchange() {
    if (exchangeCoins <= 0)      { alert("1以上のコインを入力してください"); return; }
    if (exchangeCoins > coins)   { alert(`コインが足りません。\nもってるコイン: ${coins}`); return; }
    if (!window.confirm(
      `coin ${exchangeCoins} を ${exchangeCoins * RATE}円に交換申請しますか？`
    )) return;

    setSending(true);
    try {
      await addDoc(collection(db, "cashLogs"), {
        userId:    uid,
        userName:  userData.name,
        familyId,
        type:      "exchange",
        coins:     exchangeCoins,
        amount:    exchangeCoins * RATE,
        rate:      RATE,
        status:    "pending",
        createdAt: new Date(),
      });
      setExchangeCoins(10);
      setDone("exchange");
      setTimeout(() => setDone(""), 2000);
    } catch (e) {
      alert("申請に失敗しました: " + e.message);
    } finally {
      setSending(false);
    }
  }

  // 交換申請を承認（親）
  async function handleApproveExchange(log) {
    try {
      // 子供のコインを減算
      await updateDoc(doc(db, "users", log.userId), {
        coins: increment(-log.coins),
        cash:  increment(log.amount),
      });
      // ログを承認済みに更新
      await updateDoc(doc(db, "cashLogs", log.id), {
        status:     "approved",
        approvedAt: new Date(),
        approvedBy: uid,
      });
    } catch (e) {
      alert("承認に失敗しました: " + e.message);
    }
  }

  // 交換申請を却下（親）
  async function handleRejectExchange(log) {
    try {
      await updateDoc(doc(db, "cashLogs", log.id), {
        status:     "rejected",
        approvedAt: new Date(),
        approvedBy: uid,
      });
    } catch (e) {
      alert("却下に失敗しました: " + e.message);
    }
  }

  // 現金を引き出し（親が子供に現金を渡した時）
  async function handleWithdraw(child, amount) {
    if (amount <= 0)        { alert("1以上の金額を入力してください"); return; }
    if (amount > child.cash){ alert(`現金残高が足りません。\n残高: ${child.cash}円`); return; }
    if (!window.confirm(
      `${child.name} の現金残高から ${amount}円 を引き出しますか？\n（実際に現金を渡した時に押してください）`
    )) return;

    try {
      await updateDoc(doc(db, "users", child.id), {
        cash: increment(-amount),
      });
      await addDoc(collection(db, "cashLogs"), {
        userId:    child.id,
        userName:  child.name,
        familyId,
        type:      "withdraw",
        coins:     0,
        amount,
        rate:      RATE,
        status:    "approved",
        createdAt: new Date(),
        approvedBy: uid,
      });
    } catch (e) {
      alert("引き出しに失敗しました: " + e.message);
    }
  }

  // 承認待ちの交換申請
  const pendingExchanges = cashLogs.filter(
    l => l.type === "exchange" && l.status === "pending"
  );

  return (
    <div style={{ fontFamily: "'Nunito','Hiragino Maru Gothic Pro',sans-serif" }}>

      {/* ===== 子供用UI ===== */}
      {!isParent && (
        <>
          {/* 残高カード */}
          <div style={{
            background: "linear-gradient(135deg,#1e1b4b,#312e81)",
            borderRadius: 20, padding: "20px", marginBottom: 16,
            boxShadow: "0 8px 30px rgba(79,70,229,0.3)",
          }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <p style={{ color: "#a5b4fc", fontSize: 12, margin: "0 0 4px" }}>
                  コイン残高
                </p>
                <div style={{ color: "#fde68a", fontSize: 26, fontWeight: 900 }}>
                  coin {coins}
                </div>
              </div>
              <div style={{
                width: 1, background: "rgba(255,255,255,0.2)",
              }} />
              <div style={{ flex: 1, textAlign: "center" }}>
                <p style={{ color: "#a5b4fc", fontSize: 12, margin: "0 0 4px" }}>
                  現金残高
                </p>
                <div style={{ color: "#86efac", fontSize: 26, fontWeight: 900 }}>
                  {cash}円
                </div>
              </div>
            </div>
          </div>

          {/* 交換申請フォーム */}
          <div style={{
            background: "white", borderRadius: 24, padding: "24px 20px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 16,
          }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: "#1e293b" }}>
              コインを現金にこうかん
            </h2>
            <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
              1コイン = {RATE}円 · おうちのひとに承認してもらってね
            </p>

            <label style={S.label}>こうかんするコイン数</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[10, 30, 50, 100].map(preset => (
                <button key={preset} onClick={() => setExchangeCoins(preset)} style={{
                  flex: 1, padding: "10px 4px", borderRadius: 12,
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  border: `2px solid ${exchangeCoins === preset ? "#7c3aed" : "#e2e8f0"}`,
                  background: exchangeCoins === preset ? "#ede9fe" : "#f8fafc",
                  color: exchangeCoins === preset ? "#7c3aed" : "#94a3b8",
                }}>coin {preset}</button>
              ))}
            </div>
            <input type="number" min={1} max={coins}
              style={S.input} value={exchangeCoins}
              onChange={e => setExchangeCoins(Number(e.target.value))} />

            {/* 交換後の金額プレビュー */}
            <div style={{
              background: "#f0fdf4", borderRadius: 12, padding: "12px",
              marginTop: 12, textAlign: "center",
            }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>こうかん後の金額：</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#22c55e" }}>
                {exchangeCoins * RATE}円
              </span>
            </div>

            {exchangeCoins > coins && (
              <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 700, marginTop: 8 }}>
                コインが足りません！（もってるコイン: {coins}）
              </p>
            )}

            <button onClick={handleExchange}
              disabled={sending || exchangeCoins <= 0 || exchangeCoins > coins}
              style={{
                ...S.btn, marginTop: 16,
                opacity: (sending || exchangeCoins <= 0 || exchangeCoins > coins) ? 0.5 : 1,
              }}>
              {done === "exchange" ? "申請しました！" : sending ? "申請中..." : "こうかんを申請する"}
            </button>
          </div>
        </>
      )}

      {/* ===== 親用UI ===== */}
      {isParent && (
        <>
          {/* 子供の残高一覧 */}
          <div style={{
            background: "white", borderRadius: 24, padding: "24px 20px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 16,
          }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 900, color: "#1e293b" }}>
              子供の残高管理
            </h2>
            {children.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: 13 }}>子供が登録されていません</p>
            ) : children.map(child => (
              <div key={child.id} style={{
                background: "#f8fafc", borderRadius: 16, padding: "14px",
                marginBottom: 12, border: "2px solid #e2e8f0",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "linear-gradient(135deg,#fde68a,#f59e0b)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20,
                  }}>👦</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: "#1e293b" }}>
                      {child.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>
                      coin {child.coins ?? 0} · 現金 {child.cash ?? 0}円
                    </div>
                  </div>
                </div>

                {/* 引き出しフォーム */}
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number" min={1}
                    placeholder="引き出し金額（円）"
                    id={`withdraw-${child.id}`}
                    style={{ ...S.input, flex: 1, padding: "10px 12px", fontSize: 14 }}
                  />
                  <button
                    onClick={() => {
                      const el = document.getElementById(`withdraw-${child.id}`);
                      handleWithdraw(child, Number(el.value));
                      el.value = "";
                    }}
                    style={{
                      padding: "10px 16px", borderRadius: 12, border: "none",
                      background: "linear-gradient(135deg,#22c55e,#16a34a)",
                      color: "white", fontWeight: 800, fontSize: 13,
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}>
                    引き出し
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 交換申請の承認 */}
          {pendingExchanges.length > 0 && (
            <div style={{
              background: "white", borderRadius: 24, padding: "24px 20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 16,
            }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 900, color: "#1e293b" }}>
                交換申請 ({pendingExchanges.length}件)
              </h2>
              {pendingExchanges.map(log => (
                <div key={log.id} style={{
                  background: "#fef3c7", borderRadius: 16, padding: "14px",
                  marginBottom: 10, border: "2px solid #fde68a",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 28 }}>💱</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b" }}>
                        {log.userName}
                      </div>
                      <div style={{ fontSize: 13, color: "#64748b" }}>
                        coin {log.coins} → {log.amount}円
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleRejectExchange(log)} style={{
                      flex: 1, padding: "10px", borderRadius: 12,
                      border: "2px solid #fca5a5", background: "#fff1f2",
                      color: "#ef4444", fontWeight: 800, fontSize: 13,
                    }}>却下</button>
                    <button onClick={() => handleApproveExchange(log)} style={{
                      flex: 2, padding: "10px", borderRadius: 12, border: "none",
                      background: "linear-gradient(135deg,#22c55e,#16a34a)",
                      color: "white", fontWeight: 800, fontSize: 14,
                      boxShadow: "0 3px 10px rgba(34,197,94,0.3)",
                    }}>承認して現金に追加</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 履歴（親・子共通） */}
      <h3 style={{ fontWeight: 900, fontSize: 15, color: "#1e293b", marginBottom: 10 }}>
        現金の履歴
      </h3>
      {cashLogs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
          <p style={{ fontWeight: 700 }}>履歴がまだありません</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cashLogs.map(log => {
            const date    = log.createdAt?.toDate
              ? log.createdAt.toDate() : new Date();
            const dateStr = `${date.getMonth()+1}/${date.getDate()}`;
            const typeInfo = {
              exchange: {
                icon: "💱", label: "コイン交換",
                color: "#2563eb", bg: "#eff6ff", border: "#93c5fd",
              },
              withdraw: {
                icon: "💴", label: "引き出し",
                color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd",
              },
            }[log.type] || { icon: "💰", label: log.type, color: "#64748b", bg: "#f1f5f9", border: "#cbd5e1" };

            const statusInfo = {
              pending:  { text: "審査中",   color: "#f59e0b", bg: "#fef3c7" },
              approved: { text: "承認済み", color: "#22c55e", bg: "#f0fdf4" },
              rejected: { text: "却下",     color: "#ef4444", bg: "#fff1f2" },
            }[log.status] || { text: log.status, color: "#94a3b8", bg: "#f1f5f9" };

            return (
              <div key={log.id} style={{
                background: "white", borderRadius: 14, padding: "12px 14px",
                border: `2px solid ${typeInfo.border}`,
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: "50%",
                  background: typeInfo.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, flexShrink: 0,
                }}>{typeInfo.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>
                    {isParent ? `${log.userName} · ` : ""}{typeInfo.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {dateStr}
                    {log.type === "exchange" && ` · coin ${log.coins} → ${log.amount}円`}
                    {log.type === "withdraw" && ` · ${log.amount}円 引き出し`}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{
                    fontWeight: 900, fontSize: 15,
                    color: log.type === "withdraw" ? "#ef4444" : "#22c55e",
                  }}>
                    {log.type === "withdraw" ? "-" : "+"}{log.amount}円
                  </span>
                  <span style={{
                    background: statusInfo.bg, color: statusInfo.color,
                    fontSize: 11, fontWeight: 700, borderRadius: 8, padding: "2px 7px",
                  }}>{statusInfo.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const S = {
  label: {
    display: "block", fontSize: 13, fontWeight: 700,
    color: "#64748b", marginBottom: 8, marginTop: 8,
  },
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