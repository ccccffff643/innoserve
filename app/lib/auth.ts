// app/lib/auth.ts
import { ADMIN_EMAILS } from '../constants/admins';
import { getJSON, setJSON } from './storage';

export type AuthUser = {
  uid: string;
  email: string;
};

const AUTH_KEY = 'auth:user';

/** 取得目前已登入的使用者 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  return await getJSON<AuthUser | null>(AUTH_KEY, null);
}

/** 是否為管理員（用 email 比對名單） */
export function isAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return ADMIN_EMAILS.some(e => e.toLowerCase() === user.email.toLowerCase());
}

/** 示範登入：把 email 存起來即可；密碼目前不檢查 */
export async function signIn(email: string, password: string): Promise<AuthUser> {
  const e = (email || '').trim().toLowerCase();
  if (!e) throw new Error('請輸入 Email');

  // 先用時間戳作 uid，之後可改成後端/第三方回傳的真正 uid
  const user: AuthUser = { uid: `u_${Date.now()}`, email: e };
  await setJSON<AuthUser | null>(AUTH_KEY, user);
  return user;
}

/** 登出：清空狀態 */
export async function signOut(): Promise<void> {
  await setJSON<AuthUser | null>(AUTH_KEY, null);
}
