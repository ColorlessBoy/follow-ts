import path from 'path';
import { existsSync, readFileSync } from 'node:fs';
import Parser from './parser';
import { AxiomNode, FloatNode, Frame, NodeType, OpNode, ProveNode, Token, createOpNode } from './types';
import { writeFileSync } from 'fs';

export const globalAliasMap: Map<string, string> = new Map([
  ['c0', 'emptycls'],
  ['cvv', 'universe'],
  ['df-v', 'df-universe'],
]);

export function metamathToFollow(filename: string, output: string) {
  const absPath = path.resolve(filename);
  if (!existsSync(absPath)) {
    return;
  }
  const input = readFileSync(absPath, 'utf-8');
  const parser = new Parser(input);
  const frame = parser.nextFrame();
  if (frame === undefined) {
    return;
  }
  const contents: Array<string> = [];
  initAllBodyTrees(frame);
  /*
  const variablePool: Set<string> = new Set(
    'ph,ps,ch,th,ta,et,ze,si,rh,mu,la,ka,x,y,z,w,v,u,t,e,f,g,h,i,j,k,m,n,o,s,r,q,p,a,b,c,d,l,A,B,C,D,P,Q,R,S,T,U,E,F,G,H,I,J,K,L,M,N,O,V,W,X,Y,Z'.split(
      ',',
    ),
  );
  if (frame?.floats) {
    for (const float of frame.floats) {
      const s = float.variable?.value;
      if (s) {
        if (variablePool.has(s)) {
          continue;
        }
        contents.push(`const ${float.type?.value} ${float.label?.value} // ${float.variable?.value}`);
      }
    }
  }
  */
  if (frame?.axioms) {
    const typeSet: Set<string> = new Set();
    frame.floats.forEach((float) => {
      if (float.type?.value) {
        typeSet.add(float.type.value);
      }
    });
    contents.push(`type ${[...typeSet].join(' ')}`);
    for (const axiom of frame.axioms) {
      if (axiom.type?.value !== '|-' && (axiom.floatsReordered === undefined || axiom.floatsReordered.length === 0)) {
        if (axiom.label?.value === undefined) {
          continue;
        }
        const mainName = globalAliasMap.get(axiom.label.value) || axiom.label.value;
        contents.push(`const ${axiom.type?.value} ${mainName}`);
      }
    }
    contents.push(`const wff hw0 hw1 hw2 hw3 hw4 hw5 hw6 hw7 hw8 hw9`);
    contents.push(`const setvar hs0 hs1 hs2 hs3 hs4 hs5 hs6 hs7 hs8 hs9`);
    contents.push(`prop wff diffss(setvar s0, setvar s1)`);
    contents.push(`prop wff diffsc(setvar s0, class c0)`);
    contents.push(`prop wff diffsw(setvar s0, wff w0)`);
    for (const axiom of frame.axioms) {
      if (axiom.type?.value !== '|-' && axiom.floatsReordered && axiom.floatsReordered.length > 0) {
        if (axiom.label?.value === undefined) {
          continue;
        }
        const args = axiom.floatsReordered
          ?.map((float) => {
            return `${float.type?.value} ${axiom.floatsAliasMap?.get(float.label?.value || '')}`;
          })
          .join(', ');
        const mainName = globalAliasMap.get(axiom.label.value) || axiom.label.value;
        contents.push(`prop ${axiom.type?.value} ${mainName}(${args})`);
      }
    }
    for (const axiom of frame.axioms) {
      if (axiom.type?.value === '|-') {
        if (axiom.label?.value === undefined) {
          continue;
        }
        let s = axiom.bodyOpTreeStrRename;
        if (s === undefined) {
          s = '*****' + axiom.body.map((e) => e.value).join(' ');
        }
        const args = axiom.floatsReordered
          ?.map((float) => {
            return `${float.type?.value} ${axiom.floatsAliasMap?.get(float.label?.value || '')}`;
          })
          .join(', ');
        const mainName = globalAliasMap.get(axiom.label.value) || axiom.label.value;
        if ((axiom.essentialsStrRename && axiom.essentialsStrRename.length > 0) || axiom.disjointMap.size > 0) {
          contents.push(`axiom ${mainName}(${args}) {`);
          contents.push(`  |- ${s}`);
          if (axiom.essentialsStrRename) {
            for (const essential of axiom.essentialsStrRename) {
              contents.push(`  -| ${essential}`);
            }
          }
          if (axiom.diffVarsRename) {
            for (const s of axiom.diffVarsRename) {
              contents.push(`  -| ${s}`);
            }
          }
          contents.push('}');
        } else {
          contents.push(`axiom ${mainName}(${args}) { |- ${s} }`);
        }
      }
    }

    for (const prove of frame.proves) {
      if (prove.label?.value === 'idi' || prove.label?.value === 'a1ii' || prove.label?.value === 'pm11.07') {
        continue;
      }
      if (prove.type?.value === '|-') {
        if (prove.label?.value === undefined) {
          continue;
        }
        let s = prove.bodyOpTreeStrRename;
        if (s === undefined) {
          s = '*****' + prove.body.map((e) => e.value).join(' ');
        }
        const args = prove.floatsReordered
          ?.map((float) => {
            return `${float.type?.value} ${prove.floatsAliasMap?.get(float.label?.value || '')}`;
          })
          .join(', ');

        const mainName = globalAliasMap.get(prove.label.value) || prove.label.value;
        contents.push(`thm ${mainName}(${args}) {`);
        contents.push(`  |- ${s}`);
        if (prove.essentialsStrRename) {
          for (const essential of prove.essentialsStrRename) {
            contents.push(`  -| ${essential}`);
          }
        }
        if (prove.diffVarsRename) {
          for (const s of prove.diffVarsRename) {
            contents.push(`  -| ${s}`);
          }
        }
        contents.push('} = {');
        if (prove.opTree) {
          contents.push(`  ${proofToStringRename(prove.opTree, prove, frame)}`);
        }
        contents.push('}');
      }
    }
  }
  writeFileSync(output, contents.join('\n'), {
    encoding: 'utf8',
    flag: 'w',
  });
}

class InfoNode {
  public children: Map<string, InfoNode>;
  public float?: FloatNode;
  public axiom?: AxiomNode;

  constructor() {
    this.children = new Map();
  }

  public getChildOrDefault(key: string, defaultInfoNode?: InfoNode): InfoNode {
    if (key === 'class' || key === 'setvar') {
      key = 'classOrSetvar';
    }
    let child = this.children.get(key);
    if (child === undefined) {
      child = defaultInfoNode || new InfoNode();
      this.children.set(key, child);
    }
    return child;
  }
  public getChild(key: string): InfoNode | undefined {
    if (key === 'class' || key === 'setvar') {
      key = 'classOrSetvar';
    }
    const child = this.children.get(key);
    return child;
  }
}

class BodyParser {
  private frame: Frame;
  private parseRuleTree: InfoNode;
  private shouldFollowLeftParen: Set<string>; // The token followed by left parentheses.
  private cv?: AxiomNode;
  private co?: AxiomNode;
  private emptycls?: AxiomNode;
  private universe?: AxiomNode;

  constructor(frame: Frame) {
    this.frame = frame;
    this.shouldFollowLeftParen = new Set();
    this.parseRuleTree = new InfoNode();
    this.cv = this.frame.axiomMap.get('cv');
    this.co = this.frame.axiomMap.get('co');
    this.emptycls = this.frame.axiomMap.get('c0');
    this.universe = this.frame.axiomMap.get('cvv');
    this.initShouldFollowLeftParen();
    this.initParseRuleTree();
    return;
  }

  public parse(token: Array<Token>, node: AxiomNode | ProveNode): OpNode | undefined {
    const tokenStr = token.map((e) => {
      return e.value;
    });
    const opNode = this.parse2(tokenStr, node);
    return opNode;
  }

  private parse2(tokens: Array<string>, node: AxiomNode | ProveNode): OpNode | undefined {
    const currentTokens: Array<string | OpNode> = [];
    for (const token of tokens) {
      const float = node.floatVarMap.get(token) || this.frame.floatVarMap.get(token);
      if (float) {
        const opNode = createOpNode(float);
        currentTokens.push(opNode);
      } else if (this.universe && token === '_V') {
        const opNode = createOpNode(this.universe);
        currentTokens.push(opNode);
      } else if (this.emptycls && token === '(/)') {
        const opNode = createOpNode(this.emptycls);
        currentTokens.push(opNode);
      } else {
        currentTokens.push(token);
      }
    }
    const opNode = this.parseBFS(currentTokens);
    return opNode;
  }

  private parseBFS(tokens: Array<string | OpNode>): OpNode | undefined {
    if (tokens.length === 0) {
      return;
    }
    if (tokens.length === 1 && 'object' === typeof tokens[0]) {
      return tokens[0];
    }
    let currentTokens: Array<string | OpNode> = [];
    // parentheses
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if ('object' === typeof token) {
        currentTokens.push(token);
      } else if (this.shouldFollowLeftParen.has(token)) {
        currentTokens.push(token);
        i += 1; // next token is '(' and ignore it
        currentTokens.push(tokens[i]);
      } else if (token === '(') {
        let leftParenCnt = 1;
        let rightParenCnt = 0;
        for (let j = i + 1; j < tokens.length; j++) {
          const nextToken = tokens[j];
          if (nextToken === '(') {
            leftParenCnt++;
          } else if (nextToken === ')') {
            rightParenCnt++;
          }
          if (leftParenCnt === rightParenCnt) {
            let nextOpNode = this.parseBFS(tokens.slice(i + 1, j));
            if (this.co && nextOpNode?.definition.label?.value === 'wbr') {
              // co :: (A B C)
              // wbr :: A R B
              const coOpNode = createOpNode(this.co);
              coOpNode.children = nextOpNode.children;
              nextOpNode = coOpNode;
            }
            if (nextOpNode) {
              currentTokens.push(nextOpNode);
            }
            i = j;
            break;
          }
        }
      } else if (i > 0 && token === '{') {
        let leftCnt = 1;
        let rightCnt = 0;
        for (let j = i + 1; j < tokens.length; j++) {
          const nextToken = tokens[j];
          if (nextToken === '{') {
            leftCnt++;
          } else if (nextToken === '}') {
            rightCnt++;
          }
          if (leftCnt === rightCnt) {
            const nextOpNode = this.parseBFS(tokens.slice(i, j + 1));
            if (nextOpNode) {
              currentTokens.push(nextOpNode);
            }
            i = j;
            break;
          }
        }
      } else if (i > 0 && token === '<.') {
        let leftCnt = 1;
        let rightCnt = 0;
        for (let j = i + 1; j < tokens.length; j++) {
          const nextToken = tokens[j];
          if (nextToken === '<.') {
            leftCnt++;
          } else if (nextToken === '>.') {
            rightCnt++;
          }
          if (leftCnt === rightCnt) {
            const leftToken = tokens[i - 1];
            const rightToken = tokens[j + 1];
            if (
              'string' === typeof leftToken &&
              leftToken === '{' &&
              'string' === typeof rightToken &&
              rightToken === '|'
            ) {
              // copab $a class { <. x , y >. | ph } $.
              currentTokens.push(tokens[i]);
              break;
            }
            const nextOpNode = this.parseBFS(tokens.slice(i, j + 1));
            if (nextOpNode) {
              currentTokens.push(nextOpNode);
            }
            i = j;
            break;
          }
        }
      } else {
        currentTokens.push(token);
      }
    }
    if (currentTokens.length === 0) {
      return;
    }
    if (currentTokens.length === 1 && 'object' === typeof currentTokens[0]) {
      return currentTokens[0];
    }
    if (this.co && currentTokens.length === 3 && currentTokens[0] === '(' && currentTokens[2] === ')') {
      // co :: (A B C)
      // wbr :: A R B
      const token = currentTokens[1];
      if ('object' === typeof token && token.definition.label?.value === 'wbr') {
        const opNode = createOpNode(this.co);
        this.setOpNodeChildren(opNode, token.children);
        currentTokens = [opNode];
      }
    }

    while (currentTokens.length > 0 && !(currentTokens.length === 1 && 'object' === typeof currentTokens[0])) {
      const [nextTokens, isChanged] = this.parseBFSRightMost(currentTokens);
      if (!isChanged) {
        break;
      }
      currentTokens = nextTokens;
    }
    if (currentTokens.length === 1 && 'object' === typeof currentTokens[0]) {
      return currentTokens[0];
    }
    return;
  }

  private parseBFSRightMost(tokens: Array<string | OpNode>): [Array<string | OpNode>, boolean] {
    let nextTokens: Array<string | OpNode> = [];
    let currentNodeInfo = this.parseRuleTree.getChild('all');
    let currentTokens: Array<string | OpNode> = [];
    let currentChildren: Array<OpNode> = [];

    let i = 0;
    while (i < tokens.length && currentNodeInfo) {
      const token = tokens[i];
      const name = 'string' === typeof token ? token : token.definition.type?.value;
      if (name === undefined) {
        continue;
      }
      let nextNodeInfo = currentNodeInfo?.getChild(name);
      if (nextNodeInfo === undefined) {
        if (currentNodeInfo?.axiom) {
          break;
        } else {
          nextTokens = nextTokens.concat(currentTokens);
        }
        currentTokens = [];
        currentChildren = [];
        nextNodeInfo = this.parseRuleTree.getChild('all')?.getChild(name);
      }
      if (nextNodeInfo) {
        i++;
        currentNodeInfo = nextNodeInfo;
        currentTokens.push(token);
        if ('object' === typeof token) {
          currentChildren.push(token);
        }
      } else {
        i++;
        nextTokens.push(token);
        currentNodeInfo = this.parseRuleTree.getChild('all');
      }
    }
    const isChanged = currentNodeInfo?.axiom !== undefined;
    if (currentNodeInfo?.axiom) {
      const opNode = createOpNode(currentNodeInfo.axiom);
      this.setOpNodeChildren(opNode, currentChildren);
      nextTokens.push(opNode);
      if (i < tokens.length) {
        nextTokens = nextTokens.concat(tokens.slice(i));
      }
    } else {
      nextTokens = nextTokens.concat(currentTokens);
      if (i < tokens.length) {
        nextTokens = nextTokens.concat(tokens.slice(i));
      }
    }
    return [nextTokens, isChanged];
  }

  private setOpNodeChildren(opNode: OpNode, childrenStrOrder: Array<OpNode>) {
    if (opNode.definition.floatsStrOrder) {
      const children = opNode.definition.floatsStrOrder.map((idx) => {
        return childrenStrOrder[idx];
      });
      opNode.children = children;
    } else {
      opNode.children = childrenStrOrder;
    }

    const floats = opNode.definition?.floats;
    if (floats === undefined) {
      return;
    }
    const children = opNode.children;

    for (let i = 0; i < floats.length && children.length; i++) {
      if (this.cv && floats[i].type?.value === 'class' && children[i].definition.type?.value === 'setvar') {
        const cvOpNode = createOpNode(this.cv);
        cvOpNode.children.push(children[i]);
        children[i] = cvOpNode;
      }
    }
  }

  private initParseRuleTree() {
    this.frame.axioms.forEach((axiom) => {
      if (
        axiom.type?.value &&
        axiom.type.value !== '|-' &&
        axiom.label?.value !== 'cv' &&
        axiom.label?.value !== 'co'
      ) {
        const type = axiom.type.value;
        let bodyAbstract = axiom.bodyAbstract;
        if (bodyAbstract[0].value === '(') {
          bodyAbstract = bodyAbstract.slice(1, bodyAbstract.length - 1);
        }
        let axiomInfo = this.parseRuleTree.getChildOrDefault(type);
        for (const token of bodyAbstract) {
          const child = axiomInfo.getChildOrDefault(token.value);
          axiomInfo = child;
        }
        axiomInfo.axiom = axiom;

        let allInfo = this.parseRuleTree.getChildOrDefault('all');
        for (const token of bodyAbstract) {
          const child = allInfo.getChildOrDefault(token.value);
          allInfo = child;
        }
        allInfo.axiom = axiom;
      }
    });
  }

  private initShouldFollowLeftParen() {
    this.frame.axioms.forEach((axiom) => {
      if (axiom.type?.value && axiom.type.value !== '|-') {
        const bodyAbstract = axiom.bodyAbstract;
        if (bodyAbstract.length > 1 && bodyAbstract[1].value === '(') {
          this.shouldFollowLeftParen.add(bodyAbstract[0].value);
        }
      }
    });
  }
}

export function opNodeToString(node: OpNode): string {
  const ops: Array<string> = [];
  if (node.definition.label?.value) {
    ops.push(node.definition.label?.value);
  }

  const childrenStr: Array<string> = [];
  for (const child of node.children) {
    childrenStr.push(opNodeToString(child));
  }
  const reOrderedChildrenStr = node.floatsOrder?.map((idx) => {
    return childrenStr[idx];
  });
  if (reOrderedChildrenStr) {
    ops.push(reOrderedChildrenStr.join(' '));
  } else {
    ops.push(childrenStr.join(' '));
  }
  return ops.join(' ');
}

export function proofToStringRename(node: OpNode, prove: ProveNode | AxiomNode, frame: Frame): string {
  const proofOps = proofToString(node).trim().split(new RegExp(' +'));
  const nextProofOps = [];
  const floatsAliasMap: Map<string, string> = prove.floatsAliasMap || new Map();
  const floatMap = prove.floatMap;
  prove.floatsAliasMap = floatsAliasMap;
  const hiddenAliasCount: Map<string, number> = prove.hiddenAliasCount || new Map();
  prove.hiddenAliasCount = hiddenAliasCount;
  for (const op of proofOps) {
    let frameOpStr: string = op;
    if (op.includes('.')) {
      for (const partOp of op.split('.')) {
        const partFloat = frame.floatMap.get(partOp);
        if (partFloat) {
          frameOpStr = partOp;
          break;
        }
      }
    }
    const hiddenDef = floatMap.get(op) || frame.floatMap.get(frameOpStr);
    const hiddenType = hiddenDef?.type?.value;
    if (hiddenDef && hiddenType && !floatsAliasMap.has(op)) {
      let hiddenCode = hiddenAliasCount.get(hiddenType);
      if (hiddenCode === undefined) {
        hiddenCode = 0;
      } else {
        hiddenCode += 1;
      }
      hiddenAliasCount.set(hiddenType, hiddenCode);
      const rename = `h${hiddenType[0]}${hiddenCode}`;
      floatsAliasMap.set(op, rename);
    }

    const nextOp = floatsAliasMap?.get(op) || op;
    const axiom = frame.axiomMap.get(nextOp);
    const prove = frame.proveMap.get(nextOp);
    if (nextProofOps.length > 0 && (axiom?.type?.value === '|-' || prove)) {
      nextProofOps.push('\n ');
    }
    nextProofOps.push(nextOp);
  }
  const proofblock = nextProofOps.join(' ');
  const proofLines = proofblock.split('\n');
  if (proofLines.length > 1) {
    const nextProofLines: Array<string> = [];
    const proofLineSet: Set<string> = new Set();
    proofLines.reverse().forEach((e) => {
      const line = e.trim();
      if (!proofLineSet.has(line)) {
        proofLineSet.add(line);
        nextProofLines.push(`${line}`);
      }
    });
    return nextProofLines.reverse().join('\n  ');
  }
  return nextProofOps.join(' ');
}

export function proofToString(node: OpNode): string {
  const ops: Array<string> = [];
  if (node.definition.label?.value) {
    if (node.definition.label.value === 'weq') {
      ops.push('wceq');
    } else if (node.definition.label.value === 'wel') {
      ops.push('wcel');
    } else {
      ops.push(node.definition.label?.value);
    }
  }
  const childrenStr: Array<string> = [];
  for (const child of node.children) {
    if (child.definition.nodeType === NodeType.ESSENTIAL) {
      continue;
    }
    childrenStr.push(proofToString(child));
  }

  const reOrderedChildrenStr: Array<string> = [];
  node.definition.floatsOrder?.map((idx) => {
    reOrderedChildrenStr.push(childrenStr[idx]);
  });
  for (let i = reOrderedChildrenStr.length; i < childrenStr.length; i++) {
    if (node.definition.label?.value === 'weq' || node.definition.label?.value === 'wel') {
      reOrderedChildrenStr.push(`cv ${childrenStr[i]}`);
    } else {
      reOrderedChildrenStr.push(`${childrenStr[i]}`);
    }
  }
  if (reOrderedChildrenStr?.length && reOrderedChildrenStr.length > 0) {
    ops.push(reOrderedChildrenStr.join(' '));
  } else if (childrenStr.length > 0) {
    ops.push(childrenStr.join(' '));
  }
  return ops.join(' ');
}

export function generateArgsMap(node: AxiomNode | ProveNode, frame: Frame) {
  const floatAliasMap: Map<string, string> = new Map(globalAliasMap);
  const floatCountTable: Map<string, number> = new Map();
  const setvarArgs: Array<string> = [];
  const classArgs: Array<string> = [];
  const wffArgs: Array<string> = [];
  const otherArgs: Array<string> = [];
  node.bodyOpTreeStr
    ?.trim()
    .split(new RegExp(' +'))
    .forEach((op) => {
      const definition = node.floatMap.get(op);
      const dtype = definition?.type?.value;
      if (definition && dtype && !floatAliasMap.has(op)) {
        let code = floatCountTable.get(dtype);
        if (code == undefined) {
          code = 0;
        } else {
          code += 1;
        }
        floatCountTable.set(dtype, code);
        const rename = `${dtype[0]}${code}`;
        floatAliasMap.set(op, rename);
        if (dtype === 'setvar') {
          setvarArgs.push(op);
        } else if (dtype === 'class') {
          classArgs.push(op);
        } else if (dtype === 'wff') {
          wffArgs.push(op);
        } else {
          otherArgs.push(op);
        }
      }
    });
  node.essentialsStr?.forEach((s) => {
    s.trim()
      .split(new RegExp(' +'))
      .forEach((op) => {
        const definition = node.floatMap.get(op);
        const dtype = definition?.type?.value;
        if (definition && dtype && !floatAliasMap.has(op)) {
          let code = floatCountTable.get(dtype);
          if (code == undefined) {
            code = 0;
          } else {
            code += 1;
          }
          floatCountTable.set(dtype, code);
          const rename = `${dtype[0]}${code}`;
          floatAliasMap.set(op, rename);
          if (dtype === 'setvar') {
            setvarArgs.push(op);
          } else if (dtype === 'class') {
            classArgs.push(op);
          } else if (dtype === 'wff') {
            wffArgs.push(op);
          } else {
            otherArgs.push(op);
          }
        }
      });
  });
  node?.floats.forEach((definition) => {
    const op = definition.label?.value;
    const dtype = definition.type?.value;
    if (op && dtype && !floatAliasMap.has(op)) {
      let code = floatCountTable.get(dtype);
      if (code == undefined) {
        code = 0;
      } else {
        code += 1;
      }
      floatCountTable.set(dtype, code);
      const rename = `${dtype[0]}${code}`;
      floatAliasMap.set(op, rename);
      if (definition.label?.value) {
        floatAliasMap.set(definition.label?.value, rename);
      }
      if (dtype === 'setvar') {
        setvarArgs.push(op);
      } else if (dtype === 'class') {
        classArgs.push(op);
      } else if (dtype === 'wff') {
        wffArgs.push(op);
      } else {
        otherArgs.push(op);
      }
    }
  });
  node.floatsAliasMap = floatAliasMap;
  node.floatsAlias = setvarArgs.concat(classArgs).concat(wffArgs).concat(otherArgs);
  const originalOrderMap: Map<string, number> = new Map();
  node.floats.forEach((float, idx) => {
    if (float.label?.value) {
      originalOrderMap.set(float.label.value, idx);
    }
  });
  node.floatsOrder = node.floatsAlias.map((float) => {
    return originalOrderMap.get(float) || 0;
  });
  node.floatsReordered = node.floatsAlias.map((float) => {
    const idx = originalOrderMap.get(float) || 0;
    return node.floats[idx];
  });

  if (node.bodyOpTree) {
    node.bodyOpTreeStrRename = proofToStringRename(node.bodyOpTree, node, frame);
  }
  if (node.essentialsOpTree) {
    node.essentialsStrRename = [];
    for (const opTree of node.essentialsOpTree) {
      node.essentialsStrRename.push(proofToStringRename(opTree, node, frame));
    }
  }

  const ssDiff: Array<string> = [];
  const scDiff: Array<string> = [];
  const swDiff: Array<string> = [];
  for (const dNode of node.disjointMap.values()) {
    const left = dNode.left;
    const right = dNode.right;
    const leftFloat = node.floatVarMap.get(left.value);
    const rightFloat = node.floatVarMap.get(right.value);
    const leftType = leftFloat?.type?.value;
    const rightType = rightFloat?.type?.value;
    const leftLabel = leftFloat?.label?.value;
    const rightLabel = rightFloat?.label?.value;
    if (leftType && rightType && leftLabel && rightLabel) {
      const leftRename = node.floatsAliasMap.get(leftLabel);
      const rightRename = node.floatsAliasMap.get(rightLabel);
      if (leftRename === undefined || rightRename === undefined) {
        continue;
      }
      if (leftType === 'setvar' && rightType === 'setvar') {
        if (leftRename > rightRename) {
          ssDiff.push(`diffss ${rightRename} ${leftRename}`);
        } else {
          ssDiff.push(`diffss ${leftRename} ${rightRename}`);
        }
      } else if (leftType === 'setvar' && rightType === 'class') {
        scDiff.push(`diffsc ${leftRename} ${rightRename}`);
      } else if (leftType === 'setvar' && rightType === 'wff') {
        swDiff.push(`diffsw ${leftRename} ${rightRename}`);
      } else if (leftType === 'class') {
        scDiff.push(`diffsc ${rightRename} ${leftRename}`);
      } else if (leftType === 'wff') {
        swDiff.push(`diffsw ${rightRename} ${leftRename}`);
      }
    }
  }
  ssDiff.sort();
  scDiff.sort();
  swDiff.sort();
  node.diffVarsRename = ssDiff.concat(scDiff).concat(swDiff);
}

export function initAllBodyTrees(frame: Frame) {
  const bodyParser: BodyParser = new BodyParser(frame);
  if (frame.axioms === undefined) {
    return;
  }

  frame.axioms.forEach((axiom) => {
    if (axiom.type?.value === '|-') {
      axiom.bodyOpTree = bodyParser.parse(axiom.body, axiom);
      // axiom.bodyOpTreeStr = axiom.bodyOpTree ? opNodeToString(axiom.bodyOpTree) : '';
      axiom.bodyOpTreeStr = axiom.bodyOpTree ? proofToString(axiom.bodyOpTree) : '';

      axiom.essentialsOpTree = [];
      axiom.essentialsStr = [];
      axiom.essentials.forEach((e) => {
        const eOpTree = bodyParser.parse(e.body, axiom);
        if (eOpTree) {
          axiom.essentialsOpTree?.push(eOpTree);
          // axiom.essentialsStr?.push(opNodeToString(eOpTree));
          axiom.essentialsStr?.push(proofToString(eOpTree));
        }
      });
    }
    generateArgsMap(axiom, frame);
  });

  frame.proves.forEach((prove) => {
    if (prove.type?.value === '|-') {
      prove.bodyOpTree = bodyParser.parse(prove.body, prove);
      // prove.bodyOpTreeStr = prove.bodyOpTree ? opNodeToString(prove.bodyOpTree) : '';
      prove.bodyOpTreeStr = prove.bodyOpTree ? proofToString(prove.bodyOpTree) : '';

      prove.essentialsOpTree = [];
      prove.essentialsStr = [];
      prove.essentials.forEach((e) => {
        const eOpTree = bodyParser.parse(e.body, prove);
        if (eOpTree) {
          prove.essentialsOpTree?.push(eOpTree);
          // prove.essentialsStr?.push(opNodeToString(eOpTree));
          prove.essentialsStr?.push(proofToString(eOpTree));
        }
      });
      generateArgsMap(prove, frame);
    }
  });
}
