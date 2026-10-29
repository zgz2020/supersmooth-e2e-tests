import console from 'node:console';
import process from 'node:process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { exec, spawn } from 'node:child_process';

const loadDefaultBaseUrl = () => {
  try {
    const urlsFile = path.resolve('utils/constants/urls.ts');
    if (fs.existsSync(urlsFile)) {
      const content = fs.readFileSync(urlsFile, 'utf8');
      const match = content.match(/export const DEFAULT_BASE_URL\s*=\s*['"]([^'"]+)['"]/);
      if (match) return match[1];
    }
  } catch {
    // fallback if file cannot be read
  }
  return 'https://staging.supersmooth.fi';
};

const DEFAULT_BASE_URL = loadDefaultBaseUrl();

const normalizeBaseUrl = (url, fallback = DEFAULT_BASE_URL) => {
  const base = (url || '').trim() || fallback;
  return base.replace(/\/+$/, '');
};

const PROFILES = [
  { id: 'smoke', name: 'Smoke Test', desc: '1 VU, 30s (quick functional SLA check)' },
  { id: 'load', name: 'Load Test', desc: 'Ramps up to 20 VUs (realistic sustained traffic)' },
  { id: 'stress', name: 'Stress Test', desc: 'Ramps up to 100 VUs (system breaking point test)' },
  { id: 'spike', name: 'Spike Test', desc: 'Surges to 150 VUs (surge recovery evaluation)' },
  { id: 'soak', name: 'Soak Test', desc: 'Sustained 30 VUs (extended memory/leak stability)' },
  { id: 'custom', name: 'Custom Profile', desc: 'Manually specify VUs and duration' },
];

const PAGES = [
  { id: '/', label: 'Home Page (/)' },
  { id: 'earn', label: 'Earn Page (/products/earn)' },
  { id: 'borrow', label: 'Borrow Page (/products/borrow)' },
  { id: 'trade', label: 'Trade Page (/products/trade)' },
  { id: 'multiply', label: 'Multiply Page (/products/multiply)' },
  { id: 'migrate', label: 'Migrate Page (/migrate)' },
];

const ENDPOINTS = [
  { id: 'token-prices', label: 'Token Prices (/api/token-prices/current)' },
  { id: 'geo', label: 'Compliance Geo Check (/api/compliance/geo)' },
  { id: 'screen', label: 'Compliance Wallet Screen (/api/compliance/screen)' },
  { id: 'safes', label: 'Portfolio Safes (/api/portfolio/safes)' },
  { id: 'summary', label: 'Portfolio Summary (/api/portfolio/summary)' },
  { id: 'strategies', label: 'Portfolio Strategies (/api/portfolio/recommended-strategies)' },
  { id: 'terms', label: 'Terms Status (/api/terms/status)' },
  { id: 'top-cards', label: 'Product Top Cards (/api/product-table/top-cards)' },
  { id: 'spread', label: 'Effective Spread (/api/effective-spread)' },
  { id: 'migrate-earn', label: 'Migrate Earn Positions (/api/migrate/earn-positions)' },
  { id: 'migrate-safes', label: 'Migrate Adoptable Safes (/api/migrate/adoptable-safes)' },
  { id: 'rpc', label: 'JSON-RPC eth_blockNumber (/api/rpc/8453)' },
];

const askQuestion = (rl, question) =>
  new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });

const promptProfile = async (rl) => {
  console.log('\n--- 1. Select Traffic Profile ---');
  PROFILES.forEach((p, idx) => {
    const isDefault = idx === 0 ? ' [Default]' : '';
    console.log(`  ${idx + 1}) ${p.id.padEnd(8)} - ${p.desc}${isDefault}`);
  });

  while (true) {
    const input = await askQuestion(rl, '\nChoice (1-6 or profile name) [default: 1]: ');
    if (!input || input === '1' || input === 'smoke') return { profile: 'smoke' };
    if (input === '2' || input === 'load') return { profile: 'load' };
    if (input === '3' || input === 'stress') return { profile: 'stress' };
    if (input === '4' || input === 'spike') return { profile: 'spike' };
    if (input === '5' || input === 'soak') return { profile: 'soak' };
    if (input === '6' || input === 'custom') {
      const vus = await askQuestion(rl, 'Target Virtual Users (VUs) [default: 5]: ');
      const duration = await askQuestion(rl, 'Test duration (e.g. 30s, 1m, 2m) [default: 30s]: ');
      return {
        profile: 'smoke',
        customVus: vus || '5',
        customDuration: duration || '30s',
      };
    }
    console.log('Invalid choice. Please select 1-6 or enter a profile name.');
  }
};

const promptPagesSelection = async (rl) => {
  console.log('\nAvailable Web Pages:');
  PAGES.forEach((page, idx) => {
    console.log(`  ${idx + 1}) ${page.label}`);
  });

  const input = await askQuestion(
    rl,
    '\nEnter page number(s) comma-separated (e.g. 1,2) or page names [default: all pages]: ',
  );

  if (!input || input.toLowerCase() === 'all') return 'web';

  const selected = input
    .split(',')
    .map((item) => {
      const trimmed = item.trim();
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= PAGES.length) {
        return PAGES[num - 1].id;
      }
      return trimmed;
    })
    .filter(Boolean);

  return selected.join(',');
};

const promptEndpointsSelection = async (rl) => {
  console.log('\nAvailable API Endpoints:');
  ENDPOINTS.forEach((ep, idx) => {
    console.log(`  ${String(idx + 1).padStart(2, ' ')}) ${ep.label}`);
  });

  const input = await askQuestion(
    rl,
    '\nEnter endpoint number(s) comma-separated (e.g. 1,12) or names [default: all APIs]: ',
  );

  if (!input || input.toLowerCase() === 'all') return 'api';

  const selected = input
    .split(',')
    .map((item) => {
      const trimmed = item.trim();
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= ENDPOINTS.length) {
        return ENDPOINTS[num - 1].id;
      }
      return trimmed;
    })
    .filter(Boolean);

  return selected.join(',');
};

const promptTarget = async (rl) => {
  console.log('\n--- 2. Select Target Scope & Endpoints ---');
  console.log('  1) all                - Full realistic flow (all pages + all APIs) [Default]');
  console.log('  2) web                - All frontend web pages');
  console.log('  3) api                - All API endpoints');
  console.log('  4) specific page(s)   - Pick one or more frontend pages');
  console.log('  5) specific API(s)    - Pick one or more API endpoints');
  console.log('  6) custom target expression (e.g. "earn,token-prices,rpc")');

  while (true) {
    const input = await askQuestion(rl, '\nChoice (1-6) [default: 1]: ');
    if (!input || input === '1' || input === 'all') return 'all';
    if (input === '2' || input === 'web') return 'web';
    if (input === '3' || input === 'api') return 'api';
    if (input === '4' || input === 'pages') return await promptPagesSelection(rl);
    if (input === '5' || input === 'endpoints') return await promptEndpointsSelection(rl);
    if (input === '6' || input === 'custom') {
      const customInput = await askQuestion(
        rl,
        'Enter comma-separated targets (e.g. "earn,borrow,rpc"): ',
      );
      return customInput || 'all';
    }
    console.log('Invalid choice. Please select 1-6.');
  }
};

const promptBaseUrl = async (rl) => {
  const defaultBaseUrl = normalizeBaseUrl(process.env.K6_BASE_URL || process.env.BASE_URL);
  console.log('\n--- 3. Target Environment ---');
  console.log(`Current default: ${defaultBaseUrl}`);

  const input = await askQuestion(rl, `Target Base URL (press Enter to keep default): `);
  return normalizeBaseUrl(input || defaultBaseUrl);
};

const promptAutoOpenReport = async (rl) => {
  console.log('\n--- 4. Post-Execution Options ---');
  const input = await askQuestion(
    rl,
    'Automatically open the itemised HTML report in your browser when done? (Y/n) [default: Y]: ',
  );
  return input.toLowerCase() !== 'n' && input.toLowerCase() !== 'no';
};

const openInBrowser = (filePath) => {
  const cmd =
    process.platform === 'darwin'
      ? `open ${filePath}`
      : process.platform === 'win32'
        ? `start ${filePath}`
        : `xdg-open ${filePath}`;

  exec(cmd, () => {
    // Ignore error if browser cannot be opened in headless/CI
  });
};

const parseCliArgs = () => {
  const args = process.argv.slice(2);
  const options = {};

  for (const arg of args) {
    if (arg.startsWith('--profile=')) {
      options.profile = arg.split('=')[1];
    } else if (arg.startsWith('--target=')) {
      options.target = arg.split('=')[1];
    } else if (arg.startsWith('--baseUrl=') || arg.startsWith('--base-url=')) {
      options.baseUrl = arg.split('=')[1];
    } else if (arg === '--open') {
      options.autoOpen = true;
    } else if (arg === '--no-open') {
      options.autoOpen = false;
    }
  }

  return options;
};

const main = async () => {
  const cliArgs = parseCliArgs();
  const isInteractive = Object.keys(cliArgs).length === 0;

  let profile = cliArgs.profile;
  let customVus;
  let customDuration;
  let target = cliArgs.target;
  let baseUrl = cliArgs.baseUrl;
  let autoOpen = cliArgs.autoOpen ?? true;

  if (isInteractive) {
    console.log('======================================================================');
    console.log('            🚀 GRAFANA K6 PERFORMANCE TEST RUNNER');
    console.log('======================================================================');
    console.log('Configure workload profiles, target scopes, and endpoints interactively.');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      const profileResult = await promptProfile(rl);
      profile = profileResult.profile;
      customVus = profileResult.customVus;
      customDuration = profileResult.customDuration;

      target = await promptTarget(rl);
      baseUrl = await promptBaseUrl(rl);
      autoOpen = await promptAutoOpenReport(rl);
    } finally {
      rl.close();
    }
  } else {
    profile = profile || 'smoke';
    target = target || 'all';
    baseUrl = normalizeBaseUrl(baseUrl || process.env.K6_BASE_URL || process.env.BASE_URL);
  }

  baseUrl = normalizeBaseUrl(baseUrl);

  console.log('\n' + '='.repeat(70));
  console.log('⚡ STARTING PERFORMANCE RUN');
  console.log('='.repeat(70));
  console.log(
    `  • Profile     : ${profile}${customVus ? ` (${customVus} VUs, ${customDuration})` : ''}`,
  );
  console.log(`  • Target(s)   : ${target}`);
  console.log(`  • Base URL    : ${baseUrl}`);
  console.log(`  • Auto-open   : ${autoOpen ? 'Yes' : 'No'}`);
  console.log('='.repeat(70) + '\n');

  const env = {
    ...process.env,
    K6_PROFILE: profile,
    K6_TARGET: target,
    K6_BASE_URL: baseUrl,
    ...(customVus ? { K6_VUS: customVus } : {}),
    ...(customDuration ? { K6_DURATION: customDuration } : {}),
  };

  const child = spawn('pnpm', ['test:performance'], {
    stdio: 'inherit',
    shell: true,
    env,
  });

  child.on('error', (err) => {
    console.error('Failed to start k6 performance process:', err);
    process.exit(1);
  });

  child.on('close', (code) => {
    try {
      const historyFile = 'performance-reports/history/runs.json';
      if (fs.existsSync(historyFile)) {
        const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
        if (Array.isArray(history) && history.length > 0) {
          const latestRun = history[0];
          const latestDashboard = 'performance-reports/dashboard.html';
          if (fs.existsSync(latestDashboard)) {
            fs.copyFileSync(
              latestDashboard,
              `performance-reports/history/dashboard-${latestRun.id}.html`,
            );
          }

          // Housekeeping: automatically prune files not in the active 20 runs
          const allowedIds = new Set(history.map((r) => r.id));
          const historyDir = 'performance-reports/history';
          const existingFiles = fs.readdirSync(historyDir);
          for (const file of existingFiles) {
            if (file === 'runs.json') continue;
            const match = file.match(/^(?:report|summary|dashboard)-(.+)\.(?:html|json)$/);
            if (match && !allowedIds.has(match[1])) {
              fs.unlinkSync(path.join(historyDir, file));
            }
          }
        }
      }
    } catch {
      // Best-effort archiving and cleanup
    }

    if (autoOpen) {
      console.log('\n📄 Opening itemised HTML report in browser...');
      openInBrowser('performance-reports/report.html');
    }

    process.exit(code ?? 0);
  });
};

main();
