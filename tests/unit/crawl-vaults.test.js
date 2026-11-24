import assert from 'node:assert';
import console from 'node:console';
import process from 'node:process';
import {
  parseRouteDetails,
  extractRoutesFromHtml,
  extractRoutesFromTopCards,
  discoverAllRoutes,
  checkHtmlHealth,
  auditAllRoutes,
  generateAuditReport,
  scaffoldSpec,
  classifyRenderedPage,
  checkRenderedPage,
  auditRenderedRoutes,
} from '../../scripts/qa-agent/crawl-vaults.js';

async function runTests() {
  console.log('🧪 Running Autonomous Route Crawler Unit Tests...\n');

  // --- SUITE 1: Route URL Parsing ---
  console.log('📦 Suite 1: Route URL Parsing');

  // Test 1: parseRouteDetails parses valid dynamic vault route
  {
    const parsed = parseRouteDetails(
      '/products/yield-loop/morpho/8453/0x3a4048c64ba1b375330d376b1ce40e4047d03b47ab4d48af484edec9fec801ba',
    );
    assert.ok(parsed);
    assert.strictEqual(parsed.productType, 'yield-loop');
    assert.strictEqual(parsed.protocol, 'morpho');
    assert.strictEqual(parsed.chainId, '8453');
    assert.strictEqual(parsed.networkName, 'Base');
    assert.strictEqual(
      parsed.poolId,
      '0x3a4048c64ba1b375330d376b1ce40e4047d03b47ab4d48af484edec9fec801ba',
    );
    console.log('  ✓ Test 1 Passed: parseRouteDetails parses valid dynamic vault route');
  }

  // Test 2: parseRouteDetails parses Robinhood (4663) and Ethereum (1)
  {
    const rh = parseRouteDetails('/products/borrow/morpho/4663/0xabcdef');
    assert.ok(rh);
    assert.strictEqual(rh.chainId, '4663');
    assert.strictEqual(rh.networkName, 'Robinhood');

    const eth = parseRouteDetails('/products/earn/spark/1/0x123456');
    assert.ok(eth);
    assert.strictEqual(eth.chainId, '1');
    assert.strictEqual(eth.networkName, 'Ethereum');
    console.log('  ✓ Test 2 Passed: parseRouteDetails parses Robinhood (4663) and Ethereum (1)');
  }

  // Test 3: parseRouteDetails parses compound hyphenated pool IDs (Spark/Aave)
  {
    const compound = parseRouteDetails(
      '/products/multiply/spark/1/0xC13e21B648A5Ee794902342038FF3aDAB66BE987-0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf-0xdC035D45d973E3EC169d2276DDab16f1e407384F',
    );
    assert.ok(compound);
    assert.strictEqual(compound.productType, 'multiply');
    assert.strictEqual(compound.protocol, 'spark');
    assert.strictEqual(compound.chainId, '1');
    assert.strictEqual(
      compound.poolId,
      '0xC13e21B648A5Ee794902342038FF3aDAB66BE987-0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf-0xdC035D45d973E3EC169d2276DDab16f1e407384F',
    );
    console.log(
      '  ✓ Test 3 Passed: parseRouteDetails parses compound hyphenated pool IDs (Spark/Aave)',
    );
  }

  // Test 4: parseRouteDetails returns null for invalid non-position URLs
  {
    assert.strictEqual(parseRouteDetails('/terms'), null);
    assert.strictEqual(parseRouteDetails('/products/earn'), null);
    assert.strictEqual(parseRouteDetails(''), null);
    assert.strictEqual(parseRouteDetails(null), null);
    console.log('  ✓ Test 4 Passed: parseRouteDetails returns null for invalid non-position URLs');
  }

  // --- SUITE 2: Route Extraction from Sources ---
  console.log('\n📦 Suite 2: Route Extraction from Sources');

  // Test 5: extractRoutesFromTopCards extracts and deduplicates cards
  {
    const mockTopCards = {
      cards: [
        {
          id: 'card-1',
          title: 'Morpho ETH Multiply',
          tokens: ['ETH', 'USDC'],
          url: '/products/multiply/morpho/8453/0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda',
        },
        {
          id: 'card-1-duplicate',
          title: 'Morpho ETH Multiply Duplicate',
          tokens: ['ETH'],
          url: '/products/multiply/morpho/8453/0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda',
        },
        {
          id: 'card-2',
          title: 'Spark wstETH Earn',
          tokens: ['wstETH'],
          url: '/products/earn/spark/1/0xbeeff2490FEffa212faC2f6553682C219E6a8845',
        },
      ],
    };

    const routes = extractRoutesFromTopCards(mockTopCards, 'earn');
    assert.strictEqual(routes.length, 2);
    assert.strictEqual(routes[0].tokens[0], 'ETH');
    assert.strictEqual(routes[1].networkName, 'Ethereum');
    console.log('  ✓ Test 5 Passed: extractRoutesFromTopCards extracts and deduplicates cards');
  }

  // Test 6: extractRoutesFromHtml parses server-rendered catalog anchors (including hyphenated markets)
  {
    const mockHtml = `
      <div>
        <a href="/products/yield-loop/morpho/8453/0x3a4048c64ba1b375330d376b1ce40e4047d03b47ab4d48af484edec9fec801ba">Morpho wstETH</a>
        <a href="/products/earn/coinbase/8453/0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22">Coinbase cbETH</a>
        <a href="/products/multiply/spark/1/0xC13e21B648A5Ee794902342038FF3aDAB66BE987-0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf-0xdC035D45d973E3EC169d2276DDab16f1e407384F">Spark cbBTC</a>
        <a href="/about">About Us</a>
      </div>
    `;

    const routes = extractRoutesFromHtml(mockHtml, 'yieldLoop');
    assert.strictEqual(routes.length, 3);
    assert.strictEqual(routes[0].protocol, 'morpho');
    assert.strictEqual(routes[1].protocol, 'coinbase');
    assert.strictEqual(routes[2].protocol, 'spark');
    console.log('  ✓ Test 6 Passed: extractRoutesFromHtml parses server-rendered catalog anchors');
  }

  // Test 7: discoverAllRoutes paginates through tables and combines with top-cards
  {
    const mockFetcher = async (url) => {
      if (url.includes('/api/product-table/top-cards')) {
        return {
          ok: true,
          json: async () => ({
            cards: [
              {
                id: 'top-1',
                title: 'Top Card',
                tokens: ['ETH'],
                url: '/products/earn/morpho/8453/0x1111',
              },
            ],
          }),
        };
      }
      if (url.includes('/products/earn') && url.includes('page=1')) {
        return {
          ok: true,
          text: async () => `
            <a href="/products/earn/coinbase/8453/0x2222">Coinbase</a>
            <a href="/products/earn/lido/1/0x3333">Lido</a>
          `,
        };
      }
      if (url.includes('/products/earn') && url.includes('page=2')) {
        return {
          ok: true,
          text: async () => `
            <a href="/products/earn/spark/1/0x4444">Spark</a>
          `,
        };
      }
      return { ok: true, text: async () => '' };
    };

    const routes = await discoverAllRoutes({
      fetcher: mockFetcher,
      baseUrl: 'https://staging.supersmooth.fi',
      productFilter: 'earn',
      maxPages: 3,
      includeTopCards: true,
      includeTables: true,
    });

    assert.ok(routes.length >= 4);
    assert.ok(routes.some((r) => r.url.includes('0x1111')));
    assert.ok(routes.some((r) => r.url.includes('0x2222')));
    assert.ok(routes.some((r) => r.url.includes('0x4444')));
    console.log(
      '  ✓ Test 7 Passed: discoverAllRoutes paginates through tables and combines with top-cards',
    );
  }

  // Test 8: discoverAllRoutes with allPages: true crawls until page returns 0 new routes
  {
    const requestedPages = [];
    const mockFetcher = async (url) => {
      if (url.includes('/api/product-table/top-cards')) {
        return { ok: true, json: async () => ({ cards: [] }) };
      }
      const pageMatch = url.match(/page=(\d+)/);
      const pageNum = pageMatch ? Number.parseInt(pageMatch[1], 10) : 1;
      requestedPages.push(pageNum);

      if (pageNum <= 4) {
        return {
          ok: true,
          text: async () =>
            `<a href="/products/borrow/morpho/8453/0xpool${pageNum}">Pool ${pageNum}</a>`,
        };
      }
      return { ok: true, text: async () => '' };
    };

    const routes = await discoverAllRoutes({
      fetcher: mockFetcher,
      baseUrl: 'https://staging.supersmooth.fi',
      productFilter: 'borrow',
      allPages: true,
      includeTopCards: false,
      includeTables: true,
    });

    assert.strictEqual(routes.length, 4);
    assert.deepStrictEqual(requestedPages, [1, 2, 3, 4, 5]);
    console.log(
      '  ✓ Test 8 Passed: discoverAllRoutes with allPages: true crawls until page returns 0 new routes',
    );
  }

  // Test 9: discoverAllRoutes does not prematurely abort with chainFilter on sparse pages and handles numeric chainId
  {
    const requestedPages = [];
    const mockFetcher = async (url) => {
      if (url.includes('/api/product-table/top-cards')) {
        return { ok: true, json: async () => ({ cards: [] }) };
      }
      const pageMatch = url.match(/page=(\d+)/);
      const pageNum = pageMatch ? Number.parseInt(pageMatch[1], 10) : 1;
      requestedPages.push(pageNum);

      // Page 1: Robinhood (4663)
      // Page 2: Only Ethereum (1) -> 0 matching Robinhood items
      // Page 3: Robinhood (4663) -> must NOT be skipped!
      // Page 4: Empty -> natural catalog end
      if (pageNum === 1) {
        return {
          ok: true,
          text: async () => `<a href="/products/borrow/morpho/4663/0xrh1">RH 1</a>`,
        };
      }
      if (pageNum === 2) {
        return {
          ok: true,
          text: async () => `<a href="/products/borrow/morpho/1/0xeth1">ETH 1</a>`,
        };
      }
      if (pageNum === 3) {
        return {
          ok: true,
          text: async () => `<a href="/products/borrow/morpho/4663/0xrh2">RH 2</a>`,
        };
      }
      return { ok: true, text: async () => '' };
    };

    const routes = await discoverAllRoutes({
      fetcher: mockFetcher,
      baseUrl: 'https://staging.supersmooth.fi',
      productFilter: 'borrow',
      chainFilter: 4663, // Numeric chain ID to verify type coercion
      maxPages: 5,
      includeTopCards: false,
      includeTables: true,
    });

    assert.strictEqual(routes.length, 2);
    assert.ok(routes.some((r) => r.url.includes('0xrh1')));
    assert.ok(routes.some((r) => r.url.includes('0xrh2')));
    assert.deepStrictEqual(requestedPages, [1, 2, 3, 4]);
    console.log(
      '  ✓ Test 9 Passed: discoverAllRoutes does not prematurely abort with chainFilter on sparse pages',
    );
  }

  // Test 10: discoverAllRoutes retries on transient network errors
  {
    let attempts = 0;
    const mockFetcher = async (url) => {
      if (url.includes('/api/product-table/top-cards')) {
        return { ok: true, json: async () => ({ cards: [] }) };
      }
      attempts++;
      if (attempts === 1) {
        throw new Error('Transient ECONNRESET');
      }
      return {
        ok: true,
        text: async () => `<a href="/products/borrow/morpho/8453/0xretried">Retried</a>`,
      };
    };

    const routes = await discoverAllRoutes({
      fetcher: mockFetcher,
      baseUrl: 'https://staging.supersmooth.fi',
      productFilter: 'borrow',
      maxPages: 1,
      includeTopCards: false,
      includeTables: true,
    });

    assert.strictEqual(attempts, 2);
    assert.strictEqual(routes.length, 1);
    assert.ok(routes[0].url.includes('0xretried'));
    console.log('  ✓ Test 10 Passed: discoverAllRoutes retries on transient network errors');
  }

  // --- SUITE 3: HTML Health & 404 Boundary Evaluation ---
  console.log('\n📦 Suite 3: HTML Health & 404 Boundary Evaluation (Issue #1649)');

  // Test 11: checkHtmlHealth detects HTTP 404 status code
  {
    const health = checkHtmlHealth('', 404);
    assert.strictEqual(health.healthy, false);
    assert.strictEqual(health.has404Fallback, true);
    assert.match(health.reason, /404/);
    console.log('  ✓ Test 11 Passed: checkHtmlHealth detects HTTP 404 status code');
  }

  // Test 12: checkHtmlHealth detects DOM "Page not found" fallback
  {
    const htmlWith404 = `
      <html>
        <body>
          <div class="error-container">
            <h1>404</h1>
            <p>This page could not be found.</p>
          </div>
        </body>
      </html>
    `;
    const health = checkHtmlHealth(htmlWith404, 200);
    assert.strictEqual(health.healthy, false);
    assert.strictEqual(health.has404Fallback, true);
    assert.match(health.reason, /Page not found/);
    console.log('  ✓ Test 12 Passed: checkHtmlHealth detects DOM "Page not found" fallback');
  }

  // Test 13: checkHtmlHealth detects unhandled React error boundary
  {
    const htmlWithError = `
      <html>
        <body>
          <div>Application error: a client-side exception has occurred</div>
        </body>
      </html>
    `;
    const health = checkHtmlHealth(htmlWithError, 200);
    assert.strictEqual(health.healthy, false);
    assert.strictEqual(health.hasErrorBoundary, true);
    console.log('  ✓ Test 13 Passed: checkHtmlHealth detects unhandled React error boundary');
  }

  // Test 14: checkHtmlHealth passes for healthy position DOM
  {
    const healthyHtml = `
      <html>
        <body>
          <div id="__next">
            <h2>Configure position</h2>
            <button>Deposit</button>
          </div>
        </body>
      </html>
    `;
    const health = checkHtmlHealth(healthyHtml, 200);
    assert.strictEqual(health.healthy, true);
    assert.strictEqual(health.has404Fallback, false);
    assert.strictEqual(health.hasErrorBoundary, false);
    console.log('  ✓ Test 14 Passed: checkHtmlHealth passes for healthy position DOM');
  }

  // --- SUITE 4: Concurrent Auditing, Reporting & Spec Scaffolding ---
  console.log('\n📦 Suite 4: Concurrent Auditing, Reporting & Spec Scaffolding');

  // Test 15: auditAllRoutes audits routes concurrently with mock fetch
  {
    const mockRoutes = [
      {
        url: '/products/multiply/morpho/8453/0x1111',
        productType: 'multiply',
        protocol: 'morpho',
        chainId: '8453',
        networkName: 'Base',
      },
      {
        url: '/products/borrow/morpho/4663/0x2222',
        productType: 'borrow',
        protocol: 'morpho',
        chainId: '4663',
        networkName: 'Robinhood',
      },
    ];

    const mockFetcher = async (url) => {
      if (url.includes('0x2222')) {
        return {
          status: 404,
          text: async () => '<h1>404 - Page not found</h1>',
        };
      }
      return {
        status: 200,
        text: async () => '<div>Configure position</div>',
      };
    };

    const results = await auditAllRoutes(mockRoutes, {
      fetcher: mockFetcher,
      baseUrl: 'https://staging.supersmooth.fi',
      concurrency: 2,
    });

    assert.strictEqual(results.length, 2);
    const pass = results.find((r) => r.url.includes('0x1111'));
    const fail = results.find((r) => r.url.includes('0x2222'));

    assert.strictEqual(pass.status, 'PASS');
    assert.strictEqual(fail.status, 'FAIL');
    assert.strictEqual(fail.has404Fallback, true);
    console.log('  ✓ Test 15 Passed: auditAllRoutes audits routes concurrently with mock fetch');
  }

  // Test 16: generateAuditReport outputs Markdown summary with stats
  {
    const results = [
      {
        url: '/products/multiply/morpho/8453/0x1111',
        productType: 'multiply',
        protocol: 'morpho',
        chainId: '8453',
        networkName: 'Base',
        status: 'PASS',
        statusCode: 200,
        responseTimeMs: 85,
      },
      {
        url: '/products/borrow/morpho/4663/0x2222',
        productType: 'borrow',
        protocol: 'morpho',
        chainId: '4663',
        networkName: 'Robinhood',
        status: 'FAIL',
        statusCode: 404,
        responseTimeMs: 92,
        errorReason: 'HTTP 404 Not Found',
      },
    ];

    const md = generateAuditReport(results, { baseUrl: 'https://staging.supersmooth.fi' });
    assert.match(md, /Autonomous Route Health Audit Report/);
    assert.match(md, /50\.0%/);
    assert.match(md, /Robinhood/);
    assert.match(md, /Defective Routes Detected/);
    console.log('  ✓ Test 16 Passed: generateAuditReport outputs Markdown summary with stats');
  }

  // Test 17: scaffoldSpec generates clean Playwright test suite
  {
    const routes = [
      {
        url: '/products/yield-loop/spark/1/0x3333',
        productType: 'yield-loop',
        protocol: 'spark',
        networkName: 'Ethereum',
      },
    ];

    const code = scaffoldSpec(routes);
    assert.match(code, /import \{ test \} from '\.\.\/\.\.\/\.\.\/src\/fixtures';/);
    assert.match(code, /app\.vaultPage\.openPage\('\/products\/yield-loop\/spark\/1\/0x3333'\);/);
    assert.match(code, /app\.vaultPage\.shouldBeVisible\(\);/);
    console.log('  ✓ Test 17 Passed: scaffoldSpec generates clean Playwright test suite');
  }

  // --- SUITE 5: Rendered Page-Load Check ---
  console.log('\n📦 Suite 5: Rendered Page-Load Check');

  // What a loaded vault page shows (seen on staging for every product type).
  const loadedSnapshot = {
    headings: ['Open Borrow Position', 'USDT / K3 Capital Prime Market', 'Configure Position'],
    text: 'Open Borrow Position\nUSDT / K3 Capital Prime Market\nConfigure Position',
    skeletonCount: 0,
  };
  const notFoundSnapshot = {
    headings: ["This page doesn't exist"],
    text: "This page doesn't exist\n\nIt may have moved, or the link may be wrong.",
    skeletonCount: 0,
  };
  const skeletonSnapshot = { headings: [], text: 'Back', skeletonCount: 58 };

  // Fake Playwright page that returns the given snapshots in order (the last one repeats).
  const fakePage = (snapshots, { pageError } = {}) => {
    let i = 0;
    const handlers = {};
    return {
      on: (event, fn) => {
        handlers[event] = fn;
      },
      goto: async () => {
        if (pageError) handlers.pageerror?.(new Error(pageError));
      },
      evaluate: async () => snapshots[Math.min(i++, snapshots.length - 1)],
      close: async () => {},
    };
  };
  // Fake clock: sleep() moves time forward instead of waiting.
  const fakeClock = () => {
    let t = 0;
    return { now: () => t, sleep: async (ms) => void (t += ms) };
  };

  // Test 18: classifyRenderedPage passes a page showing both loaded headings
  {
    const result = classifyRenderedPage(loadedSnapshot);
    assert.strictEqual(result.state, 'loaded');
    for (const product of ['Multiply', 'Earn', 'Yield Loop']) {
      const snap = {
        ...loadedSnapshot,
        headings: [`Open ${product} Position`, 'Configure Position'],
      };
      assert.strictEqual(classifyRenderedPage(snap).state, 'loaded', product);
    }
    console.log(
      '  ✓ Test 18 Passed: classifyRenderedPage passes a page showing both loaded headings',
    );
  }

  // Test 19: classifyRenderedPage names known error screens (#1688-style "Invalid market identifier")
  {
    const notFound = classifyRenderedPage(notFoundSnapshot);
    assert.strictEqual(notFound.state, 'failed');
    assert.strictEqual(notFound.kind, 'not-found');
    assert.match(notFound.reason, /Not-found screen despite HTTP 200: "This page doesn't exist"/);

    const invalidMarket = classifyRenderedPage({
      headings: [],
      text: 'Back\nInvalid market identifier: 0x056f-0x3136\nTry again',
      skeletonCount: 0,
    });
    assert.strictEqual(invalidMarket.kind, 'error-screen');
    assert.match(invalidMarket.reason, /"Invalid market identifier: 0x056f-0x3136"/);

    const appError = classifyRenderedPage({
      headings: [],
      text: 'Application error: a client-side exception has occurred (see the browser console)',
      skeletonCount: 0,
    });
    assert.strictEqual(appError.kind, 'error-screen');
    console.log('  ✓ Test 19 Passed: classifyRenderedPage names known error screens');
  }

  // Test 20: the loaded signal wins over error-like text elsewhere on the page (e.g. an FAQ)
  {
    const snap = { ...loadedSnapshot, text: `${loadedSnapshot.text}\nFAQ: Something went wrong?` };
    assert.strictEqual(classifyRenderedPage(snap).state, 'loaded');
    console.log(
      '  ✓ Test 20 Passed: loaded signal wins over error-like text elsewhere on the page',
    );
  }

  // Test 21: without the loaded signal a page is pending, then stuck or missing content at the end
  {
    assert.strictEqual(classifyRenderedPage(skeletonSnapshot).state, 'pending');

    const stuck = classifyRenderedPage(skeletonSnapshot, { final: true, waitedMs: 20000 });
    assert.strictEqual(stuck.kind, 'stuck-loading');
    assert.match(stuck.reason, /Stuck on loading skeleton after 20000ms \(58 placeholders/);

    const noPanel = classifyRenderedPage(
      {
        headings: ['Open Borrow Position', 'USDT / K3 Capital Prime Market'],
        text: '',
        skeletonCount: 0,
      },
      { final: true },
    );
    assert.strictEqual(noPanel.kind, 'missing-content');
    assert.match(noPanel.reason, /no "Configure Position" side panel/);
    assert.doesNotMatch(noPanel.reason, /"Open … Position" heading/);

    const blank = classifyRenderedPage(
      { headings: [], text: '', skeletonCount: 0 },
      { final: true },
    );
    assert.match(blank.reason, /heading or "Configure Position" side panel \(headings: none\)/);
    console.log(
      '  ✓ Test 21 Passed: pages without the loaded signal end as stuck or missing content',
    );
  }

  // Test 22: checkRenderedPage waits through skeletons until the page loads
  {
    const clock = fakeClock();
    const page = fakePage([skeletonSnapshot, skeletonSnapshot, loadedSnapshot]);
    const result = await checkRenderedPage(page, 'https://x/products/borrow/a/1/0x1', {
      ...clock,
      timeoutMs: 5000,
    });
    assert.strictEqual(result.state, 'loaded');
    console.log(
      '  ✓ Test 22 Passed: checkRenderedPage waits through skeletons until the page loads',
    );
  }

  // Test 23: an error screen must stay up before it counts; a brief one is ignored
  {
    const clock = fakeClock();
    const flash = fakePage([notFoundSnapshot, skeletonSnapshot, loadedSnapshot]);
    const ok = await checkRenderedPage(flash, 'https://x/p', { ...clock, errorSettleMs: 1500 });
    assert.strictEqual(ok.state, 'loaded');

    const clock2 = fakeClock();
    const stays = fakePage([notFoundSnapshot], { pageError: 'TypeError: x is undefined\n at y' });
    const failed = await checkRenderedPage(stays, 'https://x/p', {
      ...clock2,
      errorSettleMs: 1500,
      timeoutMs: 20000,
    });
    assert.strictEqual(failed.kind, 'not-found');
    assert.match(failed.reason, /uncaught error: TypeError: x is undefined$/);
    assert.ok(clock2.now() < 5000, `failed fast, not at the timeout (${clock2.now()}ms)`);
    console.log('  ✓ Test 23 Passed: a brief error screen is ignored, a lasting one fails fast');
  }

  // Test 24: checkRenderedPage reports a page stuck on skeletons at the timeout
  {
    const clock = fakeClock();
    const result = await checkRenderedPage(fakePage([skeletonSnapshot]), 'https://x/p', {
      ...clock,
      timeoutMs: 3000,
    });
    assert.strictEqual(result.kind, 'stuck-loading');
    assert.match(result.reason, /after 3000ms/);
    console.log(
      '  ✓ Test 24 Passed: checkRenderedPage reports a page stuck on skeletons at the timeout',
    );
  }

  // Test 25: auditRenderedRoutes fails HTTP-200 routes that do not load and skips HTTP failures
  {
    const opened = [];
    const snapshotsByUrl = {
      '0xaaaa': [loadedSnapshot],
      '0xbbbb': [notFoundSnapshot],
    };
    let closed = false;
    const launchBrowser = async () => ({
      newContext: async () => ({
        newPage: async () => {
          let current = [];
          const page = fakePage([]);
          return {
            ...page,
            goto: async (url) => {
              opened.push(url);
              current = snapshotsByUrl[url.slice(-6)];
            },
            evaluate: async () => current[0],
          };
        },
        close: async () => {},
      }),
      close: async () => {
        closed = true;
      },
    });
    const httpResults = [
      { url: '/products/earn/morpho/1/0xaaaa', status: 'PASS', networkName: 'Ethereum' },
      { url: '/products/earn/morpho/1/0xbbbb', status: 'PASS', networkName: 'Ethereum' },
      { url: '/products/earn/morpho/1/0xcccc', status: 'FAIL', errorReason: 'HTTP 404 Not Found' },
    ];

    const results = await auditRenderedRoutes(httpResults, {
      baseUrl: 'https://staging.supersmooth.fi',
      concurrency: 2,
      errorSettleMs: 0,
      launchBrowser,
    });

    assert.strictEqual(results.length, 3);
    assert.strictEqual(opened.length, 3, 'HTTP failures not opened; the failing page retried once');
    assert.ok(!opened.some((u) => u.endsWith('0xcccc')));
    assert.strictEqual(results[0].status, 'PASS');
    assert.strictEqual(results[0].renderStatus, 'LOADED');
    assert.strictEqual(results[1].status, 'FAIL');
    assert.strictEqual(results[1].failureKind, 'not-found');
    assert.strictEqual(results[1].has404Fallback, true);
    assert.match(results[1].errorReason, /Not-found screen despite HTTP 200.*\(failed 2 tries\)$/);
    assert.strictEqual(results[1].renderAttempts, 2);
    assert.strictEqual(results[2].errorReason, 'HTTP 404 Not Found');
    assert.ok(closed, 'browser is closed');

    const md = generateAuditReport(results, { baseUrl: 'https://staging.supersmooth.fi' });
    assert.match(md, /page load in a browser/);
    assert.match(md, /Not-found screen despite HTTP 200/);
    console.log(
      '  ✓ Test 25 Passed: auditRenderedRoutes fails HTTP-200 routes that do not load, skips HTTP failures',
    );
  }

  // Test 26: a page that fails under load but loads on its retry passes, marked as retried
  {
    let visits = 0;
    const launchBrowser = async () => ({
      newContext: async () => ({
        newPage: async () => ({
          ...fakePage([]),
          goto: async () => {
            visits += 1;
          },
          evaluate: async () => (visits === 1 ? notFoundSnapshot : loadedSnapshot),
        }),
        close: async () => {},
      }),
      close: async () => {},
    });
    const [result] = await auditRenderedRoutes(
      [{ url: '/products/earn/morpho/1/0xdddd', status: 'PASS' }],
      { errorSettleMs: 0, launchBrowser },
    );
    assert.strictEqual(visits, 2);
    assert.strictEqual(result.status, 'PASS');
    assert.strictEqual(result.renderRetried, true);
    console.log('  ✓ Test 26 Passed: a page that loads on its retry passes, marked as retried');
  }

  // Fake browser whose pages show `snapshotFor(url, visit)`; counts every page opened.
  const fakeBrowser = (snapshotFor) => {
    const visits = [];
    return {
      visits,
      launchBrowser: async () => ({
        newContext: async () => ({
          newPage: async () => {
            let url = '';
            return {
              ...fakePage([]),
              goto: async (u) => {
                url = u;
                visits.push(u);
              },
              evaluate: async () => snapshotFor(url, visits.filter((v) => v === url).length),
            };
          },
          close: async () => {},
        }),
        close: async () => {},
      }),
    };
  };
  const passingRoutes = (n) =>
    Array.from({ length: n }, (_, i) => ({
      url: `/products/earn/morpho/1/0x${String(i).padStart(4, '0')}`,
      status: 'PASS',
    }));

  // Test 27: error-like text while skeletons are still up does not fail a slow healthy page
  {
    const loading = {
      headings: [],
      text: 'FAQs\nWhat if something went wrong with my deposit?',
      skeletonCount: 40,
    };
    assert.strictEqual(classifyRenderedPage(loading).state, 'pending');

    const clock = fakeClock();
    const page = fakePage([loading, loading, loading, loading, loading, loadedSnapshot]);
    const result = await checkRenderedPage(page, 'https://x/p', { ...clock, errorSettleMs: 1500 });
    assert.strictEqual(result.state, 'loaded');

    // Once no skeletons are left, the same text counts (e.g. #1688's plain-text error).
    const settled = classifyRenderedPage({
      headings: [],
      text: 'Invalid market identifier: 0x1-0x2.',
      skeletonCount: 0,
    });
    assert.strictEqual(settled.kind, 'error-screen');
    // An error heading counts even while skeletons are still up.
    const heading = classifyRenderedPage({
      headings: ['Something went wrong'],
      text: 'Something went wrong',
      skeletonCount: 12,
    });
    assert.strictEqual(heading.kind, 'error-screen');
    console.log(
      '  ✓ Test 27 Passed: error-like text during loading does not fail a slow healthy page',
    );
  }

  // Test 28: a tab whose script hangs fails as unresponsive instead of blocking the worker
  {
    const hungPage = { ...fakePage([]), evaluate: () => new Promise(() => {}) };
    const result = await checkRenderedPage(hungPage, 'https://x/p', { snapshotTimeoutMs: 50 });
    assert.strictEqual(result.kind, 'unresponsive');
    assert.match(result.reason, /no snapshot within 50ms/);

    // A failed evaluate (e.g. the page navigated mid-call) counts as still loading.
    let calls = 0;
    const flaky = {
      ...fakePage([]),
      evaluate: async () => {
        calls += 1;
        if (calls === 1) throw new Error('Execution context was destroyed');
        return loadedSnapshot;
      },
    };
    const ok = await checkRenderedPage(flaky, 'https://x/p', fakeClock());
    assert.strictEqual(ok.state, 'loaded');
    console.log(
      '  ✓ Test 28 Passed: a hung tab fails as unresponsive; a failed snapshot is retried',
    );
  }

  // Test 29: when the first pages all fail slowly, the check stops and the rest are not checked
  {
    const fake = fakeBrowser(() => skeletonSnapshot);
    const results = await auditRenderedRoutes(passingRoutes(30), {
      concurrency: 2,
      timeoutMs: 1,
      earlyStopAfter: 5,
      launchBrowser: fake.launchBrowser,
    });
    assert.ok(fake.visits.length <= 6, `stopped early (${fake.visits.length} pages opened)`);
    assert.ok(results.every((r) => r.status === 'FAIL'));
    const notChecked = results.filter((r) => r.failureKind === 'not-checked');
    assert.ok(notChecked.length >= 24);
    assert.match(
      notChecked[0].errorReason,
      /first 5 pages all failed to load, so staging looks down/,
    );
    console.log('  ✓ Test 29 Passed: the check stops early when the first pages all fail slowly');
  }

  // Test 30: the retry is skipped when too many pages fail, and capped otherwise
  {
    // 12 of 30 fail (40% > 20%, and more than 10): no retry.
    const many = fakeBrowser((url) =>
      /00(0\d|1[01])$/.test(url) ? notFoundSnapshot : loadedSnapshot,
    );
    const results = await auditRenderedRoutes(passingRoutes(30), {
      errorSettleMs: 0,
      earlyStopAfter: 0,
      launchBrowser: many.launchBrowser,
    });
    assert.strictEqual(many.visits.length, 30, 'no page opened twice');
    const failed = results.filter((r) => r.status === 'FAIL');
    assert.strictEqual(failed.length, 12);
    assert.match(
      failed[0].errorReason,
      /not retried: 12 of 30 pages failed \(40%\), staging looks down/,
    );

    // 2 of 10 fail (20%): retried, but only 1 because of maxRetries.
    const few = fakeBrowser((url) => (/000[0-1]$/.test(url) ? notFoundSnapshot : loadedSnapshot));
    const capped = await auditRenderedRoutes(passingRoutes(10), {
      errorSettleMs: 0,
      earlyStopAfter: 0,
      maxRetries: 1,
      launchBrowser: few.launchBrowser,
    });
    assert.strictEqual(few.visits.length, 11);
    const reasons = capped.filter((r) => r.status === 'FAIL').map((r) => r.errorReason);
    assert.ok(reasons.some((r) => /\(failed 2 tries\)$/.test(r)));
    assert.ok(reasons.some((r) => /over the 1-page retry limit/.test(r)));
    console.log(
      '  ✓ Test 30 Passed: the retry is skipped when too many pages fail, and capped otherwise',
    );
  }

  console.log('\n🎉 All 30 Autonomous Route Crawler tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('❌ Test Suite Failure:', err);
  process.exit(1);
});
