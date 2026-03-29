const BEST_SCORE_KEY = 'sprouts-survival-best-score';
const PARENT_PIN_KEY = 'sprouts-parent-pin';

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

export function resetBestScore() {
  if (typeof window === 'undefined') {
    return 0;
  }

  window.localStorage.removeItem(BEST_SCORE_KEY);
  return 0;
}

export function loadParentPin() {
  if (typeof window === 'undefined') {
    return '';
  }

  const storedPin = window.localStorage.getItem(PARENT_PIN_KEY) ?? '';
  return /^\d{4}$/.test(storedPin) ? storedPin : '';
}

export function saveParentPin(pin) {
  if (typeof window === 'undefined') {
    return '';
  }

  const normalizedPin = String(pin).trim();

  if (!/^\d{4}$/.test(normalizedPin)) {
    return '';
  }

  window.localStorage.setItem(PARENT_PIN_KEY, normalizedPin);
  return normalizedPin;
}
