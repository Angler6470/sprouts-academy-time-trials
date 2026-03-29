const TEMPLATE_GROUPS = {
  easy: [
    { key: 'easy-addition-within-20', variations: 121, build: buildAdditionWithin20 },
    { key: 'easy-subtraction-within-20', variations: 110, build: buildSubtractionWithin20 },
    { key: 'easy-doubles', variations: 12, build: buildDoublesFacts },
    { key: 'easy-near-ten', variations: 40, build: buildNearTenAddition },
    { key: 'easy-missing-addend', variations: 100, build: buildMissingAddendQuestion },
  ],
  medium: [
    { key: 'medium-two-digit-addition', variations: 1521, build: buildTwoDigitAddition },
    { key: 'medium-two-digit-subtraction', variations: 1482, build: buildTwoDigitSubtraction },
    { key: 'medium-multiplication', variations: 110, build: () => buildMultiplicationQuestion(3, 12, 2, 12) },
    { key: 'medium-division', variations: 110, build: () => buildDivisionQuestion(3, 12, 2, 12) },
    { key: 'medium-place-value', variations: 567, build: buildPlaceValueQuestion },
  ],
  hard: [
    { key: 'hard-multiplication', variations: 90, build: () => buildMultiplicationQuestion(6, 15, 4, 12) },
    { key: 'hard-division', variations: 90, build: () => buildDivisionQuestion(6, 15, 4, 12) },
    { key: 'hard-two-step', variations: 2112, build: buildTwoStepQuestion },
    { key: 'hard-parentheses', variations: 440, build: buildParenthesesQuestion },
    { key: 'hard-mixed-operation', variations: 1260, build: buildMixedDivisionQuestion },
  ],
};

export function getQuestionPoolStats() {
  return Object.entries(TEMPLATE_GROUPS).reduce(
    (stats, [difficulty, templates]) => {
      const totalPossible = templates.reduce((sum, template) => sum + template.variations, 0);
      stats.byDifficulty[difficulty] = totalPossible;
      stats.totalPossible += totalPossible;
      return stats;
    },
    {
      byDifficulty: {},
      totalPossible: 0,
    },
  );
}

export function generateQuestion(difficulty, questionNumber, recentPrompts = []) {
  const templates = TEMPLATE_GROUPS[difficulty] ?? TEMPLATE_GROUPS.easy;
  const recentPromptSet = new Set(recentPrompts);
  let fallbackQuestion = null;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const template = templates[randomInt(0, templates.length - 1)];
    const baseQuestion = template.build();
    const nextQuestion = {
      ...baseQuestion,
      id: `${difficulty}-${questionNumber}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      difficulty,
    };

    fallbackQuestion = nextQuestion;

    if (!recentPromptSet.has(nextQuestion.prompt)) {
      return nextQuestion;
    }
  }

  return fallbackQuestion;
}

function buildAdditionWithin20() {
  const left = randomInt(0, 10);
  const right = randomInt(0, 10);

  return createQuestion({
    prompt: `${left} + ${right}`,
    answer: left + right,
    hint: `Count up ${right} more from ${left}.`,
  });
}

function buildSubtractionWithin20() {
  const answer = randomInt(0, 10);
  const change = randomInt(1, 10);
  const total = answer + change;

  return createQuestion({
    prompt: `${total} - ${change}`,
    answer,
    hint: `Think about the number left after taking ${change} away from ${total}.`,
  });
}

function buildDoublesFacts() {
  const number = randomInt(1, 12);

  return createQuestion({
    prompt: `${number} + ${number}`,
    answer: number * 2,
    hint: `A double means two equal groups of ${number}.`,
  });
}

function buildNearTenAddition() {
  const left = randomInt(8, 12);
  const right = randomInt(1, 8);

  return createQuestion({
    prompt: `${left} + ${right}`,
    answer: left + right,
    hint: `Try making a ten first, then add what is left.`,
  });
}

function buildMissingAddendQuestion() {
  const firstAddend = randomInt(1, 10);
  const answer = randomInt(1, 10);
  const total = firstAddend + answer;

  return createQuestion({
    prompt: `${firstAddend} + ? = ${total}`,
    answer,
    hint: `Ask what number added to ${firstAddend} makes ${total}.`,
  });
}

function buildTwoDigitAddition() {
  const left = randomInt(11, 49);
  const right = randomInt(11, 49);

  return createQuestion({
    prompt: `${left} + ${right}`,
    answer: left + right,
    hint: `Add tens first, then ones.`,
  });
}

function buildTwoDigitSubtraction() {
  const left = randomInt(35, 98);
  const right = randomInt(6, Math.min(34, left - 5));

  return createQuestion({
    prompt: `${left} - ${right}`,
    answer: left - right,
    hint: `Subtract the tens, then the leftover ones.`,
  });
}

function buildPlaceValueQuestion() {
  const tensA = randomInt(1, 5) * 10;
  const tensB = randomInt(1, 3) * 10;
  const ones = randomInt(1, 9);

  return createQuestion({
    prompt: `${tensA} + ${tensB} + ${ones}`,
    answer: tensA + tensB + ones,
    hint: `Combine the tens first, then add the ones.`,
  });
}

function buildMultiplicationQuestion(leftMinimum, leftMaximum, rightMinimum, rightMaximum) {
  const left = randomInt(leftMinimum, leftMaximum);
  const right = randomInt(rightMinimum, rightMaximum);

  return createQuestion({
    prompt: `${left} × ${right}`,
    answer: left * right,
    hint: `Picture ${left} groups with ${right} in each group.`,
  });
}

function buildDivisionQuestion(divisorMinimum, divisorMaximum, quotientMinimum, quotientMaximum) {
  const divisor = randomInt(divisorMinimum, divisorMaximum);
  const quotient = randomInt(quotientMinimum, quotientMaximum);
  const dividend = divisor * quotient;

  return createQuestion({
    prompt: `${dividend} ÷ ${divisor}`,
    answer: quotient,
    hint: `Ask how many groups of ${divisor} fit into ${dividend}.`,
  });
}

function buildTwoStepQuestion() {
  const left = randomInt(4, 15);
  const middle = randomInt(2, 9);
  const right = randomInt(2, 12);
  const operation = Math.random() > 0.5 ? '+' : '-';
  const product = left * middle;
  const answer = operation === '+' ? product + right : product - right;

  return createQuestion({
    prompt: `${left} × ${middle} ${operation} ${right}`,
    answer,
    hint: `Multiply first, then ${operation === '+' ? 'add' : 'subtract'} ${right}.`,
  });
}

function buildParenthesesQuestion() {
  const left = randomInt(2, 12);
  const middle = randomInt(2, 9);
  const multiplier = randomInt(2, 6);

  return createQuestion({
    prompt: `(${left} + ${middle}) × ${multiplier}`,
    answer: (left + middle) * multiplier,
    hint: `Solve inside the parentheses before multiplying.`,
  });
}

function buildMixedDivisionQuestion() {
  const divisor = randomInt(4, 12);
  const quotient = randomInt(3, 12);
  const addend = randomInt(2, 15);
  const dividend = divisor * quotient;

  return createQuestion({
    prompt: `${dividend} ÷ ${divisor} + ${addend}`,
    answer: quotient + addend,
    hint: `Divide first, then add ${addend}.`,
  });
}

function createQuestion({ prompt, answer, hint }) {
  return {
    prompt,
    answer,
    choices: buildChoices(answer),
    hint,
  };
}

function buildChoices(answer) {
  const correctIndex = randomInt(0, 3);
  const distractorPool = buildDistractorPool(answer);
  const distractors = shuffle(Array.from(distractorPool)).slice(0, 3);
  const choices = new Array(4);
  let distractorIndex = 0;

  for (let index = 0; index < choices.length; index += 1) {
    if (index === correctIndex) {
      choices[index] = answer;
    } else {
      choices[index] = distractors[distractorIndex];
      distractorIndex += 1;
    }
  }

  return choices;
}

function buildDistractorPool(answer) {
  const options = new Set();
  const baseSpread = Math.max(4, Math.ceil(Math.abs(answer) * 0.25));
  const offsets = [1, 2, 3, 4, 5, 6, 8, 10, 12];

  offsets.forEach((offset) => {
    addOption(options, answer + offset);
    addOption(options, answer - offset);
  });

  addOption(options, answer + baseSpread);
  addOption(options, answer - baseSpread);
  addOption(options, answer + Math.max(2, Math.floor(baseSpread / 2)));
  addOption(options, answer - Math.max(2, Math.floor(baseSpread / 2)));

  if (answer > 3) {
    addOption(options, Math.floor(answer / 2));
    addOption(options, Math.max(0, answer - Math.ceil(answer / 3)));
  }

  addOption(options, answer + Math.max(7, Math.ceil(answer * 0.4)));

  while (options.size < 8) {
    const candidate = answer + randomInt(-baseSpread * 2, baseSpread * 2);
    addOption(options, candidate);
  }

  return options;
}

function addOption(options, candidate) {
  if (candidate >= 0) {
    options.add(candidate);
  }
}

function shuffle(items) {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }

  return nextItems;
}

function randomInt(minimum, maximum) {
  const lower = Math.ceil(minimum);
  const upper = Math.floor(maximum);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}
