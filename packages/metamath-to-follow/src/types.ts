export enum Error {
  ConstNameDuplicated = 'ConstNameDuplicated',
  VarNameDuplicated = 'VarNameDuplicated',
  TypeUndefined = 'TypeUndefined',
  VarUndefined = 'VarUndefined',
  ConstUndefined = 'ConstUndefined',

  FloatLabelMissing = 'FloatLabelMissing',
  FloatTypeMissing = 'FloatTypeMissing',
  FloatVariableMissing = 'FloatVariableMissing',
  FloatTokenUseless = 'FloatTokenUseless',

  EssentialBodyUndefined = 'EssentialBodyUndefined',
  EssentailLabelMissing = 'EssentailLabelMissing',
  EssentialTypeMissing = 'EssentialTypeMissing',
  EssentialBodyEmpty = 'EssentialBodyEmpty',

  AxiomBodyUndefined = 'AxiomBodyUndefined',
  AxiomLabelMissing = 'AxiomLabelMissing',
  AxiomTypeMissing = 'AxiomTypeMissing',
  AxiomBodyEmpty = 'AxiomBodyEmpty',

  ProveBodyUndefined = 'ProveBodyUndefined',
  ProveLabelMissing = 'ProveLabelMissing',
  ProveTypeMissing = 'ProveTypeMissing',
  ProveBodyEmpty = 'ProveBodyEmpty',
  ProveProofEmpty = 'ProveProofEmpty',
}

// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#position
export interface Position {
  offset: number; // zero-based
  line: number; // zero-based
  character: number; // zero-based
}

// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#range
export interface Range {
  start: Position;
  end: Position; // exclusive
}

export enum TokenType {
  COMMENT = 'comment', // `$( * $)`
  IMPORT = 'import', // `$[ * $]`
  CONST = 'const',
  VAR = 'variable',
  DISJOINT = 'disjoint',
  FLOAT = 'float',
  ESSENTIAL = 'essential',
  AXIOM = 'axiom',
  PROVE = 'prove',
  EQ = 'eq',
  END = 'end',
  BSTART = 'block_start',
  BEND = 'block_end',
  WORD = 'word',
  EOF = 'eof',
  UNKNOWN = 'unknown',

  TYPE_VAL = 'type_val',
  VAR_VAL = 'var_val',
  CONST_VAL = 'const_val',
  FLOAT_LABEL = 'float_label',
  ESSENTIAL_LABEL = 'essential_label',
  AXIOM_LABEL = 'axiom_label',
  PROVE_LABEL = 'prove_label',
}

export interface Token {
  tokenType: TokenType;
  range: Range;
  value: string;
  error?: Error;
  filename?: string;
}

export function createPosition(offset: number, line: number, character: number): Position {
  return { offset: offset, line: line, character: character };
}
export function clonePosition(position: Position): Position {
  return { offset: position.offset, line: position.line, character: position.character };
}
export function createRange(start: Position, end: Position): Range {
  return {
    start: start,
    end: end,
  };
}
export function cloneRange(range: Range): Range {
  return {
    start: range.start,
    end: range.end,
  };
}
export function createToken(
  tokenType: TokenType,
  start: Position,
  end: Position,
  value: string,
  filename?: string,
): Token {
  return {
    tokenType: tokenType,
    range: createRange(start, end),
    value: value,
    filename: filename,
  };
}

export type ScannerOptions = {
  sourceRange?: Range;
  sourceFilename?: string;
};

export interface Frame {
  constants: Map<string, Token>;
  variables: Map<string, Token>;
  disjoints: Map<string, DisjointNode>;
  floats: Array<FloatNode>;
  floatMap: Map<string, FloatNode>;
  essentials: Array<EssentialNode>;
  essentialsMap: Map<string, EssentialNode>;
  axioms: Array<AxiomNode>;
  axiomsMap: Map<string, AxiomNode>;
  prove: Array<ProveNode>;
  proveMap: Map<string, ProveNode>;
  errorNodes: Array<Node>;
}

export enum NodeType {
  KEYWORD = 'keyword', // type const prop axiom thm -| |-
  NAME = 'name', // block name
  FLOAT = 'float',
  ESSENTIAL = 'essential',
  DISJOINT = 'disjoint',
  AXIOM = 'axiom',
  PROVE = 'prove',
}

export type Node = FloatNode | EssentialNode | AxiomNode | ProveNode;

export interface NodeBase {
  nodeType: NodeType;
  error?: Error;
}

export interface FloatNode extends NodeBase {
  nodeType: NodeType.FLOAT;
  keyword: Token;
  label?: Token;
  type?: Token;
  variable?: Token;
}

export interface EssentialNode extends NodeBase {
  nodeType: NodeType.ESSENTIAL;
  keyword: Token;
  label?: Token;
  type?: Token;
  body: Array<Token>;
}

export interface AxiomNode extends NodeBase {
  nodeType: NodeType.AXIOM;
  keyword: Token;
  label?: Token;
  type?: Token;
  body: Array<Token>;
  essentials: Array<EssentialNode>;
  floats: Array<FloatNode>;
  disjointMap: Map<string, DisjointNode>;
}

export interface ProveNode extends NodeBase {
  nodeType: NodeType.PROVE;
  keyword: Token;
  label?: Token;
  type?: Token;
  body: Array<Token>;
  proof: Array<Token>;
  essentials: Array<EssentialNode>;
  floats: Array<FloatNode>;
  disjointMap: Map<string, DisjointNode>;
}

export interface DisjointNode extends NodeBase {
  nodeType: NodeType;
  keyword: Token;
  left: Token;
  right: Token;
}

export function stmtNodeToString(node: EssentialNode | AxiomNode | ProveNode): string {
  const statement: string = node.body.map((e) => e.value).join(' ');
  return statement;
}
export function disjointNodeToString(node: DisjointNode): string {
  return node.left.value + ' ' + node.right.value;
}
