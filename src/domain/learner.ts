/**
 * Learner model: the skill map, tier/stage progression, streaks, and weekly
 * calibration. Pure functions over a serializable profile — no React Native
 * imports — so everything here runs under plain Node for unit tests.
 *
 * Progression rules follow docs/SYSTEM_PROMPT.md:
 * - A token advances a production tier after 3 productions at the current
 *   tier with latency under 3 seconds.
 * - A token regresses a tier when its struggle count exceeds 3 in a single
 *   session (JIT translation taps and blocked responses both count).
 */

import {
  type BankToken,
  type Stage,
  type SessionTopic,
  stageIndex,
  tokensForStage,
  topicsForStage,
} from './tokens.ts';

export type Tier = 1 | 2 | 3; // 1 = Cloze, 2 = Semantic, 3 = Roleplay

export const FAST_LATENCY_MS = 3000; // under this counts toward advancement
export const BLOCKED_LATENCY_MS = 5000; // over this counts as a struggle
const ADVANCE_SUCCESSES = 3;
const REGRESS_SESSION_STRUGGLES = 3;
const LATENCY_WINDOW = 20;
const MAX_SESSION_RECORDS = 100;

/** Tokens mastered (tier 3 + enough productions) required to leave a stage. */
const STAGE_ADVANCE_THRESHOLD: Record<Stage, number | null> = {
  crawl: 15,
  walk: 30,
  run: 45,
  fly: null, // terminal stage
};

export interface TokenState {
  surface: string;
  reading: string;
  translation: string;
  tier: Tier;
  /** Consecutive fast productions at the current tier. */
  successesAtTier: number;
  /** Lifetime struggle count (JIT taps + blocked responses). */
  struggleCount: number;
  /** Struggles in the current session — drives tier regression. */
  sessionStruggles: number;
  /** Total successful productions across all tiers. */
  productions: number;
  /** Rolling window of production latencies (ms). */
  latencies: number[];
}

export interface SessionRecord {
  id: string;
  startedAt: string; // ISO datetime
  durationSec: number;
  userTurns: number;
  meanLatencyMs: number | null;
  tokensProduced: string[];
}

export interface AuditRecord {
  date: string; // ISO datetime
  rating: number; // 1–10 effort self-rating
  newTokenRatio: number; // ratio after applying this audit
}

export interface LearnerProfile {
  version: 1;
  stage: Stage;
  tokens: Record<string, TokenState>;
  sessions: SessionRecord[];
  audits: AuditRecord[];
  /** Share of session tokens drawn from unseen vocabulary (0.1–0.5). */
  newTokenRatio: number;
  topicRotation: number;
}

export function createProfile(): LearnerProfile {
  return {
    version: 1,
    stage: 'crawl',
    tokens: {},
    sessions: [],
    audits: [],
    newTokenRatio: 0.3,
    topicRotation: 0,
  };
}

function newTokenState(bank: BankToken): TokenState {
  return {
    surface: bank.surface,
    reading: bank.reading,
    translation: bank.translation,
    tier: 1,
    successesAtTier: 0,
    struggleCount: 0,
    sessionStruggles: 0,
    productions: 0,
    latencies: [],
  };
}

function ensureToken(profile: LearnerProfile, bank: BankToken): TokenState {
  let token = profile.tokens[bank.surface];
  if (!token) {
    token = newTokenState(bank);
    profile.tokens[bank.surface] = token;
  }
  return token;
}

export function meanLatency(token: TokenState): number | null {
  if (token.latencies.length === 0) return null;
  return token.latencies.reduce((a, b) => a + b, 0) / token.latencies.length;
}

/**
 * Record a successful production of a token. Fast productions advance the
 * tier; blocked (very slow) ones count as struggles instead.
 */
export function recordProduction(
  profile: LearnerProfile,
  surface: string,
  latencyMs: number | null,
): void {
  const token = profile.tokens[surface];
  if (!token) return;

  token.productions += 1;
  if (latencyMs !== null) {
    token.latencies.push(latencyMs);
    if (token.latencies.length > LATENCY_WINDOW) token.latencies.shift();
  }

  if (latencyMs !== null && latencyMs > BLOCKED_LATENCY_MS) {
    recordStruggle(profile, surface);
    return;
  }

  if (latencyMs !== null && latencyMs < FAST_LATENCY_MS) {
    token.successesAtTier += 1;
    if (token.successesAtTier >= ADVANCE_SUCCESSES && token.tier < 3) {
      token.tier = (token.tier + 1) as Tier;
      token.successesAtTier = 0;
    }
  }
}

/** Record a struggle (JIT translation tap or blocked response). */
export function recordStruggle(profile: LearnerProfile, surface: string): void {
  const token = profile.tokens[surface];
  if (!token) return;

  token.struggleCount += 1;
  token.sessionStruggles += 1;
  token.successesAtTier = 0;

  if (token.sessionStruggles > REGRESS_SESSION_STRUGGLES && token.tier > 1) {
    token.tier = (token.tier - 1) as Tier;
    token.sessionStruggles = 0;
  }
}

/** Reset per-session counters. Call at session start. */
export function beginSession(profile: LearnerProfile): void {
  for (const token of Object.values(profile.tokens)) {
    token.sessionStruggles = 0;
  }
}

export function isMastered(token: TokenState): boolean {
  return token.tier === 3 && token.productions >= 6;
}

export function masteredCount(profile: LearnerProfile): number {
  return Object.values(profile.tokens).filter(isMastered).length;
}

/** Fraction of the way to the next stage (1 when at threshold / terminal). */
export function stageProgress(profile: LearnerProfile): number {
  const threshold = STAGE_ADVANCE_THRESHOLD[profile.stage];
  if (threshold === null) return 1;
  return Math.min(1, masteredCount(profile) / threshold);
}

function maybeAdvanceStage(profile: LearnerProfile): void {
  const threshold = STAGE_ADVANCE_THRESHOLD[profile.stage];
  if (threshold !== null && masteredCount(profile) >= threshold) {
    const order: Stage[] = ['crawl', 'walk', 'run', 'fly'];
    profile.stage = order[stageIndex(profile.stage) + 1];
  }
}

/** Persist a finished session and re-evaluate stage progression. */
export function recordSession(
  profile: LearnerProfile,
  record: Omit<SessionRecord, 'id'>,
): void {
  profile.sessions.push({ id: `s-${Date.now()}`, ...record });
  if (profile.sessions.length > MAX_SESSION_RECORDS) {
    profile.sessions.splice(0, profile.sessions.length - MAX_SESSION_RECORDS);
  }
  profile.topicRotation += 1;
  maybeAdvanceStage(profile);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Consecutive practice days ending today or yesterday. */
export function currentStreak(profile: LearnerProfile, now: Date = new Date()): number {
  const practiceDays = new Set(
    profile.sessions.map((s) => dayKey(new Date(s.startedAt))),
  );
  if (practiceDays.size === 0) return 0;

  const cursor = new Date(now);
  // A streak survives until the end of today, so start from today and allow
  // the first missing day to be today itself.
  if (!practiceDays.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!practiceDays.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (practiceDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Weekly audit: the effort rating calibrates the new-vs-familiar mix.
 * Target zone is 5–6 ("just right" / "slightly hard").
 */
export function applyAudit(
  profile: LearnerProfile,
  rating: number,
  now: Date = new Date(),
): void {
  let delta = 0;
  if (rating <= 4) delta = 0.05; // too easy → more new material
  else if (rating >= 9) delta = -0.1; // overwhelming → sharply less
  else if (rating >= 7) delta = -0.05; // hard → slightly less

  profile.newTokenRatio = Math.min(0.5, Math.max(0.1, profile.newTokenRatio + delta));
  profile.audits.push({
    date: now.toISOString(),
    rating,
    newTokenRatio: profile.newTokenRatio,
  });
}

/**
 * Pick the working set for a session: struggling/stale familiar tokens plus
 * new introductions per `newTokenRatio`. Registers new tokens on the profile.
 */
export function selectSessionTokens(
  profile: LearnerProfile,
  count = 8,
): TokenState[] {
  const known = Object.values(profile.tokens);
  const knownSurfaces = new Set(known.map((t) => t.surface));
  const unseen = tokensForStage(profile.stage).filter(
    (t) => !knownSurfaces.has(t.surface),
  );

  const newCount = Math.min(
    unseen.length,
    Math.max(known.length === 0 ? count : 1, Math.round(count * profile.newTokenRatio)),
  );

  // Familiar tokens: highest struggle first, then slowest, then least practiced.
  const familiar = [...known]
    .filter((t) => !isMastered(t))
    .sort(
      (a, b) =>
        b.struggleCount - a.struggleCount ||
        (meanLatency(b) ?? 0) - (meanLatency(a) ?? 0) ||
        a.productions - b.productions,
    )
    .slice(0, count - newCount);

  const introduced = unseen
    .slice(0, Math.max(newCount, count - familiar.length))
    .map((bank) => ensureToken(profile, bank));

  return [...familiar, ...introduced].slice(0, count);
}

export function pickTopic(profile: LearnerProfile): SessionTopic {
  const topics = topicsForStage(profile.stage);
  return topics[profile.topicRotation % topics.length];
}

/** Session-level aggregates for the audit screen. */
export function sessionsInRange(
  profile: LearnerProfile,
  from: Date,
  to: Date,
): SessionRecord[] {
  return profile.sessions.filter((s) => {
    const at = new Date(s.startedAt).getTime();
    return at >= from.getTime() && at < to.getTime();
  });
}

export function meanSessionLatency(sessions: SessionRecord[]): number | null {
  const values = sessions
    .map((s) => s.meanLatencyMs)
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
