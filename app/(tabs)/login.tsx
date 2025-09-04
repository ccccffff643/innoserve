// app/(tabs)/login.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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

// 從 (tabs) 回到 app 再進 lib
import { getCurrentUser, isAdmin, signIn, signOut, type AuthUser } from '../lib/auth';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();

  // 狀態
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);

  // 驗證狀態
  const [emailTouched, setEmailTouched] = useState(false);
  const [pwdTouched, setPwdTouched] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const emailValid = useMemo(() => emailRegex.test(email.trim()), [email]);
  const pwdValid = useMemo(() => pwd.length >= 6, [pwd]);
  const canSubmit = useMemo(() => !busy && emailValid && pwdValid && email.length > 0 && pwd.length > 0, [busy, emailValid, pwdValid, email, pwd]);

  const handleLogin = async () => {
    if (!canSubmit) {
      // 額外保險：如果還是被點到，直接提示
      if (!emailValid) Alert.alert('格式錯誤', '請輸入有效的電子郵件（例如：name@example.com）');
      else if (!pwdValid) Alert.alert('格式錯誤', '密碼至少需要 6 碼');
      return;
    }
    try {
      setBusy(true);
      const u = await signIn(email.trim(), pwd);
      setUser(u);
      Alert.alert('登入成功', isAdmin(u) ? '你是管理員' : '一般使用者');
      // 這頁是分頁之一，可視需求決定是否返回上一頁
      // router.back();
    } catch (e: any) {
      Alert.alert('登入失敗', e?.message ?? '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setEmail('');
    setPwd('');
    setEmailTouched(false);
    setPwdTouched(false);
    Alert.alert('已登出');
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <View style={styles.container}>
          <Text style={styles.title}>帳號登入</Text>

          {user ? (
            <View style={styles.card}>
              <Text style={styles.row}>目前帳號：{user.email}</Text>
              <Text style={styles.row}>身分：{isAdmin(user) ? '管理員' : '一般使用者'}</Text>

              <Pressable style={[styles.btn, { backgroundColor: '#ef4444' }]} onPress={handleLogout}>
                <Text style={styles.btnText}>登出</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              {/* Email */}
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(t) => setEmail(t)}
                onBlur={() => setEmailTouched(true)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
                style={[
                  styles.input,
                  emailTouched && !emailValid && styles.inputError,
                ]}
              />
              {emailTouched && !emailValid && email.length > 0 && (
                <Text style={styles.errorText}>請輸入正確的 Email 格式（例如：name@example.com）</Text>
              )}

              {/* 密碼（含顯示/隱藏切換） */}
              <Text style={styles.label}>密碼（至少 6 碼）</Text>
              <View style={styles.pwdRow}>
                <TextInput
                  value={pwd}
                  onChangeText={setPwd}
                  onBlur={() => setPwdTouched(true)}
                  secureTextEntry={!showPwd}
                  placeholder="••••••••"
                  style={[
                    styles.input,
                    { flex: 1, paddingRight: 44 },
                    pwdTouched && !pwdValid && styles.inputError,
                  ]}
                />
                <Pressable
                  style={styles.eyeBtn}
                  onPress={() => setShowPwd((s) => !s)}
                  hitSlop={8}
                >
                  <Ionicons name={showPwd ? 'eye-off' : 'eye'} size={20} color="#333" />
                </Pressable>
              </View>
              {pwdTouched && !pwdValid && pwd.length > 0 && (
                <Text style={styles.errorText}>密碼至少需要 6 碼</Text>
              )}

              {/* 登入按鈕（未通過驗證則禁用） */}
              <Pressable
                disabled={!canSubmit}
                style={[styles.btn, (!canSubmit || busy) && { opacity: 0.6 }]}
                onPress={handleLogin}
              >
                <Text style={styles.btnText}>{busy ? '登入中…' : '登入'}</Text>
              </Pressable>

              <Text style={styles.hint}>
                * 目前為本機示範登入。管理員名單請到 <Text style={styles.code}>app/constants/admins.ts</Text> 編輯 Email。
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
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  label: { fontWeight: '700', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fff5f5',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  pwdRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    marginTop: 12,
    backgroundColor: '#2f80ed',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { color: 'white', fontWeight: '800' },
  row: { marginBottom: 4 },
  hint: { color: '#666', fontSize: 12, marginTop: 8 },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    backgroundColor: '#eee',
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  linkBtn: { alignSelf: 'center', marginTop: 12 },
  linkText: { color: '#2f80ed', fontWeight: '700' },
});
