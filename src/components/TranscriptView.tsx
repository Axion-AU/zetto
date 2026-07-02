import { Text, TouchableOpacity, View } from 'react-native';

import type { TranscriptEntry } from '@/types';

interface TranscriptViewProps {
  entry: TranscriptEntry;
  /** Tap-to-translate handler for words in AI turns (JIT translation). */
  onWordPress?: (surface: string) => void;
}

export function TranscriptView({ entry, onWordPress }: TranscriptViewProps) {
  const isAI = entry.speaker === 'ai';

  return (
    <View
      className={`mb-4 max-w-xs rounded-2xl px-4 py-3 ${
        isAI
          ? 'self-start rounded-tl-sm bg-brand-surface'
          : 'self-end rounded-tr-sm bg-brand-vermilion'
      }`}
    >
      {isAI && (
        <View className="mb-1.5 self-start rounded-full bg-brand-vermilion px-2 py-0.5">
          <Text
            className="text-xs font-bold uppercase tracking-wider text-white"
            style={{ fontFamily: 'NotoSansJP_700Bold' }}
          >
            Zetto
          </Text>
        </View>
      )}

      {/* Render words — tap for JIT translation */}
      <View className="flex-row flex-wrap gap-x-1">
        {entry.words.map((word) => {
          const wordContents = (
            <>
              {word.furigana ? (
                <Text className="text-center text-xs text-brand-text-secondary">
                  {word.furigana}
                </Text>
              ) : null}
              <Text
                className={`text-base ${
                  isAI ? 'text-brand-text' : 'text-white'
                } ${word.isError ? 'underline decoration-red-400' : ''}`}
                style={{ fontFamily: 'NotoSansJP_400Regular' }}
              >
                {word.surface}
              </Text>
            </>
          );

          return isAI && onWordPress ? (
            <TouchableOpacity
              key={word.id}
              onPress={() => onWordPress(word.surface)}
              activeOpacity={0.5}
            >
              <View>{wordContents}</View>
            </TouchableOpacity>
          ) : (
            <View key={word.id}>{wordContents}</View>
          );
        })}
      </View>

      {entry.translation ? (
        <Text
          className="mt-2 text-xs italic text-brand-text-secondary"
          style={{ fontFamily: 'NotoSansJP_400Regular' }}
        >
          {entry.translation}
        </Text>
      ) : null}

      <Text
        className={`mt-1 text-right text-xs ${
          isAI ? 'text-brand-text-secondary' : 'text-white opacity-60'
        }`}
        style={{ fontFamily: 'IBMPlexMono_400Regular' }}
      >
        {entry.timestamp}
      </Text>
    </View>
  );
}
