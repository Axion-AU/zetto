import { Link } from 'expo-router';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import {
  currentStreak,
  masteredCount,
  meanLatency,
  stageProgress,
  type LearnerProfile,
  type TokenState,
} from '@/domain/learner';
import { useLearnerProfile } from '@/store/learnerStore';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const STAGE_LABELS: Record<LearnerProfile['stage'], { title: string; ja: string; next: string | null }> = {
  crawl: { title: 'Crawl', ja: 'はいはい', next: 'Walk' },
  walk: { title: 'Walk', ja: '歩く', next: 'Run' },
  run: { title: 'Run', ja: '走る', next: 'Fly' },
  fly: { title: 'Fly', ja: '飛ぶ', next: null },
};

function weakestTokens(profile: LearnerProfile, count = 3): TokenState[] {
  return Object.values(profile.tokens)
    .filter((t) => t.struggleCount > 0)
    .sort((a, b) => b.struggleCount - a.struggleCount)
    .slice(0, count);
}

export default function DashboardScreen() {
  const { session, signOut } = useAuth();
  const profile = useLearnerProfile();

  const streak = profile ? currentStreak(profile) : 0;
  const tokenCount = profile ? Object.keys(profile.tokens).length : 0;
  const sessionCount = profile?.sessions.length ?? 0;
  const stage = STAGE_LABELS[profile?.stage ?? 'crawl'];
  const progress = profile ? stageProgress(profile) : 0;
  const mastered = profile ? masteredCount(profile) : 0;
  const weak = profile ? weakestTokens(profile) : [];

  return (
    <SafeAreaView className="flex-1 bg-brand-sumi">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 py-10">

          {/* ── Header ── */}
          <View className="flex-row items-start justify-between mb-2">
            <View>
              <Text
                className="text-sm text-brand-stone"
                style={{ fontFamily: 'NotoSansJP_400Regular' }}
              >
                {getGreeting()} 👋{session?.user?.email ? ` ${session.user.email}` : ''}
              </Text>
              <Text
                className="text-3xl font-bold text-brand-warm"
                style={{ fontFamily: 'NotoSansJP_700Bold' }}
              >
                ゼット Dashboard
              </Text>
            </View>
            <TouchableOpacity
              onPress={signOut}
              activeOpacity={0.8}
              className="mt-1 rounded-full border border-brand-ink px-3 py-1.5"
            >
              <Text
                className="text-xs text-brand-stone"
                style={{ fontFamily: 'NotoSansJP_400Regular' }}
              >
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View className="my-6 h-px bg-brand-ink" />

          {/* ── Stage card ── */}
          <View className="mb-8 rounded-xl border border-brand-ink bg-brand-tatami px-5 py-5">
            <View className="flex-row items-baseline justify-between">
              <Text
                className="text-xs font-bold uppercase tracking-widest text-brand-vermilion"
                style={{ fontFamily: 'NotoSansJP_700Bold' }}
              >
                Current Stage
              </Text>
              <Text
                className="text-xs text-brand-stone"
                style={{ fontFamily: 'IBMPlexMono_400Regular' }}
              >
                {mastered} mastered
              </Text>
            </View>
            <Text
              className="mt-1 text-2xl font-bold text-brand-warm"
              style={{ fontFamily: 'NotoSansJP_700Bold' }}
            >
              {stage.title} <Text className="text-brand-stone">{stage.ja}</Text>
            </Text>
            {stage.next ? (
              <>
                <View className="mt-3 h-2 overflow-hidden rounded-full bg-brand-sumi">
                  <View
                    className="h-2 rounded-full bg-brand-vermilion"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </View>
                <Text
                  className="mt-2 text-xs text-brand-stone"
                  style={{ fontFamily: 'NotoSansJP_400Regular' }}
                >
                  {Math.round(progress * 100)}% of the way to {stage.next}. Mastery = producing
                  a token in roleplay, fast, repeatedly.
                </Text>
              </>
            ) : (
              <Text
                className="mt-2 text-xs text-brand-stone"
                style={{ fontFamily: 'NotoSansJP_400Regular' }}
              >
                Terminal stage — now it's just you and the language.
              </Text>
            )}
          </View>

          {/* ── Stats ── */}
          <Text
            className="mb-4 text-xs font-bold uppercase tracking-widest text-brand-vermilion"
            style={{ fontFamily: 'NotoSansJP_700Bold' }}
          >
            Your Stats
          </Text>
          <View className="w-full flex-row gap-3 mb-10">
            <StatCard emoji="🔥" value={String(streak)} label="day streak" accentColor="#D4A03C" />
            <StatCard emoji="📚" value={String(tokenCount)} label="vocab tokens" accentColor="#5B8C5A" />
            <StatCard emoji="🎯" value={String(sessionCount)} label={sessionCount === 1 ? 'session' : 'sessions'} accentColor="#D94032" />
          </View>

          {/* ── Weak tokens ── */}
          {weak.length > 0 ? (
            <>
              <Text
                className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-vermilion"
                style={{ fontFamily: 'NotoSansJP_700Bold' }}
              >
                Needs Work
              </Text>
              <View className="mb-10 rounded-xl border border-brand-ink bg-brand-tatami">
                {weak.map((token, i) => (
                  <View
                    key={token.surface}
                    className={`flex-row items-center justify-between px-5 py-4 ${
                      i > 0 ? 'border-t border-brand-ink' : ''
                    }`}
                  >
                    <View className="flex-1">
                      <Text
                        className="text-base font-semibold text-brand-warm"
                        style={{ fontFamily: 'NotoSansJP_500Medium' }}
                      >
                        {token.surface}
                      </Text>
                      <Text
                        className="mt-0.5 text-xs text-brand-stone"
                        style={{ fontFamily: 'NotoSansJP_400Regular' }}
                      >
                        {token.translation}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className="text-xs text-brand-amber"
                        style={{ fontFamily: 'IBMPlexMono_400Regular' }}
                      >
                        ×{token.struggleCount} struggles
                      </Text>
                      {meanLatency(token) !== null ? (
                        <Text
                          className="mt-0.5 text-xs text-brand-stone"
                          style={{ fontFamily: 'IBMPlexMono_400Regular' }}
                        >
                          ~{Math.round(meanLatency(token)!)} ms
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* ── Primary CTA: Start Session ── */}
          <Text
            className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-vermilion"
            style={{ fontFamily: 'NotoSansJP_700Bold' }}
          >
            Practice
          </Text>
          <Link href="/session" asChild>
            <TouchableOpacity
              className="w-full rounded-xl bg-brand-vermilion px-6 py-6 shadow-lg mb-4"
              activeOpacity={0.85}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text
                    className="text-xl font-bold tracking-wide text-white"
                    style={{ fontFamily: 'NotoSansJP_700Bold' }}
                  >
                    Start Session →
                  </Text>
                  <Text
                    className="mt-1 text-sm text-white opacity-70"
                    style={{ fontFamily: 'NotoSansJP_500Medium' }}
                  >
                    {sessionCount === 0
                      ? 'Your first session builds your skill map'
                      : 'Tap and speak Japanese immediately'}
                  </Text>
                </View>
                <View className="ml-4 rounded-full bg-white/20 px-2 py-1">
                  <Text
                    className="text-xs font-bold text-white"
                    style={{ fontFamily: 'IBMPlexMono_400Regular' }}
                  >
                    🔴 LIVE
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </Link>

          {/* ── Secondary CTA: Weekly Audit ── */}
          <Link href="/audit" asChild>
            <TouchableOpacity
              className="w-full rounded-xl border border-brand-ink bg-brand-tatami px-6 py-5"
              activeOpacity={0.85}
            >
              <View className="flex-row items-center">
                <Text className="mr-3 text-xl">📅</Text>
                <View>
                  <Text
                    className="text-base font-semibold text-brand-warm"
                    style={{ fontFamily: 'NotoSansJP_500Medium' }}
                  >
                    Weekly Audit
                  </Text>
                  <Text
                    className="mt-0.5 text-sm text-brand-stone"
                    style={{ fontFamily: 'NotoSansJP_400Regular' }}
                  >
                    Calibrate difficulty with your AI coach
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ──────────────────────────── Sub-components ──────────────────────────── */

function StatCard({
  emoji,
  value,
  label,
  accentColor,
}: {
  emoji: string;
  value: string;
  label: string;
  accentColor: string;
}) {
  return (
    <View
      className="flex-1 rounded-xl border border-brand-ink bg-brand-tatami py-5 px-3 items-center"
      style={{ borderTopWidth: 3, borderTopColor: accentColor }}
    >
      <Text className="text-xl mb-1">{emoji}</Text>
      <Text
        className="text-2xl font-bold text-brand-warm"
        style={{ fontFamily: 'IBMPlexMono_400Regular' }}
      >
        {value}
      </Text>
      <Text
        className="mt-0.5 text-xs text-center text-brand-stone"
        style={{ fontFamily: 'NotoSansJP_400Regular' }}
      >
        {label}
      </Text>
    </View>
  );
}
