import { expect, test } from 'vitest';
import { FollowPrismaClient } from '../src/client';
import { readFileSync, writeFileSync } from 'node:fs';

test('#1 prisma', async () => {
  const inputFile = './examples/set.fol1';
  const client = new FollowPrismaClient();
  const start = 0;
  await client.importFromFollow(inputFile, start, true);
  expect(1 + 1).toBe(2);
});

test('#2 comment', async () => {
  const inputFile = './examples/set.mm';
  const input = readFileSync(inputFile, 'utf-8');
  const client = new FollowPrismaClient();
  await client.addComments(input);
  expect(1 + 1).toBe(2);
});

test('#3 toMarkdown', async () => {
  const inputFile = './examples/set.mm';
  const input = readFileSync(inputFile, 'utf-8');
  const client = new FollowPrismaClient();
  const markdownBlock = await client.toMarkdown(input, 'set.mm');
  const outputFile = './examples/set.json';
  writeFileSync(outputFile, JSON.stringify(markdownBlock), {
    encoding: 'utf-8',
    flag: 'w',
  });
  expect(markdownBlock !== undefined).toBe(true);
});

test('#4 getAllConstProps', async () => {
  const client = new FollowPrismaClient();
  const props = await client.getAllConstProps();
  const outputFile = './examples/set_props.txt';
  writeFileSync(outputFile, props, {
    encoding: 'utf-8',
    flag: 'w',
  });
  expect(1 + 1).toBe(2);
});
