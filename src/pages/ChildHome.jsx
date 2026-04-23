import { useState, useEffect } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, deleteDoc, doc, updateDoc, increment
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { shouldShowToday, DAY_NAMES } from "../utils/scheduleFilter";
import CoinTransfer from "../components/CoinTransfer";
import CashManager from "../components/CashManager";
import PrizeList from "../components/PrizeList";

const CATEGORY_COLORS = {
  "宿題":     { bg: "#eff6ff", border: "#3b82f6", badge: "#3b82f6" },
  "習い事":   { bg: "#f0fdf4", border: "#22c55e", badge: "#22c55e" },
  "お手伝い": { bg: "#fff7ed", border: "#f97316", badge: "#f97316" },
};

const RARITY_STYLES = {
  "ノーマル":     { color: "#64748b", bg: "#f1f5f9", border: "#cbd5e1" },
  "レア":         { color: "#2563eb", bg: "#eff6ff", border: "#93c5fd" },
  "スーパーレア": { color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" },
  "ウルトラレア": { color: "#ea580c", bg: "#fff7ed", border: "#fdba74" },
  "レジェンド":   { color: "#b45309", bg: "#fefce8", border: "#fde047" },
};

function Stars({ count, max = 5 }) {
  return (
    <span style={{ fontSize: 14 }}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ color: i < count ? "#fbbf24" : "#e2e8f0" }}>★</span>
      ))}
    </span>
  );
}

function GachaModal({ prize, onClose }) {
  const [phase, setPhase] = useState("spinning");
  const rs = RARITY_STYLES[prize.rarity] || RARITY_STYLES["ノーマル"];

  useEffect(() => {
    const t = setTimeout(() => setPhase("result"), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(15,10,40,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(6px)",
      fontFamily: "'Nunito','Hiragino Maru Gothic Pro',sans-serif",
    }}>
      <div style={{
        background: "linear-gradient(160deg,#1e1b4b,#312e81,#4c1d95)",
        borderRadius: 28, padding: "36px 28px", width: 340, maxWidth: "95vw",
        boxShadow: "0 0 60px rgba(139,92,246,0.5)",
        textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        {phase === "spinning" && (
          <>
            <style>{`@keyframes spin3d{from{transform:rotateY(0)}to{transform:rotateY(360deg)}}`}</style>
            <div style={{ fontSize: 80, animation: "spin3d 0.4s linear infinite" }}>🎰</div>
            <p style={{ color: "#a5b4fc", marginTop: 20, fontSize: 18, fontWeight: 800 }}>
              ドキドキ...！
            </p>
          </>
        )}
        {phase === "result" && (
          <>
            <style>{`@keyframes pop{0%{transform:scale(0)}60%{transform:scale(1.2)}100%{transform:scale(1)}}`}</style>
            <div style={{ fontSize: 88, animation: "pop 0.5s cubic-bezier(.36,.07,.19,.97)" }}>
              {prize.emoji}
            </div>
            <div style={{
              background: `${rs.bg}33`, border: `2px solid ${rs.border}`,
              borderRadius: 16, padding: "16px 20px", margin: "16px 0",
            }}>
              <div style={{ color: rs.color, fontWeight: 900, fontSize: 13, marginBottom: 6 }}>
                {prize.rarity}
              </div>
              <div style={{ color: "white", fontWeight: 900, fontSize: 24 }}>{prize.name}</div>
            </div>
            <p style={{ color: "#a5b4fc", fontSize: 13, marginBottom: 20 }}>
              おうちのひとにみせてね！
            </p>
            <button onClick={onClose} style={{
              width: "100%", padding: "14px", borderRadius: 16, border: "none",
              background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
              color: "white", fontWeight: 900, fontSize: 18, cursor: "pointer",
            }}>やったー！</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ChildHome({ userData }) {
  const [tab, setTab]           = useState("tasks");
  const [tasks, setTasks]       = useState([]);
  const [myLogs, setMyLogs]     = useState([]);
  const [machines, setMachines] = useState([]);
  const [sending, setSending]   = useState({});
  const [pulling, setPulling]   = useState(false);
  const [gachaResult, setGachaResult] = useState(null);

  const uid      = auth.currentUser?.uid;
  const familyId = userData?.familyId;
  const coins    = userData?.coins || 0;

  // タスク一覧
  useEffect(() => {
    if (!familyId) return;
    return onSnapshot(
      query(collection(db, "tasks"), where("familyId", "==", familyId)),
      snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error("タスク取得エラー:", err)
    );
  }, [familyId]);

  // 今日のタスクログ
  useEffect(() => {
    if (!uid) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return onSnapshot(
      query(
        collection(db, "taskLogs"),
        where("userId", "==", uid),
        where("completedAt", ">=", todayStart)
      ),
      snap => setMyLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error("ログ取得エラー:", err)
    );
  }, [uid]);

  // ガチャ機械一覧
  useEffect(() => {
    if (!familyId) return;
    return onSnapshot(
      query(collection(db, "gachaMachines"), where("familyId", "==", familyId)),
      snap => setMachines(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error("ガチャ機械取得エラー:", err)
    );
  }, [familyId]);

  // 今日表示すべきタスクに絞り込む
  const todayTasks   = tasks.filter(task => shouldShowToday(task));
  const todayTaskIds = todayTasks.map(t => t.id);

  function getLog(taskId) {
    return myLogs.find(l => l.taskId === taskId) || null;
  }

  const todayApproved = myLogs.filter(l =>
    l.status === "approved" && todayTaskIds.includes(l.taskId)
  ).length;
  const progress = todayTaskIds.length > 0
    ? (todayApproved / todayTaskIds.length) * 100 : 0;

  // できた！
  async function handleComplete(task) {
    if (getLog(task.id) || sending[task.id]) return;
    setSending(prev => ({ ...prev, [task.id]: true }));
    try {
      await addDoc(collection(db, "taskLogs"), {
        taskId: task.id, userId: uid, familyId,
        status: "pending", completedAt: new Date(),
      });
    } catch (e) {
      alert("送信に失敗しました: " + e.message);
    } finally {
      setSending(prev => ({ ...prev, [task.id]: false }));
    }
  }

  // もういちどやる
  async function handleRetry(log) {
    try {
      await deleteDoc(doc(db, "taskLogs", log.id));
    } catch (e) {
      alert("やり直しに失敗しました: " + e.message);
    }
  }

  // ガチャを引く
  async function handleGacha(machine) {
    if (pulling) return;
    if (coins < machine.cost) {
      alert(`コインが足りないよ！\nひつよう: ${machine.cost} / もってる: ${coins}`);
      return;
    }
    if (!window.confirm(`「${machine.name}」を引く？\n${machine.cost}コイン使うよ！`)) return;
    setPulling(true);
    try {
      const prizes = machine.prizes || [];
      const total  = prizes.reduce((s, p) => s + Number(p.weight), 0);
      let rand = Math.random() * total;
      let won  = prizes[prizes.length - 1];
      for (const p of prizes) {
        rand -= Number(p.weight);
        if (rand <= 0) { won = p; break; }
      }
      await updateDoc(doc(db, "users", uid), { coins: increment(-machine.cost) });
      await addDoc(collection(db, "gachaLogs"), {
        userId: uid, familyId,
        machineId: machine.id, machineName: machine.name,
        prizeName: won.name, rarity: won.rarity, emoji: won.emoji,
        cost: machine.cost, pulledAt: new Date(),
      });
      setGachaResult(won);
    } catch (e) {
      alert("ガチャに失敗しました: " + e.message);
    } finally {
      setPulling(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg,#fef3c7,#fce7f3,#ede9fe)",
      paddingBottom: 40,
      fontFamily: "'Nunito','Hiragino Maru Gothic Pro','BIZ UDPGothic',sans-serif",
    }}>
      {/* ヘッダー */}
      <div style={{
        background: "linear-gradient(135deg,#7c3aed,#4f46e5,#2563eb)",
        padding: "20px 20px 28px", borderRadius: "0 0 32px 32px",
        boxShadow: "0 8px 30px rgba(79,70,229,0.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ color: "white", margin: 0, fontSize: 24, fontWeight: 900 }}>
              がんばりボード
            </h1>
            <p style={{ color: "rgba(255,255,255,0.7)", margin: "4px 0 0", fontSize: 13 }}>
              {userData?.name} さん、きょうもがんばろう！
            </p>
            <p style={{
  color: "rgba(255,255,255,0.9)", margin: "6px 0 0",
  fontSize: 15, fontWeight: 800,
}}>
  {(() => {
    const now = new Date();
    const m   = now.getMonth() + 1;
    const d   = now.getDate();
    const dow = ["日","月","火","水","木","金","土"][now.getDay()];
    return `${m}月${d}日（${dow}）`;
  })()}
</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{
              background: "rgba(255,255,255,0.15)", borderRadius: 16,
              padding: "10px 16px", backdropFilter: "blur(8px)",
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#fde68a" }}>
                coin {coins}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>コイン</div>
            </div>
            <button onClick={() => auth.signOut()} style={{
              marginTop: 6, background: "rgba(255,255,255,0.15)", border: "none",
              color: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "4px 10px",
              fontSize: 11, cursor: "pointer",
            }}>ログアウト</button>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 700 }}>
              きょうのしんちょく
            </span>
            <span style={{ color: "#fde68a", fontSize: 13, fontWeight: 900 }}>
              {todayApproved} / {todayTaskIds.length}
            </span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 10, height: 12, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 10,
              background: "linear-gradient(90deg,#fde68a,#fb923c)",
              width: `${progress}%`,
              transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
            }} />
          </div>
          {progress === 100 && todayTaskIds.length > 0 && (
            <p style={{ color: "#fde68a", textAlign: "center", fontWeight: 900, fontSize: 14, marginTop: 8 }}>
              ぜんぶおわったよ！すごい！！
            </p>
          )}
        </div>
      </div>

      {/* タブ */}
      <div style={{
        display: "flex", margin: "16px 16px 0", background: "white",
        borderRadius: 16, padding: 4, boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}>
        {[
          ["tasks","タスク"],
          ["gacha","ガチャ"],
          ["prizes",   "景品"],
          ["transfer","送受信"],
          ["cash","現金"]
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: "10px 8px", borderRadius: 12, border: "none",
            background: tab === key
              ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "transparent",
            color: tab === key ? "white" : "#94a3b8",
            fontWeight: 800, fontSize: 15, cursor: "pointer",
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: "16px" }}>

        {/* タスク一覧 */}
        {tab === "tasks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {todayTasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
                <p style={{ fontWeight: 700, marginTop: 12 }}>
                  きょうのタスクはないよ！
                </p>
                <p style={{ fontSize: 13 }}>ゆっくりやすんでね</p>
              </div>
            ) : todayTasks.map(task => {
              const log       = getLog(task.id);
              const status    = log?.status || null;
              const colors    = CATEGORY_COLORS[task.category] || CATEGORY_COLORS["宿題"];
              const isSending = sending[task.id] || false;

              return (
                <div key={task.id} style={{
                  background: status === "approved" ? "#f8fafc" : "white",
                  border: `2px solid ${status === "approved" ? "#e2e8f0" : colors.border}`,
                  borderRadius: 20, padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: 12,
                  boxShadow: status === "approved" ? "none" : "0 4px 16px rgba(0,0,0,0.06)",
                  opacity: status === "approved" ? 0.65 : 1,
                  transition: "all 0.3s",
                }}>
                  <span style={{ fontSize: 32 }}>{task.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 800, fontSize: 15, color: "#1e293b",
                      textDecoration: status === "approved" ? "line-through" : "none",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{task.name}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                      <span style={{
                        background: colors.badge, color: "white",
                        fontSize: 11, fontWeight: 700, borderRadius: 8, padding: "2px 8px",
                      }}>{task.category}</span>
                      <Stars count={task.difficulty} />
                      {task.schedule?.type === "weekly" && (
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>
                          {(task.schedule.daysOfWeek || []).sort().map(d => DAY_NAMES[d]).join("・")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <span style={{
                      background: "linear-gradient(135deg,#fde68a,#f59e0b)",
                      color: "#92400e", fontWeight: 800, fontSize: 12,
                      borderRadius: 10, padding: "3px 8px",
                    }}>coin {task.coins}</span>
                    {status === "approved" && (
                      <span style={{
                        background: "#f0fdf4", color: "#22c55e",
                        fontSize: 12, fontWeight: 800, borderRadius: 10, padding: "4px 10px",
                      }}>しょうにん！</span>
                    )}
                    {status === "pending" && (
                      <span style={{
                        background: "#fef3c7", color: "#f59e0b",
                        fontSize: 12, fontWeight: 800, borderRadius: 10, padding: "4px 10px",
                      }}>しんさまち...</span>
                    )}
                    {status === "rejected" && (
                      <button onClick={() => handleRetry(log)} style={{
                        background: "linear-gradient(135deg,#ef4444,#dc2626)",
                        color: "white", border: "none", borderRadius: 12,
                        padding: "7px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer",
                      }}>もういちどやる</button>
                    )}
                    {!status && (
                      <button onClick={() => handleComplete(task)} disabled={isSending} style={{
                        background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                        color: "white", border: "none", borderRadius: 12,
                        padding: "7px 14px", fontSize: 13, fontWeight: 800,
                        cursor: isSending ? "not-allowed" : "pointer",
                        opacity: isSending ? 0.6 : 1,
                      }}>{isSending ? "送信中..." : "できた！"}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ガチャ画面 */}
        {tab === "gacha" && (
          <div>
            <div style={{
              background: "linear-gradient(135deg,#1e1b4b,#312e81)",
              borderRadius: 20, padding: "20px", marginBottom: 16, textAlign: "center",
              boxShadow: "0 8px 30px rgba(79,70,229,0.3)",
            }}>
              <div style={{ fontSize: 48 }}>🎰</div>
              <p style={{ color: "#a5b4fc", fontSize: 13, margin: "8px 0 0" }}>もってるコイン</p>
              <div style={{ color: "#fde68a", fontSize: 28, fontWeight: 900 }}>coin {coins}</div>
            </div>

            {machines.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
                <div style={{ fontSize: 48 }}>🎰</div>
                <p style={{ fontWeight: 700, marginTop: 12 }}>ガチャがまだないよ</p>
                <p style={{ fontSize: 13 }}>おうちのひとに登録してもらってね！</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[...machines].sort((a, b) => a.cost - b.cost).map(machine => {
                  const canAfford = coins >= machine.cost;
                  return (
                    <div key={machine.id} style={{
                      background: "white", borderRadius: 20, padding: "16px",
                      border: `2px solid ${canAfford ? "#c4b5fd" : "#e2e8f0"}`,
                      opacity: canAfford ? 1 : 0.6,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <div style={{
                          background: "linear-gradient(135deg,#1e1b4b,#312e81)",
                          borderRadius: 14, padding: "10px 14px", textAlign: "center",
                        }}>
                          <div style={{ fontSize: 28 }}>🎰</div>
                          <div style={{ color: "#fde68a", fontWeight: 900, fontSize: 12 }}>
                            coin {machine.cost}
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 900, fontSize: 16, color: "#1e293b" }}>
                            {machine.name}
                          </div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>
                            景品 {machine.prizes?.length ?? 0} 種類
                          </div>
                          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                            {(machine.prizes || []).map((p, i) => {
                              const rs = RARITY_STYLES[p.rarity] || RARITY_STYLES["ノーマル"];
                              return (
                                <span key={i} style={{
                                  background: rs.bg, color: rs.color,
                                  fontSize: 10, fontWeight: 700, borderRadius: 6,
                                  padding: "1px 6px", border: `1px solid ${rs.border}`,
                                }}>{p.emoji} {p.rarity}</span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => canAfford && !pulling && handleGacha(machine)}
                        disabled={!canAfford || pulling}
                        style={{
                          width: "100%", padding: "12px", borderRadius: 14, border: "none",
                          background: canAfford
                            ? "linear-gradient(135deg,#f59e0b,#ef4444)" : "#e2e8f0",
                          color: canAfford ? "white" : "#94a3b8",
                          fontWeight: 900, fontSize: 16,
                          cursor: canAfford && !pulling ? "pointer" : "not-allowed",
                        }}>
                        {!canAfford
                          ? `coin ${machine.cost - coins} 足りないよ`
                          : pulling ? "ひいてるよ..." : "ガチャをひく！"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

{/* 景品リスト */}
{tab === "prizes" && (
  <PrizeList userData={userData} />
)}

{/* コイン送受信 */}
{tab === "transfer" && (
  <CoinTransfer userData={userData} />
)}

{/* 現金管理 */}
{tab === "cash" && (
  <CashManager userData={userData} />
)}

      </div>

      {gachaResult && (
        <GachaModal prize={gachaResult} onClose={() => setGachaResult(null)} />
      )}
    </div>
  );
}