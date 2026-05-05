import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, StyleSheet } from 'react-native';

import { HomeScreen } from './src/screens/HomeScreen';
import { useApp } from './src/state/store';
import { themeFor } from './src/theme';
import { cleanupOrphanedRecordings } from './src/api/audioCleanup';

export default function App() {
  const dark = useApp((s) => s.dark);
  const t = themeFor(dark);

  // On mount: delete any .m4a cache files left behind from previous crashed sessions.
  useEffect(() => {
    cleanupOrphanedRecordings().catch((err) => {
      console.warn('[App] startup audio cleanup failed:', err);
    });
  }, []);

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
