import { expect, test } from 'vitest';
import { Node, NodeType } from '../src/types';
import Parser from '../src/parser';

function eqNode(node: Node, nodeType: NodeType, type?: string, value?: string): boolean {
  if (node === undefined) {
    return false;
  }
  if (node.nodeType !== nodeType) {
    return false;
  }
  if (type && node.type?.value !== type) {
    return false;
  }
  if (value && node.name?.value !== value) {
    return false;
  }
  return true;
}

test('#1 parse import', () => {
  const input = "import 'def.fol'";
  const parser = new Parser(input);
  const nodes: Array<Node> = parser.getNodes();
  expect(nodes.length).toBe(2);
  expect(eqNode(nodes[0], NodeType.IMPORT, undefined, "'def.fol'")).toBe(true);
});

test('#2 parse typedef', () => {
  const input = 'type wff';
  const parser = new Parser(input);
  const nodes: Array<Node> = parser.getNodes();
  expect(nodes.length).toBe(2);
  expect(eqNode(nodes[0], NodeType.TYPE_DEF, 'wff', undefined)).toBe(true);
});

test('#3 parse constdef', () => {
  const input = 'const wff true';
  const parser = new Parser(input);
  const nodes: Array<Node> = parser.getNodes();
  expect(nodes.length).toBe(2);
  expect(eqNode(nodes[0], NodeType.CONST_DEF, 'wff', 'true')).toBe(true);
});

test('#4 parse propdef', () => {
  const input = 'prop wff imp(wff w0, wff w1)';
  const parser = new Parser(input);
  const nodeList: Array<Node> = parser.getNodes();
  expect(nodeList.length).toBe(2);
  expect(eqNode(nodeList[0], NodeType.PROP_DEF, 'wff', 'imp')).toBe(true);

  const node = nodeList[0];
  expect(node.params?.length).toBe(2);
  const params = node.params;
  if (params) {
    expect(eqNode(params[0], NodeType.ARG_DEF, 'wff', 'w0')).toBe(true);
    expect(eqNode(params[1], NodeType.ARG_DEF, 'wff', 'w1')).toBe(true);
  }
});

test('#5 parse axiomdef', () => {
  const input = 'axiom ax1(wff w0, wff w1) { |- imp(w0, imp(w1, w0) }';
  const parser = new Parser(input);
  const nodeList: Array<Node> = parser.getNodes();
  expect(nodeList.length).toBe(2);
  expect(eqNode(nodeList[0], NodeType.AXIOM_DEF, undefined, 'ax1')).toBe(true);

  const node = nodeList[0];
  expect(node.params?.length).toBe(2);
  expect(node.body?.target?.tokens?.length).toBe(5);
  const params = node.params;
  if (params) {
    expect(eqNode(params[0], NodeType.ARG_DEF, 'wff', 'w0')).toBe(true);
    expect(eqNode(params[1], NodeType.ARG_DEF, 'wff', 'w1')).toBe(true);
  }
});

test('#6 parse thmdef', () => {
  const input = 'thm thm1(wff w0, wff w1) { -| w0 |- imp(w1, w0) } = { mp(w0, imp w1 w0) ax1(w0, w1)}';
  const parser = new Parser(input);
  const nodeList: Array<Node> = parser.getNodes();
  expect(nodeList.length).toBe(2);
  expect(eqNode(nodeList[0], NodeType.THEOREM_DEF, undefined, 'thm1')).toBe(true);

  const node = nodeList[0];
  expect(node.params?.length).toBe(2);
  expect(node.body?.assumes?.length).toBe(1);
  expect(node.body?.target?.tokens?.length).toBe(3);
  expect(node.proof?.tokens?.length).toBe(8);
  const params = node.params;
  if (params) {
    expect(eqNode(params[0], NodeType.ARG_DEF, 'wff', 'w0')).toBe(true);
    expect(eqNode(params[1], NodeType.ARG_DEF, 'wff', 'w1')).toBe(true);
  }
});
