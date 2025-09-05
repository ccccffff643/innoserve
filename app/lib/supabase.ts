// app/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = 'https://rxjqzctsquuhjkeiuwiw.supabase.co'; // ← 換成你的
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4anF6Y3RzcXV1aGprZWl1d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMDY2MzIsImV4cCI6MjA3MjU4MjYzMn0.qZv0fVfAh68HA1wm0ka3mwIANkcwsvnoKmjWrWl38KA';              // ← 換成你的

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
