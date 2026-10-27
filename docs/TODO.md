# E2E & Frontend Improvements TODO

## Missing `data-testid` / Semantic Attributes in App Code

### 1. Product Top Cards Container & Card Items

- **Location in tests**: [`src/pages/topCards.ts`](../src/pages/topCards.ts)
- **Current selector**:
  ```typescript
  this.cards = this.tabList
    .locator('xpath=ancestor::div[contains(@class, "items-start")][1]')
    .locator('a[href^="/products/"]');
  ```
- **Why it needs improvement**:
  - Both the top 4 cards and the product table rows below them render `<a href='/products/...'>` links without any distinguishing `role`, `aria-label`, or `data-testid` on the top cards container.
  - Relying on XPath ancestor traversal and Tailwind utility classes (`items-start`) is brittle and coupled to styling.
- **Action needed in frontend app repo**:
  - Add `data-testid='top-cards-container'` (or a `<section aria-label='Top product cards'>` landmark / `role='tabpanel'`) to the top cards wrapper.
  - Add `data-testid='top-card'` to each individual card link.
- **Target selector once added**:
  ```typescript
  this.cards = page.getByTestId('top-card');
  // or
  this.cards = page.getByTestId('top-cards-container').getByRole('link');
  ```

### 2. Product Top Cards Tablist (`tabList`)

- **Location in tests**: [`src/pages/topCards.ts`](../src/pages/topCards.ts)
- **Current selector**:
  ```typescript
  this.tabList = page.getByRole('tablist');
  ```
- **Why it needs improvement**:
  - `page.getByRole('tablist')` is not scoped or named. If the page ever renders a second tab list (e.g., inside the product table filters or another section), it will fail Playwright's strict mode.
- **Action needed in frontend app repo**:
  - Add an `aria-label` (e.g. `aria-label='Top cards filter'`) or `data-testid='top-cards-tablist'` to the top cards `[role='tablist']` element, or scope it inside `data-testid='top-cards-container'`.
- **Target selector once added**:
  ```typescript
  this.tabList = page.getByRole('tablist', { name: 'Top cards filter' });
  // or scoped to container:
  this.tabList = this.container.getByRole('tablist');
  ```

### 3. Product Top Card Inner Fields (`getTopCardsData` in `TopCards`)

- **Location in tests**: [`src/pages/topCards.ts`](../src/pages/topCards.ts) (`getTopCardsData`)
- **Current implementation**:
  - Reads the entire card `innerText()`, splits by `\n`, and searches line indices (`lines.findIndex((l) => l === 'Current APY')`, `lines.findIndex((l) => l === 'Liquidity')`) to locate the values on the next line.
- **Why it needs improvement**:
  - Splitting raw `innerText()` by newline and indexing into adjacent lines is overly complicated and fragile if card layout, badges, or labels change.
  - Other product types (`multiply`, `borrow`, `yieldLoop`) display different primary metrics (`Protocol Borrow Rate`, `Max Multiple`, `Max LTV`, `APY`) alongside `Liquidity`.
- **Action needed in frontend app repo**:
  - Add `data-testid` attributes (or semantic `<dl>` / `<dt>` / `<dd>` elements) to the inner elements of each top card:
    - `data-testid='top-card-title'` (asset / strategy title)
    - `data-testid='top-card-primary-metric-label'` & `data-testid='top-card-primary-metric-value'` (or `data-testid='top-card-current-apy'`, `data-testid='top-card-borrow-rate'`, etc.)
    - `data-testid='top-card-liquidity'` (liquidity value)
- **Target implementation once added**:
  ```typescript
  const title = await card.getByTestId('top-card-title').innerText();
  const apyText = await card.getByTestId('top-card-current-apy').innerText();
  const liquidityText = await card.getByTestId('top-card-liquidity').innerText();
  ```

### 4. Configure Position Right-Side Panel (`panelLocator`)

- **Location in tests**: [`src/pages/rightSidePanel/configurePosition.ts`](../src/pages/rightSidePanel/configurePosition.ts)
- **Current selector**:
  ```typescript
  this.panelLocator = this.page.locator('[data-open-position-sidebar]');
  // TODO: Add testid for all position types to create a proper 'panelLocator'
  ```
- **Why it needs improvement**:
  - `[data-open-position-sidebar]` is not consistently present across all position types (e.g., Multiply, Borrow, Earn, Yield Loop, Perps/Spot), forcing child locators in [`ConfigurePosition`](../src/pages/rightSidePanel/configurePosition.ts) to query from `this.page` directly instead of scoping to `this.panelLocator`.
- **Action needed in frontend app repo**:
  - Add a consistent `data-testid='configure-position-panel'` (or `<aside aria-label='Configure position'>`) across all position configuration sidebars.
- **Target selector once added**:
  ```typescript
  this.panelLocator = this.page.getByTestId('configure-position-panel');
  ```
  *(And update methods in [`ConfigurePosition`](../src/pages/rightSidePanel/configurePosition.ts) to scope their queries to `this.panelLocator` instead of `this.page`.)*
