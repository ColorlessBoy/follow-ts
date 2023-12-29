import { createReadStream, existsSync, readFileSync } from 'node:fs';
import * as charCodes from 'charcodes';

export async function read(filePath: string, callback: (arg0: string) => void, highWaterMark: number = 1024) {
  const reader = createReadStream(filePath, { highWaterMark: highWaterMark });
  reader.setEncoding('utf-8');
  for await (const chunk of reader) {
    await callback(chunk);
  }
}

export class Prop {
  type: string;
  name: string;
  params: string[];
  stmt: string[];
  paramNames: string[];
  constructor(tokens: string[]) {
    this.type = tokens[1];
    this.name = tokens[2];
    this.params = [];
    this.stmt = [];
    for (let i = 4; i < tokens.length; i++) {
      if (tokens[i] === ')') {
        if (i > 4) {
          this.params = tokens
            .slice(4, i)
            .join(' ')
            .split(/[(,)]/)
            .map((e) => e.trim());
        }
        if (i + 2 < tokens.length - 1) {
          this.stmt = tokens
            .slice(i + 2, tokens.length - 1)
            .map((e) => e.trim())
            .filter((e) => e.length > 0);
        }
        break;
      }
    }
    this.paramNames = this.params.map((e) => e.split(' ')[1]);
  }

  public replace(args: string[]) {
    if (this.stmt.length === 0) {
      if (args.length === 0) {
        return `${this.name}(${args.join(', ')})`;
      } else {
        return this.name;
      }
    }
    const size = args.length < this.params.length ? args.length : this.params.length;
    const replaceMap: Map<string, string> = new Map();
    for (let i = 0; i < size; i++) {
      const key = this.paramNames[i];
      const value = args[i].trim();
      replaceMap.set(key, value);
    }
    return this.stmt.map((e) => replaceMap.get(e) || e).join(' ');
  }

  toString(constPropMap?: Map<string, string>): string {
    const stmt = constPropMap?.get(this.name) || this.stmt.join(' ').trim();
    return `prop ${this.type} ${this.name}(${this.params.join(', ')}) { ${stmt} }`;
  }
}

export class ProofNode {
  statement: string[];
  target: string;
  assumptions: string[];

  propTarget: string;
  propAssumptions: string[];

  name: string;
  args: string[];
  propArgs: string[];

  useful: boolean;
  cumulatedTarget: string;
  cumulatedAssumptions: string[];

  cumulatedPropTarget: string;
  cumulatedPropAssumptions: string[];

  comment?: string;

  constructor(
    statement: string[],
    propMap: Map<string, Prop>,
    axiomTheoremMap: Map<string, AxiomTheorem>,
    preCumulatedTarget: string,
    preCumulatedAssumptions: string[],
    comment?: string,
  ) {
    this.statement = statement;
    this.comment = comment;
    const name = statement[0];
    const args: string[] = [];
    this.name = name;
    this.args = args;
    let arg: string[] = [];
    let leftParenthesis = 0;
    let rightParenthesis = 0;
    for (let i = 2; i < statement.length - 1; i++) {
      const op = statement[i];
      if (op === ',' && leftParenthesis === rightParenthesis) {
        args.push(arg.join(' '));
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
      args.push(arg.join(' '));
    }
    const node = axiomTheoremMap.get(name);
    if (node) {
      [this.target, this.assumptions] = node.replace(args);
    } else {
      this.target = '';
      this.assumptions = [];
    }

    this.useful = true;
    if (preCumulatedTarget.length === 0) {
      this.cumulatedTarget = this.target;
      this.cumulatedAssumptions = this.assumptions;
    } else {
      this.cumulatedTarget = preCumulatedTarget;
      const assumptions = preCumulatedAssumptions.filter((assumption) => assumption !== this.target);
      if (assumptions.length === preCumulatedAssumptions.length) {
        this.useful = false;
      }
      for (const assume of this.assumptions) {
        if (!assumptions.includes(assume)) {
          assumptions.push(assume);
        }
      }
      this.cumulatedAssumptions = assumptions;
    }

    this.propArgs = this.args.map((e) => this.stmtToPropTarget(e, propMap));
    this.propTarget = this.stmtToPropTarget(this.target, propMap);
    this.propAssumptions = this.assumptions.map((e) => this.stmtToPropTarget(e, propMap));
    this.cumulatedPropTarget = this.stmtToPropTarget(this.cumulatedTarget, propMap);
    this.cumulatedPropAssumptions = this.cumulatedAssumptions.map((e) => this.stmtToPropTarget(e, propMap));
  }

  public stmtToPropTarget(stmt: string, propMap: Map<string, Prop>): string {
    const words = stmt.split(' ');
    const preStacks: string[][] = [];
    let stack: string[] = [];
    for (const word of words) {
      if (word === '(') {
        preStacks.push(stack);
        stack = [];
      } else if (word === ')') {
        const args: string[] = [];
        let buffer: string[] = [];
        for (const w of stack) {
          if (w === ',') {
            args.push(buffer.join(' '));
            buffer = [];
          } else {
            const prop = propMap.get(w);
            if (prop) {
              buffer.push(prop.replace([]));
            } else {
              buffer.push(w);
            }
          }
        }
        if (buffer.length > 0) {
          args.push(buffer.join(' '));
        }
        const prestack = preStacks.pop();
        if (!prestack) {
          continue;
        }
        stack = prestack;
        const propname = stack.pop();
        if (!propname) {
          continue;
        }
        const prop = propMap.get(propname);
        if (!prop) {
          continue;
        }
        stack.push(prop.replace(args));
      } else {
        stack.push(word);
      }
    }
    return stack[0] || stmt;
  }

  public getStmtString(): string {
    return this.name + '[' + this.args.join('#') + ']';
  }

  public buildCumulatedInfo(preCumulatedTarget: string, preCumulatedAssumptions: string[]) {
    this.useful = true;
    if (preCumulatedTarget.length === 0) {
      this.cumulatedTarget = this.target;
      this.cumulatedAssumptions = this.assumptions;
    } else {
      this.cumulatedTarget = preCumulatedTarget;
      const assumptions = preCumulatedAssumptions.filter((assumption) => assumption !== this.target);
      if (assumptions.length === preCumulatedAssumptions.length) {
        this.useful = false;
      }
      for (const assume of this.assumptions) {
        if (!assumptions.includes(assume)) {
          assumptions.push(assume);
        }
      }
      this.cumulatedAssumptions = assumptions;
    }
  }

  public toJSON(): object {
    const jsonData = {
      name: this.name,
      args: this.args,
      target: this.target,
      assumptions: this.assumptions,
      cumulatedTarget: this.cumulatedTarget,
      cumulatedAssumptions: this.cumulatedAssumptions,
      propArgs: this.propArgs,
      propTarget: this.propTarget,
      propAssumptions: this.propAssumptions,
      cumulatedPropTarget: this.cumulatedPropTarget,
      cumulatedPropAssumptions: this.cumulatedPropAssumptions,
    };
    return jsonData;
  }

  public toString(): string {
    let s = this.statement.join('').replace(/,/g, ', ');
    if (this.comment) {
      s = `  // ${this.comment} \n  ` + s;
    }
    return s;
  }
}

export class AxiomTheorem {
  name: string;
  params: string[];
  paramMap: Map<string, string>;
  target: string;
  assumptions: string[];
  propTarget: string;
  propAssumptions: string[];
  parent: string[];
  children: string[];
  proofNodes?: ProofNode[];
  isValid?: boolean;
  inValidInfo?: string;
  constructor(
    tokens: string[],
    constMap: Map<string, string>,
    propMap: Map<string, Prop>,
    axiomTheoremMap: Map<string, AxiomTheorem>,
    diffEnable: boolean,
    parseProof: boolean,
    parentChildEnable: boolean,
  ) {
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
    this.paramMap = new Map(
      this.params.map((e) => {
        const tokens = e.split(' ');
        return [tokens[1], tokens[0]];
      }),
    );

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

    this.propTarget = this.stmtToPropTarget(this.target, propMap);
    this.propAssumptions = this.assumptions.map((e) => this.stmtToPropTarget(e, propMap));

    while (i < tokens.length && tokens[i] !== '{') {
      i++;
    }
    let proofTokens = tokens.slice(i + 1, tokens.length - 1);
    if (this.name !== 'idi' && this.assumptions.length === 1 && this.assumptions[0] === this.target) {
      proofTokens = ['idi', '(', ...this.target.split(' '), ')'];
    }
    if (parseProof && proofTokens.length > 0) {
      this.parseProof(proofTokens, propMap, axiomTheoremMap);
      this.isValid = this.check();
      if (this.isValid === false && this.proofNodes) {
        const proofNode = this.proofNodes[this.proofNodes.length - 1];
        this.inValidInfo = ['invalid proof: ', proofNode.cumulatedTarget, ...proofNode.cumulatedAssumptions].join('\n');
      } else if (this.proofNodes) {
        const s = this.proofNodes
          .filter((e) => !e.useful)
          .map((e) => e.statement.join(' '))
          .join('\n');
        if (s.length > 0) {
          this.inValidInfo = `useless operator: \n${s}`;
        }
      }
    }
    if (diffEnable && this.proofNodes && this.proofNodes.length > 0) {
      this.generateSuggestion(this.proofNodes, constMap, propMap, axiomTheoremMap);
      this.truncProofNodes();
    }
    this.parent = [];
    this.children = [];
    if (parentChildEnable && this.proofNodes) {
      this.proofNodes.forEach((node) => {
        if (!this.parent.includes(node.name)) {
          this.parent.push(node.name);
        }
      });
      this.parent.forEach((parentName) => {
        const axiomTheorem = axiomTheoremMap.get(parentName);
        axiomTheorem?.children.push(this.name);
      });
    }
  }

  public stmtToPropTarget(stmt: string, propMap: Map<string, Prop>): string {
    const words = stmt.split(' ');
    const preStacks: string[][] = [];
    let stack: string[] = [];
    for (const word of words) {
      if (word === '(') {
        preStacks.push(stack);
        stack = [];
      } else if (word === ')') {
        const args: string[] = [];
        let buffer: string[] = [];
        for (const w of stack) {
          if (w === ',') {
            args.push(buffer.join(' '));
            buffer = [];
          } else {
            buffer.push(propMap.get(w)?.stmt.join('') || w);
          }
        }
        if (buffer.length > 0) {
          args.push(buffer.join(' '));
        }
        const prestack = preStacks.pop();
        if (!prestack) {
          continue;
        }
        stack = prestack;
        const propname = stack.pop();
        if (!propname) {
          continue;
        }
        const prop = propMap.get(propname);
        if (!prop) {
          continue;
        }
        stack.push(prop.replace(args));
      } else {
        stack.push(word);
      }
    }
    return stack[0] || stmt;
  }

  public proofOpToStr(): string {
    if (!this.proofNodes) {
      return '';
    }
    const s = JSON.stringify(this.proofNodes.map((e) => e.toJSON()));
    return s;
  }
  public cleanProofNodes() {
    this.proofNodes = undefined;
  }
  public parseProof(tokens: string[], propMap: Map<string, Prop>, axiomTheoremMap: Map<string, AxiomTheorem>) {
    let i = 0;
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
      this.parseNextProofNode(stmt, propMap, axiomTheoremMap);
    }
  }
  public parseNextProofNode(
    stmt: string[],
    propMap: Map<string, Prop>,
    axiomTheoremMap: Map<string, AxiomTheorem>,
    comment?: string,
  ) {
    if (this.proofNodes === undefined) {
      this.proofNodes = [];
    }
    if (this.proofNodes === undefined || this.proofNodes.length === 0) {
      const proofNode = new ProofNode(stmt, propMap, axiomTheoremMap, this.target, [this.target]);
      this.proofNodes.push(proofNode);
    } else {
      const lastProofNode = this.proofNodes[this.proofNodes.length - 1];
      const proofNode = new ProofNode(
        stmt,
        propMap,
        axiomTheoremMap,
        lastProofNode.cumulatedTarget,
        lastProofNode.cumulatedAssumptions,
        comment,
      );
      this.proofNodes.push(proofNode);
    }
  }
  private check(): boolean {
    if (this.proofNodes && this.proofNodes.length > 0) {
      const cumulatedAssumeSet = new Set(this.proofNodes[this.proofNodes.length - 1].cumulatedAssumptions);
      const assumptionSet = new Set(this.assumptions);
      if (assumptionSet.size !== this.assumptions.length) {
        return false;
      }
      if (cumulatedAssumeSet.size === assumptionSet.size) {
        for (const assume of this.assumptions) {
          if (!cumulatedAssumeSet.has(assume)) {
            return false;
          }
        }
        return true;
      }
    }
    return false;
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
      .join(' ');
    const replaceAssumptions = this.assumptions.map((assume) => {
      return assume
        .split(' ')
        .map((e) => e.trim())
        .filter((e) => e.length > 0)
        .map((e) => {
          return paramMap.get(e) || e;
        })
        .join(' ');
    });
    return [replaceTarget, replaceAssumptions];
  }
  private generateSuggestion(
    proofNodes: ProofNode[],
    constMap: Map<string, string>,
    propMap: Map<string, Prop>,
    axiomTheoremMap: Map<string, AxiomTheorem>,
  ) {
    const cumulatedAssumptions = new Set(proofNodes[proofNodes.length - 1].cumulatedAssumptions);
    const assumptions = new Set(this.assumptions);
    for (const assume of cumulatedAssumptions) {
      if (!assumptions.has(assume)) {
        const tokens = assume.split(' ');
        if (
          tokens[0] === 'diffss' ||
          tokens[0] === 'diffsc' ||
          tokens[0] === 'diffsw' ||
          tokens[0] === 'diffcc' ||
          tokens[0] === 'diffcw' ||
          tokens[0] === 'diffww'
        ) {
          const args = this.getArgs(tokens);
          this.generateDiffSuggestion(args[0], args[1], constMap, propMap, axiomTheoremMap);
        }
      }
    }
    const cumulatedAssumptionsV2 = new Set(proofNodes[proofNodes.length - 1].cumulatedAssumptions);
    for (let i = this.assumptions.length - 1; i >= 0; i--) {
      const assume = this.assumptions[i];
      if (!cumulatedAssumptionsV2.has(assume)) {
        const stmt = ['a1ii', '(', ...this.target.split(' '), ',', ...assume.split(' '), ')'];
        const proofNode = new ProofNode(stmt, propMap, axiomTheoremMap, this.target, [this.target]);
        if (this.proofNodes) {
          this.proofNodes = [proofNode, ...this.proofNodes];
        }
      }
    }
  }
  private truncProofNodes() {
    if (this.proofNodes === undefined) {
      return;
    }
    const proofNodeSet: Set<string> = new Set();
    let newProofNodes: ProofNode[] = [];
    for (let i = this.proofNodes.length - 1; i >= 0; i--) {
      const proofNode = this.proofNodes[i];
      const stmt = proofNode.statement.join(' ');
      if (!proofNodeSet.has(stmt)) {
        proofNodeSet.add(stmt);
        newProofNodes.push(proofNode);
      }
    }
    newProofNodes.reverse();
    let isChanged = true;
    while (isChanged) {
      isChanged = false;
      this.rebuildCumulatedInfo(newProofNodes);
      newProofNodes = newProofNodes.filter((proofNode) => {
        return proofNode.useful;
      });
      if (this.proofNodes.length !== newProofNodes.length) {
        isChanged = true;
        this.proofNodes = newProofNodes;
      }
    }
    this.isValid = this.check();
  }
  private rebuildCumulatedInfo(proofNodes: ProofNode[]) {
    let preCumulatedTarget = this.target;
    let preCumulatedAssumptions = [this.target];
    for (const proofNode of proofNodes) {
      proofNode.buildCumulatedInfo(preCumulatedTarget, preCumulatedAssumptions);
      preCumulatedTarget = proofNode.cumulatedTarget;
      preCumulatedAssumptions = proofNode.cumulatedAssumptions;
    }
  }
  private generateDiffSuggestion(
    left: string[],
    right: string[],
    constMap: Map<string, string>,
    propMap: Map<string, Prop>,
    axiomTheoremMap: Map<string, AxiomTheorem>,
    comment?: string,
  ) {
    if (left.length === 0 || right.length === 0) {
      return;
    }
    const rightName = right[0];
    const rightType = constMap.get(rightName) || this.paramMap.get(rightName) || propMap.get(rightName)?.type;
    const leftName = left[0];
    const leftType = constMap.get(leftName) || this.paramMap.get(leftName) || propMap.get(leftName)?.type;
    if (leftType === undefined || rightType === undefined) {
      return;
    }
    if (right.length === 1) {
      if (left.length > 1) {
        if (leftType === rightType) {
          const stmt = [`diff${leftType[0]}${rightType[0]}.ex`, '(', left.join(' '), ',', rightName, ')'];
          this.parseNextProofNode(stmt, propMap, axiomTheoremMap, comment);
          this.generateDiffSuggestion(right, left, constMap, propMap, axiomTheoremMap);
        } else {
          const stmt = [`diff.${leftName}.${rightType[0]}`, `(`, rightName, ...left.slice(2)];
          this.parseNextProofNode(stmt, propMap, axiomTheoremMap, comment);
          for (const arg of this.getArgs(left)) {
            this.generateDiffSuggestion(arg, right, constMap, propMap, axiomTheoremMap);
          }
        }
      } else if (constMap.has(leftName)) {
        const stmt = [`diff.${leftName}.${rightType[0]}`, '(', rightName, ')'];
        this.parseNextProofNode(stmt, propMap, axiomTheoremMap, comment);
      } else if (constMap.has(rightName)) {
        if (leftType === rightType) {
          const stmt = [`diff${leftType[0]}${rightType[0]}.ex`, '(', leftName, ',', rightName, ')'];
          this.parseNextProofNode(stmt, propMap, axiomTheoremMap, comment);
          const stmt2 = [`diff.${rightName}.${leftType[0]}`, '(', leftName, ')'];
          this.parseNextProofNode(stmt2, propMap, axiomTheoremMap, comment);
        } else {
          const stmt = [`diff.${rightName}.${leftType[0]}`, '(', leftName, ')'];
          this.parseNextProofNode(stmt, propMap, axiomTheoremMap, comment);
        }
      } else if (leftType === rightType && rightName < leftName) {
        const stmt = [`diff${leftType[0]}${rightType[0]}.ex`, '(', leftName, ',', rightName, ')'];
        this.parseNextProofNode(stmt, propMap, axiomTheoremMap, comment);
      }
    } else if (constMap.has(leftName)) {
      const stmt = [`diff.${leftName}.${rightType[0]}`, '(', ...right, ')'];
      this.parseNextProofNode(stmt, propMap, axiomTheoremMap, comment);
    } else {
      const stmt = [`diff.${rightName}.${leftType[0]}`, '(', left.join(' '), ',', ...right.slice(2)];
      this.parseNextProofNode(stmt, propMap, axiomTheoremMap, comment);
      for (const arg of this.getArgs(right)) {
        this.generateDiffSuggestion(left, arg, constMap, propMap, axiomTheoremMap);
      }
    }
  }
  private getArgs(tokens: string[]): string[][] {
    const args: string[][] = [];
    let arg: string[] = [];
    let leftParenthesis = 0;
    let rightParenthesis = 0;
    for (let i = 2; i < tokens.length - 1; i++) {
      const op = tokens[i];
      if (op === ',' && leftParenthesis === rightParenthesis) {
        if (arg.length > 0) {
          args.push(arg);
          arg = [];
        }
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
      args.push(arg);
    }
    return args;
  }
}

export class Parser {
  public blockStrBuffer: string[];
  public tokenBuffer: string[];
  public typeSet: Set<string>;
  public constMap: Map<string, string>;
  public propMap: Map<string, Prop>;
  public axiomTheoremMap: Map<string, AxiomTheorem>;
  public blockOrder: string[];
  public startParseProofBIdx: number;
  public constPropMap: Map<string, string>;
  public parentChildEnable: boolean;

  constructor(constPropMapFile: string = '', startParseProofIdx: number = 0, parentChildEnable = false) {
    this.blockStrBuffer = [];
    this.tokenBuffer = [];
    this.typeSet = new Set();
    this.constMap = new Map();
    this.propMap = new Map();
    this.axiomTheoremMap = new Map();
    this.blockOrder = [];
    this.startParseProofBIdx = startParseProofIdx;
    this.parentChildEnable = parentChildEnable;

    this.constPropMap = new Map();
    if (constPropMapFile && existsSync(constPropMapFile)) {
      const content = readFileSync(constPropMapFile, { encoding: 'utf-8' });
      content.split('\n').forEach((e) => {
        const words = e
          .split(' @ ')
          .map((f) => f.trim())
          .filter((g) => g.length > 0);
        if (words.length >= 2) {
          this.constPropMap.set(words[0], words[1]);
        }
      });
    }
  }

  public outputBlockStr(): string[] {
    const blockStrBuffer = this.blockStrBuffer;
    this.blockStrBuffer = [];
    return blockStrBuffer;
  }

  public parseNextToken(token: string, enableBlockStr: boolean, cleanProofNodes: boolean, diffEnable: boolean) {
    if (token === undefined || token.length === 0) {
      if (this.tokenBuffer.length > 0) {
        this.parseBlock(this.tokenBuffer, enableBlockStr, cleanProofNodes, diffEnable);
      }
      this.tokenBuffer = [];
    } else if (this.isKeyword(token)) {
      if (this.tokenBuffer.length > 0) {
        this.parseBlock(this.tokenBuffer, enableBlockStr, cleanProofNodes, diffEnable);
      }
      this.tokenBuffer = [token];
    } else {
      this.tokenBuffer.push(token);
    }
  }

  private addBlockStrBuffer(str: string, enableBlockStr: boolean) {
    if (enableBlockStr) {
      this.blockStrBuffer.push(str);
    }
  }

  public parseBlock(tokens: string[], enableBlockStr: boolean, enableCleanProofNodes: boolean, enableDiffFix: boolean) {
    if (tokens[0] === 'type') {
      const types: string[] = [];
      for (let i = 1; i < tokens.length; i++) {
        const value = tokens[i];
        if (!this.typeSet.has(value)) {
          this.typeSet.add(value);
          types.push(value);
          this.blockOrder.push(value);
        }
      }
      if (types.length > 0) {
        this.addBlockStrBuffer(`type ${types.join(' ')}`, enableBlockStr);
      }
      if (enableDiffFix) {
        this.parseBlock(
          `prop wff diffss ( setvar s0 , setvar s1 ) { d ( s0 , s1 ) }`.split(' '),
          enableBlockStr,
          enableCleanProofNodes,
          enableDiffFix,
        );
        this.parseBlock(
          `prop wff diffsc ( setvar s0 , class c0 ) { d ( s0 , c0 ) }`.split(' '),
          enableBlockStr,
          enableCleanProofNodes,
          enableDiffFix,
        );
        this.parseBlock(
          `prop wff diffsw ( setvar s0 , wff w0 ) { d ( s0 , w0 ) }`.split(' '),
          enableBlockStr,
          enableCleanProofNodes,
          enableDiffFix,
        );
        this.parseBlock(
          `prop wff diffcc ( class c0 , class c1 ) { d ( c0 , c1 ) }`.split(' '),
          enableBlockStr,
          enableCleanProofNodes,
          enableDiffFix,
        );
        this.parseBlock(
          `prop wff diffcw ( class c0 , wff w0 ) { d ( c0 , w0 ) }`.split(' '),
          enableBlockStr,
          enableCleanProofNodes,
          enableDiffFix,
        );
        this.parseBlock(
          `prop wff diffww ( wff w0 , wff w1 ) { d ( w0 , w1 ) }`.split(' '),
          enableBlockStr,
          enableCleanProofNodes,
          enableDiffFix,
        );
        this.parseBlock(
          `axiom diffss.ex ( setvar s0 , setvar s1 ) { |- diffss ( s0 , s1 ) -| diffss ( s1 , s0 ) }`.split(' '),
          enableBlockStr,
          enableCleanProofNodes,
          enableDiffFix,
        );
        this.parseBlock(
          `axiom diffcc.ex ( class c0 , class c1 ) { |- diffcc ( c0 , c1 ) -| diffcc ( c1 , c0 ) }`.split(' '),
          enableBlockStr,
          enableCleanProofNodes,
          enableDiffFix,
        );
        this.parseBlock(
          `axiom diffww.ex ( wff w0 , wff w1 ) { |- diffww ( w0 , w1 ) -| diffww ( w1 , w0 ) }`.split(' '),
          enableBlockStr,
          enableCleanProofNodes,
          enableDiffFix,
        );
      }
      for (const type of types) {
        for (let i = 0; i <= 20; i++) {
          const name = `h${type[0]}${i}`;
          this.parseBlock(['const', type, name], enableBlockStr, enableCleanProofNodes, enableDiffFix);
        }
      }
    } else if (tokens[0] === 'const') {
      const type = tokens[1];
      const value = tokens[2];
      if (!this.constMap.has(value)) {
        this.constMap.set(value, type);
        this.blockOrder.push(value);
      }
      if (!this.propMap.has(value)) {
        const fakeTokens = [...tokens.slice(0, 3), '(', ')', ...tokens.slice(3)];
        this.propMap.set(value, new Prop(fakeTokens));
      }

      const target = this.constPropMap.get(value) || tokens.slice(4, tokens.length - 1).join('');
      if (target && target.length > 0) {
        this.addBlockStrBuffer(`const ${type} ${value} { ${target} }`, enableBlockStr);
      } else {
        this.addBlockStrBuffer(`const ${type} ${value}`, enableBlockStr);
      }
      if (enableDiffFix) {
        if (type === 'setvar') {
          this.parseBlock(
            `axiom diff.${value}.s ( setvar s0 ) { |- diffss ( ${value} , s0 ) }`.split(' '),
            enableBlockStr,
            enableCleanProofNodes,
            enableDiffFix,
          );
          this.parseBlock(
            `axiom diff.${value}.c ( class c0 ) { |- diffsc ( ${value} , c0 ) }`.split(' '),
            enableBlockStr,
            enableCleanProofNodes,
            enableDiffFix,
          );
          this.parseBlock(
            `axiom diff.${value}.w ( wff w0 ) { |- diffsw ( ${value} , w0 ) }`.split(' '),
            enableBlockStr,
            enableCleanProofNodes,
            enableDiffFix,
          );
        } else if (type === 'class') {
          this.parseBlock(
            `axiom diff.${value}.s ( setvar s0 ) { |- diffsc ( s0 , ${value} ) }`.split(' '),
            enableBlockStr,
            enableCleanProofNodes,
            enableDiffFix,
          );
          this.parseBlock(
            `axiom diff.${value}.c ( class c0 ) { |- diffcc ( ${value} , c0 ) }`.split(' '),
            enableBlockStr,
            enableCleanProofNodes,
            enableDiffFix,
          );
          this.parseBlock(
            `axiom diff.${value}.w ( wff w0 ) { |- diffcw ( ${value} , w0 ) }`.split(' '),
            enableBlockStr,
            enableCleanProofNodes,
            enableDiffFix,
          );
        } else if (type === 'wff') {
          this.parseBlock(
            `axiom diff.${value}.s ( setvar s0 ) { |- diffsw ( s0 , ${value} ) }`.split(' '),
            enableBlockStr,
            enableCleanProofNodes,
            enableDiffFix,
          );
          this.parseBlock(
            `axiom diff.${value}.c ( class c0 ) { |- diffcw ( c0, ${value} ) }`.split(' '),
            enableBlockStr,
            enableCleanProofNodes,
            enableDiffFix,
          );
          this.parseBlock(
            `axiom diff.${value}.w ( wff w0 ) { |- diffww ( ${value} , w0 ) }`.split(' '),
            enableBlockStr,
            enableCleanProofNodes,
            enableDiffFix,
          );
        }
      }
    } else if (tokens[0] === 'prop') {
      const prop = new Prop(tokens);
      this.propMap.set(prop.name, prop);
      this.blockOrder.push(prop.name);
      this.addBlockStrBuffer(prop.toString(this.constPropMap), enableBlockStr);
      if (
        enableDiffFix &&
        prop.name !== 'diffss' &&
        prop.name !== 'diffsc' &&
        prop.name !== 'diffsw' &&
        prop.name !== 'diffcc' &&
        prop.name !== 'diffcw' &&
        prop.name !== 'diffww'
      ) {
        const propTypeCode = prop.type === 'setvar' ? 0 : prop.type === 'class' ? 1 : 2;
        for (const baseType of ['setvar', 'class', 'wff']) {
          const baseTypeCode = baseType === 'setvar' ? 0 : baseType === 'class' ? 1 : 2;
          const baseName = `${baseType[0]}Base`;
          const axiomBodys = [
            `axiom diff.${prop.name}.${baseType[0]} ( ${baseType} ${baseName} , ${prop.params.join(' , ')} ) {`,
          ];
          if (baseTypeCode <= propTypeCode) {
            axiomBodys.push(
              `|- diff${baseType[0]}${prop.type[0]} ( ${baseName} , ${prop.name} ( ${prop.params
                .map((e) => e.split(' ')[1])
                .join(' , ')} ) )`,
            );
          } else {
            axiomBodys.push(
              `|- diff${prop.type[0]}${baseType[0]} ( ${prop.name} ( ${prop.params
                .map((e) => e.split(' ')[1])
                .join(' , ')} ) , ${baseName} )`,
            );
          }
          for (const param of prop.params) {
            const tokens = param.split(' ');
            const type = tokens[0];
            const typeCode = tokens[0] === 'setvar' ? 0 : tokens[0] === 'class' ? 1 : 2;
            const name = tokens[1];
            if (baseTypeCode <= typeCode) {
              axiomBodys.push(`-| diff${baseType[0]}${type[0]} ( ${baseName} , ${name} )`);
            } else {
              axiomBodys.push(`-| diff${type[0]}${baseType[0]} ( ${name} , ${baseName} )`);
            }
          }
          axiomBodys.push(`}`);
          this.parseBlock(axiomBodys.join(' ').split(' '), enableBlockStr, enableCleanProofNodes, enableDiffFix);
        }
      }
    } else if (tokens[0] === 'axiom') {
      const axiom = new AxiomTheorem(
        tokens,
        this.constMap,
        this.propMap,
        this.axiomTheoremMap,
        enableDiffFix,
        false,
        this.parentChildEnable,
      );
      this.axiomTheoremMap.set(axiom.name, axiom);
      this.blockOrder.push(axiom.name);
      this.addBlockStrBuffer(axiom.toString(), enableBlockStr);
    } else if (tokens[0] === 'thm') {
      const parseProof = this.blockOrder.length > this.startParseProofBIdx ? true : false;
      const theorem = new AxiomTheorem(
        tokens,
        this.constMap,
        this.propMap,
        this.axiomTheoremMap,
        enableDiffFix,
        parseProof,
        this.parentChildEnable,
      );
      this.axiomTheoremMap.set(theorem.name, theorem);
      this.blockOrder.push(theorem.name);
      this.addBlockStrBuffer(theorem.toString(), enableBlockStr);
      if (enableCleanProofNodes) {
        theorem.cleanProofNodes();
      }
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
