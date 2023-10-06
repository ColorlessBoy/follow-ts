import { expect, test } from 'vitest';
import ImportParser from '../src/import';

test('#1 init import parser', () => {
  const importParser = new ImportParser();
  const filePath = './examples/first-order-logic/6_mix.fol';
  importParser.parseFile(filePath);
  expect(importParser.documentMap.size).toBe(7);
});
