import { useState, useEffect, useRef } from "react";

// ========== DATA ==========
const INITIAL_TASKS = [
  { id: 1, name: "さんすうのドリル", category: "宿題", difficulty: 3, coins: 30, icon: "📐", done: false },
  { id: 2, name: "こくごのよみかき", category: "宿題", difficulty: 2, coins: 20, icon: "✏️", done: false },
  { id: 3, name: "ピアノのれんしゅう", category: "習い事", difficulty: 4, coins: 40, icon: "🎹", done: false },
  { id: 4, name: "おふろそうじ", category: "お手伝い", difficulty: 2, coins: 20, icon: "🛁", done: false },
  { id: 5, name: "しょっきあらい", category: "お手伝い", difficulty: 1, coins: 10, icon: "🍽️", done: false },
  { id: 6, name: "じぶんのへやのかたづけ", category: "お手伝い", difficulty: 2, coins: 20, icon: "🧹", done: false },
  { id: 7, name: "えいごのプリント", category: "宿題", difficulty: 3, coins: 30, icon: "🌍", done: false },
  { id: 8, name: "スイミングスクール", category: "習い事", difficulty: 3, coins: 30, icon: "🏊", done: false },
];

const GACHA_PRIZES = [
  { id: 1, name: "シール1まい", rarity: "ノーマル", color: "#94a3b8", emoji: "⭐", cost: 30 },
  { id: 2, name: "おやつ（小）", rarity: "ノーマル", color: "#94a3b8", emoji: "🍬", cost: 30 },
  { id: 3, name: "シール3まい", rarity: "レア", color: "#60a5fa", emoji: "💫", cost: 60 },
  { id: 4, name: "おやつ（大）", rarity: "レア", color: "#60a5fa", emoji: "🍫", cost: 60 },
  { id: 5, name: "すきなごはんリクエスト", rarity: "スーパーレア", color: "#c084fc", emoji: "🍱", cost: 100 },
  { id: 6, name: "30ぷんゲームOK", rarity: "スーパーレア", color: "#c084fc", emoji: "🎮", cost: 100 },
  { id: 7, name: "おでかけリクエスト", rarity: "ウルトラレア", color: "#fb923c", emoji: "🎡", cost: 200 },
  { id: 8, name: "なんでもいっこ", rarity: "レジェンド", color: "#f59e0b", emoji: "👑", cost: 300 },
];

const CATEGORY_COLORS = {
  "宿題": { bg: "#eff6ff", border: "#3b82f6", badge: "#3b82f6" },
  "習い事": { bg: "#f0fdf4", border: "#22c55e", badge: "#22c55e" },
  "お手伝い": { bg: "#fff7ed", border: "#f97316", badge: "#f97316" },
};

const STAR_COLORS = ["#fbbf24", "#fbbf24", "#fbbf24", "#fbbf24", "#fbbf24"];

function Stars({ count, max = 5 }) {
  return (
    <span style={{ fontSize: 14, letterSpacing: 1 }}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ color: i < count ? "#fbbf24" : "#e2e8f0" }}>★</span>
      ))}
    </span>
  );
}

function CoinBadge({ amount, size = "md" }) {
  const s = size === "sm" ? { fontSize: 13, px: 8, py: 3 } : { fontSize: 16, px: 12, py: 5 };
  return (
    <span style={{
      background: "linear-gradient(135deg, #fde68a, #f59e0b)",
      color: "#92400e",
      fontWeight: 800,
      borderRadius: 20,
      padding: `${s.py}px ${s.px}px`,
      fontSize: s.fontSize,
      boxShadow: "0 2px 6px rgba(245,158,11,0.4)",
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
    }}>
      🪙 {amount}
    </span>
  );
}

// ========== GACHA MODAL ==========
function GachaModal({ coins, onClose, onEarn }) {
  const [phase, setPhase] = useState("select"); // select | spinning | result
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [particles, setParticles] = useState([]);
  const spinRef = useRef(null);

  const affordable = GACHA_PRIZES.filter(p => p.cost <= coins);

  function pullGacha(prize) {
    if (coins < prize.cost) return;
    setSelected(prize);
    setPhase("spinning");
    setSpinning(true);
    setTimeout(() => {
      setSpinning(false);
      setResult(prize);
      setPhase("result");
      onEarn(-prize.cost);
      // particles
      setParticles(Array.from({ length: 18 }, (_, i) => ({
        id: i,
        x: Math.random() * 320 - 160,
        y: Math.random() * -200 - 50,
        r: Math.random() * 360,
        color: ["#fbbf24","#f472b6","#60a5fa","#4ade80","#fb923c"][i % 5],
        size: 8 + Math.random() * 10,
      })));
    }, 1800);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,10,40,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(6px)",
    }}>
      <div style={{
        background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)",
        borderRadius: 28, padding: "32px 28px", width: 360, maxWidth: "95vw",
        boxShadow: "0 0 60px rgba(139,92,246,0.5), 0 0 0 1px rgba(255,255,255,0.1)",
        position: "relative", overflow: "hidden",
        fontFamily: "'Nunito', 'Rounded Mplus 1c', sans-serif",
      }}>
        {/* Stars bg */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {Array.from({length:20}).map((_,i)=>(
            <div key={i} style={{
              position:"absolute", width:2, height:2, borderRadius:"50%",
              background:"white", opacity: 0.3 + Math.random()*0.5,
              left: `${Math.random()*100}%`, top: `${Math.random()*100}%`,
            }}/>
          ))}
        </div>

        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 14,
          background: "rgba(255,255,255,0.15)", border: "none",
          color: "white", borderRadius: "50%", width: 32, height: 32,
          fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>✕</button>

        <h2 style={{ color: "#fde68a", textAlign: "center", fontSize: 26, fontWeight: 900, marginBottom: 4, marginTop: 0 }}>
          ✨ ガチャ ✨
        </h2>
        <p style={{ color: "#a5b4fc", textAlign: "center", fontSize: 13, marginBottom: 20 }}>
          もってるコイン: <strong style={{color:"#fde68a"}}>🪙 {coins}</strong>
        </p>

        {phase === "select" && (
          <div>
            <p style={{ color: "#c7d2fe", fontSize: 12, textAlign: "center", marginBottom: 14 }}>
              ひきたいガチャをえらんでね！
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {GACHA_PRIZES.map(prize => {
                const canAfford = coins >= prize.cost;
                return (
                  <button key={prize.id} onClick={() => canAfford && pullGacha(prize)}
                    style={{
                      background: canAfford
                        ? `linear-gradient(135deg, ${prize.color}33, ${prize.color}11)`
                        : "rgba(255,255,255,0.04)",
                      border: `2px solid ${canAfford ? prize.color : "rgba(255,255,255,0.1)"}`,
                      borderRadius: 14, padding: "10px 14px",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      cursor: canAfford ? "pointer" : "not-allowed",
                      opacity: canAfford ? 1 : 0.45,
                      transition: "transform 0.15s",
                      color: "white",
                    }}
                    onMouseEnter={e => canAfford && (e.currentTarget.style.transform = "scale(1.02)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    <span style={{ fontSize: 22 }}>{prize.emoji}</span>
                    <div style={{ flex: 1, textAlign: "left", marginLeft: 12 }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{prize.name}</div>
                      <div style={{ fontSize: 11, color: prize.color, fontWeight: 700 }}>{prize.rarity}</div>
                    </div>
                    <CoinBadge amount={prize.cost} size="sm" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {phase === "spinning" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{
              fontSize: 72,
              animation: "spin 0.3s linear infinite",
              display: "inline-block",
            }}>🎰</div>
            <style>{`@keyframes spin { from{transform:rotateY(0)} to{transform:rotateY(360deg)} }`}</style>
            <p style={{ color: "#a5b4fc", marginTop: 20, fontSize: 16, fontWeight: 700 }}>
              ドキドキ…！
            </p>
          </div>
        )}

        {phase === "result" && result && (
          <div style={{ textAlign: "center", padding: "20px 0", position: "relative" }}>
            {particles.map(p => (
              <div key={p.id} style={{
                position: "absolute", left: "50%", top: "50%",
                width: p.size, height: p.size, borderRadius: 3,
                background: p.color, pointerEvents: "none",
                animation: `fly-${p.id} 1s ease-out forwards`,
                transform: `translate(${p.x}px, ${p.y}px) rotate(${p.r}deg)`,
              }}/>
            ))}
            <div style={{ fontSize: 80, marginBottom: 12, animation: "pop 0.4s cubic-bezier(.36,.07,.19,.97)" }}>
              {result.emoji}
            </div>
            <style>{`@keyframes pop { 0%{transform:scale(0)} 60%{transform:scale(1.2)} 100%{transform:scale(1)} }`}</style>
            <div style={{
              background: `linear-gradient(135deg, ${result.color}44, ${result.color}22)`,
              border: `2px solid ${result.color}`,
              borderRadius: 16, padding: "16px 20px", marginBottom: 16,
            }}>
              <div style={{ color: result.color, fontWeight: 900, fontSize: 13, marginBottom: 4 }}>
                {result.rarity} ✨
              </div>
              <div style={{ color: "white", fontWeight: 900, fontSize: 22 }}>{result.name}</div>
            </div>
            <p style={{ color: "#a5b4fc", fontSize: 13, marginBottom: 20 }}>
              おうちのひとにみせてね！🎉
            </p>
            <button onClick={onClose} style={{
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              color: "white", border: "none", borderRadius: 14,
              padding: "12px 32px", fontSize: 16, fontWeight: 800,
              cursor: "pointer", width: "100%",
              boxShadow: "0 4px 15px rgba(124,58,237,0.4)",
            }}>
              やったー！🎊
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ========== ADD TASK MODAL ==========
function AddTaskModal({ onAdd, onClose }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("宿題");
  const [difficulty, setDifficulty] = useState(2);
  const [icon, setIcon] = useState("📚");

  const icons = ["📚","✏️","📐","🎹","🏊","⚽","🎨","🧩","🍽️","🧹","🛁","🌍","🎵","🏃","🎯"];
  const coins = difficulty * 10;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: "white", borderRadius: 24, padding: "28px 24px",
        width: 340, maxWidth: "95vw",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        fontFamily: "'Nunito', sans-serif",
      }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 900, color: "#1e293b" }}>
          ➕ タスクをついか
        </h3>

        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
          アイコン
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {icons.map(ic => (
            <button key={ic} onClick={() => setIcon(ic)} style={{
              fontSize: 22, background: icon === ic ? "#ede9fe" : "#f8fafc",
              border: `2px solid ${icon === ic ? "#7c3aed" : "#e2e8f0"}`,
              borderRadius: 10, width: 40, height: 40, cursor: "pointer",
            }}>{ic}</button>
          ))}
        </div>

        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
          タスクのなまえ
        </label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="たとえば: かんじのれんしゅう"
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 12,
            border: "2px solid #e2e8f0", fontSize: 15, fontFamily: "inherit",
            outline: "none", marginBottom: 16, boxSizing: "border-box",
          }}
        />

        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
          しゅるい
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["宿題","習い事","お手伝い"].map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} style={{
              flex: 1, padding: "8px 4px", borderRadius: 12, fontSize: 13, fontWeight: 700,
              border: `2px solid ${category === cat ? CATEGORY_COLORS[cat].badge : "#e2e8f0"}`,
              background: category === cat ? CATEGORY_COLORS[cat].bg : "#f8fafc",
              color: category === cat ? CATEGORY_COLORS[cat].badge : "#94a3b8",
              cursor: "pointer",
            }}>{cat}</button>
          ))}
        </div>

        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
          むずかしさ (★{difficulty} → 🪙{coins})
        </label>
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {[1,2,3,4,5].map(d => (
            <button key={d} onClick={() => setDifficulty(d)} style={{
              flex: 1, padding: "8px 4px", borderRadius: 12,
              background: d <= difficulty ? "#fde68a" : "#f8fafc",
              border: `2px solid ${d <= difficulty ? "#f59e0b" : "#e2e8f0"}`,
              fontSize: 18, cursor: "pointer",
            }}>★</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px", borderRadius: 14, border: "2px solid #e2e8f0",
            background: "white", color: "#64748b", fontWeight: 700, fontSize: 15, cursor: "pointer",
          }}>キャンセル</button>
          <button onClick={() => {
            if (!name.trim()) return;
            onAdd({ name, category, difficulty, coins, icon });
            onClose();
          }} style={{
            flex: 2, padding: "12px", borderRadius: 14, border: "none",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            color: "white", fontWeight: 800, fontSize: 15, cursor: "pointer",
          }}>ついか！</button>
        </div>
      </div>
    </div>
  );
}

// ========== MAIN APP ==========
export default function KidsTaskApp() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [coins, setCoins] = useState(50);
  const [totalEarned, setTotalEarned] = useState(0);
  const [showGacha, setShowGacha] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [filter, setFilter] = useState("すべて");
  const [completedAnim, setCompletedAnim] = useState(null);
  const [tab, setTab] = useState("tasks"); // tasks | shop

  const categories = ["すべて", "宿題", "習い事", "お手伝い"];
  const filteredTasks = filter === "すべて" ? tasks : tasks.filter(t => t.category === filter);
  const doneTasks = tasks.filter(t => t.done).length;
  const progress = tasks.length > 0 ? (doneTasks / tasks.length) * 100 : 0;

  function completeTask(id) {
    setTasks(prev => prev.map(t => {
      if (t.id === id && !t.done) {
        setCoins(c => c + t.coins);
        setTotalEarned(e => e + t.coins);
        setCompletedAnim(id);
        setTimeout(() => setCompletedAnim(null), 800);
        return { ...t, done: true };
      }
      return t;
    }));
  }

  function resetTasks() {
    setTasks(prev => prev.map(t => ({ ...t, done: false })));
  }

  function addTask(task) {
    setTasks(prev => [...prev, { ...task, id: Date.now(), done: false }]);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #fef3c7 0%, #fce7f3 40%, #ede9fe 100%)",
      fontFamily: "'Nunito', 'Hiragino Maru Gothic Pro', 'BIZ UDPGothic', sans-serif",
      padding: "0 0 80px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        input { font-family: inherit; }
        @keyframes bounce-in { 0%{transform:scale(0.8);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        @keyframes slide-up { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes coin-fly { 0%{transform:translateY(0) scale(1);opacity:1} 100%{transform:translateY(-60px) scale(1.5);opacity:0} }
        @keyframes shimmer { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #7c3aed, #4f46e5, #2563eb)",
        padding: "20px 20px 28px",
        borderRadius: "0 0 32px 32px",
        boxShadow: "0 8px 30px rgba(79,70,229,0.3)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120,
          background: "rgba(255,255,255,0.05)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: -30, left: 40, width: 80, height: 80,
          background: "rgba(255,255,255,0.05)", borderRadius: "50%" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ color: "white", margin: 0, fontSize: 26, fontWeight: 900, lineHeight: 1.2 }}>
              🌟 がんばりボード
            </h1>
            <p style={{ color: "rgba(255,255,255,0.7)", margin: "4px 0 0", fontSize: 13 }}>
              きょうもいっしょにがんばろう！
            </p>
          </div>
          <div style={{
            background: "rgba(255,255,255,0.15)",
            borderRadius: 18, padding: "10px 16px",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.2)",
            textAlign: "center",
            animation: "float 3s ease-in-out infinite",
          }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#fde68a" }}>🪙 {coins}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>もっているコイン</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 700 }}>
              きょうのしんちょく
            </span>
            <span style={{ color: "#fde68a", fontSize: 13, fontWeight: 900 }}>
              {doneTasks} / {tasks.length}
            </span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 10, height: 12, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 10,
              background: "linear-gradient(90deg, #fde68a, #fb923c)",
              width: `${progress}%`,
              transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
              boxShadow: "0 0 10px rgba(251,146,60,0.6)",
            }} />
          </div>
          {progress === 100 && (
            <p style={{ color: "#fde68a", textAlign: "center", fontWeight: 900, fontSize: 14, marginTop: 8 }}>
              🎉 ぜんぶおわったよ！すごい！！
            </p>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: "flex", margin: "16px 16px 0", background: "white",
        borderRadius: 16, padding: 4, boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}>
        {[["tasks","📋 タスク"], ["shop","🎰 ガチャ"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: "10px 8px", borderRadius: 12, border: "none",
            background: tab === key ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "transparent",
            color: tab === key ? "white" : "#94a3b8",
            fontWeight: 800, fontSize: 15, cursor: "pointer",
            transition: "all 0.2s",
          }}>{label}</button>
        ))}
      </div>

      {/* TASKS TAB */}
      {tab === "tasks" && (
        <div style={{ padding: "16px 16px 0" }}>
          {/* Category Filter */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilter(cat)} style={{
                padding: "6px 14px", borderRadius: 20, border: "none",
                background: filter === cat
                  ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
                  : "white",
                color: filter === cat ? "white" : "#64748b",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: filter === cat ? "0 3px 10px rgba(124,58,237,0.3)" : "0 1px 4px rgba(0,0,0,0.08)",
              }}>{cat}</button>
            ))}
          </div>

          {/* Task List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredTasks.map((task, idx) => {
              const colors = CATEGORY_COLORS[task.category];
              const isAnim = completedAnim === task.id;
              return (
                <div key={task.id} style={{
                  background: task.done ? "#f8fafc" : "white",
                  border: `2px solid ${task.done ? "#e2e8f0" : colors.border}`,
                  borderRadius: 20, padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: 12,
                  boxShadow: task.done ? "none" : "0 4px 16px rgba(0,0,0,0.06)",
                  opacity: task.done ? 0.6 : 1,
                  transition: "all 0.3s",
                  animation: `slide-up 0.3s ease both`,
                  animationDelay: `${idx * 0.05}s`,
                  position: "relative", overflow: "hidden",
                }}>
                  {isAnim && (
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(135deg, #fde68a44, #fb923c44)",
                      animation: "bounce-in 0.8s ease",
                      borderRadius: 18,
                    }} />
                  )}
                  <span style={{ fontSize: 32 }}>{task.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 800, fontSize: 15, color: task.done ? "#94a3b8" : "#1e293b",
                      textDecoration: task.done ? "line-through" : "none",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{task.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <span style={{
                        background: colors.badge, color: "white",
                        fontSize: 11, fontWeight: 700, borderRadius: 8,
                        padding: "2px 8px",
                      }}>{task.category}</span>
                      <Stars count={task.difficulty} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <CoinBadge amount={task.coins} size="sm" />
                    {task.done ? (
                      <span style={{ fontSize: 24 }}>✅</span>
                    ) : (
                      <button onClick={() => completeTask(task.id)} style={{
                        background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                        color: "white", border: "none", borderRadius: 12,
                        padding: "6px 14px", fontSize: 13, fontWeight: 800,
                        cursor: "pointer", boxShadow: "0 3px 10px rgba(124,58,237,0.3)",
                        transition: "transform 0.15s",
                      }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                      >
                        できた！
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowAddTask(true)} style={{
              flex: 1, padding: "14px", borderRadius: 16,
              background: "white", border: "2px dashed #c4b5fd",
              color: "#7c3aed", fontWeight: 800, fontSize: 15, cursor: "pointer",
            }}>
              ➕ タスクをついか
            </button>
            <button onClick={resetTasks} style={{
              padding: "14px 20px", borderRadius: 16,
              background: "white", border: "2px solid #e2e8f0",
              color: "#94a3b8", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>
              🔄 リセット
            </button>
          </div>
        </div>
      )}

      {/* GACHA TAB */}
      {tab === "shop" && (
        <div style={{ padding: "16px" }}>
          <div style={{
            background: "linear-gradient(135deg, #1e1b4b, #312e81)",
            borderRadius: 24, padding: "24px 20px",
            boxShadow: "0 8px 30px rgba(79,70,229,0.3)",
            marginBottom: 16, textAlign: "center",
          }}>
            <div style={{ fontSize: 64, animation: "float 3s ease-in-out infinite" }}>🎰</div>
            <h2 style={{ color: "#fde68a", fontWeight: 900, fontSize: 22, margin: "12px 0 8px" }}>
              ガチャにちょうせん！
            </h2>
            <p style={{ color: "#a5b4fc", fontSize: 13, margin: "0 0 16px" }}>
              コインをつかってガチャをひこう！<br/>
              もってるコイン: <strong style={{color:"#fde68a"}}>🪙 {coins}</strong>
            </p>
            <button onClick={() => setShowGacha(true)} style={{
              background: "linear-gradient(135deg, #f59e0b, #ef4444)",
              color: "white", border: "none", borderRadius: 16,
              padding: "14px 40px", fontSize: 18, fontWeight: 900,
              cursor: "pointer", boxShadow: "0 6px 20px rgba(239,68,68,0.4)",
              animation: "shimmer 2s ease-in-out infinite",
            }}>
              🎰 ガチャをひく！
            </button>
          </div>

          {/* Prize List */}
          <h3 style={{ fontWeight: 900, fontSize: 16, color: "#1e293b", marginBottom: 12 }}>
            🎁 もらえるしょうひん
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {GACHA_PRIZES.map(prize => (
              <div key={prize.id} style={{
                background: "white", borderRadius: 16, padding: "14px 12px",
                border: `2px solid ${prize.color}44`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 36, marginBottom: 6 }}>{prize.emoji}</div>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b", marginBottom: 4 }}>
                  {prize.name}
                </div>
                <div style={{ color: prize.color, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                  {prize.rarity}
                </div>
                <CoinBadge amount={prize.cost} size="sm" />
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{
            background: "white", borderRadius: 20, padding: "16px 20px",
            marginTop: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 900, color: "#1e293b" }}>
              📊 きろく
            </h3>
            <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#7c3aed" }}>{doneTasks}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>かんりょうしたタスク</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#f59e0b" }}>🪙 {totalEarned}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>かせいだコイン</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#22c55e" }}>🪙 {coins}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>のこりコイン</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showGacha && (
        <GachaModal
          coins={coins}
          onClose={() => setShowGacha(false)}
          onEarn={delta => setCoins(c => c + delta)}
        />
      )}
      {showAddTask && (
        <AddTaskModal
          onAdd={addTask}
          onClose={() => setShowAddTask(false)}
        />
      )}
    </div>
  );
}
