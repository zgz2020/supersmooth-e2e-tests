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

  console.log('\n🎉 All 17 Autonomous Route Crawler tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('❌ Test Suite Failure:', err);
  process.exit(1);
});
