import { createReadStream } from 'node:fs';
import * as charCodes from 'charcodes';

export async function read(filePath: string, callback: (arg0: string) => void, highWaterMark: number = 1024) {
  const reader = createReadStream(filePath, { highWaterMark: highWaterMark });
  reader.setEncoding('utf-8');
  for await (const chunk of reader) {
    callback(chunk);
  }
}

class Prop {
  type: string;
  name: string;
  params: string[];
  constructor(tokens: string[]) {
    this.type = tokens[1];
    this.name = tokens[2];
    this.params = tokens
      .slice(4, tokens.length - 1)
      .join(' ')
      .split(/[(,)]/)
      .map((e) => e.trim());
  }

  toString(): string {
    return `prop ${this.type} ${this.name}(${this.params.join(', ')})`;
  }
}

class ProofNode {
  statement: string[];
  target: string;
  assumptions: string[];

  cumulatedTarget: string;
  cumulatedAssumptions: string[];
  useless: boolean;

  constructor(
    statement: string[],
    axiomTheoremMap: Map<string, AxiomTheorem>,
    preCumulatedTarget: string,
    preCumulatedAssumptions: string[],
  ) {
    this.statement = statement;
    const name = statement[0];
    const args: string[] = [];
    let arg: string[] = [];
    let leftParenthesis = 0;
    let rightParenthesis = 0;
    for (let i = 2; i < statement.length - 1; i++) {
      const op = statement[i];
      if (op === ',' && leftParenthesis === rightParenthesis) {
        args.push(arg.join(''));
        arg = [];
      } else {
        if (op === '(') {
          leftParenthesis++;
        } else if (op === ')') {
          rightParenthesis++;
        }
        arg.push(op);
      }
    }
    if (arg.length > 0) {
      args.push(arg.join(''));
    }
    const node = axiomTheoremMap.get(name);
    if (node) {
      [this.target, this.assumptions] = node.replace(args);
    } else {
      this.target = '';
      this.assumptions = [];
    }

    this.useless = false;
    if (preCumulatedTarget.length === 0) {
      this.cumulatedTarget = this.target;
      this.cumulatedAssumptions = this.assumptions;
    } else {
      this.cumulatedTarget = preCumulatedTarget;
      const assumptions = preCumulatedAssumptions.filter((assumption) => assumption !== this.target);
      if (assumptions.length === preCumulatedAssumptions.length) {
        this.useless = true;
      }
      for (const assume of this.assumptions) {
        if (!assumptions.includes(assume)) {
          assumptions.push(assume);
        }
      }
      this.cumulatedAssumptions = assumptions;
    }
  }
  public toString(): string {
    return this.statement.join('').replace(/,/g, ', ');
  }
}

class AxiomTheorem {
  name: string;
  params: string[];
  target: string;
  assumptions: string[];
  proofNodes?: ProofNode[];
  constructor(tokens: string[], axiomTheoremMap: Map<string, AxiomTheorem>) {
    this.name = tokens[1];
    let i = 2;
    for (; i < tokens.length; i++) {
      if (tokens[i] === ')') {
        i += 1;
        break;
      }
    }
    this.params = tokens
      .slice(3, i - 1)
      .join(' ')
      .split(',')
      .map((e) => e.trim());

    const statementStart = i + 1;
    for (; i < tokens.length; i++) {
      if (tokens[i] === '}') {
        i += 1;
        break;
      }
    }

    const statements: string[] = tokens
      .slice(statementStart, i - 1)
      .join(' ')
      .split(/\|-|-\|/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
    this.target = statements[0];
    this.assumptions = statements.slice(1);

    while (i < tokens.length && tokens[i] !== '{') {
      i++;
    }
    const proofTokens = tokens.slice(i + 1, tokens.length - 1);
    if (proofTokens.length > 0) {
      this.proofNodes = this.parseProof(proofTokens, axiomTheoremMap);
    }
  }
  public parseProof(tokens: string[], axiomTheoremMap: Map<string, AxiomTheorem>): ProofNode[] {
    const proofNodes: ProofNode[] = [];
    let i = 0;
    const preCumulatedTarget = this.target.split(' ').join('').replace(/,/g, ', ');
    let preCumulatedAssumptions: string[] = [preCumulatedTarget];
    while (i < tokens.length) {
      const start = i;
      if (tokens[i + 1] === '(') {
        i += 2;
        let leftParenthesis = 1;
        let rightParenthesis = 0;
        while (i < tokens.length) {
          if (tokens[i] === '(') {
            leftParenthesis += 1;
          } else if (tokens[i] === ')') {
            rightParenthesis += 1;
          }
          if (leftParenthesis === rightParenthesis) {
            break;
          }
          i++;
        }
      }
      i += 1;
      const end = i;
      const stmt = tokens.slice(start, end);
      const proofNode = new ProofNode(stmt, axiomTheoremMap, preCumulatedTarget, preCumulatedAssumptions);
      preCumulatedAssumptions = proofNode.cumulatedAssumptions;
      proofNodes.push(proofNode);
    }
    return proofNodes;
  }
  public toString(): string {
    const assumes = this.assumptions.map((assume) => {
      return `  -| ${assume.split(' ').join('').replace(/,/g, ', ')}`;
    });
    if (this.proofNodes && this.proofNodes.length > 0) {
      const proofNodes = this.proofNodes.map((e) => {
        return `  ${e.toString()}`;
      });
      return [
        `thm ${this.name}(${this.params.join(', ')}) {`,
        `  |- ${this.target.split(' ').join('').replace(/,/g, ', ')}`,
        ...assumes,
        '} = {',
        ...proofNodes,
        '}',
      ].join('\n');
    } else {
      return [
        `axiom ${this.name}(${this.params.join(', ')}) {`,
        `  |- ${this.target.split(' ').join('').replace(/,/g, ', ')}`,
        ...assumes,
        '}',
      ].join('\n');
    }
  }
  public replace(args: string[]): [string, string[]] {
    const paramMap: Map<string, string> = new Map(
      this.params.map((param, idx) => {
        return [param.split(' ')[1], args[idx]];
      }),
    );
    const replaceTarget: string = this.target
      .split(' ')
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
      .map((e) => {
        return paramMap.get(e) || e;
      })
      .join('')
      .replace(/,/g, ', ');
    const replaceAssumptions = this.assumptions.map((assume) => {
      return assume
        .split(' ')
        .map((e) => e.trim())
        .filter((e) => e.length > 0)
        .map((e) => {
          return paramMap.get(e) || e;
        })
        .join('')
        .replace(/,/g, ', ');
    });
    return [replaceTarget, replaceAssumptions];
  }
}

export class Parser {
  public blockStrBuffer: string[];
  public tokenBuffer: string[];
  public typeSet: Set<string>;
  public constSet: Set<string>;
  public propMap: Map<string, Prop>;
  public axiomTheoremMap: Map<string, AxiomTheorem>;

  constructor() {
    this.blockStrBuffer = [];
    this.tokenBuffer = [];
    this.typeSet = new Set();
    this.constSet = new Set();
    this.propMap = new Map();
    this.axiomTheoremMap = new Map();
  }

  public outputBlockStr(): string[] {
    const blockStrBuffer = this.blockStrBuffer;
    this.blockStrBuffer = [];
    return blockStrBuffer;
  }

  public parseNextToken(token: string) {
    if (token === undefined || token.length === 0) {
      if (this.tokenBuffer.length > 0) {
        this.parseBlock(this.tokenBuffer);
      }
      this.tokenBuffer = [];
    } else if (this.isKeyword(token)) {
      if (this.tokenBuffer.length > 0) {
        this.parseBlock(this.tokenBuffer);
      }
      this.tokenBuffer = [token];
    } else {
      this.tokenBuffer.push(token);
    }
  }

  public parseBlock(tokens: string[]) {
    if (tokens[0] === 'type') {
      const types: string[] = [];
      for (let i = 1; i < tokens.length; i++) {
        const value = tokens[i];
        if (!this.typeSet.has(value)) {
          this.typeSet.add(value);
          types.push(value);
        }
      }
      if (types.length > 0) {
        this.blockStrBuffer.push(`type ${types.join(' ')}`);
      }
    } else if (tokens[0] === 'const') {
      const type = tokens[1];
      const values: string[] = [];
      for (let i = 2; i < tokens.length; i++) {
        const value = `${type} ${tokens[i]}`;
        if (!this.constSet.has(value)) {
          this.constSet.add(value);
          values.push(tokens[i]);
        }
      }
      if (values.length > 0) {
        this.blockStrBuffer.push(`const ${type} ${values.join(' ')}`);
      }
    } else if (tokens[0] === 'prop') {
      const prop = new Prop(tokens);
      this.propMap.set(prop.name, prop);
      this.blockStrBuffer.push(prop.toString());
    } else if (tokens[0] === 'axiom') {
      const axiom = new AxiomTheorem(tokens, this.axiomTheoremMap);
      this.axiomTheoremMap.set(axiom.name, axiom);
      this.blockStrBuffer.push(axiom.toString());
    } else if (tokens[0] === 'thm') {
      const theorem = new AxiomTheorem(tokens, this.axiomTheoremMap);
      this.axiomTheoremMap.set(theorem.name, theorem);
      this.blockStrBuffer.push(theorem.toString());
    }
  }

  private isKeyword(token: string) {
    return token === 'type' || token === 'const' || token === 'prop' || token === 'axiom' || token === 'thm';
  }
}

export class Scanner {
  public tokenBuffer: string[];
  public tailBuffer: string;
  private isInLineComment: boolean;
  private isInBlockComment: boolean;

  constructor() {
    this.tokenBuffer = [];
    this.tailBuffer = '';
    this.isInBlockComment = false;
    this.isInLineComment = false;
  }

  public outputTokens(): string[] {
    const tokenBuffer = this.tokenBuffer;
    this.tokenBuffer = [];
    return tokenBuffer;
  }

  public scanNewInput(newInput: string) {
    let idx = 0;
    newInput = this.tailBuffer + newInput;
    this.tailBuffer = '';
    while (idx < newInput.length) {
      const code = newInput.charCodeAt(idx);
      if (this.isInLineComment) {
        if (this.isNewLine(code)) {
          this.isInLineComment = false;
        }
        idx += 1;
        continue;
      } else if (this.isInBlockComment) {
        if (code === charCodes.asterisk) {
          const nextChar = newInput.charCodeAt(idx + 1);
          if (nextChar === charCodes.slash) {
            idx += 2; // eat asterisk and slash
            this.isInBlockComment = false;
          }
        } else {
          idx += 1;
        }
        continue;
      } else if (code === charCodes.slash) {
        const nextChar = newInput.charCodeAt(idx + 1);
        if (nextChar === charCodes.slash) {
          idx += 2; // eat slash and slash
          this.isInLineComment = true;
          continue;
        } else if (nextChar === charCodes.asterisk) {
          idx += 2; // eat slash and asterisk
          this.isInBlockComment = true;
          continue;
        }
      } else if (this.isSeparator(code)) {
        idx += 1;
        continue;
      } else if (this.isSingleToken(code)) {
        this.tokenBuffer.push(newInput.slice(idx, idx + 1));
        idx += 1;
        continue;
      }
      // get next token
      const startIdx = idx;
      idx += 1;
      while (idx < newInput.length) {
        const code = newInput.charCodeAt(idx);
        if (code === charCodes.slash) {
          const nextChar = newInput.charCodeAt(idx + 1);
          if (nextChar === charCodes.slash || nextChar === charCodes.asterisk) {
            break;
          }
        } else if (this.isSeparator(code) || this.isSingleToken(code)) {
          break;
        }
        idx += 1;
      }
      if (idx === newInput.length) {
        this.tailBuffer = newInput.slice(startIdx, idx);
      } else {
        this.tokenBuffer.push(newInput.slice(startIdx, idx));
      }
    }
  }

  private isSingleToken(code: number): boolean {
    return (
      code === charCodes.leftParenthesis ||
      code === charCodes.rightParenthesis ||
      code === charCodes.leftCurlyBrace ||
      code === charCodes.rightCurlyBrace ||
      code === charCodes.equalsTo ||
      code === charCodes.comma
    );
  }

  private isSeparator(code: number): boolean {
    return this.isNewLine(code) || this.isWhitespace(code);
  }

  private isNewLine(code: number): boolean {
    return code === charCodes.lineFeed;
  }

  private isWhitespace(code: number): boolean {
    return code === charCodes.space || code === charCodes.tab || code === charCodes.carriageReturn;
  }
}
