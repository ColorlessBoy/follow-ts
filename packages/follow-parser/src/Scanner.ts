import * as charCodes from 'charcodes';
import { TokenType, Position, Token, Options, clonePosition, createPosition, createToken } from './types';

export default class Scanner {
  input: string;
  endOffset: number;
  sourceFilename?: string;

  position: Position;

  singleTokenMap: Map<number, TokenType> = new Map([
    [charCodes.leftParenthesis, TokenType.LPAREN],
    [charCodes.rightParenthesis, TokenType.RPAREN],
    [charCodes.leftCurlyBrace, TokenType.LBRACE],
    [charCodes.rightCurlyBrace, TokenType.RBRACE],
    [charCodes.equalsTo, TokenType.EQ],
    [charCodes.colon, TokenType.COLON],
    [charCodes.comma, TokenType.COMMA],
  ]);

  keywordTokenMap: Map<string, TokenType> = new Map([
    ['import', TokenType.IMPORT],
    ['type', TokenType.TYPE],
    ['const', TokenType.CONST],
    ['prop', TokenType.PROP],
    ['axiom', TokenType.AXIOM],
    ['thm', TokenType.THEOREM],
    ['-|', TokenType.ASSUME],
    ['|-', TokenType.TARGET],
  ]);

  constructor(input: string, options?: Options) {
    this.input = input;
    if (options && options.sourceFilename) {
      this.sourceFilename = options.sourceFilename;
    }

    if (options && options.sourceRange) {
      this.position = clonePosition(options.sourceRange.start);
      this.endOffset = options.sourceRange.end.offset;
    } else {
      this.position = createPosition(0, 0, 0);
      this.endOffset = input.length;
    }
  }

  public eof(): boolean {
    return this.position.offset >= this.endOffset;
  }

  public next(): Token {
    let code: number = this.positionPeek();
    // skip invalid char before next token
    while (code >= 0 && this.isSeperation(code)) {
      code = this.positionGoAhead();
    }
    if (code < 0) {
      return this.generateToken(TokenType.EOF, this.position, this.position);
    } else if (code === charCodes.apostrophe) {
      // '\'
      return this.scanString();
    } else if (this.singleTokenMap.has(code)) {
      // scan single token: `(`, `)`, `{`, `}`, `=`, `:`, ','
      return this.scanSingleToken();
    } else if (code === charCodes.slash) {
      const forwardCode = this.positionLookAhead();
      if (forwardCode === charCodes.asterisk) {
        // block comment: `/\* * \*/`
        return this.scanBlockComment();
      } else if (forwardCode === charCodes.slash) {
        // line comment: `// *\n`
        return this.scanLineComment();
      }
    }
    // scan word
    return this.scanWord();
  }

  private scanString(): Token {
    // '*'
    const startPosition = clonePosition(this.position);
    let code = this.positionGoAhead();
    while (code > 0 && code !== charCodes.apostrophe) {
      code = this.positionGoAhead();
    }
    const endPosition = clonePosition(this.position);
    return this.generateToken(TokenType.STRING, startPosition, endPosition);
  }

  private scanSingleToken(): Token {
    // scan single token: `(`, `)`, `{`, `}`, `'`, `=`, `:`, ','
    const startPosition = clonePosition(this.position);
    const code = this.positionPeek();
    this.positionGoAhead();
    const endPosition = clonePosition(this.position);
    return this.generateToken(this.singleTokenMap.get(code) || TokenType.UNKNOWN, startPosition, endPosition);
  }

  private scanBlockComment(): Token {
    // block comment: `/\* * \*/`
    const startPosition = clonePosition(this.position);
    let code: number = this.positionGoAhead();
    while (code > 0) {
      if (code === charCodes.asterisk && this.positionLookAhead() === charCodes.slash) {
        // end of block comment
        this.positionGoAhead(); // position walks into charCodes.slash
        this.positionGoAhead(); // position leaves charCodes.slash
        break;
      }
      code = this.positionGoAhead();
    }
    const endPosition = clonePosition(this.position);
    return this.generateToken(TokenType.BLOCK_COMMENT, startPosition, endPosition);
  }

  private scanLineComment(): Token {
    // line comment: `// *\n`
    const startPosition = clonePosition(this.position);
    let code: number = this.positionGoAhead();
    while (code > 0 && !this.isNewLine(code)) {
      code = this.positionGoAhead();
    }
    this.positionGoAhead();
    const endPosition = clonePosition(this.position);
    return this.generateToken(TokenType.LINE_COMMENT, startPosition, endPosition);
  }

  private scanWord(): Token {
    const startPosition = clonePosition(this.position);
    let code = this.positionPeek();
    while (code > 0 && !this.isSeperation(code)) {
      if (code === charCodes.slash) {
        const forwardCode = this.positionLookAhead();
        if (forwardCode === charCodes.asterisk || forwardCode === charCodes.slash) {
          break;
        }
      } else if (this.singleTokenMap.has(code)) {
        break;
      }
      code = this.positionGoAhead();
    }
    const endPosition = clonePosition(this.position);
    const text = this.input.slice(startPosition.offset, endPosition.offset);
    return this.generateToken(this.keywordTokenMap.get(text) || TokenType.WORD, startPosition, endPosition);
  }

  private generateToken(tokenType: TokenType, start: Position, end: Position): Token {
    return createToken(tokenType, start, end, this.input.slice(start.offset, end.offset), this.sourceFilename);
  }

  // move ahead, and return new char code.
  private positionGoAhead(): number {
    if (this.position.offset >= this.endOffset) {
      return -1;
    }
    const code = this.input.charCodeAt(this.position.offset);
    if (this.isNewLine(code) && code !== charCodes.carriageReturn) {
      this.position.character = 0;
      this.position.line += 1;
    } else {
      this.position.character += 1;
    }
    this.position.offset += 1;
    return this.positionPeek();
  }

  // Get current char code.
  private positionPeek(): number {
    if (this.position.offset >= this.endOffset) {
      return -1;
    }
    return this.input.charCodeAt(this.position.offset);
  }

  // Get forward char code.
  private positionLookAhead(): number {
    if (this.position.offset + 1 >= this.endOffset) {
      return -1;
    }
    return this.input.charCodeAt(this.position.offset + 1);
  }

  private isSeperation(code: number): boolean {
    return this.isNewLine(code) || this.isWhitespace(code);
  }

  // babel source code
  // https://tc39.github.io/ecma262/#sec-line-terminators
  private isNewLine(code: number): boolean {
    switch (code) {
      case charCodes.lineFeed:
      case charCodes.lineSeparator:
      case charCodes.paragraphSeparator:
        return true;
      case charCodes.carriageReturn: {
        const forwardCode = this.positionLookAhead();
        if (forwardCode === charCodes.lineFeed) {
          return true;
        } else {
          return false;
        }
      }
      default:
        return false;
    }
  }

  // babel source code
  // https://tc39.github.io/ecma262/#sec-white-space
  private isWhitespace(code: number): boolean {
    switch (code) {
      case 0x0009: // CHARACTER TABULATION
      case 0x000b: // LINE TABULATION
      case 0x000c: // FORM FEED
      case charCodes.space:
      case charCodes.nonBreakingSpace:
      case charCodes.oghamSpaceMark:
      case 0x2000: // EN QUAD
      case 0x2001: // EM QUAD
      case 0x2002: // EN SPACE
      case 0x2003: // EM SPACE
      case 0x2004: // THREE-PER-EM SPACE
      case 0x2005: // FOUR-PER-EM SPACE
      case 0x2006: // SIX-PER-EM SPACE
      case 0x2007: // FIGURE SPACE
      case 0x2008: // PUNCTUATION SPACE
      case 0x2009: // THIN SPACE
      case 0x200a: // HAIR SPACE
      case 0x202f: // NARROW NO-BREAK SPACE
      case 0x205f: // MEDIUM MATHEMATICAL SPACE
      case 0x3000: // IDEOGRAPHIC SPACE
      case 0xfeff: // ZERO WIDTH NO-BREAK SPACE
        return true;

      default:
        return false;
    }
  }
}
