// app/lib/user.ts
import { getJSON, setJSON } from './storage';

const ME_KEY = 'me:uid';

/**
 * 取得（或建立）本機使用者的唯一 ID。
 * 無需登入，會永久存在於本機儲存。
 */
export async function getMyId(): Promise<string> {
  const existing = await getJSON<string | null>(ME_KEY, null);
  if (existing) return existing;

  // 很簡單的隨機 ID（已足夠用於本機判斷）
  const id = `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await setJSON(ME_KEY, id);
  return id;
}
