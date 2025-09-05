// app/lib/comments.ts
import { getJSON, setJSON } from './storage';

export type Comment = {
  id: string;
  user: string;
  rating: number;      // 1~5
  text: string;
  createdAt: number;   // epoch ms
  authorId?: string;   // 舊資料沒有也OK
};

// 統一 Key：評論清單 & 平均評分快取
export const commentsKey = (pid: string) => `comments:${pid}`;
export const avgKey = (pid: string) => `avgRating:${pid}`;

// 從快取取得平均分數；如果沒有快取，就從評論計算一次
export async function getAverageRating(pid: string): Promise<number | null> {
  const cached = await getJSON<number | null>(avgKey(pid), null);
  if (typeof cached === 'number' && !Number.isNaN(cached)) return cached;

  const list = await getJSON<Comment[]>(commentsKey(pid), []);
  if (!list.length) return null;

  const total = list.reduce((s, c) => s + c.rating, 0);
  const avg = Math.round((total / list.length) * 10) / 10;
  // 把計算結果寫回快取，加速下次讀取
  await setJSON(avgKey(pid), avg);
  return avg;
}

// 在你送出/更新評論後呼叫它：幫你把平均分數寫入快取
export async function setAverageRatingFromComments(pid: string, list: Comment[]) {
  if (!list.length) {
    await setJSON(avgKey(pid), null);
    return;
  }
  const total = list.reduce((s, c) => s + c.rating, 0);
  const avg = Math.round((total / list.length) * 10) / 10;
  await setJSON(avgKey(pid), avg);
}

/* ========== 匯入 Google 風格 JSON（轉成 App 內部 Comment） ========== */

type GoogleReview = {
  reviewer?: string;
  content?: string;
  rating?: number | string;
  review_time?: string; // 例如「3 個月前」（可能沒有）
  review_date?: string; // 例如 "2024-08-01"（可能沒有）
};

// 把「X 個月/天/年 前」這種相對時間粗略轉成時間戳；失敗就用現在
function parseRelativeTime(s?: string): number {
  const now = Date.now();
  if (!s) return now;
  const m = s.match(/(\d+)\s*(秒|分鐘|小時|天|週|月|年)/);
  if (!m) return now;
  const n = parseInt(m[1], 10);
  const unit = m[2] as '秒' | '分鐘' | '小時' | '天' | '週' | '月' | '年';
  const ms: Record<typeof unit, number> = {
    秒: 1_000, 分鐘: 60_000, 小時: 3_600_000,
    天: 86_400_000, 週: 604_800_000, 月: 2_592_000_000, 年: 31_536_000_000,
  };
  return now - (ms[unit] ?? 0) * n;
}

/** 將 Google 風格 JSON 匯入到指定物件 pid 的留言中（會去重）。
 *  - `pid`: 例如 'p2'
 *  - `raw`: 你的 JSON 陣列
 *  - `opts.dedupeByText`: 預設 true，用「(user|text)」去重
 */
export async function importGoogleJson(
  pid: string,
  raw: GoogleReview[],
  opts?: { dedupeByText?: boolean }
): Promise<{ added: number; total: number }> {
  const key = commentsKey(pid);
  const existing = await getJSON<Comment[]>(key, []);
  const seen = new Set(existing.map(c => `${(c.user || '').trim()}|${c.text.trim()}`));

  const out = [...existing];
  let added = 0;

  raw.forEach((r, idx) => {
    const user = (r.reviewer || '匿名').trim();
    const text = (r.content || '').trim();
    if (!text) return;

    const dedupe = opts?.dedupeByText ?? true;
    const combo = `${user}|${text}`;
    if (dedupe && seen.has(combo)) return;

    const ratingNum = Math.max(1, Math.min(5, Number(r.rating) || 0));
    const c: Comment = {
      id: `g:${pid}:${Date.now()}:${idx}`,
      user,
      rating: ratingNum,
      text,
      createdAt: parseRelativeTime(r.review_time),
    };
    out.unshift(c); // 新資料放前面
    seen.add(combo);
    added++;
  });

  await setJSON(key, out);
  // 更新平均分數快取
  await setAverageRatingFromComments(pid, out);
  return { added, total: out.length };
}

/** 方便取平均（undefined 代表沒有留言） */
export async function getAverageRatingFor(pid: string): Promise<number | undefined> {
  const n = await getAverageRating(pid);
  return n ?? undefined;
}
