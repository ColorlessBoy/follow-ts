import { expect, test } from 'vitest';
import { Translator } from '../src/translator2';

import { writeFileSync, appendFileSync } from 'fs';

test('#2 setfol0', () => {
  const filePath = './examples/set.mm';
  const translator = new Translator([filePath]);
  let count = 0;
  const outputPath = `./examples/set.fol0`;
  writeFileSync(outputPath, '', {
    encoding: 'utf-8',
    flag: 'w',
  });
  for (const content of translator.toFollow()) {
    count += 1;
    appendFileSync(outputPath, content, {
      encoding: 'utf-8',
    });
  }
  appendFileSync(outputPath, '\n', {
    encoding: 'utf-8',
  });
  expect(count).toBe(44027);
});
