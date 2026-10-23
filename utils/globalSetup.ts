import type { FullConfig } from '@playwright/test';

// Log the base URL for the tests
export default function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || process.env.BASE_URL;
  console.log(`\n🌐 Running tests against baseURL: ${baseURL}\n`);
}
