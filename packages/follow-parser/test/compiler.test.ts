import { expect, test } from 'vitest';
import Compiler from '../src/compiler';
import { opNodeString } from '../src/types';

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
          outputStr.push('|- ' + opNodeString(opTree.target));
        }
        if (opTree.assumes) {
          for (const assume of opTree.assumes) {
            outputStr.push('-| ' + opNodeString(assume));
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
