import { test, expect } from '@playwright/test';
import { tc } from '../../utils/testCase';
import { loadCatalogue, priorityTag } from '../../scripts/tc/catalogue';

test.describe('tc()', () => {
  test('links the ID and tags every catalogue case with its own priority', () => {
    const { cases } = loadCatalogue();
    expect(cases.length).toBeGreaterThan(0);

    for (const testCase of cases) {
      expect(tc(testCase.id)).toEqual({
        annotation: { type: 'tc', description: testCase.id },
        tag: [priorityTag(testCase.priority)],
      });
    }
  });

  test('maps priorities to lowercase tags', () => {
    expect(priorityTag('P1')).toBe('@p1');
    expect(priorityTag('P2')).toBe('@p2');
    expect(priorityTag('P3')).toBe('@p3');
    expect(priorityTag('P9')).toBeUndefined();
    expect(priorityTag(undefined)).toBeUndefined();
  });

  test('adds no tag for a well-formed ID missing from the catalogue', () => {
    expect(tc('API-ZZZ-999')).toEqual({ annotation: { type: 'tc', description: 'API-ZZZ-999' } });
  });

  test('rejects malformed IDs', () => {
    expect(() => tc('COMP-1')).toThrow('Invalid test case ID "COMP-1"');
  });
});
