import { expect, test } from 'vitest';
import { CommentParser } from '../src/CommentParser';
import { readFileSync } from 'fs';

test('#1 Comment Parser', async () => {
  const inputFile = './examples/set_part2.mm';
  const input = readFileSync(inputFile, 'utf-8');
  const commentParser = new CommentParser();
  commentParser.parseInput(input);
  expect(1 + 1).toBe(2);
});

test('#2 Markdown', async () => {
  const inputFile = './examples/set.mm';
  const input = readFileSync(inputFile, 'utf-8');
  const commentParser = new CommentParser();
  commentParser.parseInput(input);
  const markdownBlock = commentParser.toMarkdown('Set.mm');
  expect(markdownBlock !== undefined).toBe(true);
});
