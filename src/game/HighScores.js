const STORAGE_KEY = 'flame_alchemist_scores_v1';
const MAX_PER_MODE = 10;

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { timed: [], endless: [] };
    const parsed = JSON.parse(raw);
    return {
      timed: Array.isArray(parsed.timed) ? parsed.timed : [],
      endless: Array.isArray(parsed.endless) ? parsed.endless : []
    };
  } catch {
    return { timed: [], endless: [] };
  }
}

function saveAll(all) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function computeScore({ kills, survivedMs, mode }) {
  const survivedSec = Math.floor(survivedMs / 1000);
  if (mode === 'endless') {
    return kills * 100 + survivedSec;
  }
  return kills * 100 + Math.max(0, survivedSec);
}

export function getScores(mode) {
  const all = loadAll();
  return all[mode] || [];
}

export function getAllScores() {
  return loadAll();
}

export function submitScore(entry) {
  const mode = entry.mode === 'endless' ? 'endless' : 'timed';
  const all = loadAll();
  const list = all[mode] || [];
  const score = computeScore(entry);
  const record = {
    score,
    kills: entry.kills,
    survivedMs: entry.survivedMs,
    mode,
    character: entry.character,
    cleared: !!entry.cleared,
    date: Date.now()
  };
  list.push(record);
  list.sort((a, b) => b.score - a.score || b.kills - a.kills);
  const trimmed = list.slice(0, MAX_PER_MODE);
  all[mode] = trimmed;
  saveAll(all);
  const rank = trimmed.findIndex((r) => r === record);
  return {
    record,
    rank: rank === -1 ? null : rank + 1,
    isNewBest: rank === 0,
    inTop: rank !== -1
  };
}

export function clearScores() {
  saveAll({ timed: [], endless: [] });
}

export function formatSurvivedMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}
