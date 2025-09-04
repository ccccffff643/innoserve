// app/(tabs)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      {/* 地圖頁：對應 app/(tabs)/index.tsx */}
      <Tabs.Screen
        name="index"
        options={{
          title: '地圖',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 收藏頁：對應 app/(tabs)/favorites.tsx（一定要有這個檔案） */}
      <Tabs.Screen
        name="Favorites"
        options={{
        title: '收藏',
        tabBarIcon: ({ color, size }) => (
        <Ionicons name="heart" size={size} color={color} />
          ),
        }}
      />
      
      {/* 登入頁：對應 app/(tabs)/login.tsx（一定要有這個檔案） */}
      <Tabs.Screen name="login" options={{ title: '登入' }} /> 

      {/* 若你有 Explore 也可加上：
      <Tabs.Screen name="explore" options={{ title: '探索' }} />
      */}
    </Tabs>
  );
}
