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
  return null;
};

const askQuestion = (rl, question) =>
  new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });

const promptSuite = async (rl) => {
  console.log('\nSelect tests to run:');
  console.log('  1) api');
  console.log('  2) api:regression');
  console.log('  3) no-wallet');
  console.log('  4) with-wallet\n');

  while (true) {
    const input = await askQuestion(
      rl,
      'Choice (api | api:regression | no-wallet | with-wallet or 1-4): ',
    );
    const normalized = normalizeSuite(input);
    if (normalized) {
      return normalized;
    }
    console.log(
      'Invalid choice. Please enter api, api:regression, no-wallet, or with-wallet (or 1-4).',
    );
  }
};

const promptIterations = async (rl, suite) => {
  const config = SUITES[suite];
  const { minIterations, maxIterations, label } = config;

  while (true) {
    const defaultVal = minIterations === 1 ? 2 : minIterations;
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
