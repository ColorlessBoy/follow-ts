import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import * as charCodes from 'charcodes';
import { antlrParse } from './antlr';

export const globalAliasMap: Map<string, string> = new Map([
  ['c0', 'emptycls'],
  ['cvv', 'universe'],
  ['df-v', 'df-universe'],
  ['cc0', 'nat0'],
  ['c1', 'nat1'],
  ['c2', 'nat2'],
  ['c3', 'nat3'],
  ['c4', 'nat4'],
  ['c5', 'nat5'],
  ['c6', 'nat6'],
  ['c7', 'nat7'],
  ['c8', 'nat8'],
  ['c9', 'nat9'],
  ['vx', 'x'],
  ['vy', 'y'],
  ['vf', 'f'],
  ['vg', 'g'],
]);

export class Parser {
  public scanner: Scanner;
  public propAxiomMap: Map<string, Axiom>;
  public axiomMap: Map<string, Axiom>;
  public theoremMap: Map<string, Theorem>;
  public blockOrder: Array<string>;
  public frameStack: FrameStack;
  public quick: boolean;

  constructor(fileList: string[], quick: boolean = false) {
    this.scanner = new Scanner(fileList);
    this.propAxiomMap = new Map();
    this.axiomMap = new Map();
    this.theoremMap = new Map();
    this.frameStack = new FrameStack();
    this.blockOrder = [];
    this.quick = quick;
  }

  public parseAllBlocks() {
    while (!this.scanner.eof()) {
      this.parseNextBlock();
    }
  }

  public *parseNextBlockV2() {
    let currentLength = this.blockOrder.length;
    while (!this.scanner.eof()) {
      this.parseNextBlock();
      while (currentLength < this.blockOrder.length) {
        yield this.blockOrder[currentLength];
        currentLength++;
      }
    }
  }

  public parseNextBlock() {
    const token = this.scanner.nextToken();
    if (token === '${') {
      this.parseBlockBlock();
    } else if (token === '$c') {
      this.parseConst();
    } else if (token === '$v') {
      this.parseVar();
    } else if (token === '$d') {
      this.parseDisjoint();
    } else {
      const label = token;
      const nextToken = this.scanner.nextToken();
      if (nextToken === '$f') {
        this.parseFloat(label);
      } else if (nextToken === '$e') {
        this.parseEssential(label);
      } else if (nextToken === '$a') {
        this.parseAxiom(label);
      } else if (nextToken === '$p') {
        this.parseTheorem(label);
      }
    }
  }

  private parseConst(): void {
    let constToken;
    while (`$.` !== (constToken = this.scanner.nextToken())) {
      this.frameStack.addConst(constToken);
    }
    return;
  }

  private parseVar(): void {
    let varToken;
    while (`$.` !== (varToken = this.scanner.nextToken())) {
      this.frameStack.addVar(varToken);
    }
    return;
  }

  private parseDisjoint(): string[] {
    const varList: string[] = [];
    let varToken;
    while ('$.' !== (varToken = this.scanner.nextToken())) {
      varList.push(varToken);
      continue;
    }
    this.frameStack.addDisjoint(varList);
    return varList;
  }

  private parseBlockBlock(): Frame | undefined {
    this.frameStack.pushEmpty();
    let token: string;
    while ('$}' !== (token = this.scanner.nextToken())) {
      if (token === '${') {
        this.parseBlockBlock();
      } else if (token === '$c') {
        this.parseConst();
      } else if (token === '$v') {
        this.parseVar();
      } else if (token === '$d') {
        this.parseDisjoint();
      } else {
        const label = token;
        const nextToken = this.scanner.nextToken();
        if (nextToken === '$f') {
          this.parseFloat(label);
        } else if (nextToken === '$e') {
          this.parseEssential(label);
        } else if (nextToken === '$a') {
          this.parseAxiom(label);
        } else if (nextToken === '$p') {
          this.parseTheorem(label);
        }
      }
    }
    return this.frameStack.pop();
  }

  private parseFloat(label: string): Float {
    const typeToken = this.scanner.nextToken();
    const valueToken = this.scanner.nextToken();
    this.scanner.nextToken(); // eat `$.`
    const float = new Float(label, typeToken, valueToken);
    this.frameStack.addFloat(float);
    return float;
  }

  private parseEssential(label: string): Essential {
    const typeToken = this.scanner.nextToken();
    const valueList: string[] = [];
    let valueToken: string;
    while ('$.' !== (valueToken = this.scanner.nextToken())) {
      valueList.push(valueToken);
    }
    const essential = new Essential(label, typeToken, valueList, this.frameStack, this.propAxiomMap, this.quick);
    this.frameStack.addEssential(essential);
    return essential;
  }

  private parseAxiom(label: string): Axiom {
    const typeToken = this.scanner.nextToken();
    const valueList: string[] = [];
    let valueToken: string;
    while ('$.' !== (valueToken = this.scanner.nextToken())) {
      valueList.push(valueToken);
    }
    const axiom = new Axiom(label, typeToken, valueList, this.frameStack, this.propAxiomMap, this.quick);
    if (axiom.type === '|-') {
      this.axiomMap.set(label, axiom);
    } else {
      this.propAxiomMap.set(label, axiom);
    }
    this.blockOrder.push(axiom.label);
    return axiom;
  }

  private parseTheorem(label: string): Theorem {
    const typeToken = this.scanner.nextToken();
    const valueList: string[] = [];
    const proofList: string[] = [];
    let valueToken: string;
    while ('$=' !== (valueToken = this.scanner.nextToken())) {
      valueList.push(valueToken);
    }
    while ('$.' !== (valueToken = this.scanner.nextToken())) {
      proofList.push(valueToken);
    }
    const theorem = new Theorem(
      label,
      typeToken,
      valueList,
      this.frameStack,
      proofList,
      this.propAxiomMap,
      this.axiomMap,
      this.theoremMap,
      this.quick,
    );
    this.theoremMap.set(label, theorem);
    this.blockOrder.push(theorem.label);
    return theorem;
  }
}

export class Scanner {
  fileList: string[]; // split large file into small file
  currentContent: string[] = []; // split tokens

  constructor(fileList: string[]) {
    this.fileList = fileList.filter((file) => existsSync(file));
    this.fileList.reverse();
  }

  public reset() {
    this.currentContent = [];
  }

  public eof(): boolean {
    return this.currentContent.length === 0 && this.fileList.length === 0;
  }

  public nextToken(): string {
    if (this.currentContent.length === 0) {
      const filePath = this.fileList.pop();
      if (filePath === undefined) {
        // end
        return '';
      }
      const input = readFileSync(filePath, 'utf-8');
      const input2 = input.split(/[\r\n\s]/).filter((e) => e.length > 0);
      this.currentContent = [];
      let inCommentBlock = false;
      for (const word of input2) {
        if (inCommentBlock === true) {
          if (word === '$)') {
            inCommentBlock = false;
          }
        } else if (word === '$(') {
          inCommentBlock = true;
        } else {
          this.currentContent.push(word);
        }
      }
      this.currentContent.reverse();
    }
    const op = this.currentContent.pop() || '';
    return globalAliasMap.get(op) || op;
  }
}

class Float {
  label: string;
  type: string;
  value: string;
  constructor(label: string, type: string, value: string) {
    this.label = label;
    this.type = type;
    this.value = value;
  }
}

class Essential {
  label: string;
  type: string;
  value: string;
  absValue: string;
  parseValue: string;
  err: string[];
  constructor(
    label: string,
    type: string,
    valueList: string[],
    frameStack: FrameStack,
    propAxiomMap: Map<string, Axiom>,
    quick: boolean,
  ) {
    this.label = label;
    this.type = type;
    this.value = valueList.join(' ');
    const absValue = frameStack.valueToAbsValue(valueList).join(' ');
    this.absValue = absValue;
    [this.parseValue, this.err] = frameStack.getParseValue(this.value, propAxiomMap, quick);
  }
}

class Axiom {
  label: string;
  type: string;
  value: string;
  absValue: string;
  parseValue: string;
  floats: Float[];
  floatMap: Map<string, Float>;
  floatInFollowOrderIdx: number[];
  valueInFollowOrderIdx: number[];
  floatToFollowMap: Map<string, string>;
  essentials: Essential[];
  disjoints: Set<string>;
  err: string[] = [];
  constructor(
    label: string,
    type: string,
    valueList: string[],
    frameStack: FrameStack,
    propAxiomMap: Map<string, Axiom>,
    quick: boolean,
  ) {
    this.label = label;
    this.type = type;
    this.value = valueList.join(' ');
    const absValue = frameStack.valueToAbsValue(valueList).join(' ');
    this.absValue = absValue;
    if (this.type === '|-') {
      [this.parseValue, this.err] = frameStack.getParseValue(this.value, propAxiomMap, quick);
    } else {
      this.parseValue = this.value;
    }
    this.floats = frameStack.getArgs(valueList);
    this.floatMap = new Map(this.floats.map((float) => [float.value, float]));
    this.essentials = frameStack.getEssentials();
    this.disjoints = frameStack.getDisjoints(this.floatMap);

    const [floatFollowOrder, floatToFollowMap] = frameStack.getArgsInFollowOrderIdx(valueList);
    this.floatToFollowMap = floatToFollowMap;
    const floatIdxMap: Map<string, number> = new Map(
      this.floats.map((float, idx) => {
        return [float.value, idx];
      }),
    );
    this.floatInFollowOrderIdx = floatFollowOrder.map((float) => {
      return floatIdxMap.get(float) || 0;
    });
    const valueIdxMap: Map<string, number> = new Map(
      valueList
        .filter((value) => {
          return this.floatMap.has(value);
        })
        .map((float, idx) => {
          return [float, idx];
        }),
    );
    this.valueInFollowOrderIdx = floatFollowOrder.map((float) => {
      return valueIdxMap.get(float) || 0;
    });
  }

  public getFollowArgs(): string {
    const args = this.floatInFollowOrderIdx
      .map((idx) => {
        const float = this.floats[idx];
        return `${float.type} ${this.floatToFollowMap.get(float.value) || float.value}`;
      })
      .join(', ');
    return args;
  }

  public replaceToFollowV2(input: string): string {
    const output = input
      .split(' ')
      .map((e) => {
        return this.floatToFollowMap.get(e) || e;
      })
      .join(' ');
    return output;
  }

  public replaceToFollow(input: string): string {
    const output = input
      .split(' ')
      .map((e) => {
        if (e === ',') {
          return ', ';
        }
        return this.floatToFollowMap.get(e) || e;
      })
      .join('');
    return output;
  }

  public getFollowBody(): string[] {
    const content: string[] = [];
    content.push(`  |- ${this.replaceToFollow(this.parseValue)}`);
    for (const essential of this.essentials) {
      content.push(`  -| ${this.replaceToFollow(essential.parseValue)}`);
    }
    const diffssContent: string[] = [];
    const diffscContent: string[] = [];
    const diffswContent: string[] = [];
    for (const disjoint of this.disjoints) {
      const variables = disjoint.split(' ');
      const float0 = this.floatMap.get(variables[0]);
      const float1 = this.floatMap.get(variables[1]);
      if (float0 && float1) {
        const floatvalue0 = this.floatToFollowMap.get(float0.value) || float0.value;
        const floatvalue1 = this.floatToFollowMap.get(float1.value) || float1.value;
        if (float0.type === 'setvar' && float1.type === 'setvar') {
          if (floatvalue0 < floatvalue1) {
            diffssContent.push(`  -| diffss(${floatvalue0}, ${floatvalue1})`);
          } else {
            diffssContent.push(`  -| diffss(${floatvalue1}, ${floatvalue0})`);
          }
        } else if (float1.type === 'setvar') {
          if (float0.type === 'class') {
            diffscContent.push(`  -| diffsc(${floatvalue1}, ${floatvalue0})`);
          } else if (float0.type === 'wff') {
            diffswContent.push(`  -| diffsw(${floatvalue1}, ${floatvalue0})`);
          }
        } else {
          if (float1.type === 'class') {
            diffscContent.push(`  -| diffsc(${floatvalue0}, ${floatvalue1})`);
          } else if (float1.type === 'wff') {
            diffswContent.push(`  -| diffsw(${floatvalue0}, ${floatvalue1})`);
          }
        }
      }
    }
    return [...content, ...diffssContent, ...diffscContent, ...diffswContent];
  }
}

class Theorem {
  label: string;
  type: string;
  value: string;
  absValue: string;
  parseValue: string;
  floats: Float[];
  floatMap: Map<string, Float>;
  floatInFollowOrderIdx: number[];
  valueInFollowOrderIdx: number[];
  floatToFollowMap: Map<string, string>;
  essentials: Essential[];
  disjoints: Set<string>;
  proof: string;
  error: string[];
  constructor(
    label: string,
    type: string,
    valueList: string[],
    frameStack: FrameStack,
    proofList: string[],
    propAxiomMap: Map<string, Axiom>,
    axiomMap: Map<string, Axiom>,
    theoremMap: Map<string, Theorem>,
    quick: boolean,
  ) {
    this.label = label;
    this.type = type;
    this.value = valueList.join(' ');
    const absValue = frameStack.valueToAbsValue(valueList).join(' ');
    this.absValue = absValue;
    [this.parseValue, this.error] = frameStack.getParseValue(this.value, propAxiomMap, quick);
    this.floats = frameStack.getArgs(valueList);
    this.floatMap = new Map(this.floats.map((float) => [float.value, float]));
    this.essentials = frameStack.getEssentials();
    this.disjoints = frameStack.getDisjoints(this.floatMap);

    const [floatFollowOrder, floatToFollowMap] = frameStack.getArgsInFollowOrderIdx(valueList);
    this.floatToFollowMap = floatToFollowMap;
    const floatIdxMap: Map<string, number> = new Map(
      this.floats.map((float, idx) => {
        return [float.value, idx];
      }),
    );
    this.floatInFollowOrderIdx = floatFollowOrder.map((float) => {
      return floatIdxMap.get(float) || 0;
    });
    const valueIdxMap: Map<string, number> = new Map(
      valueList
        .filter((value) => {
          return this.floatMap.has(value);
        })
        .map((float, idx) => {
          return [float, idx];
        }),
    );
    this.valueInFollowOrderIdx = floatFollowOrder.map((float) => {
      return valueIdxMap.get(float) || 0;
    });
    this.proof = this.decompressProof(
      proofList,
      propAxiomMap,
      axiomMap,
      theoremMap,
      frameStack,
      quick || this.error.length > 0,
    );
  }

  public decompressProof(
    proofList: string[],
    propAxiomMap: Map<string, Axiom>,
    axiomMap: Map<string, Axiom>,
    theoremMap: Map<string, Theorem>,
    frameStack: FrameStack,
    quick: boolean,
  ): string {
    if (quick) {
      return proofList.join(' ');
    }
    writeFileSync('./main.log', `decompressProof ${this.label} start`, { encoding: 'utf-8' });
    const decompressProof: string[] = [];
    if (proofList[0] !== '(') {
      decompressProof.push(...proofList);
    } else {
      const opLabelInProof: string[] = [];
      let idx = 0;
      for (; idx < proofList.length; idx++) {
        const op = proofList[idx];
        if (op === '(') {
          continue;
        } else if (op === ')') {
          idx++; // eat ')'
          break;
        } else {
          opLabelInProof.push(op);
        }
      }
      const compressdProof = proofList.slice(idx).join('');
      const proofInts: Array<number> = [];
      let curInt = 0;
      for (const ch of compressdProof) {
        if (ch === 'Z') {
          proofInts.push(-1);
        } else if ('A' <= ch && ch <= 'T') {
          curInt = 20 * curInt + (ch.charCodeAt(0) - charCodes.uppercaseA) + 1;
          proofInts.push(curInt - 1);
          curInt = 0;
        } else if ('U' <= ch && ch <= 'Y') {
          curInt = 5 * curInt + ch.charCodeAt(0) - charCodes.uppercaseU + 1;
        }
      }

      const floatEndIdx = this.floats.length;
      const essentialEndIdx = floatEndIdx + this.essentials.length;
      const opLabelEndIdx = essentialEndIdx + opLabelInProof.length;
      let decompressInts: Array<number> = [];
      const subProofs: Array<Array<number>> = [];
      let prevProofs: Array<Array<number>> = [];

      for (const proofInt of proofInts) {
        if (proofInt === -1) {
          subProofs.push(prevProofs[prevProofs.length - 1]);
        } else if (0 <= proofInt && proofInt < essentialEndIdx) {
          prevProofs.push([proofInt]);
          decompressInts.push(proofInt);
        } else if (essentialEndIdx <= proofInt && proofInt < opLabelEndIdx) {
          decompressInts.push(proofInt);
          const label = opLabelInProof[proofInt - essentialEndIdx];
          const node = propAxiomMap.get(label) || axiomMap.get(label) || theoremMap.get(label);
          if (node) {
            const hypNum = node.floats.length + node.essentials.length;
            const newPrevProof: Array<number> = [];
            if (hypNum > 0) {
              for (let i = prevProofs.length - hypNum; i < prevProofs.length; i++) {
                if (i < 0) {
                  continue;
                }
                for (const n of prevProofs[i]) {
                  newPrevProof.push(n);
                }
              }
              prevProofs = prevProofs.slice(0, prevProofs.length - hypNum);
            }
            newPrevProof.push(proofInt);
            prevProofs.push(newPrevProof);
          } else {
            prevProofs.push([proofInt]);
          }
        } else if (proofInt - opLabelEndIdx < subProofs.length) {
          const proof = subProofs[proofInt - opLabelEndIdx];
          decompressInts = [...decompressInts, ...proof];
          prevProofs.push(proof);
        }
      }

      for (const di of decompressInts) {
        let node: string | undefined;
        if (di < floatEndIdx) {
          node = this.floats[di].label;
        } else if (di < essentialEndIdx) {
          node = this.essentials[di - floatEndIdx].label;
        } else if (di < opLabelEndIdx) {
          node = opLabelInProof[di - essentialEndIdx];
        }
        if (node) {
          decompressProof.push(node);
        }
      }
    }

    let stack: string[] = [];
    const hiddenIdxMap: Map<string, number> = new Map();
    const hiddenFloatMap: Map<string, string> = new Map();
    for (let label of decompressProof) {
      const node = propAxiomMap.get(label) || axiomMap.get(label) || theoremMap.get(label);
      if (node) {
        const floats = node.floats;
        const essentials = node.essentials;
        const args = stack.slice(stack.length - floats.length - essentials.length);
        stack = stack.slice(0, stack.length - floats.length - essentials.length);
        let argFloats = args.slice(0, floats.length).map((e) => e.trim());
        if (label === 'weq' || label === 'wel') {
          label = label === 'weq' ? 'wceq' : 'wcel';
          argFloats = argFloats.map((e) => `cv(${e})`);
        }
        const reorderedArgs = node.floatInFollowOrderIdx.map((idx) => {
          return argFloats[idx];
        });
        const argEssentials = args.slice(floats.length).filter((essential) => {
          return frameStack.lookForEssential(essential) === undefined;
        });
        const head = reorderedArgs.length > 0 ? `${label}(${reorderedArgs.join(', ')})` : `${label}`;
        if (argEssentials.length > 0) {
          stack.push(`  ${head}\n${argEssentials.join('\n')}`);
        } else {
          stack.push(`  ${head}`);
        }
      } else {
        const float = frameStack.lookForFloat(label);
        if (float) {
          const follow = this.floatToFollowMap?.get(float.value);
          if (follow) {
            stack.push(follow);
          } else {
            let hiddenFollow = hiddenFloatMap.get(float.value);
            if (hiddenFollow === undefined) {
              let typeIdx = hiddenIdxMap.get(float.type);
              if (typeIdx === undefined) {
                typeIdx = 0;
              }
              hiddenFollow = `h${float.type[0]}${typeIdx}`;
              hiddenFloatMap.set(float.value, hiddenFollow);
              typeIdx++;
              hiddenIdxMap.set(float.type, typeIdx);
            }
            stack.push(hiddenFollow);
          }
        } else {
          stack.push(label);
        }
      }
    }
    return stack[0];
  }

  public getFollowArgs(): string {
    const args = this.floatInFollowOrderIdx
      .map((idx) => {
        const float = this.floats[idx];
        return `${float.type} ${this.floatToFollowMap.get(float.value) || float.value}`;
      })
      .join(', ');
    return args;
  }

  public replaceToFollow(input: string): string {
    const output = input
      .split(' ')
      .map((e) => {
        if (e === ',') {
          return ', ';
        }
        return this.floatToFollowMap.get(e) || e;
      })
      .join('');
    return output;
  }

  public getFollowBody(): string[] {
    const content: string[] = [];
    content.push(`  |- ${this.replaceToFollow(this.parseValue)}`);
    const essentialSet: Set<string> = new Set();
    for (const essential of this.essentials) {
      const s = this.replaceToFollow(essential.parseValue);
      if (!essentialSet.has(s)) {
        content.push(`  -| ${s}`);
        essentialSet.add(s);
      }
    }
    const diffContents: string[][] = [[], [], [], [], [], []];
    for (const disjoint of this.disjoints) {
      const variables = disjoint.split(' ');
      const float0 = this.floatMap.get(variables[0]);
      const float1 = this.floatMap.get(variables[1]);
      if (float0 && float1) {
        const floatvalue0 = this.floatToFollowMap.get(float0.value) || float0.value;
        const floatvalue1 = this.floatToFollowMap.get(float1.value) || float1.value;
        const typeCode0 = float0.type === 'setvar' ? 0 : float0.type === 'class' ? 1 : 2;
        const typeCode1 = float1.type === 'setvar' ? 0 : float1.type === 'class' ? 1 : 2;
        const compareFunction = () => {
          if (typeCode0 < typeCode1) {
            return true;
          } else if (typeCode0 > typeCode1) {
            return false;
          }
          if (floatvalue0 < floatvalue1) {
            return true;
          }
          return false;
        };
        const isFromFloat0ToFloat1: boolean = compareFunction();
        if (isFromFloat0ToFloat1) {
          const code = typeCode0 * 2 + typeCode1;
          const diffContent = diffContents[code];
          diffContent.push(`  -| diff${float0.type[0]}${float1.type[0]}(${floatvalue0}, ${floatvalue1})`);
        } else {
          const code = typeCode1 * 2 + typeCode0;
          const diffContent = diffContents[code];
          diffContent.push(`  -| diff${float1.type[0]}${float0.type[0]}(${floatvalue1}, ${floatvalue0})`);
        }
      }
    }
    for (const arr of diffContents) {
      arr.sort();
      content.push(...arr);
    }
    return content;
  }
}

class Frame {
  constants: Set<string>;
  variables: Set<string>;
  disjoints: Set<string>;
  floats: Array<Float>;
  floatMap: Map<string, Float>;
  floatVarMap: Map<string, Float>;
  essentials: Array<Essential>;
  essentialMap: Map<string, Essential>;

  constructor() {
    this.constants = new Set();
    this.variables = new Set();
    this.disjoints = new Set();
    this.floats = [];
    this.floatMap = new Map();
    this.floatVarMap = new Map();
    this.essentials = [];
    this.essentialMap = new Map();
  }
}

class FrameStack {
  public stack: Array<Frame> = [];

  constructor() {
    this.pushEmpty();
  }

  public pushEmpty() {
    this.stack.push(new Frame());
  }

  public push(frame: Frame) {
    this.stack.push(frame);
  }

  public pop(): Frame | undefined {
    return this.stack.pop();
  }

  public top(): Frame {
    return this.stack[this.stack.length - 1];
  }

  public addConst(token: string): boolean {
    if (this.stack.length === 0) {
      return false;
    }
    const frame = this.stack[this.stack.length - 1];
    frame.constants.add(token);
    return true;
  }

  public addVar(variable: string): boolean {
    if (this.stack.length === 0) {
      return false;
    }
    const frame = this.stack[this.stack.length - 1];
    frame.variables.add(variable);
    return true;
  }

  public addFloat(float: Float): boolean {
    if (this.stack.length === 0) {
      return false;
    }
    const frame = this.stack[this.stack.length - 1];
    frame.floats.push(float);
    frame.floatMap.set(float.label, float);
    frame.floatVarMap.set(float.value, float);
    return true;
  }

  public addEssential(essential: Essential): boolean {
    if (this.stack.length === 0) {
      return false;
    }
    const frame = this.stack[this.stack.length - 1];
    frame.essentials.push(essential);
    frame.essentialMap.set(essential.label, essential);
    return true;
  }

  public addDisjoint(vars: string[]): boolean {
    if (this.stack.length === 0) {
      return false;
    }
    const frame = this.stack[this.stack.length - 1];
    vars.sort();
    for (let i = 0; i < vars.length - 1; i++) {
      for (let j = i + 1; j < vars.length; j++) {
        frame.disjoints.add(`${vars[i]} ${vars[j]}`);
      }
    }
    return true;
  }

  public lookForConst(token: string): string | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      if (frame.constants.has(token)) {
        return token;
      }
    }
    return;
  }

  public lookForVar(variable: string): string | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      if (frame.variables.has(variable)) {
        return variable;
      }
    }
    return;
  }

  public lookForFloat(floatLabel: string): Float | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      if (frame.floatMap.has(floatLabel)) {
        return frame.floatMap.get(floatLabel);
      }
    }
    return;
  }

  public lookForFloatByVar(variable: string): Float | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      if (frame.floatVarMap.has(variable)) {
        return frame.floatVarMap.get(variable);
      }
    }
    return;
  }

  public lookForEssential(essentialLabel: string): Essential | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      if (frame.essentialMap.has(essentialLabel)) {
        return frame.essentialMap.get(essentialLabel);
      }
    }
    return;
  }

  public valueToAbsValue(valueList: string[]): string[] {
    return valueList.map((value) => {
      const float = this.lookForFloatByVar(value);
      if (float) {
        return float.type;
      } else {
        return value;
      }
    });
  }

  public getEssentials(): Essential[] {
    const essentials: Essential[] = [];
    for (const frame of this.stack) {
      if (frame.essentials) {
        essentials.push(...frame.essentials);
      }
    }
    return essentials;
  }

  public getArgs(valueList: string[]): Float[] {
    const argSet: Set<string> = new Set();
    const argList: Float[] = [];
    // get all argSet
    for (const op of valueList) {
      const float = this.lookForFloatByVar(op);
      if (float) {
        argSet.add(op);
      }
    }
    this.getEssentials().forEach((essential) => {
      essential.value.split(' ').forEach((op) => {
        const float = this.lookForFloatByVar(op);
        if (float) {
          argSet.add(op);
        }
      });
    });
    for (let stackIdx = this.stack.length - 1; stackIdx >= 0; stackIdx--) {
      const stack = this.stack[stackIdx];
      for (let floatIdx = stack.floats.length - 1; floatIdx >= 0; floatIdx--) {
        const float = stack.floats[floatIdx];
        if (argSet.has(float.value)) {
          argList.push(float);
          argSet.delete(float.value);
        }
      }
    }
    argList.reverse();
    return argList;
  }

  public getArgsInFollowOrderIdx(valueList: string[]): [string[], Map<string, string>] {
    const argList: Float[] = [];
    const argSet: Set<string> = new Set();
    for (const op of valueList) {
      const float = this.lookForFloatByVar(op);
      if (float && !argSet.has(float.value)) {
        argList.push(float);
        argSet.add(op);
      }
    }
    this.getEssentials().forEach((essential) => {
      essential.value.split(' ').forEach((op) => {
        const float = this.lookForFloatByVar(op);
        if (float && !argSet.has(float.value)) {
          argList.push(float);
          argSet.add(op);
        }
      });
    });
    const setvarList = argList
      .filter((float) => {
        return float.type === 'setvar';
      })
      .map((float) => float.value);
    const classList = argList
      .filter((float) => {
        return float.type === 'class';
      })
      .map((float) => float.value);
    const wffList = argList
      .filter((float) => {
        return float.type === 'wff';
      })
      .map((float) => float.value);
    const floatInFollowOrder = [...setvarList, ...classList, ...wffList];
    const floatToFollowMap: Map<string, string> = new Map();
    setvarList.forEach((s, idx) => {
      floatToFollowMap.set(s, `s${idx}`);
    });
    classList.map((c, idx) => {
      floatToFollowMap.set(c, `c${idx}`);
    });
    wffList.map((w, idx) => {
      floatToFollowMap.set(w, `w${idx}`);
    });
    return [floatInFollowOrder, floatToFollowMap];
  }

  public getDisjoints(floatMap: Map<string, Float>): Set<string> {
    const result: Set<string> = new Set();
    this.stack.forEach((frame) => {
      frame.disjoints.forEach((disjoint) => {
        const varList = disjoint.split(' ');
        if (floatMap.has(varList[0]) && floatMap.has(varList[1])) {
          result.add(disjoint);
        }
      });
    });
    return result;
  }

  public getParseValue(value: string, propAxiomMap: Map<string, Axiom>, quick: boolean): [string, string[]] {
    if (quick) {
      return [value, []];
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [antlrParseValue, err] = antlrParse(value);
    if (err.length > 0) {
      writeFileSync('./error.log', `${value} \n ${err.join('\n')}`, { flag: 'ax', encoding: 'utf-8' });
      return [value, err];
    }
    const antlrOps = antlrParseValue.split(' ').map((op) => {
      op = globalAliasMap.get(op) || op;
      const float = this.lookForFloat(op);
      if (float) {
        return float.value;
      }
      return op;
    });
    let stack: string[] = [];
    antlrOps.reverse();
    for (const antlrOp of antlrOps) {
      const axiom = propAxiomMap.get(antlrOp);
      if (axiom) {
        const argsLength = axiom.valueInFollowOrderIdx.length;
        if (argsLength > 0) {
          const args = stack.slice(stack.length - argsLength);
          stack = stack.slice(0, stack.length - argsLength);
          args.reverse();
          const reorderedArgs = axiom.valueInFollowOrderIdx
            .map((idx) => {
              return args[idx];
            })
            .join(' , ');
          stack.push(`${antlrOp} ( ${reorderedArgs} )`);
          continue;
        }
      }
      stack.push(antlrOp);
    }
    return [stack[0], []];
  }
}
