import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  applyAudit,
  meanSessionLatency,
  sessionsInRange,
} from '@/domain/learner';
import { updateProfile, useLearnerProfile } from '@/store/learnerStore';

const EFFORT_LABELS: Record<number, string> = {
  1: 'Too easy',
  2: 'Very easy',
  3: 'Easy',
  4: 'Slightly easy',
  5: 'Just right',
  6: 'Slightly hard',
  7: 'Hard',
  8: 'Very hard',
  9: 'Extremely hard',
  10: 'Overwhelming',
};

function effortAccent(n: number): string {
  if (n <= 5) return '#5B8C5A'; // matcha
  if (n <= 7) return '#D4A03C'; // amber
  return '#D94032';             // vermilion
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function calibrationMessage(rating: number): string {
  if (rating <= 4) return 'Too comfortable — next week introduces more new vocabulary.';
  if (rating <= 6) return 'You are in the productive-struggle zone. The mix stays as it is.';
  if (rating <= 8) return 'Running hot — next week shifts toward familiar tokens.';
  return 'Overloaded — next week pulls back sharply on new material.';
}

export default function AuditScreen() {
  const router = useRouter();
  const profile = useLearnerProfile();
  const [effortRating, setEffortRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - WEEK_MS);
  const twoWeeksAgo = new Date(now.getTime() - 2 * WEEK_MS);
  const thisWeek = profile ? sessionsInRange(profile, weekAgo, now) : [];
  const lastWeek = profile ? sessionsInRange(profile, twoWeeksAgo, weekAgo) : [];
  const thisWeekLatency = meanSessionLatency(thisWeek);
  const lastWeekLatency = meanSessionLatency(lastWeek);

  const handleSubmit = async () => {
    if (effortRating === null) return;
    await updateProfile((p) => applyAudit(p, effortRating));
    setSubmitted(true);
  };

  if (submitted && effortRating !== null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-sumi px-6">
        {/* Decorative confetti strip */}
        <View className="mb-6 flex-row gap-2">
          {['#D94032', '#D4A03C', '#5B8C5A', '#D94032', '#D4A03C'].map((c, i) => (
            <View
              key={i}
              className="h-2 w-8 rounded-full"
              style={{ backgroundColor: c }}
            />
          ))}
        </View>

        <Text className="text-7xl">✅</Text>
        <Text
          className="mt-6 text-center text-2xl font-bold text-brand-warm"
          style={{ fontFamily: 'NotoSansJP_700Bold' }}
        >
          Calibration saved
        </Text>
        <Text
          className="mt-3 text-center text-sm leading-relaxed text-brand-stone"
          style={{ fontFamily: 'NotoSansJP_400Regular' }}
        >
          {calibrationMessage(effortRating)}
        </Text>
        <TouchableOpacity
          className="mt-10 rounded-xl bg-brand-vermilion px-10 py-5"
          onPress={() => router.replace('/dashboard')}
          activeOpacity={0.85}
        >
          <Text
            className="text-base font-bold text-white"
            style={{ fontFamily: 'NotoSansJP_700Bold' }}
          >
            Back to Dashboard
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-sumi" edges={['bottom']}>
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingVertical: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Intro ── */}
        <Text
          className="text-2xl font-bold text-brand-warm"
          style={{ fontFamily: 'NotoSansJP_700Bold' }}
        >
          Weekly Audit
        </Text>
        <Text
          className="mt-2 text-sm leading-relaxed text-brand-stone"
          style={{ fontFamily: 'NotoSansJP_400Regular' }}
        >
          Rate the overall effort level of your practice this week. Your answer calibrates next week's difficulty mix.
        </Text>

        {/* ── This week's numbers ── */}
        <View className="mt-6 rounded-xl border border-brand-ink bg-brand-tatami px-5 py-4">
          <Text
            className="text-xs font-bold uppercase tracking-widest text-brand-vermilion"
            style={{ fontFamily: 'NotoSansJP_700Bold' }}
          >
            This Week
          </Text>
          <View className="mt-3 flex-row justify-between">
            <View>
              <Text
                className="text-xl font-bold text-brand-warm"
                style={{ fontFamily: 'IBMPlexMono_400Regular' }}
              >
                {thisWeek.length}
              </Text>
              <Text
                className="text-xs text-brand-stone"
                style={{ fontFamily: 'NotoSansJP_400Regular' }}
              >
                sessions ({lastWeek.length} last week)
              </Text>
            </View>
            <View className="items-end">
              <Text
                className="text-xl font-bold text-brand-warm"
                style={{ fontFamily: 'IBMPlexMono_400Regular' }}
              >
                {thisWeekLatency !== null ? `${Math.round(thisWeekLatency)} ms` : '—'}
              </Text>
              <Text
                className="text-xs text-brand-stone"
                style={{ fontFamily: 'NotoSansJP_400Regular' }}
              >
                {lastWeekLatency !== null && thisWeekLatency !== null
                  ? thisWeekLatency <= lastWeekLatency
                    ? `${Math.round(lastWeekLatency - thisWeekLatency)} ms faster than last week`
                    : `${Math.round(thisWeekLatency - lastWeekLatency)} ms slower than last week`
                  : 'mean response latency'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Rating grid ── */}
        <Text
          className="mb-4 mt-8 font-semibold text-brand-warm"
          style={{ fontFamily: 'NotoSansJP_500Medium' }}
        >
          Effort rating
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const selected = effortRating === n;
            const accent = effortAccent(n);
            return (
              <TouchableOpacity
                key={n}
                className={`h-14 w-14 items-center justify-center rounded-xl border ${
                  selected ? 'border-transparent' : 'border-brand-ink bg-brand-tatami'
                }`}
                style={selected ? { backgroundColor: accent, borderColor: accent } : {}}
                onPress={() => setEffortRating(n)}
                activeOpacity={0.75}
              >
                <Text
                  className={`text-base font-bold ${selected ? 'text-white' : 'text-brand-warm'}`}
                  style={{ fontFamily: 'IBMPlexMono_400Regular' }}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Effort label card ── */}
        {effortRating !== null ? (
          <View
            className="mt-5 rounded-xl bg-brand-tatami px-5 py-4"
            style={{ borderLeftWidth: 4, borderLeftColor: effortAccent(effortRating) }}
          >
            <Text
              className="text-xs font-bold uppercase tracking-widest"
              style={{ fontFamily: 'NotoSansJP_700Bold', color: effortAccent(effortRating) }}
            >
              {effortRating} / 10
            </Text>
            <Text
              className="mt-1 text-base font-semibold text-brand-warm"
              style={{ fontFamily: 'NotoSansJP_500Medium' }}
            >
              {EFFORT_LABELS[effortRating]}
            </Text>
          </View>
        ) : null}

        {/* ── Submit ── */}
        <TouchableOpacity
          className={`mt-8 items-center rounded-xl px-6 py-5 ${
            effortRating !== null ? 'bg-brand-vermilion' : 'bg-brand-tatami'
          }`}
          onPress={handleSubmit}
          disabled={effortRating === null}
          activeOpacity={0.85}
        >
          <Text
            className={`font-bold ${effortRating !== null ? 'text-white' : 'text-brand-stone'}`}
            style={{ fontFamily: 'NotoSansJP_700Bold' }}
          >
            Submit Rating
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
