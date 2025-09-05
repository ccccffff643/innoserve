// app/lib/importComments.ts
// 零相依版：支援 JSON 與 CSV 匯入評論，不需要 papaparse

import {
    Comment,
    commentsKey,
    setAverageRatingFromComments,
} from './comments';
import { getJSON, setJSON } from './storage';

type RawComment = {
  // 你可能的欄位（Google/Dcard/自備 CSV）
  user?: string;
  reviewer?: string;
  author?: string;

  text?: string;
  content?: string;
  comment?: string;

  rating?: number | string; // 1~5

  createdAt?: number | string; // epoch 或日期字串
  date?: string;
  review_date?: string;
  review_time?: string; // 例如「3 個月前」
};

// ====== 匯入入口（JSON 陣列）==================================================
export async function importCommentsFromJSON(
  pid: string,
  rows: RawComment[],
  opts?: { dedupe?: boolean; merge?: boolean }
): Promise<number> {
  const key = commentsKey(pid);
  const existing = await getJSON<Comment[]>(key, []);

  const dedupe = opts?.dedupe ?? true;
  const seen = new Set(
    existing.map((c) => `${(c.user || '').trim()}|${c.text.trim()}`)
  );

  let added = 0;
  const out = [...existing];

  rows.forEach((r, i) => {
    const norm = normalize(r, pid, i);
    if (!norm.text) return;

    if (dedupe) {
      const sig = `${norm.user}|${norm.text}`;
      if (seen.has(sig)) return;
      seen.add(sig);
    }

    out.unshift(norm); // 新資料放前面
    added++;
  });

  await setJSON(key, out);
  await setAverageRatingFromComments(pid, out);
  return added;
}

// ====== 匯入入口（CSV 純文字）==================================================
// 注意：此簡易 CSV 解析器支援引號、逗點與跳脫 ""，一般情境足夠。
export async function importCommentsFromCSV(
  pid: string,
  csv: string,
  opts?: { dedupe?: boolean; merge?: boolean }
): Promise<number> {
  const rows = parseCSV(csv.trim());
  return importCommentsFromJSON(pid, rows as RawComment[], opts);
}

// ====== 工具：正規化 RawComment -> Comment ====================================
function normalize(r: RawComment, pid: string, idx: number): Comment {
  const user =
    (r.user ?? r.reviewer ?? r.author ?? '匿名').toString().trim() || '匿名';
  const text = (r.text ?? r.content ?? r.comment ?? '').toString().trim();

  // rating 轉數字並夾在 1~5
  let rating = Number(r.rating ?? 0);
  if (!Number.isFinite(rating)) rating = 0;
  rating = Math.max(1, Math.min(5, rating || 0));

  const createdAt = resolveCreatedAt(r);

  return {
    id: `imp:${pid}:${createdAt}:${idx}`,
    user,
    rating,
    text,
    createdAt,
  };
}

function resolveCreatedAt(r: RawComment): number {
  // 1) 優先 epoch number
  const n = Number(r.createdAt);
  if (Number.isFinite(n) && n > 0) return n;

  // 2) 明確日期字串
  const ds =
    (r.createdAt as string) ||
    r.date ||
    r.review_date ||
    undefined;
  if (ds) {
    const t = Date.parse(ds);
    if (!Number.isNaN(t)) return t;
  }

  // 3) 相對時間（例如「3 個月前」）
  const rel = r.review_time;
  if (rel) return parseRelativeTime(rel);

  // 4) 失敗就用現在
  return Date.now();
}

// 解析「X 個月/天/年 前」→ 粗略時間戳
function parseRelativeTime(s: string): number {
  const now = Date.now();
  const m = s.match(/(\d+)\s*(秒|分鐘|小時|天|週|月|年)/);
  if (!m) return now;
  const n = parseInt(m[1], 10);
  const unit = m[2] as '秒' | '分鐘' | '小時' | '天' | '週' | '月' | '年';
  const ms: Record<typeof unit, number> = {
    秒: 1_000,
    分鐘: 60_000,
    小時: 3_600_000,
    天: 86_400_000,
    週: 604_800_000,
    月: 2_592_000_000,
    年: 31_536_000_000,
  };
  return now - (ms[unit] ?? 0) * n;
}

// ====== 簡易 CSV 解析器 ========================================================
// 回傳：每列一個物件（用第一列做 header）
function parseCSV(text: string): Record<string, string>[] {
  if (!text) return [];
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  if (!lines.length) return [];

  const headers = splitCSVLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length === 1 && cols[0] === '') continue; // 空行
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

// 支援引號、逗點、跳脫 ""
function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // 轉義雙引號
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }

    cur += ch!;
  }
  out.push(cur);
  return out;
}
