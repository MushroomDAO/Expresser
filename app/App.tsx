import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, StyleSheet } from 'react-native';

import { HomeScreen } from './src/screens/HomeScreen';
import { useApp } from './src/state/store';
import { themeFor } from './src/theme';

export default function App() {
  const dark = useApp((s) => s.dark);
  const t = themeFor(dark);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]}>
        <HomeScreen />
        <StatusBar style={dark ? 'light' : 'dark'} />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
