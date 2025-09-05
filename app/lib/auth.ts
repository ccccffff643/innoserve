// app/lib/auth.ts
import { ADMIN_EMAILS } from '../constants/admins';
import { getJSON, setJSON } from './storage';
import { supabase } from './supabase';

export type AuthUser = { uid: string; email: string };

type StoredUser = {
  uid: string;
  email: string;    // 小寫
  password: string; // DEMO：純文字（正式上線請改雜湊）
  createdAt: number;
};

const AUTH_KEY  = 'auth:user';
const USERS_KEY = 'auth:users'; // Record<email(lowercase), StoredUser>

// ------------- 本機帳號庫存取 -------------
async function loadUsers(): Promise<Record<string, StoredUser>> {
  return (await getJSON<Record<string, StoredUser>>(USERS_KEY, {})) ?? {};
}
async function saveUsers(users: Record<string, StoredUser>) {
  await setJSON(USERS_KEY, users);
}

// ------------- Session / Admin -------------
export async function getCurrentUser(): Promise<AuthUser | null> {
  return await getJSON<AuthUser | null>(AUTH_KEY, null);
}
export function isAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return ADMIN_EMAILS.some(e => e.toLowerCase() === user.email.toLowerCase());
}

// ------------- 註冊 / 登入 / 登出（本機 DEMO）-------------
export async function emailExists(email: string): Promise<boolean> {
  const users = await loadUsers();
  const key = (email || '').trim().toLowerCase();
  return !!users[key];
}

export async function register(email: string, password: string): Promise<AuthUser> {
  const e = (email || '').trim().toLowerCase();
  if (!e) throw new Error('請輸入 Email');
  if ((password || '').length < 6) throw new Error('密碼至少 6 碼');

  const users = await loadUsers();
  if (users[e]) throw new Error('此 Email 已被註冊');

  const user: StoredUser = {
    uid: `u_${Date.now()}`,
    email: e,
    password,
    createdAt: Date.now(),
  };
  users[e] = user;
  await saveUsers(users);

  const authUser: AuthUser = { uid: user.uid, email: user.email };
  await setJSON<AuthUser | null>(AUTH_KEY, authUser);
  return authUser;
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const e = (email || '').trim().toLowerCase();
  const users = await loadUsers();
  const u = users[e];
  if (!u) throw new Error('此 Email 尚未註冊');
  if (u.password !== password) throw new Error('密碼不正確');

  const authUser: AuthUser = { uid: u.uid, email: u.email };
  await setJSON<AuthUser | null>(AUTH_KEY, authUser);
  return authUser;
}

export async function signOut(): Promise<void> {
  await setJSON<AuthUser | null>(AUTH_KEY, null);
}

// ------------- 忘記密碼（雲端 OTP）-------------
/**
 * 寄送重設密碼的 OTP（6位數）到 email。
 * 條件：本機帳號庫已有此 email。
 */
export async function sendResetOtp(email: string): Promise<void> {
  const e = (email || '').trim().toLowerCase();
  if (!e) throw new Error('請輸入 Email');
  if (!(await emailExists(e))) throw new Error('此 Email 尚未註冊');

  const { error } = await supabase.auth.signInWithOtp({ email: e });
  if (error) throw new Error(error.message ?? '寄送驗證碼失敗');
}

/**
 * 使用 OTP 驗證並「只更新本機帳號庫」的新密碼（Demo）
 * @param email email
 * @param token 6位數 OTP
 * @param newPassword 新密碼（>=6）
 */
export async function resetPasswordWithOtp(
  email: string,
  token: string,
  newPassword: string
): Promise<void> {
  const e = (email || '').trim().toLowerCase();
  if (!e) throw new Error('請輸入 Email');
  if ((newPassword || '').length < 6) throw new Error('新密碼至少 6 碼');

  // 驗證 OTP（Supabase 雲端）
  const { error } = await supabase.auth.verifyOtp({
    email: e,
    token,
    type: 'email', // 使用 email OTP 驗證
  });
  if (error) throw new Error(error.message ?? '驗證碼錯誤或逾時');

  // 驗證成功 → 更新本機帳號密碼（Demo）
  const users = await loadUsers();
  const u = users[e];
  if (!u) throw new Error('查無此 Email（可能尚未註冊）');

  u.password = newPassword;
  await saveUsers(users);
}

// 對外提供別名：resetPassword(email, otp, newPassword)
export { resetPasswordWithOtp as resetPassword };

