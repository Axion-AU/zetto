import '../global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  NotoSansJP_400Regular,
  NotoSansJP_500Medium,
  NotoSansJP_700Bold,
} from '@expo-google-fonts/noto-sans-jp';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/context/AuthContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/** Inner component so it can consume AuthContext. */
function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, loading } = useAuth();

  const [fontsLoaded, fontError] = useFonts({
    NotoSansJP_400Regular,
    NotoSansJP_500Medium,
    NotoSansJP_700Bold,
    IBMPlexMono_400Regular,
  });

  useEffect(() => {
    if (loading || (!fontsLoaded && !fontError)) return;

    SplashScreen.hideAsync();

    const inAuthGroup =
      segments[0] === 'dashboard' ||
      segments[0] === 'session' ||
      segments[0] === 'audit';

    if (isAuthenticated && !inAuthGroup) {
      router.replace('/dashboard');
    } else if (!isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, loading, fontsLoaded, fontError, segments]);

  if (loading || (!fontsLoaded && !fontError)) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0D0D0D' },
          headerTintColor: '#E8E4DF',
          headerTitleStyle: { fontWeight: 'bold', fontFamily: 'NotoSansJP_700Bold' },
          contentStyle: { backgroundColor: '#0D0D0D' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Log In', headerBackVisible: true }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="session" options={{ title: 'Practice Session', headerBackVisible: true }} />
        <Stack.Screen name="audit" options={{ title: 'Weekly Audit', headerBackVisible: true }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}
