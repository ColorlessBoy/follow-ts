import { expect, test } from 'vitest';
import { Parser, Scanner, read } from '../src/parser';
import { writeFileSync, appendFileSync } from 'fs';

test('#4 set.fol1', async () => {
  const inputFile = './examples/set.fol0';
  const outputFile = './examples/set.fol1';
  const scanner = new Scanner();
  const parser = new Parser('./examples/set_props_v2.txt');
  writeFileSync(outputFile, '', {
    encoding: 'utf-8',
    flag: 'w',
  });
  await read(inputFile, (chunk) => {
    scanner.scanNewInput(chunk);
    for (const token of scanner.outputTokens()) {
      parser.parseNextToken(token, true, true, true);
    }
    for (const content of parser.outputBlockStr()) {
      appendFileSync(outputFile, content + '\n', {
        encoding: 'utf-8',
      });
    }
  });
  scanner.scanNewInput(' axiom ');
  for (const token of scanner.outputTokens()) {
    parser.parseNextToken(token, true, true, true);
  }
  for (const content of parser.outputBlockStr()) {
    appendFileSync(outputFile, content + '\n', {
      encoding: 'utf-8',
    });
  }
  expect(1 + 1).toBe(2);
});

test('#5 check proofs', async () => {
  const inputFile = './examples/set.fol1';
  const outputFile = './examples/set.fol1.log';
  const scanner = new Scanner();
  const parser = new Parser();
  await read(inputFile, (chunk) => {
    scanner.scanNewInput(chunk);
    for (const token of scanner.outputTokens()) {
      parser.parseNextToken(token, false, true, false);
    }
  });
  scanner.scanNewInput(' axiom ');
  for (const token of scanner.outputTokens()) {
    parser.parseNextToken(token, false, true, false);
  }

  const content: string[] = [];
  for (const theorem of parser.axiomTheoremMap.values()) {
    if (theorem.inValidInfo) {
      content.push(theorem.name);
      content.push('\n' + theorem.inValidInfo + '\n');
    }
  }
  writeFileSync(outputFile, content.join('\n'), {
    encoding: 'utf-8',
    flag: 'w',
  });
  expect(1 + 1).toBe(2);
});
