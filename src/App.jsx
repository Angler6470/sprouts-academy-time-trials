import { useEffect, useMemo, useRef, useState } from 'react';
import sproutsLogo from '../balance-seed.png';
import { generateQuestion } from './lib/questionGenerator';
import { loadBestScore, saveBestScore } from './lib/storage';
import {
  DEFAULT_SURVIVAL_SETTINGS,
  DIFFICULTY_LABELS,
  formatSeconds,
  getActiveDifficulty,
  normalizeSurvivalSettings,
  evaluateStreakRewards,
} from './lib/survival';

const MODE_OPTIONS = [
  {
    id: 'survival',
    title: 'Survival Mode',
    description: 'Beat the timer, protect your lives, and climb the board with streak bonuses.',
    badge: 'New',
  },
];

const FEEDBACK_TIMEOUT_MS = 2200;
const QUESTION_ADVANCE_DELAY_MS = 850;
const CHALLENGE_MODE_OPTIONS = [
  { value: 'adaptive', label: 'Adaptive', helper: 'Starts easy, shifts to medium at 5 correct, then hard at 10 correct.' },
  { value: 'easy', label: 'Locked Easy', helper: 'Keeps the whole run in gentle practice mode.' },
  { value: 'medium', label: 'Locked Medium', helper: 'Keeps the whole run in a balanced challenge range.' },
  { value: 'hard', label: 'Locked Hard', helper: 'Keeps the whole run in advanced speed-practice mode.' },
];

function createRunState(settings) {
  const normalizedSettings = normalizeSurvivalSettings(settings);
  const openingDifficulty = getActiveDifficulty(normalizedSettings, 0);
  const openingQuestion = generateQuestion(openingDifficulty, 1, []);

  return {
    status: 'playing',
    settings: normalizedSettings,
    lives: normalizedSettings.startingLives,
    score: 0,
    streak: 0,
    highestStreak: 0,
    totalCorrect: 0,
    questionNumber: 1,
    question: openingQuestion,
    recentPrompts: [openingQuestion.prompt],
    timeLeft: normalizedSettings.timerSeconds,
    sessionElapsed: 0,
    pendingStop: false,
    isTransitioning: false,
    finalReason: '',
    latestBonus: 0,
  };
}

export default function App() {
  const [selectedMode, setSelectedMode] = useState('survival');
  const [settings, setSettings] = useState(DEFAULT_SURVIVAL_SETTINGS);
  const [appPhase, setAppPhase] = useState('home');
  const [run, setRun] = useState(null);
  const [bestScore, setBestScore] = useState(() => loadBestScore());
  const [feedback, setFeedback] = useState({
    tone: 'info',
    title: 'Ready to play?',
    detail: 'Set the rules in Parent Controls, then start a survival run.',
  });
  const [showHint, setShowHint] = useState(false);

  const advanceTimeoutRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);

  const activeSettings = run?.settings ?? normalizeSurvivalSettings(settings);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) {
        window.clearTimeout(advanceTimeoutRef.current);
      }

      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!feedback?.detail) {
      return undefined;
    }

    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }

    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback((currentFeedback) => {
        if (currentFeedback.tone === 'info') {
          return currentFeedback;
        }

        return {
          tone: 'info',
          title: 'Stay focused',
          detail: 'Keep moving to build your score and protect your streak.',
        };
      });
    }, FEEDBACK_TIMEOUT_MS);

    return () => {
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [feedback]);

  useEffect(() => {
    if (appPhase !== 'playing' || !run || run.isTransitioning || run.timeLeft <= 0) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setRun((currentRun) => {
        if (!currentRun || currentRun.isTransitioning) {
          return currentRun;
        }

        return {
          ...currentRun,
          timeLeft: Math.max(0, currentRun.timeLeft - 1),
        };
      });
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [appPhase, run]);

  useEffect(() => {
    if (appPhase !== 'playing' || !run) {
      return undefined;
    }

    const sessionId = window.setTimeout(() => {
      setRun((currentRun) => {
        if (!currentRun) {
          return currentRun;
        }

        return {
          ...currentRun,
          sessionElapsed: currentRun.sessionElapsed + 1,
        };
      });
    }, 1000);

    return () => window.clearTimeout(sessionId);
  }, [appPhase, run?.sessionElapsed, run]);

  useEffect(() => {
    if (appPhase !== 'playing' || !run || run.isTransitioning || run.timeLeft !== 0) {
      return;
    }

    resolveQuestion('timeout');
  }, [appPhase, run]);

  useEffect(() => {
    if (appPhase !== 'playing' || !run) {
      return;
    }

    const maxSessionTime = run.settings.maxSessionTimeSeconds;

    if (maxSessionTime <= 0 || run.sessionElapsed < maxSessionTime) {
      return;
    }

    if (run.settings.gentleStop) {
      if (!run.pendingStop) {
        setRun((currentRun) => {
          if (!currentRun) {
            return currentRun;
          }

          return {
            ...currentRun,
            pendingStop: true,
          };
        });
        setFeedback({
          tone: 'bonus',
          title: 'Last round',
          detail: 'The session timer is up. Finish this question and then we will wrap up.',
        });
      }
      return;
    }

    finishRun(run, 'Session complete');
  }, [appPhase, run]);

  const currentDifficultyLabel = useMemo(() => {
    if (!run?.question?.difficulty) {
      return DIFFICULTY_LABELS[getActiveDifficulty(activeSettings, run?.totalCorrect ?? 0)];
    }

    return DIFFICULTY_LABELS[run.question.difficulty];
  }, [activeSettings, run]);

  function applyFeedback(nextFeedback) {
    setFeedback(nextFeedback);
  }

  function applySettings(nextValues) {
    setSettings((currentSettings) =>
      normalizeSurvivalSettings({
        ...currentSettings,
        ...nextValues,
      }),
    );
  }

  function updateSetting(key, rawValue) {
    applySettings({ [key]: rawValue });
  }

  function updateChallengeMode(mode) {
    if (mode === 'adaptive') {
      applySettings({
        autoDifficultyScaling: true,
      });
      return;
    }

    applySettings({
      autoDifficultyScaling: false,
      lockedDifficulty: mode,
    });
  }

  function beginRun() {
    const nextRun = createRunState(settings);
    setRun(nextRun);
    setAppPhase('playing');
    setShowHint(false);
    applyFeedback({
      tone: 'info',
      title: 'Survival started',
      detail: 'Answer before the timer runs out and keep your streak alive.',
    });
  }

  function returnHome() {
    if (advanceTimeoutRef.current) {
      window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }

    setRun(null);
    setAppPhase('home');
    setShowHint(false);
    applyFeedback({
      tone: 'info',
      title: 'Ready to play?',
      detail: 'Adjust the parent controls and start another survival session whenever you like.',
    });
  }

  function finishRun(finalRun, reason) {
    if (advanceTimeoutRef.current) {
      window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }

    const updatedBestScore = saveBestScore(finalRun.score);
    setBestScore(updatedBestScore);
    setRun({
      ...finalRun,
      status: 'gameover',
      isTransitioning: false,
      finalReason: reason,
    });
    setAppPhase('gameover');
    setShowHint(false);
    applyFeedback({
      tone: updatedBestScore === finalRun.score && finalRun.score > 0 ? 'bonus' : 'danger',
      title: updatedBestScore === finalRun.score && finalRun.score > 0 ? 'New best score' : 'Game over',
      detail:
        updatedBestScore === finalRun.score && finalRun.score > 0
          ? `You finished with ${finalRun.score} points.`
          : 'Take a breather, tweak the settings, and jump back in.',
    });
  }

  function advanceToNextQuestion(baseRun) {
    if (baseRun.pendingStop) {
      finishRun(baseRun, 'Session complete');
      return;
    }

    const nextQuestionNumber = baseRun.questionNumber + 1;
    const nextDifficulty = getActiveDifficulty(baseRun.settings, baseRun.totalCorrect);
    const nextQuestion = generateQuestion(nextDifficulty, nextQuestionNumber, baseRun.recentPrompts);

    setRun({
      ...baseRun,
      questionNumber: nextQuestionNumber,
      question: nextQuestion,
      recentPrompts: [...baseRun.recentPrompts, nextQuestion.prompt].slice(-8),
      timeLeft: baseRun.settings.timerSeconds,
      isTransitioning: false,
      latestBonus: 0,
    });
    setShowHint(false);
  }

  function resolveQuestion(outcome, selectedChoice = null) {
    if (!run || run.isTransitioning) {
      return;
    }

    const currentRun = {
      ...run,
      isTransitioning: true,
    };

    setRun(currentRun);

    let nextRun = currentRun;
    let endReason = '';

    if (outcome === 'correct') {
      const nextStreak = currentRun.streak + 1;
      const rewardResult = evaluateStreakRewards(nextStreak, currentRun.settings);
      const earnedPoints = currentRun.settings.pointsPerCorrect + rewardResult.totalReward;
      const rewardCopy = rewardResult.rewards.map((reward) => reward.message).join(' ');

      nextRun = {
        ...currentRun,
        score: currentRun.score + earnedPoints,
        streak: nextStreak,
        highestStreak: Math.max(currentRun.highestStreak, nextStreak),
        totalCorrect: currentRun.totalCorrect + 1,
        latestBonus: rewardResult.totalReward,
      };

      applyFeedback({
        tone: rewardResult.totalReward > 0 ? 'bonus' : 'success',
        title: rewardResult.totalReward > 0 ? rewardCopy : 'Correct answer',
        detail:
          rewardResult.totalReward > 0
            ? `Nice work. You earned ${currentRun.settings.pointsPerCorrect} base points and ${rewardResult.totalReward} bonus points.`
            : `You earned ${currentRun.settings.pointsPerCorrect} points. Keep the streak going.`,
      });
    }

    if (outcome === 'wrong') {
      const livesRemaining = currentRun.lives - 1;

      nextRun = {
        ...currentRun,
        lives: Math.max(0, livesRemaining),
        streak: 0,
        latestBonus: 0,
      };

      endReason = livesRemaining <= 0 ? 'Out of lives' : '';
      applyFeedback({
        tone: 'danger',
        title: 'Not this one',
        detail: selectedChoice === null ? 'A wrong answer cost one life.' : `${selectedChoice} was not correct. One life lost.`,
      });
    }

    if (outcome === 'timeout') {
      if (currentRun.settings.timeoutsCountWrong) {
        const livesRemaining = currentRun.lives - 1;

        nextRun = {
          ...currentRun,
          lives: Math.max(0, livesRemaining),
          streak: 0,
          latestBonus: 0,
        };

        endReason = livesRemaining <= 0 ? 'Out of lives' : '';
        applyFeedback({
          tone: 'danger',
          title: 'Time is up',
          detail: 'That timeout counted as a wrong answer and cost one life.',
        });
      } else {
        nextRun = {
          ...currentRun,
          latestBonus: 0,
        };

        applyFeedback({
          tone: 'info',
          title: 'Time is up',
          detail: 'No life lost. A fresh question is on the way.',
        });
      }
    }

    setRun(nextRun);

    if (advanceTimeoutRef.current) {
      window.clearTimeout(advanceTimeoutRef.current);
    }

    advanceTimeoutRef.current = window.setTimeout(() => {
      if (endReason) {
        finishRun(
          {
            ...nextRun,
            isTransitioning: false,
          },
          endReason,
        );
        return;
      }

      advanceToNextQuestion({
        ...nextRun,
        isTransitioning: false,
      });
    }, QUESTION_ADVANCE_DELAY_MS);
  }

  return (
    <div className="app-shell">
      <div className="app-backdrop" aria-hidden="true" />
      <main className="app-main">
        <header className="hero-card">
          <div className="hero-copy">
            <div className="hero-brand">
              <img className="hero-logo" src={sproutsLogo} alt="Sprouts mascot" />
              <div className="hero-brand-copy">
                <span className="eyebrow">Sprouts Academy</span>
                <h1>Sprouts Academy Time Trials</h1>
              </div>
            </div>
          </div>
          <div className="hero-preview">
            <div className="preview-badge">Best Score: {bestScore}</div>
          </div>
        </header>

        {appPhase === 'home' && (
          <HomeScreen
            selectedMode={selectedMode}
            setSelectedMode={setSelectedMode}
            settings={settings}
            onSettingChange={updateSetting}
            onChallengeModeChange={updateChallengeMode}
            onStart={beginRun}
            bestScore={bestScore}
            feedback={feedback}
          />
        )}

        {appPhase === 'playing' && run && (
          <GameScreen
            run={run}
            bestScore={bestScore}
            feedback={feedback}
            showHint={showHint}
            onToggleHint={() => setShowHint((currentValue) => !currentValue)}
            onAnswer={(choice) => resolveQuestion(choice === run.question.answer ? 'correct' : 'wrong', choice)}
            onEndRun={() => finishRun(run, 'Run ended early')}
            currentDifficultyLabel={currentDifficultyLabel}
          />
        )}

        {appPhase === 'gameover' && run && (
          <GameOverScreen
            run={run}
            bestScore={bestScore}
            onRestart={beginRun}
            onReturnHome={returnHome}
          />
        )}
      </main>
    </div>
  );
}

function HomeScreen({ selectedMode, setSelectedMode, settings, onSettingChange, onChallengeModeChange, onStart, bestScore, feedback }) {
  const normalizedSettings = normalizeSurvivalSettings(settings);
  const nextDifficulty = DIFFICULTY_LABELS[getActiveDifficulty(normalizedSettings, 0)];
  const challengeMode = normalizedSettings.autoDifficultyScaling ? 'adaptive' : normalizedSettings.lockedDifficulty;

  return (
    <section className="screen-grid">
      <div className="panel-stack">
        <section className="panel-card compact-modes-panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Game Modes</span>
              <h2>Choose a mode</h2>
            </div>
          </div>
          <div className="mode-grid">
            {MODE_OPTIONS.map((mode) => (
              <div key={mode.id} className={`mode-card compact-mode-card ${selectedMode === mode.id ? 'is-active' : ''}`}>
                <span className="mode-badge">{mode.badge}</span>
                <div className="mode-copy">
                  <strong>{mode.title}</strong>
                  <p>{mode.description}</p>
                </div>
                <button type="button" className="primary-button slim-button" onClick={() => { setSelectedMode(mode.id); onStart(); }}>
                  Start Survival Mode
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="panel-card compact-panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Session Preview</span>
              <h2>Ready for launch</h2>
            </div>
          </div>
          <div className="summary-grid">
            <SummaryTile label="Starting lives" value={normalizedSettings.startingLives} />
            <SummaryTile label="Timer" value={`${normalizedSettings.timerSeconds}s`} />
            <SummaryTile label="Opening difficulty" value={nextDifficulty} />
            <SummaryTile label="Best score" value={bestScore} />
          </div>
          <div className={`feedback-banner tone-${feedback.tone}`}>
            <strong>{feedback.title}</strong>
            <span>{feedback.detail}</span>
          </div>
        </section>
      </div>

      <section className="panel-card settings-panel">
        <div className="panel-header sticky-header">
          <div>
            <span className="section-kicker">Parent Controls</span>
            <h2>Quick setup</h2>
          </div>
          <p>Only the most useful controls are visible here. Scoring, streak bonuses, timeout rules, and ramp tuning stay optimized in the background.</p>
        </div>

        <div className="settings-sections">
          <SettingsSection title="Core Controls" description="The key options parents usually need, without the extra clutter.">
            <NumberSetting
              id="startingLives"
              label="Starting lives"
              helper="Choose how many mistakes a player can make before the run ends."
              value={settings.startingLives}
              min={1}
              max={9}
              onChange={(value) => onSettingChange('startingLives', value)}
            />
            <NumberSetting
              id="timerSeconds"
              label="Timer per question"
              helper="Set the countdown length for each question."
              value={settings.timerSeconds}
              min={3}
              max={60}
              suffix="seconds"
              onChange={(value) => onSettingChange('timerSeconds', value)}
            />
            <ChoiceToggleSetting
              id="challengeMode"
              label="Challenge level"
              helper={CHALLENGE_MODE_OPTIONS.find((option) => option.value === challengeMode)?.helper}
              value={challengeMode}
              options={CHALLENGE_MODE_OPTIONS.map(({ value, label }) => ({ value, label }))}
              onChange={onChallengeModeChange}
            />
          </SettingsSection>

          <SettingsSection title="Helpful Supports" description="Small comfort settings that keep the game readable and friendly.">
            <ToggleSetting
              id="hintsEnabled"
              label="Enable hints"
              helper="Players can reveal a lightweight hint on the question card."
              checked={settings.hintsEnabled}
              onChange={(checked) => onSettingChange('hintsEnabled', checked)}
            />
            <ToggleSetting
              id="showTimer"
              label="Show visual timer"
              helper="Keep the countdown visible or let it run quietly in the background."
              checked={settings.showTimer}
              onChange={(checked) => onSettingChange('showTimer', checked)}
            />
          </SettingsSection>

          <div className="background-note">
            <strong>Behind-the-scenes tuning</strong>
            <span>
              Survival keeps 10 points per correct answer, timeout penalties on, streak bonuses at 3 and 5, and adaptive mode ramps from easy to medium to hard every 5 correct answers.
            </span>
          </div>
        </div>
      </section>
    </section>
  );
}

function GameScreen({ run, bestScore, feedback, showHint, onToggleHint, onAnswer, onEndRun, currentDifficultyLabel }) {
  const question = run.question;
  const sessionRemaining =
    run.settings.maxSessionTimeSeconds > 0 ? Math.max(0, run.settings.maxSessionTimeSeconds - run.sessionElapsed) : null;

  return (
    <section className="game-layout">
      <div className="top-bar-card">
        <div className="stats-grid">
          <StatPill label="Lives" value={run.lives} accent="danger" />
          <StatPill label="Score" value={run.score} accent="success" />
          <StatPill label="Streak" value={run.streak} accent="bonus" />
          <StatPill label="Correct" value={run.totalCorrect} accent="neutral" />
          <StatPill label="Difficulty" value={currentDifficultyLabel} accent="neutral" />
          {run.settings.showTimer && <StatPill label="Timer" value={`${run.timeLeft}s`} accent={run.timeLeft <= 3 ? 'danger' : 'neutral'} />}
          {sessionRemaining !== null && <StatPill label="Session left" value={formatSeconds(sessionRemaining)} accent="neutral" />}
          <StatPill label="Best" value={bestScore} accent="neutral" />
        </div>
      </div>

      <div className="question-card">
        <div className="question-meta-row">
          <span className="question-count">Question {run.questionNumber}</span>
          {run.pendingStop && <span className="pending-stop-pill">Final question</span>}
        </div>
        <h2>{question.prompt}</h2>
        <p className="question-support">Tap the best answer before the countdown ends.</p>
        {run.settings.hintsEnabled && (
          <div className="hint-block">
            <button type="button" className="secondary-button" onClick={onToggleHint}>
              {showHint ? 'Hide hint' : 'Show hint'}
            </button>
            {showHint && <p className="hint-copy">{question.hint}</p>}
          </div>
        )}
      </div>

      <div className="answers-card">
        <div className="answers-grid">
          {question.choices.map((choice) => (
            <button
              key={`${question.id}-${choice}`}
              type="button"
              className="answer-button"
              onClick={() => onAnswer(choice)}
              disabled={run.isTransitioning}
            >
              {choice}
            </button>
          ))}
        </div>
      </div>

      {run.latestBonus > 0 && (
        <div className="bonus-cue" role="status" aria-live="polite">
          <span className="bonus-spark" aria-hidden="true" />
          <strong>Streak Bonus</strong>
          <span>{`+${run.latestBonus}`}</span>
        </div>
      )}

      <div className={`feedback-banner large tone-${feedback.tone}`}>
        <strong>{feedback.title}</strong>
        <span>{feedback.detail}</span>
      </div>

      <div className="utility-row">
        <div className="run-stats-panel">
          <div>
            <span className="mini-label">Highest streak</span>
            <strong>{run.highestStreak}</strong>
          </div>
          <div>
            <span className="mini-label">Latest bonus</span>
            <strong>{run.latestBonus > 0 ? `+${run.latestBonus}` : 'None'}</strong>
          </div>
        </div>
        <button type="button" className="ghost-button" onClick={onEndRun}>
          End run
        </button>
      </div>
    </section>
  );
}

function GameOverScreen({ run, bestScore, onRestart, onReturnHome }) {
  return (
    <section className="game-over-wrap">
      <div className="panel-card game-over-card">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Run Complete</span>
            <h2>{run.finalReason || 'Game over'}</h2>
          </div>
          <p>Review the run, then jump right back in with the same parent-control settings.</p>
        </div>

        <div className="summary-grid big-summary">
          <SummaryTile label="Final score" value={run.score} />
          <SummaryTile label="Best score" value={bestScore} />
          <SummaryTile label="Total correct" value={run.totalCorrect} />
          <SummaryTile label="Highest streak" value={run.highestStreak} />
          <SummaryTile label="Lives left" value={run.lives} />
          <SummaryTile label="Session time" value={formatSeconds(run.sessionElapsed)} />
        </div>

        <div className="game-over-actions">
          <button type="button" className="primary-button" onClick={onRestart}>
            Restart Survival Mode
          </button>
          <button type="button" className="secondary-button" onClick={onReturnHome}>
            Back to Parent Controls
          </button>
        </div>
      </div>
    </section>
  );
}

function SettingsSection({ title, description, children }) {
  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="settings-fields">{children}</div>
    </section>
  );
}

function NumberSetting({ id, label, helper, value, min, max, onChange, suffix, disabled = false }) {
  return (
    <label className={`setting-card ${disabled ? 'is-disabled' : ''}`} htmlFor={id}>
      <div className="setting-copy">
        <span>{label}</span>
        <small>{helper}</small>
      </div>
      <div className="setting-control">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function ToggleSetting({ id, label, helper, checked, onChange, disabled = false }) {
  return (
    <label className={`setting-card ${disabled ? 'is-disabled' : ''}`} htmlFor={id}>
      <div className="setting-copy">
        <span>{label}</span>
        <small>{helper}</small>
      </div>
      <div className="toggle-wrap">
        <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span className="toggle-track" aria-hidden="true">
          <span className="toggle-thumb" />
        </span>
        <span className="toggle-text">{checked ? 'On' : 'Off'}</span>
      </div>
    </label>
  );
}

function ChoiceToggleSetting({ id, label, helper, value, options, onChange, disabled = false }) {
  return (
    <label className={`setting-card ${disabled ? 'is-disabled' : ''}`} htmlFor={id}>
      <div className="setting-copy">
        <span>{label}</span>
        <small>{helper}</small>
      </div>
      <div className="choice-toggle-group" id={id} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`choice-toggle ${value === option.value ? 'is-selected' : ''}`}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </label>
  );
}

function SelectSetting({ id, label, helper, value, options, onChange, disabled = false }) {
  return (
    <label className={`setting-card ${disabled ? 'is-disabled' : ''}`} htmlFor={id}>
      <div className="setting-copy">
        <span>{label}</span>
        <small>{helper}</small>
      </div>
      <div className="setting-control full-width">
        <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div className="summary-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatPill({ label, value, accent }) {
  return (
    <div className={`stat-pill accent-${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
