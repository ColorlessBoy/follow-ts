import { expect, test } from 'vitest';
import { FollowPrismaClient } from '../src/client';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

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
  // const jsonMap = JSON.parse(readFileSync('./examples/block-path-map.json', 'utf-8'));
  // const blockPathMap: Map<string, string> = new Map(Object.entries(jsonMap));
  const blockPathMap: Map<string, string> = new Map();
  await client.generateMdFiles(markdownBlock, './examples/', '', 0, blockPathMap);
  const blockMapPath = './examples/set-mm/block-path-map.json';
  writeFileSync(blockMapPath, JSON.stringify(Object.fromEntries(blockPathMap)));
  expect(markdownBlock !== undefined).toBe(true);
});

test('#4 toJson', async () => {
  const inputFile = './examples/set.mm';
  const input = readFileSync(inputFile, 'utf-8');
  const client = new FollowPrismaClient();
  const markdownBlock = await client.toMarkdown(input, 'set.mm');
  const outputDir = './examples/follow-setmm-json/';
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir);
  }
  client.generateFileIndex(markdownBlock);
  const blockTitleIndex = client.generateBlockFileIndexMap(markdownBlock);
  await client.generateJsonFiles(markdownBlock, outputDir);
  const content = await client.generateContentJson(markdownBlock);
  const indexJson = {
    blockTitleIndex: blockTitleIndex.map((e) => {
      return [e.name, e.index];
    }),
  };
  writeFileSync(outputDir + 'content.json', JSON.stringify(content));
  writeFileSync(outputDir + 'index.json', JSON.stringify(indexJson));
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
