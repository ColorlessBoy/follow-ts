import { expect, test } from 'vitest';
import { hello } from '../src/main';

test('hello', () => {
  expect(hello('test')).toBe('Hello test, this is follow-parser!');
});
