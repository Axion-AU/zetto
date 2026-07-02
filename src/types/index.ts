export type Speaker = 'user' | 'ai';

export interface TranscriptWord {
  id: string;
  surface: string;
  /** Hiragana reading (shown on first Kanji encounter only). */
  furigana?: string;
  /** Whether this word contains a deliberate Socratic error. */
  isError?: boolean;
}

export interface TranscriptEntry {
  id: string;
  speaker: Speaker;
  words: TranscriptWord[];
  /** Shown below the sentence when the user taps a word for JIT translation. */
  translation?: string;
  timestamp: string;
}

export type SessionState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface SkillToken {
  surface: string;
  reading: string;
  /** 1 = Cloze, 2 = Semantic, 3 = Roleplay */
  tier: 1 | 2 | 3;
  retrievalLatencies: number[];
  struggleCount: number;
}
