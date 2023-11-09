import { Token, Position, ScannerOptions, clonePosition, createPosition, TokenType, createToken } from './types';
import * as charCodes from 'charcodes';

export default class Scanner {
  input: string;
  endOffset: number;
  tokens: Array<Token> = [];
  currentTokenIdx: number = -1;
  position: Position;
  filename?: string;

  keyCodeMap: Map<number, TokenType> = new Map([
    [charCodes.lowercaseC, TokenType.CONST],
    [charCodes.lowercaseV, TokenType.VAR],
    [charCodes.lowercaseD, TokenType.DISJOINT],
    [charCodes.lowercaseF, TokenType.FLOAT],
    [charCodes.lowercaseE, TokenType.ESSENTIAL],
    [charCodes.lowercaseA, TokenType.AXIOM],
    [charCodes.lowercaseP, TokenType.PROVE],
    [charCodes.equalsTo, TokenType.EQ],
    [charCodes.dot, TokenType.END],
    [charCodes.leftCurlyBrace, TokenType.BSTART],
    [charCodes.rightCurlyBrace, TokenType.BEND],
  ]);

  constructor(input: string, options?: ScannerOptions) {
    this.input = input;

    if (options && options.sourceRange) {
      this.position = clonePosition(options.sourceRange.start);
      this.endOffset = options.sourceRange.end.offset;
    } else {
      this.position = createPosition(0, 0, 0);
      this.endOffset = input.length;
    }
    this.filename = options?.sourceFilename;
  }

  public eof(): boolean {
    return this.position.offset >= this.endOffset;
  }

  public lookAhead(): Token {
    if (this.currentTokenIdx + 1 >= this.tokens.length) {
      this.tokens.push(this.nextToken());
    }
    return this.tokens[this.currentTokenIdx + 1];
  }

  public peek(): Token {
    if (this.currentTokenIdx >= this.tokens.length) {
      this.tokens.push(this.nextToken());
    }
    return this.tokens[this.currentTokenIdx];
  }

  public back(): void {
    if (this.currentTokenIdx > -1) {
      this.currentTokenIdx--;
    }
  }

  public begin(): void {
    this.currentTokenIdx = -1;
  }

  public getTokens(): Array<Token> {
    while (this.currentTokenIdx < 0 || this.tokens[this.currentTokenIdx].tokenType !== TokenType.EOF) {
      this.next();
    }
    return this.tokens;
  }

  public next(): Token {
    if (this.currentTokenIdx >= 0 && this.tokens[this.currentTokenIdx].tokenType === TokenType.EOF) {
      return this.tokens[this.currentTokenIdx];
    }
    if (this.currentTokenIdx + 1 >= this.tokens.length) {
      this.tokens.push(this.nextToken());
    }
    this.currentTokenIdx++;
    return this.tokens[this.currentTokenIdx];
  }

  private nextToken(): Token {
    let code: number = this.positionPeek();
    // skip invalid char before next token
    while (code >= 0 && this.isSeperation(code)) {
      code = this.positionGoAhead();
    }
    if (code < 0) {
      return this.generateToken(TokenType.EOF, this.position, this.position);
    } else if (code === charCodes.dollarSign) {
      const forwardCode = this.positionLookAhead();
      if (forwardCode === charCodes.leftParenthesis) {
        // $(
        return this.scanComment();
      } else if (forwardCode === charCodes.leftSquareBracket) {
        // $[
        return this.scanImport();
      } else if (this.keyCodeMap.has(forwardCode)) {
        return this.scanKeyword();
      }
    }
    // scan word
    return this.scanWord();
  }

  private scanKeyword(): Token {
    const startPosition = clonePosition(this.position);
    const keycode = this.positionGoAhead(); // eat `$`
    this.positionGoAhead(); // eat keycode
    const endPosition = clonePosition(this.position);
    return this.generateToken(this.keyCodeMap.get(keycode) || TokenType.UNKNOWN, startPosition, endPosition);
  }

  private scanComment(): Token {
    // block comment: `$( * $)`
    const startPosition = clonePosition(this.position);
    let code: number = this.positionGoAhead();
    while (code > 0) {
      if (code === charCodes.dollarSign && this.positionLookAhead() === charCodes.rightParenthesis) {
        // end of block comment
        this.positionGoAhead(); // eat `$`
        this.positionGoAhead(); // eat `)`
        break;
      }
      code = this.positionGoAhead();
    }
    const endPosition = clonePosition(this.position);
    return this.generateToken(TokenType.COMMENT, startPosition, endPosition);
  }

  private scanImport(): Token {
    // import block: `$[ $]`
    const startPosition = clonePosition(this.position);
    let code: number = this.positionGoAhead();
    while (code > 0) {
      if (code === charCodes.dollarSign && this.positionLookAhead() === charCodes.rightSquareBracket) {
        // end of block comment
        this.positionGoAhead(); // eat `$`
        this.positionGoAhead(); // eat `]`
        break;
      }
      code = this.positionGoAhead();
    }
    const endPosition = clonePosition(this.position);
    return this.generateToken(TokenType.IMPORT, startPosition, endPosition);
  }

  private scanWord(): Token {
    const startPosition = clonePosition(this.position);
    let code = this.positionPeek();
    while (code > 0 && !this.isSeperation(code)) {
      code = this.positionGoAhead();
    }
    const endPosition = clonePosition(this.position);
    return this.generateToken(TokenType.WORD, startPosition, endPosition);
  }

  private generateToken(tokenType: TokenType, start: Position, end: Position): Token {
    const s = this.input.slice(start.offset, end.offset);
    return createToken(tokenType, start, end, s, this.filename);
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
