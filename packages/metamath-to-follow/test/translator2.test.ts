import { expect, test } from 'vitest';
import { Translator } from '../src/translator2';

import { writeFileSync, appendFileSync } from 'fs';

test('#1 Grammar', () => {
  const filePath = './examples/set.mm';
  const translator = new Translator([filePath], true);
  const grammarName = 'AntlrMetamath';
  const grammar = translator.generateAntlrGrammar(grammarName);

  const outputPath = `./packages/metamath-to-follow/${grammarName}.g4`;

  writeFileSync(outputPath, grammar, {
    encoding: 'utf-8',
    flag: 'w',
  });
  expect(grammar.length).toBe(46591);
});

test('#2 ToFollow', () => {
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
  expect(count).toBe(44092);
});
