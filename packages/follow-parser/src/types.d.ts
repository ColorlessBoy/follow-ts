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
  LINE_COMMENT, // `// * \n`
  BLOCK_COMMENT, // `/\* * \*/`
  LPAREN, // (
  RPAREN, // )
  LBRACE, // {
  RBRACE, // }
  EQ, // =
  COLON, // :
  COMMA, // ,
  STRING, // '*'
  IMPORT, // import
  TYPE, // type
  CONST, // const
  PROP, // prop
  AXIOM, // axiom
  THEOREM, // thm
  ASSUME, // -|
  TARGET, // |-
  WORD, // Word is separated by seeparators.
  EOF, // end of file
  UNKNOWN, // unknown
}

export interface Token {
  tokenType: TokenType;
  range: Range;
  value?: string;
  filename?: string;
}

export enum NodeType {
  KEYWORD, // type const prop axiom thm -| |-
  NAME, // block name

  // instance
  TYPE, // semantic type
  ARG,
  CONST,
  PROP,
  AXIOM,
  THEOREM,

  // statement
  TYPE_DEF, // type NAME
  CONST_DEF, // const TYPE (NAME)+
  PROP_DEF, // prop TYPE NAME (ARG_DEF, ARG_DEF, ...)
  AXIOM_DEF, // axiom NAME (ARG_DEF, ARG_DEF, ...) { STATEMENT }
  THEOREM_DEF, // thm NAME (ARG_DEF, ARG_DEF, ...) { STATEMENT } := { PROOF }
  ARG_DEF, // TYPE NAME
  STATEMENT, // ASSUME* TARGET
  ASSUME, // -| (ID)+
  TARGET, // |- (ID)+
  PROOF, // (ID)+
}

export interface Node {
  nodeType: NodeType;
  token: Token;
}

export type Options = {
  sourceFilename?: string;
  sourceRange?: Range;
};

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
