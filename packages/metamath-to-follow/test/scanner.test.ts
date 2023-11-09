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
  const rst = t1.tokenType === t2.tokenType && eqRange(t1.range, t2.range) && t1.value === t2.value;
  return rst;
}

test('#1 Import', () => {
  const elements = [
    '$( this is \n a block comment $)\n',
    '$[ set.mm $]\n',
    '$c ( ) -> wff |- $.\n',
    '$v ph ps ch $.\n',
    'wph $f wff ph $.\n',
    'wps $f wff ps $.\n',
    'wch $f wff ch $.\n',
    'wi $a wff ( ph -> ps ) $.\n',
    '${ min $e |- ph $.  maj $e |- ( ph -> ps ) $.  ax-mp $a |- ps $. $}\n',
    'ax-1 $a |- ( ph -> ( ps -> ph ) ) $.\n',
    '${ mp2.1 $e |- ph $. mp2.2 $e |- ps $. mp2.3 $e |- ( ph -> ( ps -> ch ) ) $. mp2 $p |- ch $= ( wi ax-mp ) BCEABCGDFHH $. $}\n',
  ];
  const input = elements.join('');
  const scanner = new Scanner(input);
  const tokens = scanner.getTokens();
  expect(tokens.length).toBe(109);

  const expectTokens = [
    createToken(
      TokenType.COMMENT,
      createPosition(0, 0, 0),
      createPosition(31, 1, 19),
      '$( this is \n a block comment $)',
    ),
    createToken(TokenType.IMPORT, createPosition(32, 2, 0), createPosition(44, 2, 12), '$[ set.mm $]'),
    createToken(TokenType.CONST, createPosition(45, 3, 0), createPosition(47, 3, 2), '$c'),
    createToken(TokenType.VAR, createPosition(65, 4, 0), createPosition(67, 4, 2), '$v'),
    createToken(TokenType.FLOAT, createPosition(84, 5, 4), createPosition(86, 5, 6), '$f'),
    createToken(TokenType.AXIOM, createPosition(134, 8, 3), createPosition(136, 8, 5), '$a'),
    createToken(TokenType.ESSENTIAL, createPosition(164, 9, 7), createPosition(166, 9, 9), '$e'),
  ];

  expect(eqToken(tokens[0], expectTokens[0])).toBe(true);
  expect(eqToken(tokens[1], expectTokens[1])).toBe(true);
  expect(eqToken(tokens[2], expectTokens[2])).toBe(true);
  expect(eqToken(tokens[9], expectTokens[3])).toBe(true);
  expect(eqToken(tokens[15], expectTokens[4])).toBe(true);
  expect(eqToken(tokens[30], expectTokens[5])).toBe(true);
  expect(eqToken(tokens[40], expectTokens[6])).toBe(true);
});
