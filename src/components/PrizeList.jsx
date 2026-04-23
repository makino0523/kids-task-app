import { useState, useEffect } from "react";
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, orderBy
} from "firebase/firestore";
import { auth, db } from "../firebase";

const RARITY_STYLES = {
  "ノーマル":     { color: "#64748b", bg: "#f1f5f9", border: "#cbd5e1" },
  "レア":         { color: "#2563eb", bg: "#eff6ff", border: "#93c5fd" },
  "スーパーレア": { color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" },
  "ウルトラレア": { color: "#ea580c", bg: "#fff7ed", border: "#fdba74" },
  "レジェンド":   { color: "#b45309", bg: "#fefce8", border: "#fde047" },
};

const STATUS_INFO = {
  null:        { text: "未申請",     color: "#94a3b8", bg: "#f1f5f9" },
  requested:   { text: "承認待ち",   color: "#f59e0b", bg: "#fef3c7" },
  approved:    { text: "承認済み",   color: "#2563eb", bg: "#eff6ff" },
  delivered:   { text: "引渡済み",   color: "#22c55e", bg: "#f0fdf4" },
};

export default function PrizeList({ userData }) {
  const [logs, setLogs]         = useState([]);
  const [filter, setFilter]     = useState("all");
  const [processing, setProcessing] = useState({});

  const uid      = auth.currentUser?.uid;
  const familyId = userData?.familyId;
  const isParent = userData?.role === "parent";

  // ガチャログを取得
  useEffect(() => {
    if (!familyId) return;
    const q = isParent
      ? query(
          collection(db, "gachaLogs"),
          where("familyId", "==", familyId),
          orderBy("pulledAt", "desc")
        )
      : query(
          collection(db, "gachaLogs"),
          where("userId", "==", uid),
          orderBy("pulledAt", "desc")
        );
    return onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.error("景品リスト取得エラー:", err));
  }, [familyId, uid, isParent]);

  // 子供：承認依頼
  async function handleRequest(logId) {
    setProcessing(prev => ({ ...prev, [logId]: true }));
    try {
      await updateDoc(doc(db, "gachaLogs", logId), {
        requestStatus: "requested",
        requestedAt:   new Date(),
      });
    } catch (e) {
      alert("依頼に失敗しました: " + e.message);
    } finally {
      setProcessing(prev => ({ ...prev, [logId]: false }));
    }
  }

  // 子供：承認依頼をキャンセル
  async function handleCancelRequest(logId) {
    setProcessing(prev => ({ ...prev, [logId]: true }));
    try {
      await updateDoc(doc(db, "gachaLogs", logId), {
        requestStatus: null,
        requestedAt:   null,
      });
    } catch (e) {
      alert("キャンセルに失敗しました: " + e.message);
    } finally {
      setProcessing(prev => ({ ...prev, [logId]: false }));
    }
  }

  // 親：承認
  async function handleApprove(logId) {
    setProcessing(prev => ({ ...prev, [logId]: true }));
    try {
      await updateDoc(doc(db, "gachaLogs", logId), {
        requestStatus: "approved",
        approvedAt:    new Date(),
        approvedBy:    uid,
      });
    } catch (e) {
      alert("承認に失敗しました: " + e.message);
    } finally {
      setProcessing(prev => ({ ...prev, [logId]: false }));
    }
  }

  // 親：引き渡し完了
  async function handleDeliver(logId) {
    if (!window.confirm("景品を引き渡しましたか？")) return;
    setProcessing(prev => ({ ...prev, [logId]: true }));
    try {
      await updateDoc(doc(db, "gachaLogs", logId), {
        requestStatus: "delivered",
        deliveredAt:   new Date(),
        deliveredBy:   uid,
      });
    } catch (e) {
      alert("引き渡し処理に失敗しました: " + e.message);
    } finally {
      setProcessing(prev => ({ ...prev, [logId]: false }));
    }
  }

  // 親：承認を取り消し
  async function handleRevokeApprove(logId) {
    setProcessing(prev => ({ ...prev, [logId]: true }));
    try {
      await updateDoc(doc(db, "gachaLogs", logId), {
        requestStatus: "requested",
        approvedAt:    null,
        approvedBy:    null,
      });
    } catch (e) {
      alert("取り消しに失敗しました: " + e.message);
    } finally {
      setProcessing(prev => ({ ...prev, [logId]: false }));
    }
  }

  // フィルタリング
  const filteredLogs = logs.filter(log => {
    const status = log.requestStatus || null;
    if (filter === "all")       return true;
    if (filter === "unrequested") return !status;
    if (filter === "requested") return status === "requested";
    if (filter === "approved")  return status === "approved";
    if (filter === "delivered") return status === "delivered";
    return true;
  });

  // 件数バッジ
  const counts = {
    all:         logs.length,
    unrequested: logs.filter(l => !l.requestStatus).length,
    requested:   logs.filter(l => l.requestStatus === "requested").length,
    approved:    logs.filter(l => l.requestStatus === "approved").length,
    delivered:   logs.filter(l => l.requestStatus === "delivered").length,
  };

  const formatDate = (ts) => {
    if (!ts?.toDate) return "";
    const d = ts.toDate();
    return `${d.getMonth()+1}/${d.getDate()}`;
  };

  return (
    <div style={{ fontFamily: "'Nunito','Hiragino Maru Gothic Pro',sans-serif" }}>

      {/* ヘッダー */}
      <div style={{
        background: "linear-gradient(135deg,#1e1b4b,#312e81)",
        borderRadius: 20, padding: "16px 20px", marginBottom: 16,
        boxShadow: "0 8px 30px rgba(79,70,229,0.3)",
      }}>
        <h2 style={{ color: "#fde68a", margin: "0 0 4px", fontSize: 18, fontWeight: 900 }}>
          景品リスト
        </h2>
        <p style={{ color: "#a5b4fc", fontSize: 12, margin: 0 }}>
          {isParent
            ? "子供が引いた景品の承認・引き渡し管理"
            : "ガチャで当たった景品一覧・受け取り申請"}
        </p>
      </div>

      {/* フィルタータブ */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 16,
        overflowX: "auto", paddingBottom: 4,
      }}>
        {[
          ["all",         "すべて"],
          ["unrequested", "未申請"],
          ["requested",   "承認待ち"],
          ["approved",    "承認済み"],
          ["delivered",   "引渡済み"],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: "6px 12px", borderRadius: 20, border: "none",
            background: filter === key
              ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "white",
            color: filter === key ? "white" : "#64748b",
            fontWeight: 700, fontSize: 12, cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: filter === key
              ? "0 3px 10px rgba(124,58,237,0.3)" : "0 1px 4px rgba(0,0,0,0.08)",
          }}>
            {label}
            {counts[key] > 0 && (
              <span style={{
                marginLeft: 5, background: filter === key
                  ? "rgba(255,255,255,0.3)" : "#e2e8f0",
                borderRadius: 10, padding: "1px 6px", fontSize: 11,
              }}>{counts[key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* 景品一覧 */}
      {filteredLogs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
          <div style={{ fontSize: 48 }}>🎁</div>
          <p style={{ fontWeight: 700, marginTop: 12 }}>
            {filter === "all" ? "景品がまだありません" : "該当する景品はありません"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredLogs.map(log => {
            const rs         = RARITY_STYLES[log.rarity] || RARITY_STYLES["ノーマル"];
            const status     = log.requestStatus || null;
            const statusInfo = STATUS_INFO[status] || STATUS_INFO[null];
            const isProcessing = processing[log.id] || false;

            return (
              <div key={log.id} style={{
                background: "white", borderRadius: 20, padding: "16px",
                border: `2px solid ${rs.border}`,
                boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              }}>
                {/* 景品情報 */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: rs.bg, border: `2px solid ${rs.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 32, flexShrink: 0,
                  }}>{log.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: "#1e293b" }}>
                      {log.prizeName}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                      <span style={{
                        background: rs.bg, color: rs.color, fontSize: 11,
                        fontWeight: 700, borderRadius: 8, padding: "2px 8px",
                        border: `1px solid ${rs.border}`,
                      }}>{log.rarity}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        {log.machineName} · {formatDate(log.pulledAt)}
                      </span>
                      {isParent && (
                        <span style={{
                          fontSize: 11, color: "#7c3aed", fontWeight: 700,
                          background: "#ede9fe", borderRadius: 8, padding: "2px 8px",
                        }}>
                          {log.userName ?? ""}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* ステータスバッジ */}
                  <span style={{
                    background: statusInfo.bg, color: statusInfo.color,
                    fontSize: 12, fontWeight: 800, borderRadius: 10,
                    padding: "4px 10px", whiteSpace: "nowrap", flexShrink: 0,
                  }}>{statusInfo.text}</span>
                </div>

                {/* アクションボタン */}
                {!isParent && (
                  // 子供側ボタン
                  <div>
                    {!status && (
                      <button onClick={() => handleRequest(log.id)}
                        disabled={isProcessing}
                        style={{
                          width: "100%", padding: "10px", borderRadius: 12, border: "none",
                          background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                          color: "white", fontWeight: 800, fontSize: 14,
                          cursor: isProcessing ? "not-allowed" : "pointer",
                          opacity: isProcessing ? 0.7 : 1,
                        }}>
                        {isProcessing ? "送信中..." : "もらいたい！（承認依頼）"}
                      </button>
                    )}
                    {status === "requested" && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleCancelRequest(log.id)}
                          disabled={isProcessing}
                          style={{
                            flex: 1, padding: "10px", borderRadius: 12,
                            border: "2px solid #e2e8f0", background: "#f8fafc",
                            color: "#64748b", fontWeight: 700, fontSize: 13,
                            cursor: isProcessing ? "not-allowed" : "pointer",
                          }}>
                          キャンセル
                        </button>
                        <div style={{
                          flex: 2, padding: "10px", borderRadius: 12,
                          background: "#fef3c7", textAlign: "center",
                          color: "#f59e0b", fontWeight: 800, fontSize: 13,
                        }}>
                          おうちのひとを待ってね
                        </div>
                      </div>
                    )}
                    {status === "approved" && (
                      <div style={{
                        padding: "12px", borderRadius: 12,
                        background: "#eff6ff", textAlign: "center",
                        color: "#2563eb", fontWeight: 800, fontSize: 14,
                      }}>
                        承認されたよ！おうちのひとに声をかけてね
                      </div>
                    )}
                    {status === "delivered" && (
                      <div style={{
                        padding: "12px", borderRadius: 12,
                        background: "#f0fdf4", textAlign: "center",
                        color: "#22c55e", fontWeight: 800, fontSize: 14,
                      }}>
                        受け取り完了！よかったね！
                      </div>
                    )}
                  </div>
                )}

                {isParent && (
                  // 親側ボタン
                  <div>
                    {status === "requested" && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleRevokeApprove(log.id)}
                          disabled={isProcessing}
                          style={{
                            flex: 1, padding: "10px", borderRadius: 12,
                            border: "2px solid #fca5a5", background: "#fff1f2",
                            color: "#ef4444", fontWeight: 800, fontSize: 13,
                            cursor: isProcessing ? "not-allowed" : "pointer",
                          }}>却下</button>
                        <button onClick={() => handleApprove(log.id)}
                          disabled={isProcessing}
                          style={{
                            flex: 2, padding: "10px", borderRadius: 12, border: "none",
                            background: isProcessing
                              ? "#a5b4fc" : "linear-gradient(135deg,#2563eb,#1d4ed8)",
                            color: "white", fontWeight: 800, fontSize: 14,
                            cursor: isProcessing ? "not-allowed" : "pointer",
                            boxShadow: "0 3px 10px rgba(37,99,235,0.3)",
                          }}>
                          {isProcessing ? "処理中..." : "承認する"}
                        </button>
                      </div>
                    )}
                    {status === "approved" && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleRevokeApprove(log.id)}
                          disabled={isProcessing}
                          style={{
                            flex: 1, padding: "10px", borderRadius: 12,
                            border: "2px solid #e2e8f0", background: "#f8fafc",
                            color: "#64748b", fontWeight: 700, fontSize: 13,
                            cursor: isProcessing ? "not-allowed" : "pointer",
                          }}>取り消し</button>
                        <button onClick={() => handleDeliver(log.id)}
                          disabled={isProcessing}
                          style={{
                            flex: 2, padding: "10px", borderRadius: 12, border: "none",
                            background: isProcessing
                              ? "#86efac" : "linear-gradient(135deg,#22c55e,#16a34a)",
                            color: "white", fontWeight: 800, fontSize: 14,
                            cursor: isProcessing ? "not-allowed" : "pointer",
                            boxShadow: "0 3px 10px rgba(34,197,94,0.3)",
                          }}>
                          {isProcessing ? "処理中..." : "引き渡し完了"}
                        </button>
                      </div>
                    )}
                    {!status && (
                      <div style={{
                        padding: "10px", borderRadius: 12,
                        background: "#f8fafc", textAlign: "center",
                        color: "#94a3b8", fontSize: 13, fontWeight: 700,
                      }}>
                        子供からの申請待ち
                      </div>
                    )}
                    {status === "delivered" && (
                      <div style={{
                        padding: "10px", borderRadius: 12,
                        background: "#f0fdf4", textAlign: "center",
                        color: "#22c55e", fontSize: 13, fontWeight: 800,
                      }}>
                        引き渡し完了済み
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}