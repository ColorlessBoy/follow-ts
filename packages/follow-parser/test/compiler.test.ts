import { expect, test } from 'vitest';
import Compiler from '../src/compiler';

test('#1 init import parser', () => {
  const importParser = new Compiler();
  const filePath = './examples/first-order-logic/6_mix.fol';
  importParser.parseFileRound1(filePath);
  expect(importParser.documentMap.size).toBe(7);
});
