export const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

export const DIFFICULTY_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export const DEFAULT_SURVIVAL_SETTINGS = {
  startingLives: 3,
  timerSeconds: 10,
  pointsPerCorrect: 10,
  autoDifficultyScaling: true,
  lockedDifficulty: 'easy',
  difficultyRampInterval: 5,
  firstStreakMilestone: 3,
  firstStreakReward: 20,
  secondStreakMilestone: 5,
  secondStreakReward: 50,
  hintsEnabled: true,
  maxSessionTimeSeconds: 0,
  gentleStop: false,
  timeoutsCountWrong: true,
  showTimer: true,
};

export function clampNumber(value, minimum, maximum, fallback) {
  const parsedValue = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsedValue));
}

export function normalizeSurvivalSettings(settings) {
  const firstMilestone = clampNumber(settings.firstStreakMilestone, 1, 99, DEFAULT_SURVIVAL_SETTINGS.firstStreakMilestone);
  const secondMilestone = clampNumber(
    settings.secondStreakMilestone,
    firstMilestone,
    199,
    Math.max(firstMilestone, DEFAULT_SURVIVAL_SETTINGS.secondStreakMilestone),
  );

  return {
    startingLives: clampNumber(settings.startingLives, 1, 9, DEFAULT_SURVIVAL_SETTINGS.startingLives),
    timerSeconds: clampNumber(settings.timerSeconds, 3, 60, DEFAULT_SURVIVAL_SETTINGS.timerSeconds),
    pointsPerCorrect: clampNumber(settings.pointsPerCorrect, 1, 500, DEFAULT_SURVIVAL_SETTINGS.pointsPerCorrect),
    autoDifficultyScaling: Boolean(settings.autoDifficultyScaling),
    lockedDifficulty: DIFFICULTY_ORDER.includes(settings.lockedDifficulty) ? settings.lockedDifficulty : DEFAULT_SURVIVAL_SETTINGS.lockedDifficulty,
    difficultyRampInterval: clampNumber(settings.difficultyRampInterval, 1, 50, DEFAULT_SURVIVAL_SETTINGS.difficultyRampInterval),
    firstStreakMilestone: firstMilestone,
    firstStreakReward: clampNumber(settings.firstStreakReward, 0, 500, DEFAULT_SURVIVAL_SETTINGS.firstStreakReward),
    secondStreakMilestone: secondMilestone,
    secondStreakReward: clampNumber(settings.secondStreakReward, 0, 1000, DEFAULT_SURVIVAL_SETTINGS.secondStreakReward),
    hintsEnabled: Boolean(settings.hintsEnabled),
    maxSessionTimeSeconds: clampNumber(settings.maxSessionTimeSeconds, 0, 3600, DEFAULT_SURVIVAL_SETTINGS.maxSessionTimeSeconds),
    gentleStop: Boolean(settings.gentleStop),
    timeoutsCountWrong: Boolean(settings.timeoutsCountWrong),
    showTimer: Boolean(settings.showTimer),
  };
}

export function getActiveDifficulty(settings, totalCorrect) {
  if (!settings.autoDifficultyScaling) {
    return settings.lockedDifficulty;
  }

  const rampInterval = Math.max(1, settings.difficultyRampInterval);

  if (totalCorrect >= rampInterval * 2) {
    return 'hard';
  }

  if (totalCorrect >= rampInterval) {
    return 'medium';
  }

  return 'easy';
}

export function evaluateStreakRewards(streak, settings) {
  const rewards = [];

  if (settings.firstStreakMilestone > 0 && streak > 0 && streak % settings.firstStreakMilestone === 0) {
    rewards.push({
      points: settings.firstStreakReward,
      message: `Streak Bonus! +${settings.firstStreakReward}`,
    });
  }

  if (settings.secondStreakMilestone > 0 && streak > 0 && streak % settings.secondStreakMilestone === 0) {
    rewards.push({
      points: settings.secondStreakReward,
      message: `Hot Streak! +${settings.secondStreakReward}`,
    });
  }

  return {
    totalReward: rewards.reduce((sum, reward) => sum + reward.points, 0),
    rewards,
  };
}

export function formatSeconds(totalSeconds) {
  const safeTotal = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeTotal / 60);
  const seconds = safeTotal % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
