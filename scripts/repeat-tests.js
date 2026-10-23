import console from 'node:console';
import process from 'node:process';
import readline from 'node:readline';
import { spawn } from 'node:child_process';

const SUITES = {
  api: {
    label: 'api',
    command: 'pnpm',
    args: ['test:api'],
    minIterations: 1,
    maxIterations: 2,
  },
  'api:regression': {
    label: 'api:regression',
    command: 'pnpm',
    args: ['test:api:regression'],
    minIterations: 1,
    maxIterations: 2,
  },
  'no-wallet': {
    label: 'no-wallet',
    command: 'pnpm',
    args: ['test:no-wallet'],
    minIterations: 2,
    maxIterations: 5,
  },
  'with-wallet': {
    label: 'with-wallet',
    command: 'pnpm',
    args: ['test:with-wallet'],
    minIterations: 2,
    maxIterations: 5,
  },
  'cross-browser': {
    label: 'cross-browser (all)',
    command: 'pnpm',
    args: ['test:cross-browser'],
    minIterations: 1,
    maxIterations: 5,
  },
  'cross-browser:firefox': {
    label: 'cross-browser:firefox',
    command: 'pnpm',
    args: ['test:cross-browser:firefox'],
    minIterations: 1,
    maxIterations: 5,
  },
  'cross-browser:webkit': {
    label: 'cross-browser:webkit',
    command: 'pnpm',
    args: ['test:cross-browser:webkit'],
    minIterations: 1,
    maxIterations: 5,
  },
  'cross-browser:mobile-safari': {
    label: 'cross-browser:mobile-safari',
    command: 'pnpm',
    args: ['test:cross-browser:mobile-safari'],
    minIterations: 1,
    maxIterations: 5,
  },
  'cross-browser:mobile-android': {
    label: 'cross-browser:mobile-android',
    command: 'pnpm',
    args: ['test:cross-browser:mobile-android'],
    minIterations: 1,
    maxIterations: 5,
  },
  'cross-browser:tablet-ipad': {
    label: 'cross-browser:tablet-ipad',
    command: 'pnpm',
    args: ['test:cross-browser:tablet-ipad'],
    minIterations: 1,
    maxIterations: 5,
  },
  'cross-browser:desktop-large': {
    label: 'cross-browser:desktop-large',
    command: 'pnpm',
    args: ['test:cross-browser:desktop-large'],
    minIterations: 1,
    maxIterations: 5,
  },
};

const normalizeSuite = (input) => {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === '1' || trimmed === 'api') return 'api';
  if (
    trimmed === '2' ||
    trimmed === 'api:regression' ||
    trimmed === 'api_regression' ||
    trimmed === 'api-regression' ||
    trimmed === 'apiregression'
  ) {
    return 'api:regression';
  }
  if (
    trimmed === '3' ||
    trimmed === 'no-wallet' ||
    trimmed === 'no_wallet' ||
    trimmed === 'nowallet'
  ) {
    return 'no-wallet';
  }
  if (
    trimmed === '4' ||
    trimmed === 'with-wallet' ||
    trimmed === 'with_wallet' ||
    trimmed === 'withwallet'
  ) {
    return 'with-wallet';
  }
  if (
    trimmed === '5' ||
    trimmed === 'cross-browser' ||
    trimmed === 'cross_browser' ||
    trimmed === 'crossbrowser'
  ) {
    return 'cross-browser';
  }
  if (
    trimmed === 'firefox' ||
    trimmed === 'cross-browser:firefox' ||
    trimmed === 'cross-browser-firefox'
  ) {
    return 'cross-browser:firefox';
  }
  if (
    trimmed === 'webkit' ||
    trimmed === 'safari' ||
    trimmed === 'cross-browser:webkit' ||
    trimmed === 'cross-browser-webkit' ||
    trimmed === 'cross-browser:safari'
  ) {
    return 'cross-browser:webkit';
  }
  if (
    trimmed === 'mobile-safari' ||
    trimmed === 'mobilesafari' ||
    trimmed === 'iphone' ||
    trimmed === 'cross-browser:mobile-safari'
  ) {
    return 'cross-browser:mobile-safari';
  }
  if (
    trimmed === 'mobile-android' ||
    trimmed === 'mobileandroid' ||
    trimmed === 'pixel' ||
    trimmed === 'android' ||
    trimmed === 'cross-browser:mobile-android'
  ) {
    return 'cross-browser:mobile-android';
  }
  if (
    trimmed === 'tablet-ipad' ||
    trimmed === 'tabletipad' ||
    trimmed === 'ipad' ||
    trimmed === 'tablet' ||
    trimmed === 'cross-browser:tablet-ipad'
  ) {
    return 'cross-browser:tablet-ipad';
  }
  if (
    trimmed === 'desktop-large' ||
    trimmed === 'desktoplarge' ||
    trimmed === '1080p' ||
    trimmed === 'large' ||
    trimmed === 'cross-browser:desktop-large'
  ) {
    return 'cross-browser:desktop-large';
  }
  return null;
};

const askQuestion = (rl, question) =>
  new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });

const promptCrossBrowserTarget = async (rl) => {
  console.log('\nSelect cross-browser target:');
  console.log('  1) all (all 6 browsers/devices)');
  console.log('  2) firefox (Desktop Firefox)');
  console.log('  3) webkit (Desktop Safari)');
  console.log('  4) mobile-safari (iPhone 14)');
  console.log('  5) mobile-android (Pixel 7)');
  console.log('  6) tablet-ipad (iPad Pro 11)');
  console.log('  7) desktop-large (Desktop Safari 1920x1080)\n');

  while (true) {
    const input = await askQuestion(rl, 'Choice (1-7 or target name) [default: 1]: ');
    if (input === '' || input === '1' || input === 'all') {
      return 'cross-browser';
    }
    if (input === '2' || input === 'firefox') return 'cross-browser:firefox';
    if (input === '3' || input === 'webkit' || input === 'safari') return 'cross-browser:webkit';
    if (input === '4' || input === 'mobile-safari' || input === 'iphone')
      return 'cross-browser:mobile-safari';
    if (input === '5' || input === 'mobile-android' || input === 'android' || input === 'pixel')
      return 'cross-browser:mobile-android';
    if (input === '6' || input === 'tablet-ipad' || input === 'ipad' || input === 'tablet')
      return 'cross-browser:tablet-ipad';
    if (input === '7' || input === 'desktop-large' || input === 'large')
      return 'cross-browser:desktop-large';

    console.log('Invalid choice. Please select 1-7 or enter a valid target name.');
  }
};

const promptSuite = async (rl) => {
  console.log('\nSelect tests to run:');
  console.log('  1) api');
  console.log('  2) api:regression');
  console.log('  3) no-wallet');
  console.log('  4) with-wallet');
  console.log('  5) cross-browser\n');

  while (true) {
    const input = await askQuestion(
      rl,
      'Choice (api | api:regression | no-wallet | with-wallet | cross-browser or 1-5): ',
    );
    const normalized = normalizeSuite(input);
    if (normalized === 'cross-browser') {
      return await promptCrossBrowserTarget(rl);
    }
    if (normalized) {
      return normalized;
    }
    console.log(
      'Invalid choice. Please enter api, api:regression, no-wallet, with-wallet, or cross-browser (or 1-5).',
    );
  }
};

const promptIterations = async (rl, suite) => {
  const config = SUITES[suite];
  const { minIterations, maxIterations, label } = config;

  while (true) {
    const defaultVal = suite.startsWith('cross-browser')
      ? 1
      : minIterations === 1
        ? 2
        : minIterations;
    const input = await askQuestion(
      rl,
      `Number of iterations/repetitions (${minIterations}-${maxIterations}) [default: ${defaultVal}]: `,
    );

    if (input === '') {
      return defaultVal;
    }

    const num = Number.parseInt(input, 10);
    if (!Number.isNaN(num) && num >= minIterations && num <= maxIterations) {
      return num;
    }

    if (suite.includes('api') && !Number.isNaN(num) && num > maxIterations) {
      console.log(
        `\n⚠️  Warning: API tests can only be run at most 2 times. Running more times might return 'Too many calls' or rate-limiting errors.\n`,
      );
    } else {
      console.log(
        `Invalid choice. ${label} tests can be run between ${minIterations} and ${maxIterations} time(s).`,
      );
    }
  }
};

const runIteration = (command, args) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: true });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (err) => {
      console.error(err);
      resolve(1);
    });
  });

const main = async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  process.on('SIGINT', () => {
    console.log('\nProcess interrupted by user.');
    rl.close();
    process.exit(130);
  });

  try {
    let suite = normalizeSuite(process.argv[2] || '');
    if (!suite) {
      suite = await promptSuite(rl);
    }

    if (suite.includes('api') && process.argv[3] === undefined) {
      console.log(
        `\n⚠️  Warning: API tests can only be run at most 2 times. Running more times might return 'Too many calls' or rate-limiting errors.`,
      );
    }

    const config = SUITES[suite];
    let iterations = Number.parseInt(process.argv[3] || '', 10);
    if (
      Number.isNaN(iterations) ||
      iterations < config.minIterations ||
      iterations > config.maxIterations
    ) {
      if (process.argv[3] !== undefined) {
        if (suite.includes('api') && iterations > config.maxIterations) {
          console.log(
            `\n⚠️  Warning: API tests can only be run at most 2 times. Running more times might return 'Too many calls' or rate-limiting errors.`,
          );
        } else {
          console.log(
            `\nInvalid iteration count (${process.argv[3]}). Allowed range for ${config.label}: ${config.minIterations}-${config.maxIterations}.`,
          );
        }
      }
      iterations = await promptIterations(rl, suite);
    }

    rl.close();

    const selectedSuite = SUITES[suite];
    console.log(`\nRunning ${selectedSuite.label} tests for ${iterations} iteration(s)...\n`);

    for (let i = 1; i <= iterations; i += 1) {
      console.log('==================================================');
      console.log(`  Iteration ${i} of ${iterations} (${selectedSuite.label})`);
      console.log('==================================================\n');

      const startTime = Date.now();
      const exitCode = await runIteration(selectedSuite.command, selectedSuite.args);
      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

      if (exitCode !== 0) {
        console.error(
          `\n✖ Iteration ${i} failed with exit code ${exitCode} after ${elapsedSeconds}s. Stopping further runs.\n`,
        );
        process.exit(exitCode);
      }

      console.log(`\n✔ Iteration ${i} of ${iterations} passed (${elapsedSeconds}s).\n`);
    }

    console.log(
      `🎉 All ${iterations} iteration(s) of ${selectedSuite.label} passed successfully!\n`,
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    rl.close();
    process.exit(1);
  }
};

main();
