import { expect, test } from 'vitest';
import { Translator } from '../src/translator2';

import { writeFileSync } from 'fs';

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
  expect(grammar.length).toBe(46751);
});
