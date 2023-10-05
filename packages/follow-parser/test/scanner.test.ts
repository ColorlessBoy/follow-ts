import { expect, test } from 'vitest';
import { Position, Range, Token, TokenType, createPosition, createToken } from '../src/types';
import Scanner from '../src/scanner';

function eqPosition(p1: Position, p2: Position): boolean {
  return p1.offset === p2.offset && p1.line === p2.line && p1.character === p2.character;
}

function eqRange(r1: Range, r2: Range): boolean {
  return eqPosition(r1.start, r2.start) && eqPosition(r1.end, r2.end);
}

function eqToken(t1: Token, t2: Token): boolean {
  const rst =
    t1.tokenType === t2.tokenType &&
    eqRange(t1.range, t2.range) &&
    t1.value === t2.value &&
    t1.filename === t2.filename;
  return rst;
}

test('#1 Basic', () => {
  const elements = [
    'type wff\r\n',
    'const wff w0\n',
    'prop wff imp(wff w0, wff w1)\r\n',
    'axiom ax1(wff w0, wff w1) {-| w0 |- imp w1 w0}\n',
    'thm th1(wff w0, wff w1) {-| w0 |- imp w1 w0}  = {ax1 // line comment\r\n',
    'w0 w1}\n',
    '/*\n',
    'block comment\n',
    '*/\n',
  ];
  const input = elements.join('');
  const scanner = new Scanner(input);
  const tokens = scanner.getTokens();
  expect(tokens.length).toBe(58);

  const expectTokens = [
    createToken(TokenType.TYPE, createPosition(0, 0, 0), createPosition(4, 0, 4), 'type'),
    createToken(TokenType.WORD, createPosition(5, 0, 5), createPosition(8, 0, 8), 'wff'),
    createToken(TokenType.CONST, createPosition(10, 1, 0), createPosition(15, 1, 5), 'const'),
    createToken(TokenType.WORD, createPosition(16, 1, 6), createPosition(19, 1, 9), 'wff'),
    createToken(TokenType.WORD, createPosition(20, 1, 10), createPosition(22, 1, 12), 'w0'),
    createToken(TokenType.PROP, createPosition(23, 2, 0), createPosition(27, 2, 4), 'prop'),
    createToken(TokenType.WORD, createPosition(28, 2, 5), createPosition(31, 2, 8), 'wff'),
    createToken(TokenType.WORD, createPosition(32, 2, 9), createPosition(35, 2, 12), 'imp'),
    createToken(TokenType.LPAREN, createPosition(35, 2, 12), createPosition(36, 2, 13), '('),
    createToken(TokenType.WORD, createPosition(36, 2, 13), createPosition(39, 2, 16), 'wff'),
    createToken(TokenType.WORD, createPosition(40, 2, 17), createPosition(42, 2, 19), 'w0'),
    createToken(TokenType.COMMA, createPosition(42, 2, 19), createPosition(43, 2, 20), ','),
    createToken(TokenType.WORD, createPosition(44, 2, 21), createPosition(47, 2, 24), 'wff'),
    createToken(TokenType.WORD, createPosition(48, 2, 25), createPosition(50, 2, 27), 'w1'),
    createToken(TokenType.RPAREN, createPosition(50, 2, 27), createPosition(51, 2, 28), ')'),
    createToken(TokenType.AXIOM, createPosition(53, 3, 0), createPosition(58, 3, 5), 'axiom'),
    createToken(TokenType.WORD, createPosition(59, 3, 6), createPosition(62, 3, 9), 'ax1'),
    createToken(TokenType.LPAREN, createPosition(62, 3, 9), createPosition(63, 3, 10), '('),
    createToken(TokenType.WORD, createPosition(63, 3, 10), createPosition(66, 3, 13), 'wff'),
    createToken(TokenType.WORD, createPosition(67, 3, 14), createPosition(69, 3, 16), 'w0'),
    createToken(TokenType.COMMA, createPosition(69, 3, 16), createPosition(70, 3, 17), ','),
    createToken(TokenType.WORD, createPosition(71, 3, 18), createPosition(74, 3, 21), 'wff'),
    createToken(TokenType.WORD, createPosition(75, 3, 22), createPosition(77, 3, 24), 'w1'),
    createToken(TokenType.RPAREN, createPosition(77, 3, 24), createPosition(78, 3, 25), ')'),
    createToken(TokenType.LBRACE, createPosition(79, 3, 26), createPosition(80, 3, 27), '{'),
    createToken(TokenType.ASSUME, createPosition(80, 3, 27), createPosition(82, 3, 29), '-|'),
    createToken(TokenType.WORD, createPosition(83, 3, 30), createPosition(85, 3, 32), 'w0'),
    createToken(TokenType.TARGET, createPosition(86, 3, 33), createPosition(88, 3, 35), '|-'),
    createToken(TokenType.WORD, createPosition(89, 3, 36), createPosition(92, 3, 39), 'imp'),
    createToken(TokenType.WORD, createPosition(93, 3, 40), createPosition(95, 3, 42), 'w1'),
    createToken(TokenType.WORD, createPosition(96, 3, 43), createPosition(98, 3, 45), 'w0'),
    createToken(TokenType.RBRACE, createPosition(98, 3, 45), createPosition(99, 3, 46), '}'),
    createToken(TokenType.THEOREM, createPosition(100, 4, 0), createPosition(103, 4, 3), 'thm'),
    createToken(TokenType.WORD, createPosition(104, 4, 4), createPosition(107, 4, 7), 'th1'),
    createToken(TokenType.LPAREN, createPosition(107, 4, 7), createPosition(108, 4, 8), '('),
    createToken(TokenType.WORD, createPosition(108, 4, 8), createPosition(111, 4, 11), 'wff'),
    createToken(TokenType.WORD, createPosition(112, 4, 12), createPosition(114, 4, 14), 'w0'),
    createToken(TokenType.COMMA, createPosition(114, 4, 14), createPosition(115, 4, 15), ','),
    createToken(TokenType.WORD, createPosition(116, 4, 16), createPosition(119, 4, 19), 'wff'),
    createToken(TokenType.WORD, createPosition(120, 4, 20), createPosition(122, 4, 22), 'w1'),
    createToken(TokenType.RPAREN, createPosition(122, 4, 22), createPosition(123, 4, 23), ')'),
    createToken(TokenType.LBRACE, createPosition(124, 4, 24), createPosition(125, 4, 25), '{'),
    createToken(TokenType.ASSUME, createPosition(125, 4, 25), createPosition(127, 4, 27), '-|'),
    createToken(TokenType.WORD, createPosition(128, 4, 28), createPosition(130, 4, 30), 'w0'),
    createToken(TokenType.TARGET, createPosition(131, 4, 31), createPosition(133, 4, 33), '|-'),
    createToken(TokenType.WORD, createPosition(134, 4, 34), createPosition(137, 4, 37), 'imp'),
    createToken(TokenType.WORD, createPosition(138, 4, 38), createPosition(140, 4, 40), 'w1'),
    createToken(TokenType.WORD, createPosition(141, 4, 41), createPosition(143, 4, 43), 'w0'),
    createToken(TokenType.RBRACE, createPosition(143, 4, 43), createPosition(144, 4, 44), '}'),
    createToken(TokenType.EQ, createPosition(146, 4, 46), createPosition(147, 4, 47), '='),
    createToken(TokenType.LBRACE, createPosition(148, 4, 48), createPosition(149, 4, 49), '{'),
    createToken(TokenType.WORD, createPosition(149, 4, 49), createPosition(152, 4, 52), 'ax1'),
    createToken(TokenType.LINE_COMMENT, createPosition(153, 4, 53), createPosition(168, 4, 68), '// line comment'),
    createToken(TokenType.WORD, createPosition(170, 5, 0), createPosition(172, 5, 2), 'w0'),
    createToken(TokenType.WORD, createPosition(173, 5, 3), createPosition(175, 5, 5), 'w1'),
    createToken(TokenType.RBRACE, createPosition(175, 5, 5), createPosition(176, 5, 6), '}'),
    createToken(TokenType.BLOCK_COMMENT, createPosition(177, 6, 0), createPosition(196, 8, 2), '/*\nblock comment\n*/'),
    createToken(TokenType.EOF, createPosition(197, 9, 0), createPosition(197, 9, 0), ''),
  ];
  for (let i = 0; i < tokens.length; i++) {
    expect(eqToken(tokens[i], expectTokens[i])).toBe(true);
  }
});

test('#2 Import', () => {
  const input = "import 'def.fol'";
  const scanner = new Scanner(input);
  const tokens: Array<Token> = scanner.getTokens();
  expect(tokens.length).toBe(3);

  const expectTokens = [
    createToken(TokenType.IMPORT, createPosition(0, 0, 0), createPosition(6, 0, 6), 'import'),
    createToken(TokenType.STRING, createPosition(7, 0, 7), createPosition(16, 0, 16), "'def.fol'"),
    createToken(TokenType.EOF, createPosition(16, 0, 16), createPosition(16, 0, 16), ''),
  ];

  for (let i = 0; i < tokens.length; i++) {
    expect(eqToken(tokens[i], expectTokens[i])).toBe(true);
  }
});

test('#3 Chinese', () => {
  const input = 'type 命题 const 命题 命题1';
  const scanner = new Scanner(input);
  const tokens: Array<Token> = scanner.getTokens();
  expect(tokens.length).toBe(6);

  const expectTokens = [
    createToken(TokenType.TYPE, createPosition(0, 0, 0), createPosition(4, 0, 4), 'type'),
    createToken(TokenType.WORD, createPosition(5, 0, 5), createPosition(7, 0, 7), '命题'),
    createToken(TokenType.CONST, createPosition(8, 0, 8), createPosition(13, 0, 13), 'const'),
    createToken(TokenType.WORD, createPosition(14, 0, 14), createPosition(16, 0, 16), '命题'),
    createToken(TokenType.WORD, createPosition(17, 0, 17), createPosition(20, 0, 20), '命题1'),
    createToken(TokenType.EOF, createPosition(20, 0, 20), createPosition(20, 0, 20), ''),
  ];

  for (let i = 0; i < tokens.length; i++) {
    expect(eqToken(tokens[i], expectTokens[i])).toBe(true);
  }
});
