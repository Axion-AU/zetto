import { useCallback, useEffect, useRef, useState } from 'react';

import {
  beginSession,
  pickTopic,
  recordProduction,
  recordSession,
  recordStruggle,
  selectSessionTokens,
  type TokenState,
} from '@/domain/learner';
import { buildSystemPrompt } from '@/domain/prompt';
import { findBankToken, type SessionTopic } from '@/domain/tokens';
import { updateProfile } from '@/store/learnerStore';
import type { TranscriptEntry, TranscriptWord } from '@/types';
import { hasKanji, segmentJapanese } from '@/utils/japanese';
import { useGeminiRealtime } from './useGeminiRealtime';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export type SessionStatus =
  | 'idle' // not started yet
  | 'connecting'
  | 'live'
  | 'ended'
  | 'error';

function timestamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Orchestrates a practice session: builds the calibrated system prompt from
 * the learner profile, maintains the turn-segmented transcript, attributes
 * token productions with measured latency, and persists the session record.
 */
export function useSession({ weeklyAudit = false } = {}) {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState<SessionTopic | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const sessionTokensRef = useRef<TokenState[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const turnLatenciesRef = useRef<number[]>([]);
  const pendingLatencyRef = useRef<number | null>(null);
  const tokensProducedRef = useRef<Set<string>>(new Set());
  const userTurnsRef = useRef(0);
  /** Kanji surfaces already shown with furigana this session (decay rule). */
  const furiganaSeenRef = useRef<Set<string>>(new Set());
  const savedRef = useRef(false);

  // Buffers for the turn currently being transcribed.
  const userBufferRef = useRef('');
  const aiBufferRef = useRef('');
  const aiEntryIdRef = useRef<string | null>(null);
  const userEntryIdRef = useRef<string | null>(null);

  const buildAiWords = useCallback((text: string): TranscriptWord[] => {
    return segmentJapanese(text).map((segment, i) => {
      const word: TranscriptWord = { id: `w${i}-${segment}`, surface: segment };
      const bankToken = findBankToken(segment);
      if (
        bankToken &&
        hasKanji(segment) &&
        bankToken.reading !== segment &&
        !furiganaSeenRef.current.has(segment)
      ) {
        furiganaSeenRef.current.add(segment);
        word.furigana = bankToken.reading;
      }
      return word;
    });
  }, []);

  const upsertEntry = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx === -1) return [...prev, entry];
      const next = [...prev];
      next[idx] = entry;
      return next;
    });
  }, []);

  /** Close out the learner's turn: attribute productions with latency. */
  const finalizeUserTurn = useCallback(() => {
    const text = userBufferRef.current.trim();
    userBufferRef.current = '';
    userEntryIdRef.current = null;
    if (!text) return;

    userTurnsRef.current += 1;
    const latency = pendingLatencyRef.current;
    pendingLatencyRef.current = null;
    if (latency !== null) turnLatenciesRef.current.push(latency);

    const produced = sessionTokensRef.current.filter(
      (t) => text.includes(t.surface) || text.includes(t.reading),
    );
    if (produced.length > 0) {
      for (const t of produced) tokensProducedRef.current.add(t.surface);
      void updateProfile((profile) => {
        for (const t of produced) recordProduction(profile, t.surface, latency);
      });
    }
  }, []);

  const gemini = useGeminiRealtime({
    onUserTranscript: (text) => {
      userBufferRef.current += text;
      userEntryIdRef.current ??= `user-${Date.now()}`;
      upsertEntry({
        id: userEntryIdRef.current,
        speaker: 'user',
        words: [{ id: 'u0', surface: userBufferRef.current }],
        timestamp: timestamp(),
      });
    },
    onAiTranscript: (text) => {
      // The AI responding means the learner's turn is over.
      if (userBufferRef.current) finalizeUserTurn();
      aiBufferRef.current += text;
      aiEntryIdRef.current ??= `ai-${Date.now()}`;
      upsertEntry({
        id: aiEntryIdRef.current,
        speaker: 'ai',
        words: buildAiWords(aiBufferRef.current),
        timestamp: timestamp(),
      });
    },
    onAiTurnComplete: () => {
      aiBufferRef.current = '';
      aiEntryIdRef.current = null;
    },
    onInterrupted: () => {
      aiBufferRef.current = '';
      aiEntryIdRef.current = null;
    },
    onResponseLatency: (ms) => {
      pendingLatencyRef.current = ms;
      setLatencyMs(ms);
    },
    onError: (message) => {
      setError(message);
      setStatus((prev) => (prev === 'live' || prev === 'connecting' ? 'error' : prev));
    },
  });

  /** Connect, calibrate, and let the AI open the conversation. */
  const start = useCallback(async () => {
    setError(null);
    setStatus('connecting');
    try {
      let sessionTokens: TokenState[] = [];
      const profile = await updateProfile((p) => {
        beginSession(p);
        sessionTokens = selectSessionTokens(p, 8);
      });
      sessionTokensRef.current = sessionTokens;
      const sessionTopic = pickTopic(profile);
      setTopic(sessionTopic);

      await gemini.connect(
        buildSystemPrompt(profile, {
          topic: sessionTopic,
          activeTokens: sessionTokens,
          weeklyAudit,
        }),
      );
      startedAtRef.current = Date.now();
      setStatus('live');
      // Kick off the AI's opening line; mic opens when the learner taps.
      gemini.sendText('(The learner has joined the session. Greet them and begin.)');
    } catch {
      setStatus('error');
    }
  }, [gemini, weeklyAudit]);

  const toggleMic = useCallback(async () => {
    if (gemini.isMicOpen) {
      gemini.closeMic();
    } else {
      await gemini.openMic();
    }
  }, [gemini]);

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status !== 'live') return;
      // Typed turns produce no input transcription; record the turn directly.
      userBufferRef.current = trimmed;
      userEntryIdRef.current = `user-${Date.now()}`;
      upsertEntry({
        id: userEntryIdRef.current,
        speaker: 'user',
        words: [{ id: 'u0', surface: trimmed }],
        timestamp: timestamp(),
      });
      gemini.sendText(trimmed);
      finalizeUserTurn();
    },
    [gemini, status, finalizeUserTurn, upsertEntry],
  );

  /**
   * Just-In-Time translation: tap a word in an AI turn. Increments the
   * token's struggle count (it fed back into the pipeline) and shows the
   * translation inline.
   */
  const translateWord = useCallback(
    async (entryId: string, surface: string) => {
      const bankToken = findBankToken(surface);
      let translation = bankToken
        ? `${surface}（${bankToken.reading}） — ${bankToken.translation}`
        : null;

      if (bankToken) {
        void updateProfile((profile) => recordStruggle(profile, surface));
      }

      if (!translation && API_KEY) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: `Give the English translation of this Japanese word or phrase. Reply with only the translation: ${surface}`,
                      },
                    ],
                  },
                ],
              }),
            },
          );
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) translation = `${surface} — ${text}`;
        } catch {
          // Offline or key rejected — fall through to the fallback label.
        }
      }

      setTranscript((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? { ...entry, translation: translation ?? `${surface} — (no translation available)` }
            : entry,
        ),
      );
    },
    [],
  );

  /** Persist the session record. Safe to call multiple times. */
  const end = useCallback(async () => {
    gemini.disconnect();
    if (savedRef.current || startedAtRef.current === null) {
      setStatus('ended');
      return;
    }
    savedRef.current = true;
    const latencies = turnLatenciesRef.current;
    await updateProfile((profile) =>
      recordSession(profile, {
        startedAt: new Date(startedAtRef.current!).toISOString(),
        durationSec: Math.round((Date.now() - startedAtRef.current!) / 1000),
        userTurns: userTurnsRef.current,
        meanLatencyMs:
          latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : null,
        tokensProduced: [...tokensProducedRef.current],
      }),
    );
    setStatus('ended');
  }, [gemini]);

  // Persist whatever happened if the screen unmounts mid-session.
  useEffect(() => {
    return () => {
      if (startedAtRef.current !== null && !savedRef.current) void end();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    error,
    topic,
    transcript,
    latencyMs,
    isMicOpen: gemini.isMicOpen,
    isAiSpeaking: gemini.isAiSpeaking,
    hasApiKey: gemini.hasApiKey,
    activeTokens: sessionTokensRef.current,
    start,
    toggleMic,
    sendText,
    translateWord,
    end,
  };
}
