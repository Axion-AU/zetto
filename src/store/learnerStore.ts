import { useSyncExternalStore } from 'react';

import { createProfile, type LearnerProfile } from '@/domain/learner';
import { storage } from '@/utils/storage';

const STORAGE_KEY = 'zetto.learner.v1';

let profile: LearnerProfile | null = null;
let hydration: Promise<LearnerProfile> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function hydrate(): Promise<LearnerProfile> {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LearnerProfile;
      if (parsed.version === 1) return parsed;
    }
  } catch {
    // Corrupt or unreadable state — start fresh rather than crash.
  }
  return createProfile();
}

/** Load (once) and return the persisted learner profile. */
export function loadProfile(): Promise<LearnerProfile> {
  if (profile) return Promise.resolve(profile);
  hydration ??= hydrate().then((loaded) => {
    profile = loaded;
    emit();
    return loaded;
  });
  return hydration;
}

/**
 * Apply a mutation to the profile and persist it. The mutator receives the
 * live profile object (domain functions mutate in place).
 */
export async function updateProfile(
  mutate: (profile: LearnerProfile) => void,
): Promise<LearnerProfile> {
  const current = await loadProfile();
  mutate(current);
  // Replace the reference so useSyncExternalStore sees a new snapshot.
  profile = { ...current };
  emit();
  await storage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

/** Wipe local learner data (sign-out of a local/guest profile). */
export async function resetProfile(): Promise<void> {
  profile = createProfile();
  hydration = Promise.resolve(profile);
  emit();
  await storage.removeItem(STORAGE_KEY);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * React hook for the learner profile. Returns null until hydrated from
 * storage (and always null during static rendering).
 */
export function useLearnerProfile(): LearnerProfile | null {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => profile,
    () => null,
  );
  if (!snapshot && !hydration && typeof window !== 'undefined') {
    void loadProfile();
  }
  return snapshot;
}
