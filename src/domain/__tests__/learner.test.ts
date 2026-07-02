import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyAudit,
  beginSession,
  createProfile,
  currentStreak,
  masteredCount,
  pickTopic,
  recordProduction,
  recordSession,
  recordStruggle,
  selectSessionTokens,
  stageProgress,
} from '../learner.ts';
import { buildSystemPrompt } from '../prompt.ts';
import { TOKEN_BANK, findBankToken } from '../tokens.ts';

function profileWithTokens(count = 8) {
  const profile = createProfile();
  const tokens = selectSessionTokens(profile, count);
  return { profile, tokens };
}

describe('token selection', () => {
  it('introduces new tokens for a fresh profile', () => {
    const { profile, tokens } = profileWithTokens();
    assert.equal(tokens.length, 8);
    assert.equal(Object.keys(profile.tokens).length, 8);
    // Fresh profiles draw from crawl-stage vocabulary in teaching order.
    assert.equal(tokens[0].surface, TOKEN_BANK[0].surface);
  });

  it('prioritizes struggling tokens on later sessions', () => {
    const { profile } = profileWithTokens();
    recordStruggle(profile, 'ありがとうございます');
    recordStruggle(profile, 'ありがとうございます');
    const next = selectSessionTokens(profile, 4);
    assert.equal(next[0].surface, 'ありがとうございます');
  });

  it('respects newTokenRatio when mixing new and familiar', () => {
    const { profile } = profileWithTokens();
    profile.newTokenRatio = 0.5;
    const next = selectSessionTokens(profile, 8);
    const fresh = next.filter((t) => t.productions === 0 && t.struggleCount === 0);
    assert.ok(fresh.length >= 4, `expected >=4 new tokens, got ${fresh.length}`);
  });
});

describe('tier progression', () => {
  it('advances after 3 fast productions', () => {
    const { profile, tokens } = profileWithTokens();
    const surface = tokens[0].surface;
    for (let i = 0; i < 3; i++) recordProduction(profile, surface, 1500);
    assert.equal(profile.tokens[surface].tier, 2);
    assert.equal(profile.tokens[surface].successesAtTier, 0);
  });

  it('slow productions do not advance the tier', () => {
    const { profile, tokens } = profileWithTokens();
    const surface = tokens[0].surface;
    for (let i = 0; i < 5; i++) recordProduction(profile, surface, 4000);
    assert.equal(profile.tokens[surface].tier, 1);
  });

  it('blocked productions (>5s) count as struggles', () => {
    const { profile, tokens } = profileWithTokens();
    const surface = tokens[0].surface;
    recordProduction(profile, surface, 6000);
    assert.equal(profile.tokens[surface].struggleCount, 1);
  });

  it('regresses a tier after more than 3 struggles in one session', () => {
    const { profile, tokens } = profileWithTokens();
    const surface = tokens[0].surface;
    for (let i = 0; i < 3; i++) recordProduction(profile, surface, 1000);
    assert.equal(profile.tokens[surface].tier, 2);
    for (let i = 0; i < 4; i++) recordStruggle(profile, surface);
    assert.equal(profile.tokens[surface].tier, 1);
  });

  it('session struggles reset at session start', () => {
    const { profile, tokens } = profileWithTokens();
    const surface = tokens[0].surface;
    for (let i = 0; i < 3; i++) recordStruggle(profile, surface);
    beginSession(profile);
    assert.equal(profile.tokens[surface].sessionStruggles, 0);
    assert.equal(profile.tokens[surface].struggleCount, 3); // lifetime survives
  });
});

describe('stage progression', () => {
  it('advances crawl → walk after 15 mastered tokens', () => {
    const profile = createProfile();
    const tokens = selectSessionTokens(profile, 15);
    for (const token of tokens) {
      // Drive to tier 3 with fast productions (6 needed for mastery).
      for (let i = 0; i < 9; i++) recordProduction(profile, token.surface, 1000);
    }
    assert.equal(masteredCount(profile), 15);
    assert.equal(stageProgress(profile), 1);
    recordSession(profile, {
      startedAt: new Date().toISOString(),
      durationSec: 300,
      userTurns: 10,
      meanLatencyMs: 1000,
      tokensProduced: tokens.map((t) => t.surface),
    });
    assert.equal(profile.stage, 'walk');
  });
});

describe('streak', () => {
  const day = (offset: number) => {
    const d = new Date('2026-07-02T12:00:00');
    d.setDate(d.getDate() + offset);
    return d;
  };
  const session = (offset: number) => ({
    startedAt: day(offset).toISOString(),
    durationSec: 60,
    userTurns: 5,
    meanLatencyMs: 2000,
    tokensProduced: [],
  });

  it('counts consecutive days ending today', () => {
    const profile = createProfile();
    for (const offset of [-2, -1, 0]) recordSession(profile, session(offset));
    assert.equal(currentStreak(profile, day(0)), 3);
  });

  it('survives when today has no session yet', () => {
    const profile = createProfile();
    for (const offset of [-2, -1]) recordSession(profile, session(offset));
    assert.equal(currentStreak(profile, day(0)), 2);
  });

  it('breaks after a missed day', () => {
    const profile = createProfile();
    for (const offset of [-4, -3]) recordSession(profile, session(offset));
    assert.equal(currentStreak(profile, day(0)), 0);
  });
});

describe('weekly audit calibration', () => {
  it('raises new-token ratio when the week felt too easy', () => {
    const profile = createProfile();
    applyAudit(profile, 3);
    assert.equal(profile.newTokenRatio, 0.35);
  });

  it('lowers it when overwhelming, clamped at 0.1', () => {
    const profile = createProfile();
    for (let i = 0; i < 5; i++) applyAudit(profile, 10);
    assert.equal(profile.newTokenRatio, 0.1);
  });

  it('keeps it steady in the target zone and records the audit', () => {
    const profile = createProfile();
    applyAudit(profile, 5);
    assert.equal(profile.newTokenRatio, 0.3);
    assert.equal(profile.audits.length, 1);
    assert.equal(profile.audits[0].rating, 5);
  });
});

describe('system prompt', () => {
  it('injects stage rules, topic, and active tokens', () => {
    const { profile, tokens } = profileWithTokens(4);
    const topic = pickTopic(profile);
    const prompt = buildSystemPrompt(profile, { topic, activeTokens: tokens });
    assert.match(prompt, /Stage: CRAWL/);
    assert.ok(prompt.includes(topic.title));
    assert.ok(prompt.includes(tokens[0].surface));
    assert.ok(!prompt.includes('WEEKLY AUDIT'));
  });

  it('switches to coaching persona for weekly audits', () => {
    const { profile, tokens } = profileWithTokens(4);
    const prompt = buildSystemPrompt(profile, {
      topic: pickTopic(profile),
      activeTokens: tokens,
      weeklyAudit: true,
    });
    assert.match(prompt, /WEEKLY AUDIT SESSION/);
  });
});

describe('token bank', () => {
  it('looks up bank tokens by surface for JIT translation', () => {
    const token = findBankToken('駅');
    assert.equal(token?.reading, 'えき');
    assert.equal(token?.translation, 'station');
  });
});
