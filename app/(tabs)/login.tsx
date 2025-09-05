// app/(tabs)/login.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  emailExists,
  getCurrentUser,
  isAdmin,
  register,
  resetPassword, // resetPasswordWithOtp(email, otp, newPassword)
  sendResetOtp,
  signIn,
  signOut,
  type AuthUser,
} from '../lib/auth';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Mode = 'login' | 'signup' | 'reset';
const RESEND_COOLDOWN = 60;

export default function LoginScreen() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<Mode>('login');

  // login / signup
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');

  // reset
  const [otp, setOtp] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');

  // ui
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  // cooldown
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // touched
  const [emailTouched, setEmailTouched] = useState(false);
  const [pwdTouched, setPwdTouched] = useState(false);
  const [pwd2Touched, setPwd2Touched] = useState(false);
  const [otpTouched, setOtpTouched] = useState(false);
  const [newPwdTouched, setNewPwdTouched] = useState(false);
  const [newPwd2Touched, setNewPwd2Touched] = useState(false);

  useEffect(() => { getCurrentUser().then(setUser); }, []);

  useEffect(() => {
    if (mode !== 'reset') {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setCooldown(0);
      setOtp('');
    }
  }, [mode]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const emailValid   = useMemo(() => emailRegex.test(email.trim()), [email]);
  const pwdValid     = useMemo(() => pwd.length >= 6, [pwd]);
  const pwd2Valid    = useMemo(() => (mode === 'login') ? true : (pwd2.length >= 6 && pwd2 === pwd), [pwd2, pwd, mode]);

  const otpValid     = useMemo(() => otp.trim().length >= 4, [otp]);
  const newPwdValid  = useMemo(() => newPwd.length >= 6, [newPwd]);
  const newPwd2Valid = useMemo(() => newPwd2.length >= 6 && newPwd2 === newPwd, [newPwd2, newPwd]);

  const canSubmit = useMemo(() => {
    if (busy) return false;
    if (!emailValid) return false;
    if (mode === 'login')  return pwdValid;
    if (mode === 'signup') return pwdValid && pwd2Valid;
    return otpValid && newPwdValid && newPwd2Valid;
  }, [busy, emailValid, pwdValid, pwd2Valid, mode, otpValid, newPwdValid, newPwd2Valid]);

  const clearAll = () => {
    setEmail(''); setPwd(''); setPwd2('');
    setOtp(''); setNewPwd(''); setNewPwd2('');
    setEmailTouched(false); setPwdTouched(false); setPwd2Touched(false);
    setOtpTouched(false); setNewPwdTouched(false); setNewPwd2Touched(false);
  };

  const startCooldown = (sec: number) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setCooldown(sec);
    timerRef.current = setInterval(() => {
      setCooldown(s => {
        if (s <= 1) { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const handleLogin = async () => {
    try {
      setBusy(true);
      const u = await signIn(email.trim(), pwd);
      setUser(u);
      Alert.alert('登入成功', isAdmin(u) ? '你是管理員' : '一般使用者');
    } catch (e: any) {
      Alert.alert('登入失敗', e?.message ?? '請稍後再試');
    } finally { setBusy(false); }
  };

  const handleSignup = async () => {
    try {
      setBusy(true);
      if (await emailExists(email)) {
        Alert.alert('註冊失敗', '此 Email 已存在，請改用其他 Email 或直接登入');
        return;
      }
      const u = await register(email.trim(), pwd);
      setUser(u);
      Alert.alert('註冊成功', '已自動登入');
      setMode('login');
    } catch (e: any) {
      Alert.alert('註冊失敗', e?.message ?? '請稍後再試');
    } finally { setBusy(false); }
  };

  const handleSendOtp = async () => {
    try {
      if (!emailValid) return Alert.alert('Email 格式不正確');
      if (cooldown > 0) return;
      setBusy(true);
      await sendResetOtp(email.trim());
      Alert.alert('驗證碼已寄出', '請至信箱查收 6 位數驗證碼');
      startCooldown(RESEND_COOLDOWN);
    } catch (e: any) {
      Alert.alert('寄送失敗', e?.message ?? '請稍後再試');
    } finally { setBusy(false); }
  };

  const handleDoReset = async () => {
    try {
      if (!emailValid)   return Alert.alert('Email 格式不正確');
      if (!otpValid)     return Alert.alert('請輸入驗證碼');
      if (!newPwdValid)  return Alert.alert('新密碼至少 6 碼');
      if (!newPwd2Valid) return Alert.alert('兩次新密碼需一致，且至少 6 碼');

      setBusy(true);
      await resetPassword(email.trim(), otp.trim(), newPwd);
      Alert.alert('已重設密碼', '請用新密碼登入');
      setMode('login');
      clearAll();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setCooldown(0);
    } catch (e: any) {
      Alert.alert('重設失敗', e?.message ?? '請稍後再試');
    } finally { setBusy(false); }
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    clearAll();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setCooldown(0);
    Alert.alert('已登出');
  };

  const submit = () => {
    if (!canSubmit) {
      if (!emailValid) Alert.alert('格式錯誤', '請輸入有效的 Email（例如：name@example.com）');
      else if (mode === 'login' && !pwdValid) Alert.alert('格式錯誤', '密碼至少需要 6 碼');
      else if (mode === 'signup' && !pwd2Valid) Alert.alert('格式錯誤', '兩次密碼需一致，且至少 6 碼');
      else if (mode === 'reset') {
        if (!otpValid) Alert.alert('格式錯誤', '請輸入驗證碼');
        else if (!newPwdValid) Alert.alert('格式錯誤', '新密碼至少 6 碼');
        else if (!newPwd2Valid) Alert.alert('格式錯誤', '兩次新密碼需一致，且至少 6 碼');
      }
      return;
    }
    if (mode === 'login')  return handleLogin();
    if (mode === 'signup') return handleSignup();
    return handleDoReset();
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <View style={styles.container}>
          <Text style={styles.title}>帳號中心</Text>

          {user ? (
            <View style={styles.card}>
              <Text style={styles.row}>目前帳號：{user.email}</Text>
              <Text style={styles.row}>身分：{isAdmin(user) ? '管理員' : '一般使用者'}</Text>

              {/* 只有管理員看到匯入工具 */}
              {isAdmin(user) && (
                <Pressable style={[styles.btn, { backgroundColor: '#10b981' }]} onPress={() => router.push('../admin/import')}>
                  <Text style={styles.btnText}>開啟匯入工具</Text>
                </Pressable>
              )}

              <Pressable style={[styles.btn, { backgroundColor: '#ef4444' }]} onPress={handleLogout}>
                <Text style={styles.btnText}>登出</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.modeRow}>
                <Pressable style={[styles.modeBtn, mode === 'login' && styles.modeBtnActive]} onPress={() => { setMode('login'); clearAll(); }}>
                  <Text style={[styles.modeText, mode === 'login' && styles.modeTextActive]}>登入</Text>
                </Pressable>
                <Pressable style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]} onPress={() => { setMode('signup'); clearAll(); }}>
                  <Text style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>註冊</Text>
                </Pressable>
                <Pressable style={[styles.modeBtn, mode === 'reset' && styles.modeBtnActive]} onPress={() => { setMode('reset'); clearAll(); }}>
                  <Text style={[styles.modeText, mode === 'reset' && styles.modeTextActive]}>忘記密碼</Text>
                </Pressable>
              </View>

              {/* Email */}
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onBlur={() => setEmailTouched(true)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
                style={[styles.input, emailTouched && !emailValid && styles.inputError]}
              />
              {emailTouched && !emailValid && email.length > 0 && (
                <Text style={styles.errorText}>請輸入正確的 Email 格式（例如：name@example.com）</Text>
              )}

              {/* 登入 / 註冊 密碼 */}
              {mode !== 'reset' && (
                <>
                  <Text style={styles.label}>密碼（至少 6 碼）</Text>
                  <View style={styles.pwdRow}>
                    <TextInput
                      value={pwd}
                      onChangeText={setPwd}
                      onBlur={() => setPwdTouched(true)}
                      secureTextEntry={!showPwd}
                      placeholder="••••••••"
                      style={[styles.input, { flex: 1, paddingRight: 44 }, pwdTouched && !pwdValid && styles.inputError]}
                    />
                    <Pressable style={styles.eyeBtn} onPress={() => setShowPwd(s => !s)} hitSlop={8}>
                      <Ionicons name={showPwd ? 'eye-off' : 'eye'} size={20} color="#333" />
                    </Pressable>
                  </View>
                  {pwdTouched && !pwdValid && pwd.length > 0 && (
                    <Text style={styles.errorText}>密碼至少需要 6 碼</Text>
                  )}
                </>
              )}

              {/* 註冊：再次輸入密碼 */}
              {mode === 'signup' && (
                <>
                  <Text style={styles.label}>再次輸入密碼</Text>
                  <TextInput
                    value={pwd2}
                    onChangeText={setPwd2}
                    onBlur={() => setPwd2Touched(true)}
                    secureTextEntry={!showPwd}
                    placeholder="請再輸入一次密碼"
                    style={[styles.input, pwd2Touched && !pwd2Valid && styles.inputError]}
                  />
                  {pwd2Touched && !pwd2Valid && pwd2.length > 0 && (
                    <Text style={styles.errorText}>兩次密碼需一致，且至少 6 碼</Text>
                  )}
                </>
              )}

              {/* 忘記密碼：OTP + 新密碼 + 冷卻重寄 */}
              {mode === 'reset' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>驗證碼（OTP）</Text>
                      <TextInput
                        value={otp}
                        onChangeText={setOtp}
                        onBlur={() => setOtpTouched(true)}
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholder="6 位數"
                        style={[styles.input, otpTouched && !otpValid && styles.inputError]}
                      />
                      {otpTouched && !otpValid && otp.length > 0 && (
                        <Text style={styles.errorText}>請輸入 4~6 位數驗證碼</Text>
                      )}
                    </View>
                    <Pressable
                      disabled={busy || !emailValid || cooldown > 0}
                      style={[styles.smallBtn, (busy || !emailValid || cooldown > 0) && { opacity: 0.6 }]}
                      onPress={handleSendOtp}
                    >
                      <Text style={styles.smallBtnText}>
                        {cooldown > 0 ? `重寄(${cooldown}s)` : busy ? '寄送中…' : '寄送驗證碼'}
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={styles.label}>新密碼（至少 6 碼）</Text>
                  <TextInput
                    value={newPwd}
                    onChangeText={setNewPwd}
                    onBlur={() => setNewPwdTouched(true)}
                    secureTextEntry
                    placeholder="請輸入新密碼"
                    style={[styles.input, newPwdTouched && !newPwdValid && styles.inputError]}
                  />
                  {newPwdTouched && !newPwdValid && newPwd.length > 0 && (
                    <Text style={styles.errorText}>新密碼至少 6 碼</Text>
                  )}

                  <Text style={styles.label}>再次輸入新密碼</Text>
                  <TextInput
                    value={newPwd2}
                    onChangeText={setNewPwd2}
                    onBlur={() => setNewPwd2Touched(true)}
                    secureTextEntry
                    placeholder="請再輸入一次新密碼"
                    style={[styles.input, newPwd2Touched && !newPwd2Valid && styles.inputError]}
                  />
                  {newPwd2Touched && !newPwd2Valid && newPwd2.length > 0 && (
                    <Text style={styles.errorText}>兩次新密碼需一致，且至少 6 碼</Text>
                  )}
                </>
              )}

              <Pressable disabled={!canSubmit || busy} style={[styles.btn, (!canSubmit || busy) && { opacity: 0.6 }]} onPress={submit}>
                <Text style={styles.btnText}>
                  {busy ? '處理中…' : mode === 'login' ? '登入' : mode === 'signup' ? '註冊' : '重設密碼'}
                </Text>
              </Pressable>

              <Text style={styles.hint}>
                * Demo：帳號資料僅儲存在此裝置（本機）。忘記密碼採用雲端 OTP 驗證（可設定到期時間與長度），但僅更新本機密碼。
              </Text>
            </View>
          )}

          <Pressable style={styles.linkBtn} onPress={() => router.back()}>
            <Text style={styles.linkText}>← 返回</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    gap: 10,
  },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#2f80ed' },
  modeText: { fontWeight: '700', color: '#111' },
  modeTextActive: { color: '#fff' },
  label: { fontWeight: '700', marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fafafa' },
  inputError: { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  pwdRow: { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { position: 'absolute', right: 10, height: 44, width: 44, alignItems: 'center', justifyContent: 'center' },
  btn: { marginTop: 12, backgroundColor: '#2f80ed', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '800' },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#2f80ed', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { color: '#fff', fontWeight: '800' },
  row: { marginBottom: 4 },
  hint: { color: '#666', fontSize: 12, marginTop: 8 },
  linkBtn: { alignSelf: 'center', marginTop: 12 },
  linkText: { color: '#2f80ed', fontWeight: '700' },
});
