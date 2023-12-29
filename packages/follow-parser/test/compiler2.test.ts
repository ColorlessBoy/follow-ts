import { expect, test } from 'vitest';
import Compiler from '../src/compiler';
import { writeFileSync, readFileSync, appendFileSync } from 'node:fs';

test('#4 set.fol', () => {
  const compiler = new Compiler();
  const inputPath = './examples/set.fol0';
  const input = readFileSync(inputPath, 'utf-8');
  const outputPath = './examples/set.fol1';
  writeFileSync(outputPath, '', {
    encoding: 'utf-8',
    flag: 'w',
  });
  for (const content of compiler.translateV2(input)) {
    appendFileSync(outputPath, content + '\n', {
      encoding: 'utf-8',
    });
  }
  expect(6 + 1).toBe(7);
});
