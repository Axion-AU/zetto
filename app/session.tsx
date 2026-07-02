import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TranscriptView } from '../src/components/TranscriptView';
import { VoiceButton } from '../src/components/VoiceButton';
import { useSession } from '../src/hooks/useSession';

function latencyColour(ms: number): string {
  if (ms < 2000) return '#5B8C5A'; // matcha — fast
  if (ms < 4000) return '#D4A03C'; // amber — acceptable
  return '#D94032';                 // vermilion — slow
}

export default function SessionScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');
  const {
    status,
    error,
    topic,
    transcript,
    latencyMs,
    isMicOpen,
    isAiSpeaking,
    hasApiKey,
    start,
    toggleMic,
    sendText,
    translateWord,
    end,
  } = useSession();

  useEffect(() => {
    if (transcript.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [transcript]);

  const handleEnd = async () => {
    await end();
    router.back();
  };

  const handleSend = () => {
    sendText(draft);
    setDraft('');
  };

  /* ── Pre-session states ── */
  if (status === 'idle' || status === 'connecting' || status === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-sumi px-8">
        {status === 'connecting' ? (
          <>
            <ActivityIndicator size="large" color="#D94032" />
            <Text
              className="mt-6 text-base text-brand-stone"
              style={{ fontFamily: 'NotoSansJP_400Regular' }}
            >
              Calibrating your session…
            </Text>
          </>
        ) : (
          <>
            <Text className="text-7xl">🎙</Text>
            <Text
              className="mt-6 text-center text-2xl font-bold text-brand-warm"
              style={{ fontFamily: 'NotoSansJP_700Bold' }}
            >
              Live practice
            </Text>
            <Text
              className="mt-3 text-center text-sm leading-relaxed text-brand-stone"
              style={{ fontFamily: 'NotoSansJP_400Regular' }}
            >
              Zetto builds this session from your skill map: your weak tokens,
              your stage, your pace. Speak out loud — response speed drives
              everything.
            </Text>

            {error ? (
              <View className="mt-6 w-full rounded-lg border border-red-700 bg-red-900/40 px-4 py-3">
                <Text
                  className="text-sm text-red-400"
                  style={{ fontFamily: 'NotoSansJP_400Regular' }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            {!hasApiKey ? (
              <View className="mt-6 w-full rounded-lg border border-brand-ink bg-brand-tatami px-4 py-3">
                <Text
                  className="text-sm leading-relaxed text-brand-stone"
                  style={{ fontFamily: 'IBMPlexMono_400Regular' }}
                >
                  Voice engine not configured. Add EXPO_PUBLIC_GEMINI_API_KEY to
                  .env.local and restart the dev server.
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                className="mt-8 rounded-xl bg-brand-vermilion px-10 py-5"
                onPress={start}
                activeOpacity={0.85}
              >
                <Text
                  className="text-base font-bold text-white"
                  style={{ fontFamily: 'NotoSansJP_700Bold' }}
                >
                  {status === 'error' ? 'Try Again' : 'Start Session →'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </SafeAreaView>
    );
  }

  /* ── Live session ── */
  return (
    <SafeAreaView className="flex-1 bg-brand-sumi" edges={['bottom']}>
      {/* ── Topic priming banner — full-bleed vermilion strip ── */}
      {topic ? (
        <View className="bg-brand-vermilion px-6 py-4">
          <Text
            className="text-xs font-bold uppercase tracking-widest text-white opacity-70"
            style={{ fontFamily: 'NotoSansJP_700Bold' }}
          >
            [ TOPIC ]
          </Text>
          <Text
            className="mt-0.5 text-lg font-bold text-white"
            style={{ fontFamily: 'NotoSansJP_700Bold' }}
          >
            {topic.title} — {topic.ja}
          </Text>
        </View>
      ) : null}

      {/* ── Transcript ── */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-6"
        contentContainerStyle={{ paddingVertical: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {transcript.length === 0 ? (
          <View className="mt-24 items-center">
            <Text className="text-8xl">🎙</Text>
            <Text
              className="mt-6 text-center text-xl font-bold text-brand-warm"
              style={{ fontFamily: 'NotoSansJP_700Bold' }}
            >
              {isAiSpeaking ? 'Zetto is speaking…' : 'Connected.'}
            </Text>
            <Text
              className="mt-2 text-center text-sm text-brand-stone"
              style={{ fontFamily: 'NotoSansJP_400Regular' }}
            >
              Tap the microphone and speak, or type below. Tap any Japanese
              word in the transcript for an instant translation.
            </Text>
          </View>
        ) : (
          transcript.map((entry) => (
            <TranscriptView
              key={entry.id}
              entry={entry}
              onWordPress={(surface) => translateWord(entry.id, surface)}
            />
          ))
        )}
      </ScrollView>

      {/* ── Bottom controls — floating bottom-sheet style ── */}
      <View
        className="border-t border-brand-ink bg-brand-tatami px-6 py-5"
        style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
      >
        {latencyMs !== null ? (
          <View className="mb-4 self-center">
            <View
              className="rounded-full px-4 py-1"
              style={{ backgroundColor: latencyColour(latencyMs) + '22' }}
            >
              <Text
                className="text-xs"
                style={{
                  fontFamily: 'IBMPlexMono_400Regular',
                  color: latencyColour(latencyMs),
                }}
              >
                ⏱ {latencyMs} ms response latency
              </Text>
            </View>
          </View>
        ) : null}

        <View className="mb-4 flex-row items-center gap-3">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={handleSend}
            placeholder="…or type your answer"
            placeholderTextColor="#6B6560"
            className="flex-1 rounded-xl bg-brand-sumi px-4 py-3 text-brand-warm"
            style={{
              fontFamily: 'NotoSansJP_400Regular',
              borderWidth: 1,
              borderColor: '#1A1A1A',
            }}
          />
          <TouchableOpacity
            className={`rounded-xl px-4 py-3 ${draft.trim() ? 'bg-brand-vermilion' : 'bg-brand-sumi'}`}
            onPress={handleSend}
            disabled={!draft.trim()}
            activeOpacity={0.8}
          >
            <Text
              className={`text-sm font-bold ${draft.trim() ? 'text-white' : 'text-brand-stone'}`}
              style={{ fontFamily: 'NotoSansJP_700Bold' }}
            >
              Send
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            className="rounded-xl border border-brand-ink px-5 py-3"
            onPress={handleEnd}
            activeOpacity={0.8}
          >
            <Text
              className="text-sm font-semibold text-brand-stone"
              style={{ fontFamily: 'NotoSansJP_500Medium' }}
            >
              End
            </Text>
          </TouchableOpacity>

          <VoiceButton isListening={isMicOpen} onPress={toggleMic} />

          <View className="w-16 items-center">
            {isAiSpeaking ? (
              <Text
                className="text-xs text-brand-stone"
                style={{ fontFamily: 'IBMPlexMono_400Regular' }}
              >
                ゼット…
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
