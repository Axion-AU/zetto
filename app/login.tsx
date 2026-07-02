import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { useAuth } from '@/context/AuthContext';
import LogoSvg from '../assets/vermilion-box-v2.svg';

export default function LoginScreen() {
  const router = useRouter();
  const { continueAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!isSupabaseConfigured) {
      setError(
        'Accounts are not configured on this deployment. Practice locally instead — your progress is saved on this device.',
      );
      return;
    }
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    // Auth state change in _layout.tsx drives the redirect to /dashboard.
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-sumi">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center px-6 py-12">
          {/* Logo */}
          <View className="mb-5 h-16 w-16">
            <LogoSvg width="100%" height="100%" />
          </View>
          <Text
            className="mb-2 text-3xl font-bold tracking-widest text-brand-warm"
            style={{ fontFamily: 'NotoSansJP_700Bold' }}
          >
            ZETTO
          </Text>
          <Text
            className="mb-10 text-sm text-brand-stone"
            style={{ fontFamily: 'NotoSansJP_400Regular' }}
          >
            Voice-first Japanese acquisition
          </Text>

          {/* ── Glass card form ── */}
          <View className="w-full rounded-2xl border border-brand-ink bg-brand-tatami px-6 py-8">

            {/* Error banner */}
            {error && (
              <View className="mb-4 rounded-lg bg-red-900/40 border border-red-700 px-4 py-3">
                <Text
                  className="text-sm text-red-400"
                  style={{ fontFamily: 'NotoSansJP_400Regular' }}
                >
                  {error}
                </Text>
              </View>
            )}

            {/* Email */}
            <View className="mb-5">
              <Text
                className="mb-2 text-sm font-semibold text-brand-stone"
                style={{ fontFamily: 'NotoSansJP_500Medium' }}
              >
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder="you@example.com"
                placeholderTextColor="#6B6560"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                className="w-full rounded-xl bg-brand-sumi px-4 py-4 text-brand-warm"
                style={{
                  fontFamily: 'IBMPlexMono_400Regular',
                  borderWidth: 1,
                  borderColor: emailFocused ? '#D94032' : '#1A1A1A',
                }}
              />
            </View>

            {/* Password */}
            <View className="mb-2">
              <Text
                className="mb-2 text-sm font-semibold text-brand-stone"
                style={{ fontFamily: 'NotoSansJP_500Medium' }}
              >
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="••••••••"
                placeholderTextColor="#6B6560"
                secureTextEntry
                autoComplete="current-password"
                className="w-full rounded-xl bg-brand-sumi px-4 py-4 text-brand-warm"
                style={{
                  borderWidth: 1,
                  borderColor: passwordFocused ? '#D94032' : '#1A1A1A',
                }}
              />
            </View>

            {/* Forgot password stub */}
            <TouchableOpacity className="mb-6 self-end" activeOpacity={0.7}>
              <Text
                className="text-xs text-brand-stone underline"
                style={{ fontFamily: 'NotoSansJP_400Regular' }}
              >
                Forgot password?
              </Text>
            </TouchableOpacity>

            {/* Sign In */}
            <TouchableOpacity
              className="w-full items-center rounded-xl bg-brand-vermilion px-6 py-5"
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text
                  className="text-lg font-bold text-white"
                  style={{ fontFamily: 'NotoSansJP_700Bold' }}
                >
                  Sign In →
                </Text>
              )}
            </TouchableOpacity>

            {/* Local-only practice — no account required */}
            <TouchableOpacity
              className="mt-4 w-full items-center rounded-xl border border-brand-ink px-6 py-4"
              onPress={continueAsGuest}
              activeOpacity={0.85}
            >
              <Text
                className="text-sm font-semibold text-brand-stone"
                style={{ fontFamily: 'NotoSansJP_500Medium' }}
              >
                Practice without an account →
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
