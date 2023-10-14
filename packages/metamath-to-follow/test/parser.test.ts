import { expect, test } from 'vitest';
import Parser from '../src/parser';
import path from 'path';
import { existsSync, readFileSync } from 'node:fs';

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
  const parser = new Parser(input);
  const frame = parser.nextFrame();
  expect(frame?.constants.size).toBe(5);
  expect(frame?.proves.length).toBe(1);
  expect(frame?.proves[0].isProved).toBe(true);
});

test('#2 set_part1.mm', () => {
  const filePath = './examples/set_part1.mm';
  const absPath = path.resolve(filePath);
  if (existsSync(absPath)) {
    const input = readFileSync(filePath, 'utf-8');
    const parser = new Parser(input);
    const frame = parser.nextFrame();
    expect(frame?.constants.size).toBe(31);
    expect(frame?.axioms.length).toBe(55);
    if (frame?.proves) {
      for (const prove of frame.proves) {
        expect(prove.isProved).toBe(true);
      }
    }
  }
});
