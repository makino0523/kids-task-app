import { useState, useEffect } from "react";
import {
  collection, addDoc, query, where,
  onSnapshot, doc, updateDoc, getDoc,
  increment, deleteDoc
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { shouldShowToday,formatDate, DAY_NAMES } from "../utils/scheduleFilter";
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

const RARITY_LIST = ["ノーマル","レア","スーパーレア","ウルトラレア","レジェンド"];
const EMOJIS = ["🎁","⭐","🍬","🍫","🎮","🏆","🎪","🎨","🎵","🏅","🌟","🎯","🎠","🎡","👑","🍦","🍕","🎈","🚀","🦄"];
const ICONS  = ["📚","✏️","📐","🎹","🏊","⚽","🎨","🧩","🍽️","🧹","🛁","🌍","🎵","🏃","🎯"];

function Stars({ count, max = 5 }) {
  return (
    <span style={{ fontSize: 14 }}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ color: i < count ? "#fbbf24" : "#e2e8f0" }}>★</span>
      ))}
    </span>
  );
}

function emptyPrize() {
  return { name: "", rarity: "ノーマル", emoji: "🎁", weight: 10 };
}

function scheduleLabel(schedule) {
  if (!schedule) return "毎日";
  if (schedule.type === "daily") return "毎日";
  if (schedule.type === "weekly") {
    const days = (schedule.daysOfWeek || []).sort().map(d => DAY_NAMES[d]).join("・");
    return `毎週 ${days}曜日`;
  }
  if (schedule.type === "once") return `${schedule.date} のみ`;
  return "毎日";
}

export default function ParentHome({ userData }) {
  const [tab, setTab]               = useState("approve");
  const [pendingLogs, setPendingLogs] = useState([]);
  const [tasks, setTasks]           = useState([]);
  const [children, setChildren]     = useState([]);
  const [approving, setApproving]   = useState({});
  const [machines, setMachines]     = useState([]);
  const [expandedMachine, setExpandedMachine] = useState(null);
  const [showMachineForm, setShowMachineForm] = useState(false);
  const [editTask, setEditTask]   = useState(null); // 編集中のタスク
  const [editForm, setEditForm]   = useState(null); // 編集フォームの値
  const [saving, setSaving]       = useState(false);
  const [templates, setTemplates]       = useState([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({
  name: "",
  tasks: [{ name: "", category: "宿題", difficulty: 2, icon: "📚" }],
  });
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(null);
  const [editTemplate, setEditTemplate] = useState(null); // 編集中のテンプレートID
  const [editTemplateForm, setEditTemplateForm] = useState(null); // 編集フォームの値
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [historyTab, setHistoryTab]   = useState("summary"); // summary | tasks | gacha
  const [viewMonth, setViewMonth]     = useState(() => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [taskLogs, setTaskLogs]       = useState([]);
  const [gachaLogs, setGachaLogs]     = useState([]);
  const [showTodayTaskForm, setShowTodayTaskForm] = useState(false);
  const [todayForm, setTodayForm] = useState({
  name: "", category: "宿題", difficulty: 2, icon: "📚",
  });
  const [addingTodayTask, setAddingTodayTask] = useState(false);
  const [editMachine, setEditMachine]     = useState(null); // 編集中の機械ID
  const [editMachineForm, setEditMachineForm] = useState(null); // 編集フォームの値
  const [savingMachine, setSavingMachine] = useState(false);

  // タスク追加フォーム
  const [form, setForm] = useState({
    name: "", category: "宿題", difficulty: 2, icon: "📚",
    schedule: { type: "daily", daysOfWeek: [], date: formatDate() },
  });

  // ガチャ機械追加フォーム
  const [machineForm, setMachineForm] = useState({
    name: "100コインガチャ", cost: 100, prizes: [emptyPrize()],
  });
  const [addingMachine, setAddingMachine] = useState(false);

  const uid      = auth.currentUser?.uid;
  const familyId = userData?.familyId;

  // 子供をリアルタイム監視
  useEffect(() => {
    if (!familyId) return;
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
  }, [familyId]);

  // 承認待ちログ
  useEffect(() => {
    if (!familyId) return;
    const q = query(
      collection(db, "taskLogs"),
      where("familyId", "==", familyId),
      where("status", "==", "pending")
    );
    return onSnapshot(q, async snap => {
      const logs = await Promise.all(snap.docs.map(async d => {
        const data = d.data();
        const [taskSnap, userSnap] = await Promise.all([
          getDoc(doc(db, "tasks",  data.taskId)),
          getDoc(doc(db, "users",  data.userId)),
        ]);
        return {
          id: d.id, ...data,
          task: taskSnap.exists() ? taskSnap.data() : {},
          user: userSnap.exists() ? userSnap.data() : {},
        };
      }));
      setPendingLogs(logs);
    }, err => console.error("ログ取得エラー:", err));
  }, [familyId]);

  // タスク一覧
  useEffect(() => {
    if (!familyId) return;
    return onSnapshot(
      query(collection(db, "tasks"), where("familyId", "==", familyId)),
      snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error("タスク取得エラー:", err)
    );
  }, [familyId]);

  // ガチャ機械一覧
  useEffect(() => {
    if (!familyId) return;
    return onSnapshot(
      query(collection(db, "gachaMachines"), where("familyId", "==", familyId)),
      snap => setMachines(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error("ガチャ機械取得エラー:", err)
    );
  }, [familyId]);

  // テンプレート一覧
useEffect(() => {
  if (!familyId) return;
  return onSnapshot(
    query(collection(db, "templates"), where("familyId", "==", familyId)),
    snap => setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => console.error("テンプレート取得エラー:", err)
  );
}, [familyId]);

// 月間タスクログを取得
useEffect(() => {
  if (!familyId) return;
  const start = new Date(viewMonth.year, viewMonth.month - 1, 1);
  const end   = new Date(viewMonth.year, viewMonth.month, 1);
  const q = query(
    collection(db, "taskLogs"),
    where("familyId", "==", familyId),
    where("completedAt", ">=", start),
    where("completedAt", "<",  end)
  );
  return onSnapshot(q, async snap => {
    const logs = await Promise.all(snap.docs.map(async d => {
      const data = d.data();
      const [taskSnap, userSnap] = await Promise.all([
        getDoc(doc(db, "tasks", data.taskId)),
        getDoc(doc(db, "users", data.userId)),
      ]);
      return {
        id: d.id, ...data,
        task: taskSnap.exists() ? taskSnap.data() : {},
        user: userSnap.exists() ? userSnap.data() : {},
      };
    }));
    // 日付の新しい順に並べる
    logs.sort((a, b) => b.completedAt?.toDate() - a.completedAt?.toDate());
    setTaskLogs(logs);
  }, err => console.error("タスクログ取得エラー:", err));
}, [familyId, viewMonth]);

// 月間ガチャログを取得
useEffect(() => {
  if (!familyId) return;
  const start = new Date(viewMonth.year, viewMonth.month - 1, 1);
  const end   = new Date(viewMonth.year, viewMonth.month, 1);
  const q = query(
    collection(db, "gachaLogs"),
    where("familyId", "==", familyId),
    where("pulledAt", ">=", start),
    where("pulledAt", "<",  end)
  );
  return onSnapshot(q, async snap => {
    const logs = await Promise.all(snap.docs.map(async d => {
      const data = d.data();
      const userSnap = await getDoc(doc(db, "users", data.userId));
      return {
        id: d.id, ...data,
        user: userSnap.exists() ? userSnap.data() : {},
      };
    }));
    logs.sort((a, b) => b.pulledAt?.toDate() - a.pulledAt?.toDate());
    setGachaLogs(logs);
  }, err => console.error("ガチャログ取得エラー:", err));
}, [familyId, viewMonth]);

  // 承認処理
  async function handleApprove(log) {
    if (approving[log.id]) return;
    setApproving(prev => ({ ...prev, [log.id]: true }));
    try {
      await updateDoc(doc(db, "users", log.userId), {
        coins: increment(log.task?.coins || 0),
      });
      await updateDoc(doc(db, "taskLogs", log.id), {
        status: "approved", approvedBy: uid, approvedAt: new Date(),
      });
    } catch (e) {
      alert("承認に失敗しました: " + e.message);
    } finally {
      setApproving(prev => ({ ...prev, [log.id]: false }));
    }
  }

  // 差し戻し
  async function handleReject(log) {
    try {
      await updateDoc(doc(db, "taskLogs", log.id), {
        status: "rejected", approvedBy: uid, approvedAt: new Date(),
      });
    } catch (e) {
      alert("差し戻しに失敗しました: " + e.message);
    }
  }

  // タスクを削除
async function handleDeleteTask(taskId) {
  if (!window.confirm("このタスクを削除しますか？")) return;
  try {
    await deleteDoc(doc(db, "tasks", taskId));
  } catch (e) {
    alert("削除に失敗しました: " + e.message);
  }
}

// タスクを更新
async function handleSaveTask() {
  if (!editForm.name.trim()) { alert("タスク名を入力してください"); return; }
  if (editForm.schedule.type === "weekly" && editForm.schedule.daysOfWeek.length === 0) {
    alert("曜日を1つ以上選択してください"); return;
  }
  setSaving(true);
  try {
    await updateDoc(doc(db, "tasks", editTask), {
      name:       editForm.name,
      category:   editForm.category,
      difficulty: editForm.difficulty,
      icon:       editForm.icon,
      coins:      editForm.difficulty * 10,
      schedule:   editForm.schedule,
    });
    setEditTask(null);
    setEditForm(null);
  } catch (e) {
    alert("更新に失敗しました: " + e.message);
  } finally {
    setSaving(false);
  }
}

  // ガチャ機械：景品追加・削除・更新
  function addPrizeRow() {
    setMachineForm(f => ({ ...f, prizes: [...f.prizes, emptyPrize()] }));
  }
  function removePrizeRow(idx) {
    setMachineForm(f => ({ ...f, prizes: f.prizes.filter((_, i) => i !== idx) }));
  }
  function updatePrize(idx, key, value) {
    setMachineForm(f => ({
      ...f,
      prizes: f.prizes.map((p, i) => i === idx ? { ...p, [key]: value } : p),
    }));
  }

  // ガチャ機械を登録
  async function handleAddMachine() {
    if (!machineForm.name.trim()) { alert("ガチャ名を入力してください"); return; }
    if (machineForm.prizes.some(p => !p.name.trim())) {
      alert("景品名が空のものがあります"); return;
    }
    if (machineForm.prizes.length === 0) {
      alert("景品を1つ以上追加してください"); return;
    }
    setAddingMachine(true);
    try {
      await addDoc(collection(db, "gachaMachines"), {
        name:      machineForm.name,
        cost:      Number(machineForm.cost),
        prizes:    machineForm.prizes.map(p => ({ ...p, weight: Number(p.weight) })),
        familyId,
        createdBy: uid,
        createdAt: new Date(),
      });
      setMachineForm({ name: "100コインガチャ", cost: 100, prizes: [emptyPrize()] });
      setShowMachineForm(false);
    } catch (e) {
      alert("追加に失敗しました: " + e.message);
    } finally {
      setAddingMachine(false);
    }
  }

  // ガチャ機械を削除
  async function handleDeleteMachine(machineId) {
    if (!window.confirm("このガチャを削除しますか？")) return;
    try {
      await deleteDoc(doc(db, "gachaMachines", machineId));
    } catch (e) {
      alert("削除に失敗しました: " + e.message);
    }
  }

  // ガチャ機械を更新
async function handleSaveMachine() {
  if (!editMachineForm.name.trim()) { alert("ガチャ名を入力してください"); return; }
  if (editMachineForm.prizes.some(p => !p.name.trim())) {
    alert("景品名が空のものがあります"); return;
  }
  if (editMachineForm.prizes.length === 0) {
    alert("景品を1つ以上追加してください"); return;
  }
  setSavingMachine(true);
  try {
    await updateDoc(doc(db, "gachaMachines", editMachine), {
      name:   editMachineForm.name,
      cost:   Number(editMachineForm.cost),
      prizes: editMachineForm.prizes.map(p => ({
        ...p, weight: Number(p.weight),
      })),
    });
    setEditMachine(null);
    setEditMachineForm(null);
  } catch (e) {
    alert("更新に失敗しました: " + e.message);
  } finally {
    setSavingMachine(false);
  }
}

  // 確率表示
  function calcPercent(prizes) {
    const total = prizes.reduce((s, p) => s + Number(p.weight), 0);
    return prizes.map(p => ({
      ...p,
      percent: total > 0 ? ((Number(p.weight) / total) * 100).toFixed(1) : 0,
    }));
  }

  // テンプレートのタスク行を追加
function addTemplateTaskRow() {
  setTemplateForm(f => ({
    ...f,
    tasks: [...f.tasks, { name: "", category: "宿題", difficulty: 2, icon: "📚" }],
  }));
}

// テンプレートのタスク行を削除
function removeTemplateTaskRow(idx) {
  setTemplateForm(f => ({
    ...f,
    tasks: f.tasks.filter((_, i) => i !== idx),
  }));
}

// テンプレートのタスク行を更新
function updateTemplateTask(idx, key, value) {
  setTemplateForm(f => ({
    ...f,
    tasks: f.tasks.map((t, i) => i === idx ? { ...t, [key]: value } : t),
  }));
}

// テンプレートを登録
async function handleAddTemplate() {
  if (!templateForm.name.trim()) { alert("テンプレート名を入力してください"); return; }
  if (templateForm.tasks.some(t => !t.name.trim())) {
    alert("タスク名が空のものがあります"); return;
  }
  setAddingTemplate(true);
  try {
    await addDoc(collection(db, "templates"), {
      name:      templateForm.name,
      tasks:     templateForm.tasks.map(t => ({
        ...t,
        coins: t.difficulty * 10,
      })),
      familyId,
      createdBy: uid,
      createdAt: new Date(),
    });
    setTemplateForm({
      name: "",
      tasks: [{ name: "", category: "宿題", difficulty: 2, icon: "📚" }],
    });
    setShowTemplateForm(false);
  } catch (e) {
    alert("追加に失敗しました: " + e.message);
  } finally {
    setAddingTemplate(false);
  }
}

// テンプレートを削除
async function handleDeleteTemplate(templateId) {
  if (!window.confirm("このテンプレートを削除しますか？")) return;
  try {
    await deleteDoc(doc(db, "templates", templateId));
  } catch (e) {
    alert("削除に失敗しました: " + e.message);
  }
}

// テンプレートを更新
async function handleSaveTemplate() {
  if (!editTemplateForm.name.trim()) { alert("テンプレート名を入力してください"); return; }
  if (editTemplateForm.tasks.some(t => !t.name.trim())) {
    alert("タスク名が空のものがあります"); return;
  }
  setSavingTemplate(true);
  try {
    await updateDoc(doc(db, "templates", editTemplate), {
      name:  editTemplateForm.name,
      tasks: editTemplateForm.tasks.map(t => ({
        ...t, coins: t.difficulty * 10,
      })),
    });
    setEditTemplate(null);
    setEditTemplateForm(null);
  } catch (e) {
    alert("更新に失敗しました: " + e.message);
  } finally {
    setSavingTemplate(false);
  }
}

// テンプレートを今日のタスクとして適用
async function handleApplyTemplate(template) {
  if (!window.confirm(
    `「${template.name}」を適用しますか？\n${template.tasks.length}件のタスクが追加されます。`
  )) return;
  setApplyingTemplate(template.id);
  try {
    // テンプレートの各タスクをtasksコレクションに追加
    await Promise.all(template.tasks.map(task =>
      addDoc(collection(db, "tasks"), {
        name:       task.name,
        category:   task.category,
        difficulty: task.difficulty,
        icon:       task.icon,
        coins:      task.difficulty * 10,
        schedule:   { type: "once", date: formatDate() }, // 今日だけ表示
        familyId,
        createdBy:  uid,
        createdAt:  new Date(),
        fromTemplate: template.id,
      })
    ));
    alert(`「${template.name}」を適用しました！\n子供のタスク一覧に追加されました。`);
  } catch (e) {
    alert("適用に失敗しました: " + e.message);
  } finally {
    setApplyingTemplate(null);
  }
}

// 今日のみのタスクをすばやく追加
async function handleAddTodayTask() {
  if (!todayForm.name.trim()) { alert("タスク名を入力してください"); return; }
  setAddingTodayTask(true);
  try {
    await addDoc(collection(db, "tasks"), {
      name:       todayForm.name,
      category:   todayForm.category,
      difficulty: todayForm.difficulty,
      icon:       todayForm.icon,
      coins:      todayForm.difficulty * 10,
      schedule:   { type: "once", date: formatDate() }, // 今日だけ
      familyId,
      createdBy:  uid,
      createdAt:  new Date(),
    });
    setTodayForm({ name: "", category: "宿題", difficulty: 2, icon: "📚" });
    setShowTodayTaskForm(false);
  } catch (e) {
    alert("追加に失敗しました: " + e.message);
  } finally {
    setAddingTodayTask(false);
  }
}

// 前月・翌月に移動
function prevMonth() {
  setViewMonth(v => {
    if (v.month === 1) return { year: v.year - 1, month: 12 };
    return { year: v.year, month: v.month - 1 };
  });
}
function nextMonth() {
  setViewMonth(v => {
    if (v.month === 12) return { year: v.year + 1, month: 1 };
    return { year: v.year, month: v.month + 1 };
  });
}

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg,#fef3c7,#fce7f3,#ede9fe)",
      paddingBottom: 80,
      fontFamily: "'Nunito','Hiragino Maru Gothic Pro','BIZ UDPGothic',sans-serif",
    }}>
      {/* ヘッダー */}
      <div style={{
        background: "linear-gradient(135deg,#7c3aed,#4f46e5,#2563eb)",
        padding: "20px 20px 24px", borderRadius: "0 0 28px 28px",
        boxShadow: "0 8px 30px rgba(79,70,229,0.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ color: "white", margin: 0, fontSize: 22, fontWeight: 900 }}>
              親の管理画面
            </h1>
            <p style={{ color: "rgba(255,255,255,0.7)", margin: "4px 0 0", fontSize: 13 }}>
              {userData?.name} さん
            </p>
          </div>
          <button onClick={() => auth.signOut()} style={{
            background: "rgba(255,255,255,0.2)", border: "none",
            color: "white", borderRadius: 12, padding: "8px 14px",
            fontSize: 13, fontWeight: 700,
          }}>ログアウト</button>
        </div>
        {children.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            {children.map(child => (
              <div key={child.id} style={{
                background: "rgba(255,255,255,0.15)", borderRadius: 14,
                padding: "8px 14px", backdropFilter: "blur(8px)",
              }}>
                <span style={{ color: "white", fontWeight: 800, fontSize: 13 }}>
                  {child.name}：
                  <span style={{
                    background: "linear-gradient(135deg,#fde68a,#f59e0b)",
                    color: "#92400e", fontWeight: 800, fontSize: 12,
                    borderRadius: 10, padding: "2px 8px", marginLeft: 4,
                  }}>coin {child.coins ?? 0}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* タブ */}
      <div style={{
        display: "flex", margin: "16px 16px 0", background: "white",
        borderRadius: 16, padding: 4, boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}>
        {[
          ["approve", `承認(${pendingLogs.length})`],
          ["gacha",   "ガチャ管理"],
          ["template","テンプレ"],
          ["tasks",   "本日のタスク一覧"],
          ["transfer", "送受信"],
          ["cash",     "現金"],
          ["prizes",   "景品"],
          ["history", "履歴"],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: "8px 2px", borderRadius: 12, border: "none",
            background: tab === key
              ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "transparent",
            color: tab === key ? "white" : "#94a3b8",
            fontWeight: 800, fontSize: 10, cursor: "pointer",
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: "16px" }}>

        {/* 承認待ち */}
        {tab === "approve" && (
          <div>
            {pendingLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
                <p style={{ fontWeight: 700, marginTop: 12 }}>承認待ちのタスクはありません</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendingLogs.map(log => {
                  const colors     = CATEGORY_COLORS[log.task?.category] || CATEGORY_COLORS["宿題"];
                  const isApproving = approving[log.id] || false;
                  return (
                    <div key={log.id} style={{
                      background: "white", borderRadius: 20, padding: "16px",
                      border: `2px solid ${colors.border}`,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <span style={{ fontSize: 32 }}>{log.task?.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b" }}>
                            {log.task?.name}
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                            <span style={{
                              background: colors.badge, color: "white",
                              fontSize: 11, fontWeight: 700, borderRadius: 8, padding: "2px 8px",
                            }}>{log.task?.category}</span>
                            <Stars count={log.task?.difficulty} />
                            <span style={{
                              background: "linear-gradient(135deg,#fde68a,#f59e0b)",
                              color: "#92400e", fontWeight: 800, fontSize: 12,
                              borderRadius: 10, padding: "2px 8px",
                            }}>coin {log.task?.coins}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                        {log.user?.name} が完了を報告しました
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleReject(log)} style={{
                          flex: 1, padding: "10px", borderRadius: 12,
                          border: "2px solid #fca5a5", background: "#fff1f2",
                          color: "#ef4444", fontWeight: 800, fontSize: 14,
                        }}>差し戻し</button>
                        <button onClick={() => handleApprove(log)} disabled={isApproving} style={{
                          flex: 2, padding: "10px", borderRadius: 12, border: "none",
                          background: isApproving
                            ? "#86efac" : "linear-gradient(135deg,#22c55e,#16a34a)",
                          color: "white", fontWeight: 800, fontSize: 14,
                          cursor: isApproving ? "not-allowed" : "pointer",
                          boxShadow: "0 3px 10px rgba(34,197,94,0.3)",
                        }}>
                          {isApproving ? "処理中..." : "承認してコイン付与"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ガチャ管理 */}
        {tab === "gacha" && (
          <div>
            {!showMachineForm && (
              <button onClick={() => setShowMachineForm(true)} style={{
                width: "100%", padding: "14px", borderRadius: 16,
                border: "2px dashed #c4b5fd", background: "white",
                color: "#7c3aed", fontWeight: 800, fontSize: 15,
                cursor: "pointer", marginBottom: 16,
              }}>
                + 新しいガチャを追加する
              </button>
            )}

            {showMachineForm && (
              <div style={{
                background: "white", borderRadius: 24, padding: "24px 20px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 16,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#1e293b" }}>
                    ガチャを追加する
                  </h2>
                  <button onClick={() => setShowMachineForm(false)} style={{
                    background: "#f1f5f9", border: "none", borderRadius: 8,
                    padding: "6px 12px", color: "#64748b", fontWeight: 700, cursor: "pointer",
                  }}>キャンセル</button>
                </div>

                <label style={S.label}>ガチャ名</label>
                <input style={S.input} value={machineForm.name}
                  onChange={e => setMachineForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例：100コインガチャ" />

                <label style={S.label}>必要コイン数</label>
                <input style={S.input} type="number" value={machineForm.cost} min={1}
                  onChange={e => setMachineForm(f => ({ ...f, cost: e.target.value }))}
                  placeholder="例：100" />

                <label style={{ ...S.label, marginTop: 20 }}>景品リスト</label>
                <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>
                  重みは比率です。合計が100でなくてもOKです。
                </p>

                {machineForm.prizes.map((prize, idx) => {
                  const rs = RARITY_STYLES[prize.rarity] || RARITY_STYLES["ノーマル"];
                  const total = machineForm.prizes.reduce((s, p) => s + Number(p.weight), 0);
                  const percent = total > 0
                    ? ((Number(prize.weight) / total) * 100).toFixed(1) : 0;
                  return (
                    <div key={idx} style={{
                      background: "#f8fafc", borderRadius: 16, padding: "14px",
                      marginBottom: 10, border: `2px solid ${rs.border}`,
                    }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                        <select value={prize.emoji}
                          onChange={e => updatePrize(idx, "emoji", e.target.value)}
                          style={{ fontSize: 22, border: "none", background: "transparent", cursor: "pointer" }}>
                          {EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
                        </select>
                        <input
                          style={{ ...S.input, flex: 1, padding: "8px 10px", fontSize: 14 }}
                          value={prize.name}
                          onChange={e => updatePrize(idx, "name", e.target.value)}
                          placeholder="景品名" />
                        {machineForm.prizes.length > 1 && (
                          <button onClick={() => removePrizeRow(idx)} style={{
                            background: "#fff1f2", border: "2px solid #fca5a5",
                            color: "#ef4444", borderRadius: 8,
                            padding: "6px 10px", fontWeight: 700, cursor: "pointer", fontSize: 13,
                          }}>削除</button>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select value={prize.rarity}
                          onChange={e => updatePrize(idx, "rarity", e.target.value)}
                          style={{
                            padding: "6px 10px", borderRadius: 10, fontSize: 12,
                            border: `2px solid ${rs.border}`, background: rs.bg,
                            color: rs.color, fontWeight: 700, cursor: "pointer",
                          }}>
                          {RARITY_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                          <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                            重み:
                          </span>
                          <input type="number" min={1} max={999}
                            style={{ ...S.input, width: 70, padding: "6px 8px", fontSize: 13 }}
                            value={prize.weight}
                            onChange={e => updatePrize(idx, "weight", e.target.value)} />
                          <span style={{
                            fontSize: 12, fontWeight: 800, color: "#7c3aed",
                            background: "#ede9fe", borderRadius: 8, padding: "4px 8px",
                            whiteSpace: "nowrap",
                          }}>約{percent}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <button onClick={addPrizeRow} style={{
                  width: "100%", padding: "10px", borderRadius: 12,
                  border: "2px dashed #c4b5fd", background: "white",
                  color: "#7c3aed", fontWeight: 700, fontSize: 14,
                  cursor: "pointer", marginBottom: 16,
                }}>+ 景品を追加</button>

                <button onClick={handleAddMachine}
                  style={{ ...S.btn, opacity: addingMachine ? 0.7 : 1 }}
                  disabled={addingMachine}>
                  {addingMachine ? "追加中..." : "ガチャを登録する"}
                </button>
              </div>
            )}

            <h3 style={{ fontWeight: 900, fontSize: 15, color: "#1e293b", marginBottom: 10 }}>
              登録済みのガチャ
            </h3>
            {machines.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
                <p style={{ fontWeight: 700 }}>ガチャがまだありません</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
{[...machines].sort((a, b) => a.cost - b.cost).map(machine => {
  const isExpanded  = expandedMachine === machine.id;
  const isEditing   = editMachine === machine.id;
  const prizesWithPct = calcPercent(machine.prizes || []);

  return (
    <div key={machine.id} style={{
      background: "white", borderRadius: 20,
      boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
      overflow: "hidden", border: "2px solid #e2e8f0",
    }}>
      {/* 通常表示 */}
      {!isEditing && (
        <>
          <div style={{
            display: "flex", alignItems: "center", padding: "14px 16px", gap: 12,
          }}>
            <div style={{
              background: "linear-gradient(135deg,#1e1b4b,#312e81)",
              borderRadius: 14, padding: "10px 14px", textAlign: "center",
            }}>
              <div style={{ fontSize: 22 }}>🎰</div>
              <div style={{ color: "#fde68a", fontWeight: 900, fontSize: 13 }}>
                coin {machine.cost}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: "#1e293b" }}>
                {machine.name}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                景品 {machine.prizes?.length ?? 0} 種類
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                onClick={() => setExpandedMachine(isExpanded ? null : machine.id)}
                style={{
                  background: "#f1f5f9", border: "none", borderRadius: 10,
                  padding: "6px 12px", color: "#64748b", fontWeight: 700,
                  fontSize: 12, cursor: "pointer",
                }}>{isExpanded ? "閉じる" : "詳細"}</button>
              <button onClick={() => {
                setEditMachine(machine.id);
                setEditMachineForm({
                  name:   machine.name,
                  cost:   machine.cost,
                  prizes: (machine.prizes || []).map(p => ({ ...p })),
                });
                setExpandedMachine(null);
              }} style={{
                background: "#ede9fe", border: "2px solid #c4b5fd",
                color: "#7c3aed", borderRadius: 10,
                padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>編集</button>
              <button onClick={() => handleDeleteMachine(machine.id)} style={{
                background: "#fff1f2", border: "2px solid #fca5a5",
                color: "#ef4444", borderRadius: 10,
                padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>削除</button>
            </div>
          </div>

          {/* 景品詳細（展開時） */}
          {isExpanded && (
            <div style={{ borderTop: "2px solid #f1f5f9", padding: "12px 16px" }}>
              <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>
                景品と当選確率（重みによる概算）
              </p>
              {prizesWithPct.map((p, i) => {
                const rs = RARITY_STYLES[p.rarity] || RARITY_STYLES["ノーマル"];
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 0",
                    borderBottom: i < prizesWithPct.length - 1
                      ? "1px solid #f1f5f9" : "none",
                  }}>
                    <span style={{ fontSize: 24 }}>{p.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</div>
                      <span style={{
                        background: rs.bg, color: rs.color, fontSize: 10,
                        fontWeight: 700, borderRadius: 6, padding: "1px 6px",
                        border: `1px solid ${rs.border}`,
                      }}>{p.rarity}</span>
                    </div>
                    <div style={{
                      background: "#ede9fe", color: "#7c3aed",
                      fontWeight: 800, fontSize: 13,
                      borderRadius: 10, padding: "4px 10px",
                    }}>約{p.percent}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 編集フォーム */}
      {isEditing && editMachineForm && (
        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontWeight: 900, fontSize: 15, color: "#1e293b" }}>
              ガチャを編集
            </span>
            <button onClick={() => { setEditMachine(null); setEditMachineForm(null); }} style={{
              background: "#f1f5f9", border: "none", borderRadius: 8,
              padding: "4px 10px", color: "#64748b", fontWeight: 700, cursor: "pointer",
            }}>キャンセル</button>
          </div>

          {/* ガチャ名 */}
          <label style={S.label}>ガチャ名</label>
          <input style={S.input} value={editMachineForm.name}
            onChange={e => setEditMachineForm(f => ({ ...f, name: e.target.value }))}
            placeholder="例：100コインガチャ" />

          {/* 必要コイン数 */}
          <label style={S.label}>必要コイン数</label>
          <input style={S.input} type="number" value={editMachineForm.cost} min={1}
            onChange={e => setEditMachineForm(f => ({ ...f, cost: e.target.value }))}
            placeholder="例：100" />

          {/* 景品リスト */}
          <label style={{ ...S.label, marginTop: 20 }}>景品リスト</label>
          <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>
            重みは比率です。合計が100でなくてもOKです。
          </p>

          {editMachineForm.prizes.map((prize, idx) => {
            const rs = RARITY_STYLES[prize.rarity] || RARITY_STYLES["ノーマル"];
            const total = editMachineForm.prizes.reduce((s, p) => s + Number(p.weight), 0);
            const percent = total > 0
              ? ((Number(prize.weight) / total) * 100).toFixed(1) : 0;
            return (
              <div key={idx} style={{
                background: "#f8fafc", borderRadius: 16, padding: "14px",
                marginBottom: 10, border: `2px solid ${rs.border}`,
              }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <select value={prize.emoji}
                    onChange={e => setEditMachineForm(f => ({
                      ...f,
                      prizes: f.prizes.map((p, i) =>
                        i === idx ? { ...p, emoji: e.target.value } : p),
                    }))}
                    style={{ fontSize: 22, border: "none", background: "transparent", cursor: "pointer" }}>
                    {EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
                  </select>
                  <input
                    style={{ ...S.input, flex: 1, padding: "8px 10px", fontSize: 14 }}
                    value={prize.name}
                    onChange={e => setEditMachineForm(f => ({
                      ...f,
                      prizes: f.prizes.map((p, i) =>
                        i === idx ? { ...p, name: e.target.value } : p),
                    }))}
                    placeholder="景品名" />
                  {editMachineForm.prizes.length > 1 && (
                    <button onClick={() => setEditMachineForm(f => ({
                      ...f, prizes: f.prizes.filter((_, i) => i !== idx),
                    }))} style={{
                      background: "#fff1f2", border: "2px solid #fca5a5",
                      color: "#ef4444", borderRadius: 8,
                      padding: "6px 10px", fontWeight: 700, cursor: "pointer", fontSize: 13,
                    }}>削除</button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select value={prize.rarity}
                    onChange={e => setEditMachineForm(f => ({
                      ...f,
                      prizes: f.prizes.map((p, i) =>
                        i === idx ? { ...p, rarity: e.target.value } : p),
                    }))}
                    style={{
                      padding: "6px 10px", borderRadius: 10, fontSize: 12,
                      border: `2px solid ${rs.border}`, background: rs.bg,
                      color: rs.color, fontWeight: 700, cursor: "pointer",
                    }}>
                    {RARITY_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                    <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                      重み:
                    </span>
                    <input type="number" min={1} max={999}
                      style={{ ...S.input, width: 70, padding: "6px 8px", fontSize: 13 }}
                      value={prize.weight}
                      onChange={e => setEditMachineForm(f => ({
                        ...f,
                        prizes: f.prizes.map((p, i) =>
                          i === idx ? { ...p, weight: e.target.value } : p),
                      }))} />
                    <span style={{
                      fontSize: 12, fontWeight: 800, color: "#7c3aed",
                      background: "#ede9fe", borderRadius: 8, padding: "4px 8px",
                      whiteSpace: "nowrap",
                    }}>約{percent}%</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 景品追加ボタン */}
          <button onClick={() => setEditMachineForm(f => ({
            ...f, prizes: [...f.prizes, emptyPrize()],
          }))} style={{
            width: "100%", padding: "10px", borderRadius: 12,
            border: "2px dashed #c4b5fd", background: "white",
            color: "#7c3aed", fontWeight: 700, fontSize: 14,
            cursor: "pointer", marginBottom: 16,
          }}>+ 景品を追加</button>

          {/* 保存ボタン */}
          <button onClick={handleSaveMachine}
            style={{ ...S.btn, opacity: savingMachine ? 0.7 : 1 }}
            disabled={savingMachine}>
            {savingMachine ? "保存中..." : "保存する"}
          </button>
        </div>
      )}
    </div>
  );
})}
              </div>
            )}
          </div>
        )}

{/* テンプレート管理 */}
{tab === "template" && (
  <div>
    {!showTemplateForm && (
      <button onClick={() => setShowTemplateForm(true)} style={{
        width: "100%", padding: "14px", borderRadius: 16,
        border: "2px dashed #c4b5fd", background: "white",
        color: "#7c3aed", fontWeight: 800, fontSize: 15,
        cursor: "pointer", marginBottom: 16,
      }}>
        + 新しいテンプレートを作成
      </button>
    )}

    {showTemplateForm && (
      <div style={{
        background: "white", borderRadius: 24, padding: "24px 20px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#1e293b" }}>
            テンプレートを作成
          </h2>
          <button onClick={() => setShowTemplateForm(false)} style={{
            background: "#f1f5f9", border: "none", borderRadius: 8,
            padding: "6px 12px", color: "#64748b", fontWeight: 700, cursor: "pointer",
          }}>キャンセル</button>
        </div>

        <label style={S.label}>テンプレート名</label>
        <input style={S.input} value={templateForm.name}
          onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))}
          placeholder="例：平日セット、週末セット" />

        <label style={{ ...S.label, marginTop: 20 }}>タスク一覧</label>
        {templateForm.tasks.map((task, idx) => (
          <div key={idx} style={{
            background: "#f8fafc", borderRadius: 14, padding: "12px",
            marginBottom: 10, border: "2px solid #e2e8f0",
          }}>
            {/* アイコン＋名前 */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <select value={task.icon}
                onChange={e => updateTemplateTask(idx, "icon", e.target.value)}
                style={{ fontSize: 20, border: "none", background: "transparent", cursor: "pointer" }}>
                {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
              <input
                style={{ ...S.input, flex: 1, padding: "8px 10px", fontSize: 14 }}
                value={task.name}
                onChange={e => updateTemplateTask(idx, "name", e.target.value)}
                placeholder="タスク名" />
              {templateForm.tasks.length > 1 && (
                <button onClick={() => removeTemplateTaskRow(idx)} style={{
                  background: "#fff1f2", border: "2px solid #fca5a5",
                  color: "#ef4444", borderRadius: 8,
                  padding: "6px 10px", fontWeight: 700, cursor: "pointer", fontSize: 13,
                }}>削除</button>
              )}
            </div>
            {/* カテゴリ */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {["宿題","習い事","お手伝い"].map(cat => (
                <button key={cat}
                  onClick={() => updateTemplateTask(idx, "category", cat)}
                  style={{
                    flex: 1, padding: "6px 4px", borderRadius: 10,
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                    border: `2px solid ${task.category === cat
                      ? CATEGORY_COLORS[cat].badge : "#e2e8f0"}`,
                    background: task.category === cat ? CATEGORY_COLORS[cat].bg : "white",
                    color: task.category === cat ? CATEGORY_COLORS[cat].badge : "#94a3b8",
                  }}>{cat}</button>
              ))}
            </div>
            {/* 難易度 */}
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                むずかしさ:
              </span>
              {[1,2,3,4,5].map(d => (
                <button key={d}
                  onClick={() => updateTemplateTask(idx, "difficulty", d)}
                  style={{
                    flex: 1, padding: "6px 4px", borderRadius: 8,
                    background: d <= task.difficulty ? "#fde68a" : "#f8fafc",
                    border: `2px solid ${d <= task.difficulty ? "#f59e0b" : "#e2e8f0"}`,
                    fontSize: 14, cursor: "pointer",
                  }}>★</button>
              ))}
              <span style={{
                fontSize: 11, color: "#f59e0b", fontWeight: 800,
                background: "#fef3c7", borderRadius: 8, padding: "3px 8px",
                whiteSpace: "nowrap",
              }}>coin {task.difficulty * 10}</span>
            </div>
          </div>
        ))}

        <button onClick={addTemplateTaskRow} style={{
          width: "100%", padding: "10px", borderRadius: 12,
          border: "2px dashed #c4b5fd", background: "white",
          color: "#7c3aed", fontWeight: 700, fontSize: 14,
          cursor: "pointer", marginBottom: 16,
        }}>+ タスクを追加</button>

        <button onClick={handleAddTemplate}
          style={{ ...S.btn, opacity: addingTemplate ? 0.7 : 1 }}
          disabled={addingTemplate}>
          {addingTemplate ? "作成中..." : "テンプレートを保存する"}
        </button>
      </div>
    )}

    {/* 登録済みテンプレート一覧 */}
    <h3 style={{ fontWeight: 900, fontSize: 15, color: "#1e293b", marginBottom: 10 }}>
      登録済みのテンプレート
    </h3>
    {templates.length === 0 ? (
      <div style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
        <p style={{ fontWeight: 700 }}>テンプレートがまだありません</p>
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
{templates.map(template => {
  const isApplying  = applyingTemplate === template.id;
  const isEditing   = editTemplate === template.id;

  return (
    <div key={template.id} style={{
      background: "white", borderRadius: 20, padding: "16px",
      border: "2px solid #e2e8f0",
      boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
    }}>
      {/* 通常表示 */}
      {!isEditing && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{
              background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
              borderRadius: 14, padding: "10px 14px", textAlign: "center",
            }}>
              <div style={{ fontSize: 24 }}>📋</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: "#1e293b" }}>
                {template.name}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                タスク {template.tasks?.length ?? 0} 件
              </div>
              <div style={{ marginTop: 6 }}>
                {(template.tasks || []).map((t, i) => (
                  <span key={i} style={{
                    display: "inline-block",
                    fontSize: 11, color: "#64748b",
                    background: "#f1f5f9", borderRadius: 6,
                    padding: "2px 7px", marginRight: 4, marginBottom: 4,
                  }}>
                    {t.icon} {t.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleDeleteTemplate(template.id)} style={{
              flex: 1, padding: "10px", borderRadius: 12,
              border: "2px solid #fca5a5", background: "#fff1f2",
              color: "#ef4444", fontWeight: 800, fontSize: 13, cursor: "pointer",
            }}>削除</button>
            <button onClick={() => {
              setEditTemplate(template.id);
              setEditTemplateForm({
                name:  template.name,
                tasks: template.tasks.map(t => ({ ...t })),
              });
            }} style={{
              flex: 1, padding: "10px", borderRadius: 12,
              border: "2px solid #c4b5fd", background: "#ede9fe",
              color: "#7c3aed", fontWeight: 800, fontSize: 13, cursor: "pointer",
            }}>編集</button>
            <button onClick={() => handleApplyTemplate(template)}
              disabled={isApplying}
              style={{
                flex: 2, padding: "10px", borderRadius: 12, border: "none",
                background: isApplying
                  ? "#a5b4fc" : "linear-gradient(135deg,#7c3aed,#4f46e5)",
                color: "white", fontWeight: 800, fontSize: 13,
                cursor: isApplying ? "not-allowed" : "pointer",
                boxShadow: "0 3px 10px rgba(124,58,237,0.3)",
              }}>
              {isApplying ? "適用中..." : "今日に適用"}
            </button>
          </div>
        </>
      )}

      {/* 編集フォーム */}
      {isEditing && editTemplateForm && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontWeight: 900, fontSize: 15, color: "#1e293b" }}>
              テンプレートを編集
            </span>
            <button onClick={() => { setEditTemplate(null); setEditTemplateForm(null); }} style={{
              background: "#f1f5f9", border: "none", borderRadius: 8,
              padding: "4px 10px", color: "#64748b", fontWeight: 700, cursor: "pointer",
            }}>キャンセル</button>
          </div>

          {/* テンプレート名 */}
          <label style={S.label}>テンプレート名</label>
          <input style={{ ...S.input, marginBottom: 16 }}
            value={editTemplateForm.name}
            onChange={e => setEditTemplateForm(f => ({ ...f, name: e.target.value }))} />

          {/* タスク一覧 */}
          <label style={S.label}>タスク一覧</label>
          {editTemplateForm.tasks.map((task, idx) => (
            <div key={idx} style={{
              background: "#f8fafc", borderRadius: 14, padding: "12px",
              marginBottom: 10, border: "2px solid #e2e8f0",
            }}>
              {/* アイコン＋名前 */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <select value={task.icon}
                  onChange={e => setEditTemplateForm(f => ({
                    ...f,
                    tasks: f.tasks.map((t, i) => i === idx ? { ...t, icon: e.target.value } : t),
                  }))}
                  style={{ fontSize: 20, border: "none", background: "transparent", cursor: "pointer" }}>
                  {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                </select>
                <input
                  style={{ ...S.input, flex: 1, padding: "8px 10px", fontSize: 14 }}
                  value={task.name}
                  onChange={e => setEditTemplateForm(f => ({
                    ...f,
                    tasks: f.tasks.map((t, i) => i === idx ? { ...t, name: e.target.value } : t),
                  }))}
                  placeholder="タスク名" />
                {editTemplateForm.tasks.length > 1 && (
                  <button onClick={() => setEditTemplateForm(f => ({
                    ...f, tasks: f.tasks.filter((_, i) => i !== idx),
                  }))} style={{
                    background: "#fff1f2", border: "2px solid #fca5a5",
                    color: "#ef4444", borderRadius: 8,
                    padding: "6px 10px", fontWeight: 700, cursor: "pointer", fontSize: 13,
                  }}>削除</button>
                )}
              </div>
              {/* カテゴリ */}
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {["宿題","習い事","お手伝い"].map(cat => (
                  <button key={cat}
                    onClick={() => setEditTemplateForm(f => ({
                      ...f,
                      tasks: f.tasks.map((t, i) => i === idx ? { ...t, category: cat } : t),
                    }))}
                    style={{
                      flex: 1, padding: "6px 4px", borderRadius: 10,
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                      border: `2px solid ${task.category === cat
                        ? CATEGORY_COLORS[cat].badge : "#e2e8f0"}`,
                      background: task.category === cat ? CATEGORY_COLORS[cat].bg : "white",
                      color: task.category === cat ? CATEGORY_COLORS[cat].badge : "#94a3b8",
                    }}>{cat}</button>
                ))}
              </div>
              {/* 難易度 */}
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                  むずかしさ:
                </span>
                {[1,2,3,4,5].map(d => (
                  <button key={d}
                    onClick={() => setEditTemplateForm(f => ({
                      ...f,
                      tasks: f.tasks.map((t, i) => i === idx ? { ...t, difficulty: d } : t),
                    }))}
                    style={{
                      flex: 1, padding: "6px 4px", borderRadius: 8,
                      background: d <= task.difficulty ? "#fde68a" : "#f8fafc",
                      border: `2px solid ${d <= task.difficulty ? "#f59e0b" : "#e2e8f0"}`,
                      fontSize: 14, cursor: "pointer",
                    }}>★</button>
                ))}
                <span style={{
                  fontSize: 11, color: "#f59e0b", fontWeight: 800,
                  background: "#fef3c7", borderRadius: 8, padding: "3px 8px",
                  whiteSpace: "nowrap",
                }}>coin {task.difficulty * 10}</span>
              </div>
            </div>
          ))}

          {/* タスク追加ボタン */}
          <button onClick={() => setEditTemplateForm(f => ({
            ...f,
            tasks: [...f.tasks, { name: "", category: "宿題", difficulty: 2, icon: "📚" }],
          }))} style={{
            width: "100%", padding: "10px", borderRadius: 12,
            border: "2px dashed #c4b5fd", background: "white",
            color: "#7c3aed", fontWeight: 700, fontSize: 14,
            cursor: "pointer", marginBottom: 16,
          }}>+ タスクを追加</button>

          {/* 保存ボタン */}
          <button onClick={handleSaveTemplate}
            style={{ ...S.btn, opacity: savingTemplate ? 0.7 : 1 }}
            disabled={savingTemplate}>
            {savingTemplate ? "保存中..." : "保存する"}
          </button>
        </div>
      )}
    </div>
  );
})}
      </div>
    )}
  </div>
)}

{/* 今日のタスク管理 */}
{tab === "tasks" && (
  <div>
    {/* 今日の日付表示 */}
    <div style={{
      background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
      borderRadius: 16, padding: "12px 16px", marginBottom: 16,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <span style={{ color: "white", fontWeight: 900, fontSize: 16 }}>
        {(() => {
          const now = new Date();
          const m   = now.getMonth() + 1;
          const d   = now.getDate();
          const dow = ["日","月","火","水","木","金","土"][now.getDay()];
          return `${m}月${d}日（${dow}）のタスク`;
        })()}
      </span>
      <span style={{
        background: "rgba(255,255,255,0.2)", color: "white",
        borderRadius: 10, padding: "4px 10px", fontSize: 13, fontWeight: 700,
      }}>
        {tasks.filter(t => shouldShowToday(t)).length}件
      </span>
    </div>

    {/* タスク追加ボタン（今日のみのタスクをすばやく追加） */}
    {!showTodayTaskForm ? (
      <button onClick={() => setShowTodayTaskForm(true)} style={{
        width: "100%", padding: "14px", borderRadius: 16,
        border: "2px dashed #c4b5fd", background: "white",
        color: "#7c3aed", fontWeight: 800, fontSize: 15,
        cursor: "pointer", marginBottom: 16,
      }}>
        + 今日のタスクをすぐ追加
      </button>
    ) : (
      <div style={{
        background: "white", borderRadius: 20, padding: "20px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)", marginBottom: 16,
        border: "2px solid #c4b5fd",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontWeight: 900, fontSize: 15, color: "#1e293b" }}>
            今日のタスクを追加
          </span>
          <button onClick={() => {
            setShowTodayTaskForm(false);
            setTodayForm({ name: "", category: "宿題", difficulty: 2, icon: "📚" });
          }} style={{
            background: "#f1f5f9", border: "none", borderRadius: 8,
            padding: "4px 10px", color: "#64748b", fontWeight: 700, cursor: "pointer",
          }}>キャンセル</button>
        </div>

        {/* アイコン */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
          {ICONS.map(ic => (
            <button key={ic} onClick={() => setTodayForm(f => ({ ...f, icon: ic }))} style={{
              fontSize: 20, background: todayForm.icon === ic ? "#ede9fe" : "#f8fafc",
              border: `2px solid ${todayForm.icon === ic ? "#7c3aed" : "#e2e8f0"}`,
              borderRadius: 8, width: 38, height: 38, cursor: "pointer",
            }}>{ic}</button>
          ))}
        </div>

        {/* 名前 */}
        <input style={{ ...S.input, marginBottom: 10 }}
          value={todayForm.name}
          onChange={e => setTodayForm(f => ({ ...f, name: e.target.value }))}
          placeholder="タスク名を入力" />

        {/* カテゴリ */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {["宿題","習い事","お手伝い"].map(cat => (
            <button key={cat} onClick={() => setTodayForm(f => ({ ...f, category: cat }))} style={{
              flex: 1, padding: "8px 4px", borderRadius: 10,
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              border: `2px solid ${todayForm.category === cat
                ? CATEGORY_COLORS[cat].badge : "#e2e8f0"}`,
              background: todayForm.category === cat ? CATEGORY_COLORS[cat].bg : "#f8fafc",
              color: todayForm.category === cat ? CATEGORY_COLORS[cat].badge : "#94a3b8",
            }}>{cat}</button>
          ))}
        </div>

        {/* 難易度 */}
        <div style={{ display: "flex", gap: 5, marginBottom: 16 }}>
          {[1,2,3,4,5].map(d => (
            <button key={d} onClick={() => setTodayForm(f => ({ ...f, difficulty: d }))} style={{
              flex: 1, padding: "8px 4px", borderRadius: 10,
              background: d <= todayForm.difficulty ? "#fde68a" : "#f8fafc",
              border: `2px solid ${d <= todayForm.difficulty ? "#f59e0b" : "#e2e8f0"}`,
              fontSize: 16, cursor: "pointer",
            }}>★</button>
          ))}
        </div>

        <button onClick={handleAddTodayTask}
          disabled={addingTodayTask}
          style={{ ...S.btn, opacity: addingTodayTask ? 0.7 : 1 }}>
          {addingTodayTask ? "追加中..." : "今日のタスクに追加"}
        </button>
      </div>
    )}

    {/* 今日のタスク一覧 */}
    {tasks.filter(t => shouldShowToday(t)).length === 0 ? (
      <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
        <div style={{ fontSize: 48 }}>📋</div>
        <p style={{ fontWeight: 700, marginTop: 12 }}>今日のタスクはありません</p>
        <p style={{ fontSize: 13 }}>上のボタンから追加できます</p>
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tasks.filter(t => shouldShowToday(t)).map(task => {
          const colors    = CATEGORY_COLORS[task.category] || CATEGORY_COLORS["宿題"];
          const isEditing = editTask === task.id;

          return (
            <div key={task.id} style={{
              background: "white", borderRadius: 18, padding: "14px 16px",
              border: `2px solid ${colors.border}`,
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            }}>
              {/* 通常表示 */}
              {!isEditing && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 30 }}>{task.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b" }}>
                      {task.name}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                      <span style={{
                        background: colors.badge, color: "white",
                        fontSize: 11, fontWeight: 700, borderRadius: 8, padding: "2px 8px",
                      }}>{task.category}</span>
                      <Stars count={task.difficulty} />
                      <span style={{
                        background: "linear-gradient(135deg,#fde68a,#f59e0b)",
                        color: "#92400e", fontWeight: 800, fontSize: 11,
                        borderRadius: 8, padding: "2px 7px",
                      }}>coin {task.coins}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button onClick={() => {
                      setEditTask(task.id);
                      setEditForm({
                        name:       task.name,
                        category:   task.category,
                        difficulty: task.difficulty,
                        icon:       task.icon,
                        schedule:   task.schedule || { type: "daily", daysOfWeek: [], date: formatDate() },
                      });
                    }} style={{
                      background: "#ede9fe", border: "2px solid #c4b5fd",
                      color: "#7c3aed", borderRadius: 10,
                      padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}>編集</button>
                    <button onClick={() => handleDeleteTask(task.id)} style={{
                      background: "#fff1f2", border: "2px solid #fca5a5",
                      color: "#ef4444", borderRadius: 10,
                      padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}>削除</button>
                  </div>
                </div>
              )}

              {/* 編集フォーム */}
              {isEditing && editForm && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontWeight: 900, fontSize: 15, color: "#1e293b" }}>
                      タスクを編集
                    </span>
                    <button onClick={() => { setEditTask(null); setEditForm(null); }} style={{
                      background: "#f1f5f9", border: "none", borderRadius: 8,
                      padding: "4px 10px", color: "#64748b", fontWeight: 700, cursor: "pointer",
                    }}>キャンセル</button>
                  </div>

                  {/* アイコン */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                    {ICONS.map(ic => (
                      <button key={ic} onClick={() => setEditForm(f => ({ ...f, icon: ic }))} style={{
                        fontSize: 20, background: editForm.icon === ic ? "#ede9fe" : "#f8fafc",
                        border: `2px solid ${editForm.icon === ic ? "#7c3aed" : "#e2e8f0"}`,
                        borderRadius: 8, width: 38, height: 38, cursor: "pointer",
                      }}>{ic}</button>
                    ))}
                  </div>

                  {/* 名前 */}
                  <input style={{ ...S.input, marginBottom: 10 }}
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />

                  {/* カテゴリ */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    {["宿題","習い事","お手伝い"].map(cat => (
                      <button key={cat} onClick={() => setEditForm(f => ({ ...f, category: cat }))} style={{
                        flex: 1, padding: "8px 4px", borderRadius: 10,
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        border: `2px solid ${editForm.category === cat
                          ? CATEGORY_COLORS[cat].badge : "#e2e8f0"}`,
                        background: editForm.category === cat ? CATEGORY_COLORS[cat].bg : "#f8fafc",
                        color: editForm.category === cat ? CATEGORY_COLORS[cat].badge : "#94a3b8",
                      }}>{cat}</button>
                    ))}
                  </div>

                  {/* 難易度 */}
                  <div style={{ display: "flex", gap: 5, marginBottom: 16 }}>
                    {[1,2,3,4,5].map(d => (
                      <button key={d} onClick={() => setEditForm(f => ({ ...f, difficulty: d }))} style={{
                        flex: 1, padding: "8px 4px", borderRadius: 10,
                        background: d <= editForm.difficulty ? "#fde68a" : "#f8fafc",
                        border: `2px solid ${d <= editForm.difficulty ? "#f59e0b" : "#e2e8f0"}`,
                        fontSize: 16, cursor: "pointer",
                      }}>★</button>
                    ))}
                  </div>

                  <button onClick={handleSaveTask}
                    style={{ ...S.btn, opacity: saving ? 0.7 : 1 }}
                    disabled={saving}>
                    {saving ? "保存中..." : "保存する"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}
  </div>
)}

{/* コイン送受信 */}
{tab === "transfer" && (
  <CoinTransfer userData={userData} />
)}

{/* 現金管理 */}
{tab === "cash" && (
  <CashManager userData={userData} />
)}

{/* 景品リスト */}
{tab === "prizes" && (
  <PrizeList userData={userData} />
)}

{/* 履歴・月間サマリー */}
{tab === "history" && (
  <div>
    {/* 月選択 */}
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "white", borderRadius: 16, padding: "12px 16px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.06)", marginBottom: 16,
    }}>
      <button onClick={prevMonth} style={{
        background: "#f1f5f9", border: "none", borderRadius: 10,
        padding: "8px 16px", fontWeight: 800, fontSize: 16, cursor: "pointer",
      }}>←</button>
      <span style={{ fontWeight: 900, fontSize: 18, color: "#1e293b" }}>
        {viewMonth.year}年{viewMonth.month}月
      </span>
      <button onClick={nextMonth} style={{
        background: "#f1f5f9", border: "none", borderRadius: 10,
        padding: "8px 16px", fontWeight: 800, fontSize: 16, cursor: "pointer",
      }}>→</button>
    </div>

    {/* サマリーカード */}
    {(() => {
      const approvedLogs  = taskLogs.filter(l => l.status === "approved");
      const totalCoins    = approvedLogs.reduce((s, l) => s + (l.task?.coins || 0), 0);
      const gachaCount    = gachaLogs.length;
      const gachaCoins    = gachaLogs.reduce((s, l) => s + (l.cost || 0), 0);

      // 子供ごとの集計
      const childStats = {};
      approvedLogs.forEach(l => {
        const id   = l.userId;
        const name = l.user?.name || "不明";
        if (!childStats[id]) childStats[id] = { name, tasks: 0, coins: 0 };
        childStats[id].tasks += 1;
        childStats[id].coins += l.task?.coins || 0;
      });

      return (
        <div style={{ marginBottom: 16 }}>
          {/* 全体サマリー */}
          <div style={{
            background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
            borderRadius: 20, padding: "20px", marginBottom: 12,
            boxShadow: "0 4px 20px rgba(124,58,237,0.3)",
          }}>
            <h3 style={{ color: "white", margin: "0 0 16px", fontSize: 16, fontWeight: 900 }}>
              {viewMonth.month}月の合計
            </h3>
            <div style={{ display: "flex", gap: 10 }}>
              {[
                ["承認タスク", `${approvedLogs.length}件`, "#fde68a"],
                ["獲得コイン", `coin ${totalCoins}`, "#86efac"],
                ["ガチャ回数", `${gachaCount}回`, "#f9a8d4"],
              ].map(([label, value, color]) => (
                <div key={label} style={{
                  flex: 1, background: "rgba(255,255,255,0.15)",
                  borderRadius: 14, padding: "12px 8px", textAlign: "center",
                }}>
                  <div style={{ color, fontWeight: 900, fontSize: 18 }}>{value}</div>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 4 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 子供ごとの集計 */}
          {Object.values(childStats).map(stat => (
            <div key={stat.name} style={{
              background: "white", borderRadius: 16, padding: "14px 16px",
              marginBottom: 10, border: "2px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                background: "linear-gradient(135deg,#fde68a,#f59e0b)",
                borderRadius: 12, padding: "10px", fontSize: 24,
              }}>👦</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: "#1e293b" }}>
                  {stat.name}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  タスク完了: {stat.tasks}件
                </div>
              </div>
              <div style={{
                background: "linear-gradient(135deg,#fde68a,#f59e0b)",
                color: "#92400e", fontWeight: 900, fontSize: 14,
                borderRadius: 12, padding: "6px 12px",
              }}>coin {stat.coins}</div>
            </div>
          ))}
        </div>
      );
    })()}

    {/* 詳細タブ */}
    <div style={{
      display: "flex", background: "white", borderRadius: 14,
      padding: 4, marginBottom: 14,
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    }}>
      {[["tasks","タスク履歴"],["gacha","ガチャ履歴"]].map(([key, label]) => (
        <button key={key} onClick={() => setHistoryTab(key)} style={{
          flex: 1, padding: "8px", borderRadius: 10, border: "none",
          background: historyTab === key
            ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "transparent",
          color: historyTab === key ? "white" : "#94a3b8",
          fontWeight: 800, fontSize: 13, cursor: "pointer",
        }}>{label}</button>
      ))}
    </div>

    {/* タスク履歴 */}
    {historyTab === "tasks" && (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {taskLogs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
            <p style={{ fontWeight: 700 }}>この月のタスク履歴はありません</p>
          </div>
        ) : taskLogs.map(log => {
          const colors = CATEGORY_COLORS[log.task?.category] || CATEGORY_COLORS["宿題"];
          const date   = log.completedAt?.toDate
            ? log.completedAt.toDate() : new Date();
          const dateStr = `${date.getMonth()+1}/${date.getDate()}`;
          const statusStyle = {
            approved: { bg: "#f0fdf4", color: "#22c55e", text: "承認" },
            pending:  { bg: "#fef3c7", color: "#f59e0b", text: "審査中" },
            rejected: { bg: "#fff1f2", color: "#ef4444", text: "差し戻し" },
          }[log.status] || { bg: "#f1f5f9", color: "#94a3b8", text: log.status };

          return (
            <div key={log.id} style={{
              background: "white", borderRadius: 14, padding: "12px 14px",
              border: `2px solid ${colors.border}33`,
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 24 }}>{log.task?.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 800, fontSize: 14, color: "#1e293b",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{log.task?.name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  {log.user?.name} · {dateStr}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span style={{
                  background: "linear-gradient(135deg,#fde68a,#f59e0b)",
                  color: "#92400e", fontWeight: 800, fontSize: 11,
                  borderRadius: 8, padding: "2px 7px",
                }}>coin {log.task?.coins}</span>
                <span style={{
                  background: statusStyle.bg, color: statusStyle.color,
                  fontSize: 11, fontWeight: 700, borderRadius: 8, padding: "2px 7px",
                }}>{statusStyle.text}</span>
              </div>
            </div>
          );
        })}
      </div>
    )}

    {/* ガチャ履歴 */}
    {historyTab === "gacha" && (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {gachaLogs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
            <p style={{ fontWeight: 700 }}>この月のガチャ履歴はありません</p>
          </div>
        ) : gachaLogs.map(log => {
          const rs      = RARITY_STYLES[log.rarity] || RARITY_STYLES["ノーマル"];
          const date    = log.pulledAt?.toDate
            ? log.pulledAt.toDate() : new Date();
          const dateStr = `${date.getMonth()+1}/${date.getDate()}`;

          return (
            <div key={log.id} style={{
              background: "white", borderRadius: 14, padding: "12px 14px",
              border: `2px solid ${rs.border}`,
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 28 }}>{log.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>
                  {log.prizeName}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  {log.user?.name} · {dateStr} · {log.machineName}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span style={{
                  background: rs.bg, color: rs.color,
                  fontSize: 11, fontWeight: 700, borderRadius: 8,
                  padding: "2px 7px", border: `1px solid ${rs.border}`,
                }}>{log.rarity}</span>
                <span style={{
                  background: "linear-gradient(135deg,#fde68a,#f59e0b)",
                  color: "#92400e", fontWeight: 800, fontSize: 11,
                  borderRadius: 8, padding: "2px 7px",
                }}>coin {log.cost}</span>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
)}
      </div>
    </div>
  );
}

const S = {
  label: { display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 8, marginTop: 16 },
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