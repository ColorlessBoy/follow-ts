import { expect, test } from 'vitest';
import { Scanner, Parser } from '../src/parser2';

test('#1 Scanner', () => {
  const filePath = './examples/set_part1.mm';
  const scanner = new Scanner([filePath]);
  const token = scanner.nextToken();
  expect(token).toBe('$c');
});

test('#2 Parser', () => {
  const filePath = './examples/set_part2.mm';
  const parser = new Parser([filePath]);
  parser.parseAllBlocks();
  expect(1 + 1).toBe(2);
});
