# sov-e2e-tests

End-to-end (E2E) testing suite for the Sovereign (SOV) web3 application using Playwright, TypeScript, and `pnpm`.

---

## 🚀 Tech Stack

- **Testing Framework:** [Playwright](https://playwright.dev/) (`@playwright/test`)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Package Manager:** [`pnpm`](https://pnpm.io/)
- **Runtime:** Node.js (v20 LTS recommended via `.nvmrc`)

---

## 🛠️ Prerequisites

Ensure you have Node.js (v20+) and `pnpm` installed on your machine.

If you use `nvm`, switch to the recommended Node version:

```bash
nvm use
```

Install dependencies:

```bash
pnpm install
```

Install Playwright browsers (if needed):

```bash
pnpm exec playwright install
```

---

## 📜 Available Scripts

| Script             | Description                                        |
| :----------------- | :------------------------------------------------- |
| `pnpm test`        | Runs all Playwright E2E tests in headless mode     |
| `pnpm test:ui`     | Opens the Playwright Interactive UI Mode           |
| `pnpm test:headed` | Runs E2E tests in visible (headed) browser windows |
| `pnpm typecheck`   | Validates TypeScript types across the codebase     |

---

## 📁 Repository Structure

```text
.
├── .gitignore          # Git ignore configuration
├── .nvmrc              # Node version specification (v20)
├── package.json        # Project metadata and dependencies
├── playwright.config.ts# Playwright configuration (browsers, reporters, trace)
├── pnpm-lock.yaml      # Locked dependencies file
├── README.md           # Project documentation
├── tests/              # E2E test specs directory
│   └── example.spec.ts # Sample E2E test
└── tsconfig.json       # TypeScript compiler options
```

---

## 🧪 Running Tests

### Headless Mode

```bash
pnpm test
```

### Interactive UI Mode

```bash
pnpm test:ui
```

### View HTML Test Report

```bash
pnpm exec playwright show-report
```
