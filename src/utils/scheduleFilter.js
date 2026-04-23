/**
 * 指定タスクが「今日表示すべきか」を判定する
 * @param {object} task - Firestoreのタスクドキュメント
 * @param {Date} today  - 判定する日付（省略時は今日）
 * @returns {boolean}
 */
export function shouldShowToday(task, today = new Date()) {
  const schedule = task.schedule;

  // scheduleが未設定のタスクは常に表示（後方互換）
  if (!schedule) return true;

  const type = schedule.type;

  // 毎日
  if (type === "daily") return true;

  // 週次（曜日指定）
  if (type === "weekly") {
    const todayDow = today.getDay(); // 0=日曜, 1=月曜, ...6=土曜
    return (schedule.daysOfWeek || []).includes(todayDow);
  }

  // 一回のみ（日付指定）
  if (type === "once") {
    const todayStr = formatDate(today);
    return schedule.date === todayStr;
  }

  return true;
}

/**
 * Date を "YYYY-MM-DD" 形式の文字列に変換
 */
export function formatDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 曜日の表示名
 */
export const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];