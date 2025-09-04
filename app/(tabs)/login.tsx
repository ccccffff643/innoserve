// app/(tabs)/login.tsx
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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

// ← 路徑重點：從 (tabs) 回到 app，再進 lib
import { getCurrentUser, isAdmin, signIn, signOut, type AuthUser } from '../lib/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const handleLogin = async () => {
    try {
      setBusy(true);
      const u = await signIn(email, pwd);
      setUser(u);
      Alert.alert('登入成功', isAdmin(u) ? '你是管理員' : '一般使用者');
      // 這是分頁頁面，是否要返回看你需求；保留沒壞處
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
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                style={styles.input}
              />

              <Text style={styles.label}>密碼</Text>
              <TextInput
                value={pwd}
                onChangeText={setPwd}
                secureTextEntry
                placeholder="••••••••"
                style={styles.input}
              />

              <Pressable disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]} onPress={handleLogin}>
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
