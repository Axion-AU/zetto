/**
 * Seed vocabulary bank and session topics.
 *
 * Pure data — no React Native imports — so the domain layer stays
 * unit-testable under plain Node. Tokens are ordered within each stage by
 * teaching priority; `selectSessionTokens` introduces them in this order.
 */

export type Stage = 'crawl' | 'walk' | 'run' | 'fly';

export interface BankToken {
  surface: string;
  reading: string;
  translation: string;
  stage: Stage;
}

export interface SessionTopic {
  /** English header shown before audio plays (topic priming). */
  title: string;
  /** Japanese label displayed alongside. */
  ja: string;
  stage: Stage;
}

export const TOKEN_BANK: BankToken[] = [
  // ── Crawl: survival phrases, counting, basic particles ──
  { surface: 'すみません', reading: 'すみません', translation: 'excuse me / sorry', stage: 'crawl' },
  { surface: 'ありがとうございます', reading: 'ありがとうございます', translation: 'thank you (polite)', stage: 'crawl' },
  { surface: 'これをください', reading: 'これをください', translation: 'this one, please', stage: 'crawl' },
  { surface: 'お願いします', reading: 'おねがいします', translation: 'please (requesting)', stage: 'crawl' },
  { surface: 'いくらですか', reading: 'いくらですか', translation: 'how much is it?', stage: 'crawl' },
  { surface: 'はい', reading: 'はい', translation: 'yes', stage: 'crawl' },
  { surface: 'いいえ', reading: 'いいえ', translation: 'no', stage: 'crawl' },
  { surface: 'わかりません', reading: 'わかりません', translation: "I don't understand", stage: 'crawl' },
  { surface: 'もう一度', reading: 'もういちど', translation: 'one more time', stage: 'crawl' },
  { surface: '水', reading: 'みず', translation: 'water', stage: 'crawl' },
  { surface: 'ひとつ', reading: 'ひとつ', translation: 'one (general counter)', stage: 'crawl' },
  { surface: 'ふたつ', reading: 'ふたつ', translation: 'two (general counter)', stage: 'crawl' },
  { surface: 'みっつ', reading: 'みっつ', translation: 'three (general counter)', stage: 'crawl' },
  { surface: 'トイレ', reading: 'トイレ', translation: 'toilet / restroom', stage: 'crawl' },
  { surface: '駅', reading: 'えき', translation: 'station', stage: 'crawl' },
  { surface: 'どこ', reading: 'どこ', translation: 'where', stage: 'crawl' },
  { surface: 'コーヒー', reading: 'コーヒー', translation: 'coffee', stage: 'crawl' },
  { surface: 'おはようございます', reading: 'おはようございます', translation: 'good morning (polite)', stage: 'crawl' },
  { surface: 'こんばんは', reading: 'こんばんは', translation: 'good evening', stage: 'crawl' },
  { surface: '私', reading: 'わたし', translation: 'I / me', stage: 'crawl' },
  { surface: '日本語', reading: 'にほんご', translation: 'Japanese (language)', stage: 'crawl' },
  { surface: '少し', reading: 'すこし', translation: 'a little', stage: 'crawl' },
  { surface: 'メニュー', reading: 'メニュー', translation: 'menu', stage: 'crawl' },
  { surface: 'カード', reading: 'カード', translation: '(credit) card', stage: 'crawl' },
  { surface: '大丈夫', reading: 'だいじょうぶ', translation: 'okay / fine', stage: 'crawl' },

  // ── Walk: transactions, directions, time, て-form territory ──
  { surface: '切符', reading: 'きっぷ', translation: 'ticket', stage: 'walk' },
  { surface: '禁煙席', reading: 'きんえんせき', translation: 'non-smoking seat', stage: 'walk' },
  { surface: '予約', reading: 'よやく', translation: 'reservation', stage: 'walk' },
  { surface: '注文', reading: 'ちゅうもん', translation: 'order (at a restaurant)', stage: 'walk' },
  { surface: 'おすすめ', reading: 'おすすめ', translation: 'recommendation', stage: 'walk' },
  { surface: '右', reading: 'みぎ', translation: 'right (direction)', stage: 'walk' },
  { surface: '左', reading: 'ひだり', translation: 'left (direction)', stage: 'walk' },
  { surface: 'まっすぐ', reading: 'まっすぐ', translation: 'straight ahead', stage: 'walk' },
  { surface: '曲がって', reading: 'まがって', translation: 'turn (て-form)', stage: 'walk' },
  { surface: '何時', reading: 'なんじ', translation: 'what time', stage: 'walk' },
  { surface: '乗り換え', reading: 'のりかえ', translation: 'transfer (trains)', stage: 'walk' },
  { surface: '改札', reading: 'かいさつ', translation: 'ticket gate', stage: 'walk' },
  { surface: 'ホーム', reading: 'ホーム', translation: 'platform', stage: 'walk' },
  { surface: '出口', reading: 'でぐち', translation: 'exit', stage: 'walk' },
  { surface: '持ち帰り', reading: 'もちかえり', translation: 'takeaway / to go', stage: 'walk' },
  { surface: '会計', reading: 'かいけい', translation: 'bill / check', stage: 'walk' },
  { surface: '別々に', reading: 'べつべつに', translation: 'separately (paying)', stage: 'walk' },
  { surface: '荷物', reading: 'にもつ', translation: 'luggage', stage: 'walk' },
  { surface: 'チェックイン', reading: 'チェックイン', translation: 'check-in', stage: 'walk' },
  { surface: '両替', reading: 'りょうがえ', translation: 'currency exchange', stage: 'walk' },

  // ── Run: opinions, connectors, register ──
  { surface: 'と思います', reading: 'とおもいます', translation: 'I think that…', stage: 'run' },
  { surface: 'たとえば', reading: 'たとえば', translation: 'for example', stage: 'run' },
  { surface: 'でも', reading: 'でも', translation: 'but / however', stage: 'run' },
  { surface: 'だから', reading: 'だから', translation: 'so / therefore', stage: 'run' },
  { surface: 'それに', reading: 'それに', translation: 'on top of that', stage: 'run' },
  { surface: '賛成', reading: 'さんせい', translation: 'agreement / in favour', stage: 'run' },
  { surface: '反対', reading: 'はんたい', translation: 'opposition / against', stage: 'run' },
  { surface: 'かもしれない', reading: 'かもしれない', translation: 'might / maybe', stage: 'run' },
  { surface: 'はず', reading: 'はず', translation: 'should be / expected to', stage: 'run' },
  { surface: '気がする', reading: 'きがする', translation: 'have a feeling that', stage: 'run' },
  { surface: '最近', reading: 'さいきん', translation: 'recently', stage: 'run' },
  { surface: '経験', reading: 'けいけん', translation: 'experience', stage: 'run' },

  // ── Fly: nuance, hedging, abstraction ──
  { surface: 'とは限らない', reading: 'とはかぎらない', translation: 'not necessarily the case', stage: 'fly' },
  { surface: 'にもかかわらず', reading: 'にもかかわらず', translation: 'despite / in spite of', stage: 'fly' },
  { surface: '微妙', reading: 'びみょう', translation: 'subtle / iffy', stage: 'fly' },
  { surface: '本音', reading: 'ほんね', translation: 'true feelings (vs tatemae)', stage: 'fly' },
  { surface: '建前', reading: 'たてまえ', translation: 'public stance (vs honne)', stage: 'fly' },
  { surface: '要するに', reading: 'ようするに', translation: 'in short / basically', stage: 'fly' },
];

export const SESSION_TOPICS: SessionTopic[] = [
  { title: 'Ordering at a café', ja: 'カフェで注文', stage: 'crawl' },
  { title: 'Konbini basics', ja: 'コンビニ', stage: 'crawl' },
  { title: 'Counting & prices', ja: '数と値段', stage: 'crawl' },
  { title: 'Self-introduction', ja: '自己紹介', stage: 'crawl' },
  { title: 'Transit tickets', ja: 'きっぷ', stage: 'walk' },
  { title: 'Restaurant for two', ja: 'レストランで', stage: 'walk' },
  { title: 'Asking directions', ja: '道を聞く', stage: 'walk' },
  { title: 'Hotel check-in', ja: 'チェックイン', stage: 'walk' },
  { title: 'Your day, in detail', ja: '一日について', stage: 'run' },
  { title: 'Polite disagreement', ja: '反対意見', stage: 'run' },
  { title: 'Izakaya small talk', ja: '居酒屋で', stage: 'run' },
  { title: 'Explaining a decision', ja: '決断を説明する', stage: 'fly' },
  { title: 'Honne and tatemae', ja: '本音と建前', stage: 'fly' },
];

const STAGE_ORDER: Stage[] = ['crawl', 'walk', 'run', 'fly'];

export function stageIndex(stage: Stage): number {
  return STAGE_ORDER.indexOf(stage);
}

/** Bank tokens at or below the learner's stage, in teaching order. */
export function tokensForStage(stage: Stage): BankToken[] {
  const idx = stageIndex(stage);
  return TOKEN_BANK.filter((t) => stageIndex(t.stage) <= idx);
}

export function topicsForStage(stage: Stage): SessionTopic[] {
  const atStage = SESSION_TOPICS.filter((t) => t.stage === stage);
  return atStage.length > 0 ? atStage : SESSION_TOPICS;
}

export function findBankToken(surface: string): BankToken | undefined {
  return TOKEN_BANK.find((t) => t.surface === surface);
}
