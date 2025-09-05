// app/lib/importComments.ts
import { MOCK_PROPERTIES } from '../data/properties';
import { commentsKey, setAverageRatingFromComments, type Comment } from './comments';
import { getJSON, setJSON } from './storage';

// 原始檔可接受的欄位（會做寬鬆對應）
export type RawComment = {
  // 使用者/作者
  user?: string; reviewer?: string; author?: string; name?: string;
  // 文字
  text?: string; content?: string; comment?: string; review?: string; body?: string;
  // 評分
  rating?: number | string; score?: number | string; stars?: number | string;
  // 時間
  createdAt?: number | string; date?: string; review_date?: string; time?: string;
  // 直接指定對應物件（可選）
  propertyId?: string; pid?: string;
};

// ---------- 工具：名稱比對 / 檔名解析 ----------
const sanitize = (s: string) => (s || '')
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[^\p{Letter}\p{Number}]/gu, ''); // 移除符號

export function inferPidFromFilename(filename: string): string | null {
  const m = filename?.match(/p(\d+)/i);
  return m ? `p${m[1]}` : null;
}

export function matchPidByName(nameFromFile: string): string | null {
  const key = sanitize(nameFromFile);
  const hit = MOCK_PROPERTIES.find(p => sanitize(p.name) === key);
  return hit ? hit.id : null;
}

// ---------- 解析/正規化 ----------
function normUser(x: RawComment): string {
  return (x.user ?? x.reviewer ?? x.author ?? x.name ?? '訪客').toString().trim() || '訪客';
}

function normText(x: RawComment): string {
  return (x.text ?? x.content ?? x.comment ?? x.review ?? x.body ?? '').toString().trim();
}

function normRating(x: RawComment): number {
  const raw = x.rating ?? x.score ?? x.stars ?? 0;
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (!isFinite(num)) return 3;
  // 你的 UI 以整數星星顯示，這裡四捨五入到整數 1~5
  return Math.min(5, Math.max(1, Math.round(num)));
}

function normCreatedAt(x: RawComment): number {
  const raw = x.createdAt ?? x.date ?? x.review_date ?? x.time;
  if (raw == null) return Date.now();
  if (typeof raw === 'number') return raw;
  const t = Date.parse(raw);
  return isNaN(t) ? Date.now() : t;
}

function toComment(x: RawComment): Comment {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    user: normUser(x),
    text: normText(x),
    rating: normRating(x),
    createdAt: normCreatedAt(x),
  };
}

// 去重：用 user|text|rating 當 key
function dedupe(list: Comment[]): Comment[] {
  const seen = new Set<string>();
  const out: Comment[] = [];
  for (const c of list) {
    const key = `${c.user}|${c.text}|${c.rating}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

// ---------- 匯入主流程（JSON 陣列） ----------
export async function importCommentsFromJSON(
  pid: string,
  items: RawComment[],
  opts: { merge?: boolean } = { merge: true }
): Promise<number> {
  if (!pid) throw new Error('未指定物件 pid');

  const mapped = items
    .map(toComment)
    .filter(c => c.text.length > 0); // 只收有內容者

  const key = commentsKey(pid);
  const prev = await getJSON<Comment[]>(key, []);
  const next = opts.merge ? dedupe([...mapped, ...prev]) : dedupe([...mapped]);

  await setJSON(key, next);
  await setAverageRatingFromComments(pid, next);
  return next.length - prev.length; // 估算新增數
}

// ---------- 匯入主流程（CSV 文字） ----------
export async function importCommentsFromCSV(
  pid: string,
  csv: string,
  opts: { merge?: boolean } = { merge: true }
): Promise<number> {
  // 動態 require，避免沒裝也能編譯
  // 需要：npm i papaparse
  // @ts-ignore
  const Papa = require('papaparse');
  const res = Papa.parse(csv.trim(), { header: true, skipEmptyLines: true });
  const rows: RawComment[] = res.data;
  return importCommentsFromJSON(pid, rows, opts);
}

// ---------- 從檔名或資料猜 pid ----------
export function resolvePidForFile(
  filename: string,
  firstRow?: RawComment
): string | null {
  // 1) 檔名帶 pX
  const byFile = inferPidFromFilename(filename);
  if (byFile) return byFile;

  // 2) row 自帶 propertyId/pid
  const byRow = firstRow?.propertyId ?? firstRow?.pid;
  if (typeof byRow === 'string' && byRow.trim()) return byRow.trim();

  // 3) 檔名就是物件名稱
  const base = filename.replace(/\.[^.]+$/, ''); // 去副檔名
  const byName = matchPidByName(base);
  if (byName) return byName;

  return null;
}
