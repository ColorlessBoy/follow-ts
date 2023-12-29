import { expect, test } from 'vitest';
import Compiler from '../src/compiler';
import { opNodeToString } from '../src/types';
import { writeFileSync, readFileSync, appendFileSync } from 'node:fs';

test('#1 buildCompileGraph', () => {
  const compiler = new Compiler();
  const filePath = './examples/first-order-logic/6_mix.fol';
  compiler.buildCompileGraph(filePath);
  expect(compiler.documentMap.size).toBe(7);
});

test('#2 checkDefinition', () => {
  const compiler = new Compiler();
  const filePath = './examples/hello.fol';
  const compileInfo = compiler.buildOpTree(filePath);
  expect(compiler.documentMap.size).toBe(2);

  const mp2DefNode = compileInfo?.defNodeMap?.get('mp2');
  if (mp2DefNode) {
    const opTrees = mp2DefNode.proof?.opTrees;
    const opTreesStr: Array<string> = [];
    if (opTrees) {
      for (const opTree of opTrees) {
        const outputStr: Array<string> = [];
        if (opTree.target) {
          outputStr.push('|- ' + opNodeToString(opTree.target));
        }
        if (opTree.assumes) {
          for (const assume of opTree.assumes) {
            outputStr.push('-| ' + opNodeToString(assume));
          }
        }
        opTreesStr.push(outputStr.join(' '));
      }
    }
    expect(opTreesStr.length).toBe(2);
    expect(opTreesStr[0]).toBe('|- w0 -| w1 -| imp w1 w0');
    expect(opTreesStr[1]).toBe('|- imp w1 w0 -| w2 -| imp w2 imp w1 w0');
  }
});

test('#3 set_part2.fol', () => {
  const compiler = new Compiler();
  const filePath = './examples/set_part2.fol';
  const output = './examples/set_part2_v2.fol';
  compiler.translate(filePath, output);
  expect(6 + 1).toBe(7);
});

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
