import { expect, test } from 'vitest';
import { Parser, Scanner, read } from '../src/parser2';
import { writeFileSync, appendFileSync } from 'fs';

test('#1 read chinese', async () => {
  const input = './examples/test_chinese.txt';
  const output: string[] = [];
  await read(
    input,
    (chunk) => {
      output.push(chunk);
    },
    1,
  );
  expect(output.length).toBe(3);
});

test('#2 scanner', () => {
  const input1 = '/* block comment */const wff hw0// line ';
  const input2 = 'comment\nconst w';
  const input3 = 'ff hw1\n';
  const input4 = 'axiom ax-1(wff w0, wff w1) {|- wi(w0, w1)}';
  const scanner = new Scanner();
  scanner.scanNewInput(input1);
  scanner.scanNewInput(input2);
  scanner.scanNewInput(input3);
  scanner.scanNewInput(input4);
  expect(scanner.tokenBuffer.length).toBe(24);
});

test('#3 parser', () => {
  const input1 = '/* block comment */const wff hw0// line ';
  const input2 = 'comment\nconst w';
  const input3 = 'ff hw1\n';
  const input4 = 'axiom ax-1(wff w0, wff w1) {|- wi(w0, w1)}';
  const scanner = new Scanner();
  scanner.scanNewInput(input1);
  scanner.scanNewInput(input2);
  scanner.scanNewInput(input3);
  scanner.scanNewInput(input4);

  const parser = new Parser();
  for (const token of scanner.outputTokens()) {
    parser.parseNextToken(token);
  }
  parser.parseNextToken('');

  expect(parser.blockStrBuffer.length).toBe(3);
});

test('#44 parse files', async () => {
  const inputFile = './examples/set_part2.fol0';
  const outputFile = './examples/set_part2.fol1';
  const scanner = new Scanner();
  const parser = new Parser();
  writeFileSync(outputFile, '', {
    encoding: 'utf-8',
    flag: 'w',
  });
  await read(inputFile, (chunk) => {
    scanner.scanNewInput(chunk);
    for (const token of scanner.outputTokens()) {
      parser.parseNextToken(token);
    }
    for (const content of parser.outputBlockStr()) {
      appendFileSync(outputFile, content + '\n', {
        encoding: 'utf-8',
      });
    }
  });
  parser.parseNextToken('');
  expect(1 + 1).toBe(2);
});
