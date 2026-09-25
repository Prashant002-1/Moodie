import { expect, it } from 'vitest';
import { releaseYear } from '../../src/utils/display';

it('keeps release-date years as calendar years at UTC boundaries', () => {
  expect(releaseYear('2020-01-01')).toBe('2020');
  expect(releaseYear('2020-01-01T00:00:00.000Z')).toBe('2020');
  expect(releaseYear(null)).toBe('Date unknown');
  expect(releaseYear('not a date')).toBe('Date unknown');
});
