export enum Error {
  // Token Errors
  UnknownTokenOutOfBlock = 'UnknownTokenOutOfBlock',
  ArgNameMissing = 'ArgNameMissing',
  ArgNameDuplicated = 'ArgNameDuplicated',
  UnknownTokenInBody = 'UnknownTokenInBody',
  AssumeEmpty = 'AssumeEmpty',
  TargetEmpty = 'TargetEmpty',
  TargetDuplicated = 'TargetDuplicated',

  // Node Errors
  ImportFileStringMissing = 'ImportFileStringMissing',
  ImportFileStringEmpty = 'ImportFileStringEmpty',
  ImportFileNotExist = 'ImportFileNotExist',
  TypeMissing = 'TypeMissing',
  NameMissing = 'NameMissing',
  ParamsLeftParenMissing = 'ParamsLeftParenMissing',
  ParamsRightParenMissing = 'ParamsRightParenMissing',
  BodyLeftBraceMissing = 'BodyLeftBraceMissing',
  BodyRightBraceMissing = 'BodyRightBraceMissing',
  BodyTargetMissing = 'BodyTargetMissing',
  ProofEqMissing = 'ProofEqMissing',
  ProofLeftBraceMissing = 'ProofLeftBraceMissing',
  ProofRightBraceMissing = 'ProofRightBraceMissing',
  ProofEmpty = 'ProofEmpty',

  // Compiler Errors
  HasImportCircle = 'HasImportCircle',
  TypeDefMissing = 'TypeDefMissing',
  NameDefDuplicated = 'NameDefDuplicated',
  NameDefMissing = 'NameDefMissing',
  DefinitionMissing = 'DefNodeMissing',
  ArgMissing = 'ArgMissing',
  ArgTypeWrong = 'ArgTypeWrong',
  HasArgProblem = 'HasArgProblem',
  RedundantOpTree = 'RedundantOpTree',
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
  LINE_COMMENT = 'line_comment', // `// * \n`
  BLOCK_COMMENT = 'block_comment', // `/\* * \*/`
  LPAREN = 'lparen', // (
  RPAREN = 'rparen', // )
  LBRACE = 'lbrace', // {
  RBRACE = 'rbrace', // }
  EQ = 'eq', // =
  COMMA = 'comma', // ,
  STRING = 'string', // '*'
  IMPORT = 'import', // import
  TYPE = 'type', // type
  CONST = 'const', // const
  PROP = 'prop', // prop
  AXIOM = 'axiom', // axiom
  THEOREM = 'theorem', // thm
  ASSUME = 'assume', // -|
  TARGET = 'target', // |-
  WORD = 'word', // Word is separated by seeparators.
  EOF = 'eof', // end of file
  UNKNOWN = 'unknown', // unknown

  TYPE_VAL = 'type_val',
  CONST_VAL = 'const_val',
  PROP_VAL = 'prop_val',
  AXIOM_VAL = 'axiom_val',
  THM_VAL = 'thm_val',
  ARG_VAL = 'arg_val',
}

export interface Token {
  tokenType: TokenType;
  range: Range;
  value?: string;
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
  value?: string,
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

export type ParserOptions = {
  scannerOptions?: ScannerOptions;
};

export enum NodeType {
  KEYWORD = 'keyword', // type const prop axiom thm -| |-
  NAME = 'name', // block name

  // instance
  OP = 'operation',

  // statement
  IMPORT = 'import',
  TYPE_DEF = 'type_def', // type NAME
  CONST_DEF = 'const_def', // const TYPE (NAME)+
  PROP_DEF = 'prop_def', // prop TYPE NAME (ARG_DEF, ARG_DEF, ...)
  AXIOM_DEF = 'axiom_def', // axiom NAME (ARG_DEF, ARG_DEF, ...) { BODY }
  THEOREM_DEF = 'theorem_def', // thm NAME (ARG_DEF, ARG_DEF, ...) { BODY } := { PROOF }
  PARAMS = 'params', // (ARG_DEF, ARG_DEF...)
  ARG_DEF = 'arg_def', // TYPE NAME
  BODY = 'body', // ASSUME* TARGET
  ASSUME = 'assume', // -| (ID)+
  TARGET = 'target', // |- (ID)+
  PROOF = 'proof', // (ID)+

  EOF = 'eof', // end of file
}
export type Node =
  | ImportNode
  | TypeDefNode
  | ConstDefNode
  | PropDefNode
  | AxiomDefNode
  | TheoremDefNode
  | ArgDefNode
  | BodyNode
  | AssumeNode
  | TargetNode
  | ProofNode
  | EofNode;

export interface NodeBase {
  nodeType: NodeType;

  keyword?: Token;
  type?: Token;
  name?: Token;
  params?: Array<ArgDefNode>;
  argDefMap?: Map<string, ArgDefNode>;
  body?: BodyNode;
  proof?: ProofNode;
  tokens?: Array<Token>;
  opTrees?: Array<OpNode>;

  headComment?: Token;
  inBlockComments?: Array<Token>;
  error?: Error;

  cumulatedAssumes?: Map<string, OpNode>;
  cumulatedTarget?: OpNode;
  suggestions?: Array<string>;
  preSuggestions?: Array<string>;
}
export interface ImportNode extends NodeBase {
  nodeType: NodeType.IMPORT;
  keyword: Token;
}
export interface TypeDefNode extends NodeBase {
  nodeType: NodeType.TYPE_DEF;
  keyword: Token;
}
export interface ConstDefNode extends NodeBase {
  nodeType: NodeType.CONST_DEF;
  keyword: Token;
}
export interface PropDefNode extends NodeBase {
  nodeType: NodeType.PROP_DEF;
  keyword: Token;
  params?: Array<ArgDefNode>;
}
export interface AxiomDefNode extends NodeBase {
  nodeType: NodeType.AXIOM_DEF;
  keyword: Token;
}
export interface TheoremDefNode extends NodeBase {
  nodeType: NodeType.THEOREM_DEF;
  keyword: Token;
}
export interface ArgDefNode extends NodeBase {
  nodeType: NodeType.ARG_DEF;
}
export interface BodyNode extends NodeBase {
  nodeType: NodeType.BODY;
  assumes?: Array<AssumeNode>;
  target?: TargetNode;
}
export interface AssumeNode extends NodeBase {
  nodeType: NodeType.ASSUME;
  keyword: Token;
  tokens?: Array<Token>;
}
export interface TargetNode extends NodeBase {
  nodeType: NodeType.TARGET;
  keyword: Token;
  tokens?: Array<Token>;
}
export interface ProofNode extends NodeBase {
  nodeType: NodeType.PROOF;
  tokens?: Array<Token>;
}
export interface EofNode extends NodeBase {
  nodeType: NodeType.EOF;
}

export type DefNode = TypeDefNode | ConstDefNode | PropDefNode | AxiomDefNode | TheoremDefNode | ArgDefNode;
export interface OpNode extends NodeBase {
  nodeType: NodeType.OP;
  definition?: DefNode;
  parent?: OpNode;
  children?: Array<OpNode>;
  targetDefNode?: DefNode;
  assumes?: Array<OpNode>;
  target?: OpNode;
}

export function opNodeToString(opNode: OpNode): string {
  const name = opNode.definition?.name?.value || '';
  const args =
    opNode.children
      ?.map((child) => {
        return opNodeToString(child);
      })
      .join(', ') || '';
  if (args.length > 0) {
    return `${name}(${args})`;
  }
  return name;
}

export function opNodeToStringFormat(opNode: OpNode, prefix: string): Array<string> {
  const stringList: Array<string> = [];
  const name = opNode.definition?.name?.value;
  if (name === undefined) {
    return [];
  }
  const head = `${prefix}${name}`;
  const spaceHead = ' '.repeat(head.length);
  let totalLength = head.length;
  if (opNode.children) {
    for (let i = 0; i < opNode.children.length; i++) {
      const child = opNode.children[i];
      const childStr = opNodeToString(child);
      if (opNode.children.length === 1) {
        stringList.push(`${head}(${childStr})`);
      } else if (i === 0) {
        stringList.push(`${head}(${childStr},`);
      } else if (i < opNode.children.length - 1) {
        stringList.push(`${childStr},`);
      } else {
        stringList.push(`${childStr})`);
      }
      totalLength += childStr.length;
    }
  } else {
    stringList.push(head);
  }
  if (totalLength <= 160) {
    return [stringList.join(' ')];
  }
  return stringList.map((e, idx) => {
    if (idx == 0) {
      return e;
    } else {
      return `${spaceHead} ${e}`;
    }
  });
}
