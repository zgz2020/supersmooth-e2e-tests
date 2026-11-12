/**
 * Test case traceability helpers.
 *
 * Every Playwright test is linked to exactly one test case in the `test-cases/` catalogue
 * by passing `tc('<ID>')` as the test details argument:
 *
 *   test('should flag sanctioned wallet address', tc('API-COMP-009'), async ({ request }) => {
 *     ...
 *   });
 *
 * - The ID is attached as a `tc` annotation, so it shows up in the HTML and JSON reports.
 * - The case's catalogue priority is added as a tag (`@p1`, `@p2`, `@p3`), so suites can be run
 *   by priority, e.g. `pnpm test:api --grep @p1`.
 *
 * `pnpm tc:check` (scripts/tc/check-traceability.js) verifies that test code and catalogue stay
 * in sync. Both use the same catalogue parser (scripts/tc/catalogue.js). See
 * docs/test-case-management.md.
 */
import {
  ID_PATTERN,
  TC_ANNOTATION_TYPE,
  loadCatalogue,
  priorityTag,
} from '../scripts/tc/catalogue';

export { ID_PATTERN as TC_ID_PATTERN, TC_ANNOTATION_TYPE };

type TestCaseDetails = {
  annotation: { type: string; description: string };
  tag?: string[];
};

let prioritiesById: Map<string, string | undefined> | undefined;

/** Case priorities by ID, parsed once per worker from the catalogue. */
function priorityOf(id: string): string | undefined {
  prioritiesById ??= new Map(loadCatalogue().cases.map((tc) => [tc.id, tc.priority]));
  return prioritiesById.get(id);
}

export function tc(id: string): TestCaseDetails {
  if (!ID_PATTERN.test(id)) {
    throw new Error(
      `Invalid test case ID "${id}". Expected <TYPE>-<AREA>-<NNN>, e.g. API-COMP-001`,
    );
  }
  // Unknown IDs get no tag here; `pnpm tc:check` reports them as errors.
  const tag = priorityTag(priorityOf(id));
  return {
    annotation: { type: TC_ANNOTATION_TYPE, description: id },
    ...(tag ? { tag: [tag] } : {}),
  };
}
