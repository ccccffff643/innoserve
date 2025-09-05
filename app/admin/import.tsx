// app/admin/import.tsx
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MOCK_PROPERTIES } from '../data/properties';
import {
    importCommentsFromCSV,
    importCommentsFromJSON,
    resolvePidForFile,
    type RawComment,
} from '../lib/importComments';

type Log = { file: string; pid?: string | null; added?: number; error?: string };

export default function AdminImportScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [busy, setBusy] = useState(false);

  const pickFiles = async () => {
    try {
      setBusy(true);
      setLogs([]);
      const res = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: ['application/json', 'text/csv', 'text/plain', '*/*'],
      });
      if (res.canceled) return;

      const selection = res.assets ?? [];
      const newLogs: Log[] = [];

      for (const asset of selection) {
        const name = asset.name || 'unnamed';
        try {
          const text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
          const firstRow = safeFirstRow(text, name);
          const pid = resolvePidForFile(name, firstRow);

          if (!pid) {
            newLogs.push({ file: name, pid: null, error: '⚠️ 無法配對任何物件（檔名請加 pX 或改成物件名稱）' });
            continue;
          }

          let added = 0;
          if (name.toLowerCase().endsWith('.csv')) {
            added = await importCommentsFromCSV(pid, text, { merge: true });
          } else {
            // 嘗試剖析 JSON 陣列；允許 { data: [...] } 形式
            const parsed = JSON.parse(text);
            const items: RawComment[] = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
            if (!Array.isArray(items)) throw new Error('JSON 格式需為陣列或含 data 陣列');
            added = await importCommentsFromJSON(pid, items, { merge: true });
          }

          const nameOfPid = MOCK_PROPERTIES.find(p => p.id === pid)?.name ?? pid;
          newLogs.push({ file: name, pid, added });
        } catch (e: any) {
          newLogs.push({ file: name, error: e?.message ?? '解析失敗' });
        }
      }

      setLogs(newLogs);
      const ok = newLogs.filter(l => !l.error).length;
      const fail = newLogs.filter(l => l.error).length;
      Alert.alert('匯入完成', `成功：${ok}，失敗：${fail}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={styles.title}>管理匯入工具</Text>

        <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={pickFiles} disabled={busy}>
          <Text style={styles.btnText}>{busy ? '處理中…' : '選擇檔案（可多選 JSON/CSV）'}</Text>
        </Pressable>

        <Text style={styles.h2}>規則（任一符合即可）：</Text>
        <Text style={styles.li}>• 檔名含 pX（例如：comments_p3.json）</Text>
        <Text style={styles.li}>• 檔名即物件名稱（例如：元智生活會館.json）</Text>
        <Text style={styles.li}>• 每筆資料含 propertyId 或 pid 欄位</Text>

        <Text style={styles.h2}>可接受欄位（寬鬆）：</Text>
        <Text style={styles.li}>• user/reviewer/author/name</Text>
        <Text style={styles.li}>• text/content/comment/review/body</Text>
        <Text style={styles.li}>• rating/score/stars（會四捨五入成 1–5）</Text>
        <Text style={styles.li}>• createdAt/date/review_date/time</Text>

        <Text style={styles.h2}>匯入結果</Text>
        {logs.length === 0 ? (
          <Text style={{ color: '#666' }}>尚無紀錄</Text>
        ) : (
          logs.map((l, idx) => (
            <View key={idx} style={styles.card}>
              <Text style={styles.row}>檔案：{l.file}</Text>
              {'pid' in l && <Text style={styles.row}>物件：{l.pid ?? '（未配對）'}</Text>}
              {l.added != null && <Text style={styles.row}>新增評論：{l.added} 筆</Text>}
              {l.error && <Text style={[styles.row, { color: '#ef4444' }]}>錯誤：{l.error}</Text>}
            </View>
          ))
        )}

        <Pressable style={styles.linkBtn} onPress={() => router.back()}>
          <Text style={styles.linkText}>← 返回</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function safeFirstRow(text: string, filename: string): RawComment | undefined {
  try {
    if (filename.toLowerCase().endsWith('.csv')) return undefined;
    const parsed = JSON.parse(text);
    const arr: any[] = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);
    return Array.isArray(arr) && arr.length > 0 ? (arr[0] as RawComment) : undefined;
  } catch {
    return undefined;
  }
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginVertical: 8 },
  btn: { backgroundColor: '#2f80ed', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '800' },
  h2: { marginTop: 8, fontWeight: '800' },
  li: { color: '#444', marginTop: 2 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    marginTop: 6,
  },
  row: { marginBottom: 4 },
  linkBtn: { alignSelf: 'center', marginTop: 12 },
  linkText: { color: '#2f80ed', fontWeight: '700' },
});
