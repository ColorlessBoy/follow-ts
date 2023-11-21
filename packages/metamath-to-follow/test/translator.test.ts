import { metamathToFollow } from '../src/translator';
import { expect, test } from 'vitest';

test('#1 translate set_part1.mm', () => {
  const filename = './examples/set_part1.mm';
  const output = './examples/set_part1.fol';
  metamathToFollow(filename, output);
  expect(1 + 1).toBe(2);
});

test('#2 translate set_part2.mm', () => {
  const filename = './examples/set_part2.mm';
  const output = './examples/set_part2.fol';
  metamathToFollow(filename, output);
  expect(1 + 1).toBe(2);
});

test('#3 translate set.mm', () => {
  const filename = './examples/set.mm';
  const output = './examples/set.fol';
  metamathToFollow(filename, output);
  expect(1 + 1).toBe(2);
});
