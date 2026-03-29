const BEST_SCORE_KEY = 'sprouts-survival-best-score';

export function loadBestScore() {
  if (typeof window === 'undefined') {
    return 0;
  }

  const storedValue = window.localStorage.getItem(BEST_SCORE_KEY);
  const parsedValue = Number.parseInt(storedValue ?? '0', 10);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

export function saveBestScore(score) {
  if (typeof window === 'undefined') {
    return score;
  }

  const nextScore = Math.max(0, Number.parseInt(String(score), 10) || 0);
  const currentBest = loadBestScore();

  if (nextScore > currentBest) {
    window.localStorage.setItem(BEST_SCORE_KEY, String(nextScore));
    return nextScore;
  }

  return currentBest;
}
