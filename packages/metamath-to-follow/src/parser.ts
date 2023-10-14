import Scanner from './scanner';
import {
  AxiomNode,
  DisjointNode,
  Error,
  EssentialNode,
  FloatNode,
  Frame,
  Node,
  NodeType,
  OpNode,
  ParserOptions,
  ProveNode,
  Token,
  TokenType,
  disjointNodeToString,
  stmtNodeToString,
} from './types';
import * as charCodes from 'charcodes';

export default class Parser {
  private frameStack: FrameStack = new FrameStack();
  private scanner: Scanner;
  private parserOptions?: ParserOptions;
  private comments: Array<Token> = [];

  constructor(input: string, parserOptions?: ParserOptions) {
    this.scanner = new Scanner(input, parserOptions?.scannerOptions);
    this.parserOptions = parserOptions;
  }

  public nextFrame(): Frame | undefined {
    this.frameStack.pushEmpty();

    let label: Token | undefined;
    let keywordToken = this.nextToken();
    while (keywordToken.tokenType !== TokenType.EOF && keywordToken.tokenType !== TokenType.BEND) {
      if (keywordToken.tokenType === TokenType.CONST) {
        const consts = this.nextStatement();
        for (const c of consts) {
          this.frameStack.addConst(c);
        }
      } else if (keywordToken.tokenType === TokenType.VAR) {
        const vars = this.nextStatement();
        for (const v of vars) {
          this.frameStack.addVar(v);
        }
      } else if (keywordToken.tokenType === TokenType.FLOAT) {
        const statement = this.nextStatement();
        this.frameStack.addFloat(keywordToken, statement, label);
      } else if (keywordToken.tokenType === TokenType.AXIOM) {
        const statement = this.nextStatement();
        this.frameStack.addAxiom(keywordToken, statement, label);
      } else if (keywordToken.tokenType === TokenType.ESSENTIAL) {
        const statement = this.nextStatement();
        this.frameStack.addEssential(keywordToken, statement, label);
      } else if (keywordToken.tokenType === TokenType.PROVE) {
        const statement = this.nextStatement();
        const proof = this.nextStatement();
        this.frameStack.addProve(keywordToken, statement, proof, label);
      } else if (keywordToken.tokenType === TokenType.DISJOINT) {
        const tokens = this.nextStatement();
        this.frameStack.addDisjoint(keywordToken, tokens);
      } else if (keywordToken.tokenType === TokenType.BSTART) {
        // TODO: fix this.
        const nextFrame = this.nextFrame();
        if (nextFrame) {
          this.frameStack.update(nextFrame);
        }
      } else {
        label = keywordToken;
      }
      keywordToken = this.nextToken();
    }

    const frame = this.frameStack.pop();
    return frame;
  }

  private nextToken(): Token {
    let token = this.scanner.next();
    while (token.tokenType === TokenType.COMMENT) {
      this.comments.push(token);
      token = this.scanner.next();
    }
    return token;
  }

  private nextStatement(): Array<Token> {
    let token = this.nextToken();
    const statement: Array<Token> = [];
    while (token.tokenType !== TokenType.END && token.tokenType !== TokenType.EQ) {
      statement.push(token);
      token = this.nextToken();
    }
    return statement;
  }
}

export class FrameStack {
  private stack: Array<Frame> = [];

  public pop(): Frame | undefined {
    return this.stack.pop();
  }

  public update(nextFrame: Frame) {
    if (this.stack.length === 0) {
      this.pushEmpty();
    }
    const frame = this.stack[this.stack.length - 1];
    for (const axiom of nextFrame.axioms) {
      const label = axiom.label;
      const axiomStr = stmtNodeToString(axiom);
      if (label) {
        frame.axioms.push(axiom);
        frame.axiomMap.set(label.value, axiom);
        frame.axiomStrMap.set(axiomStr, axiom);
      }
    }
    for (const prove of nextFrame.proves) {
      const label = prove.label;
      const axiomStr = stmtNodeToString(prove);
      if (label) {
        frame.proves.push(prove);
        frame.proveMap.set(label.value, prove);
        frame.proveStrMap.set(axiomStr, prove);
      }
    }
  }

  public pushEmpty() {
    this.stack.push(this.createEmptyFrame());
  }

  public addConst(token: Token) {
    if (this.stack.length === 0) {
      this.pushEmpty();
    }
    const frame = this.stack[this.stack.length - 1];
    if (frame.constants.has(token.value)) {
      token.error = Error.ConstNameDuplicated;
    } else if (frame.variables.has(token.value)) {
      token.error = Error.ConstNameDuplicated;
    } else {
      frame.constants.set(token.value, token);
    }
  }

  public addVar(token: Token) {
    if (this.stack.length === 0) {
      this.pushEmpty();
    }
    const frame = this.stack[this.stack.length - 1];
    if (frame.constants.has(token.value)) {
      token.error = Error.VarNameDuplicated;
    } else if (frame.variables.has(token.value)) {
      token.error = Error.VarNameDuplicated;
    } else {
      frame.variables.set(token.value, token);
    }
  }

  public addFloat(keyword: Token, statement: Array<Token>, label?: Token) {
    if (this.stack.length === 0) {
      this.pushEmpty();
    }
    const frame = this.stack[this.stack.length - 1];

    const floatNode: FloatNode = {
      nodeType: NodeType.FLOAT,
      keyword: keyword,
      label: label,
    };

    if (label) {
      label.tokenType = TokenType.FLOAT_LABEL;
      const node = this.lookUpLabel(label.value);
      if (node) {
        floatNode.label = undefined;
        label.error = Error.LabelDuplicated;
      }
    }

    let idx = 0;
    // parse type
    if (idx < statement.length) {
      const token = statement[idx];
      if (this.lookUpConst(token)) {
        token.tokenType = TokenType.TYPE_VAL;
        floatNode.type = token;
      } else {
        token.error = Error.TypeUndefined;
      }
      idx++;
    }
    // parse variable
    if (idx < statement.length) {
      const token = statement[idx];
      if (this.lookUpVar(token)) {
        token.tokenType = TokenType.VAR_VAL;
        floatNode.variable = token;
      } else {
        token.error = Error.VarUndefined;
      }
      idx++;
    }
    // error handling
    for (; idx < statement.length; idx++) {
      const token = statement[idx];
      token.error = Error.FloatTokenUseless;
    }
    if (floatNode.label === undefined) {
      floatNode.error = Error.FloatLabelMissing;
    } else if (floatNode.type === undefined) {
      floatNode.error = Error.FloatTypeMissing;
    } else if (floatNode.variable === undefined) {
      floatNode.error = Error.FloatVariableMissing;
    }

    if (floatNode.error === undefined) {
      // const name = floatNode.variable?.value;
      const name = floatNode.label?.value;
      if (name) {
        frame.floats.push(floatNode);
        frame.floatMap.set(name, floatNode);
      }
    } else {
      frame.errorNodes.push(floatNode);
    }
  }

  public addEssential(keyword: Token, statement: Array<Token>, label?: Token) {
    if (this.stack.length === 0) {
      this.pushEmpty();
    }
    const frame = this.stack[this.stack.length - 1];

    const essentialNode: EssentialNode = {
      nodeType: NodeType.ESSENTIAL,
      keyword: keyword,
      label: label,
      body: [],
    };

    if (label) {
      label.tokenType = TokenType.ESSENTIAL_LABEL;
      const node = this.lookUpLabel(label.value);
      if (node) {
        essentialNode.label = undefined;
        label.error = Error.LabelDuplicated;
      }
    }

    let idx = 0;
    // parse type
    if (idx < statement.length) {
      const token = statement[idx];
      if (this.lookUpConst(token)) {
        token.tokenType = TokenType.TYPE_VAL;
        essentialNode.type = token;
      } else {
        token.error = Error.TypeUndefined;
      }
      idx++;
    }
    // parse body
    for (; idx < statement.length; ++idx) {
      const token = statement[idx];
      if (this.lookUpConst(token)) {
        token.tokenType = TokenType.CONST_VAL;
        essentialNode.body.push(token);
      } else if (this.lookUpVar(token)) {
        token.tokenType = TokenType.VAR_VAL;
        essentialNode.body.push(token);
      } else {
        token.error = Error.EssentialBodyUndefined;
      }
    }
    // error handling
    if (essentialNode.label === undefined) {
      essentialNode.error = Error.EssentailLabelMissing;
    } else if (essentialNode.type === undefined) {
      essentialNode.error = Error.EssentialTypeMissing;
    } else if (essentialNode.body.length === 0) {
      essentialNode.error = Error.EssentialBodyEmpty;
    }

    if (essentialNode.error === undefined) {
      const bodyStr: string = stmtNodeToString(essentialNode);
      if (!frame.essentialsStrMap.has(bodyStr)) {
        frame.essentials.push(essentialNode);
        frame.essentialsStrMap.set(bodyStr, essentialNode);
        if (essentialNode.label?.value) {
          frame.essentialMap.set(essentialNode.label.value, essentialNode);
        }
      }
    } else {
      frame.errorNodes.push(essentialNode);
    }
  }

  public addAxiom(keyword: Token, statement: Array<Token>, label?: Token) {
    if (this.stack.length === 0) {
      this.pushEmpty();
    }
    const frame = this.stack[this.stack.length - 1];

    const axiomNode: AxiomNode = {
      nodeType: NodeType.AXIOM,
      keyword: keyword,
      label: label,
      body: [],
      essentials: this.getEssentials(),
      floats: [],
      disjointMap: new Map(),
    };

    if (label) {
      label.tokenType = TokenType.AXIOM_LABEL;
      const node = this.lookUpLabel(label.value);
      if (node) {
        axiomNode.label = undefined;
        label.error = Error.LabelDuplicated;
      }
    }

    let idx = 0;
    // parse type
    if (idx < statement.length) {
      const token = statement[idx];
      if (this.lookUpConst(token)) {
        token.tokenType = TokenType.TYPE_VAL;
        axiomNode.type = token;
      } else {
        token.error = Error.TypeUndefined;
      }
      idx++;
    }
    // parse body
    for (; idx < statement.length; ++idx) {
      const token = statement[idx];
      if (this.lookUpConst(token)) {
        token.tokenType = TokenType.CONST_VAL;
        axiomNode.body.push(token);
      } else if (this.lookUpVar(token)) {
        token.tokenType = TokenType.VAR_VAL;
        axiomNode.body.push(token);
      } else {
        token.error = Error.AxiomBodyUndefined;
      }
    }
    // error handling
    if (axiomNode.label === undefined) {
      axiomNode.error = Error.AxiomLabelMissing;
    } else if (axiomNode.type === undefined) {
      axiomNode.error = Error.AxiomTypeMissing;
    } else if (axiomNode.body.length === 0) {
      axiomNode.error = Error.AxiomBodyEmpty;
    }

    if (axiomNode.error === undefined) {
      this.makeAssertion(axiomNode);
      const bodyStr: string = stmtNodeToString(axiomNode);
      if (!frame.axiomStrMap.has(bodyStr)) {
        frame.axioms.push(axiomNode);
        frame.axiomStrMap.set(bodyStr, axiomNode);
        if (axiomNode.label?.value) {
          frame.axiomMap.set(axiomNode.label.value, axiomNode);
        }
      }
    } else {
      frame.errorNodes.push(axiomNode);
    }
  }

  public addProve(keyword: Token, statement: Array<Token>, proof: Array<Token>, label?: Token) {
    if (this.stack.length === 0) {
      this.pushEmpty();
    }
    const frame = this.stack[this.stack.length - 1];

    const proveNode: ProveNode = {
      nodeType: NodeType.PROVE,
      keyword: keyword,
      label: label,
      body: [],
      proof: proof,
      essentials: this.getEssentials(),
      floats: [],
      disjointMap: new Map(),
    };

    if (label) {
      label.tokenType = TokenType.PROVE_LABEL;
      const node = this.lookUpLabel(label.value);
      if (node) {
        proveNode.label = undefined;
        label.error = Error.LabelDuplicated;
      }
    }

    let idx = 0;
    // parse type
    if (idx < statement.length) {
      const token = statement[idx];
      if (this.lookUpConst(token)) {
        token.tokenType = TokenType.TYPE_VAL;
        proveNode.type = token;
      } else {
        token.error = Error.TypeUndefined;
      }
      idx++;
    }
    // parse body
    for (; idx < statement.length; ++idx) {
      const token = statement[idx];
      if (this.lookUpConst(token)) {
        token.tokenType = TokenType.CONST_VAL;
        proveNode.body.push(token);
      } else if (this.lookUpVar(token)) {
        token.tokenType = TokenType.VAR_VAL;
        proveNode.body.push(token);
      } else {
        token.error = Error.ProveBodyUndefined;
      }
    }
    // error handling
    if (proveNode.label === undefined) {
      proveNode.error = Error.ProveLabelMissing;
    } else if (proveNode.type === undefined) {
      proveNode.error = Error.ProveTypeMissing;
    } else if (proveNode.body.length === 0) {
      proveNode.error = Error.ProveTypeMissing;
    } else if (proveNode.proof.length === 0) {
      proveNode.error = Error.ProveProofEmpty;
    }

    if (proveNode.error === undefined) {
      this.makeAssertion(proveNode);
      this.decompressProof(proveNode);
      this.verifyProof(proveNode);
      const bodyStr: string = stmtNodeToString(proveNode);
      if (!frame.proveStrMap.has(bodyStr)) {
        frame.proveStrMap.set(bodyStr, proveNode);
      }
      if (proveNode.label?.value) {
        frame.proves.push(proveNode);
        frame.proveMap.set(proveNode.label.value, proveNode);
      }
    } else {
      frame.errorNodes.push(proveNode);
    }
  }

  public addDisjoint(keyword: Token, tokens: Array<Token>) {
    if (this.stack.length === 0) {
      this.pushEmpty();
    }
    const frame = this.stack[this.stack.length - 1];
    const tokensValid = [];
    for (const token of tokens) {
      if (this.lookUpVar(token)) {
        token.tokenType = TokenType.VAR_VAL;
        tokensValid.push(token);
      } else {
        token.error = Error.VarUndefined;
      }
    }

    for (let i = 0; i < tokens.length - 1; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        const token1 = tokens[i];
        const token2 = tokens[j];
        if (token1.value === token2.value) {
          continue;
        }
        const disjointNode = this.createDisjointNode(keyword, token1, token2);
        const disjointStr = disjointNodeToString(disjointNode);
        frame.disjoints.set(disjointStr, disjointNode);
      }
    }
  }

  public createDisjointNode(keyword: Token, token1: Token, token2: Token): DisjointNode {
    const left = token1.value < token2.value ? token1 : token2;
    const right = token1.value >= token2.value ? token1 : token2;
    return {
      nodeType: NodeType.DISJOINT,
      keyword: keyword,
      left: left,
      right: right,
    };
  }

  public lookUpConst(constToken: Token): Token | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      const constDefToken = frame.constants.get(constToken.value);
      if (constDefToken) {
        return constDefToken;
      }
    }
  }

  public lookUpVar(varToken: Token): Token | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      const varDefToken = frame.variables.get(varToken.value);
      if (varDefToken) {
        return varDefToken;
      }
    }
  }

  public lookUpFloat(label: string): FloatNode | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      const floatDefToken = frame.floatMap.get(label);
      if (floatDefToken) {
        return floatDefToken;
      }
    }
  }

  public lookUpEssential(statement: string): EssentialNode | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      const essentialDefToken = frame.essentialsStrMap.get(statement);
      if (essentialDefToken) {
        return essentialDefToken;
      }
    }
  }

  public lookUpLabel(label: string): FloatNode | EssentialNode | AxiomNode | ProveNode | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      const floatDefNode = frame.floatMap.get(label);
      if (floatDefNode) {
        return floatDefNode;
      }
      const essentialDefNode = frame.essentialMap.get(label);
      if (essentialDefNode) {
        return essentialDefNode;
      }
      const axiomDefNode = frame.axiomMap.get(label);
      if (axiomDefNode) {
        return axiomDefNode;
      }
      const proveDefNode = frame.proveMap.get(label);
      if (proveDefNode) {
        return proveDefNode;
      }
    }
  }

  public lookUpDisjoint(var1: string, var2: string): DisjointNode | undefined {
    const str = var1 + ' ' + var2;
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      const disjointDefNode = frame.disjoints.get(str);
      if (disjointDefNode) {
        return disjointDefNode;
      }
    }
  }

  private createEmptyFrame(): Frame {
    return {
      constants: new Map(),
      variables: new Map(),
      disjoints: new Map(),
      floats: [],
      floatMap: new Map(),
      essentials: [],
      essentialMap: new Map(),
      essentialsStrMap: new Map(),
      axioms: [],
      axiomMap: new Map(),
      axiomStrMap: new Map(),
      proves: [],
      proveMap: new Map(),
      proveStrMap: new Map(),
      errorNodes: [],
    };
  }

  private getEssentials(): Array<EssentialNode> {
    const essentials: Array<EssentialNode> = [];
    for (const frame of this.stack) {
      for (const essential of frame.essentials) {
        essentials.push(essential);
      }
    }
    return essentials;
  }

  private makeAssertion(node: AxiomNode | ProveNode) {
    // build var set
    const varSet: Set<string> = new Set();
    for (const essential of node.essentials) {
      for (const token of essential.body) {
        if (token.error === undefined && token.tokenType === TokenType.VAR_VAL) {
          varSet.add(token.value);
        }
      }
    }
    for (const token of node.body) {
      if (token.error === undefined && token.tokenType === TokenType.VAR_VAL) {
        varSet.add(token.value);
      }
    }

    // build disjointMap
    const varList = Array.from(varSet).sort();
    for (let i = 0; i < varList.length - 1; i++) {
      for (let j = i + 1; j < varList.length; j++) {
        const disjoinDef = this.lookUpDisjoint(varList[i], varList[j]);
        if (disjoinDef) {
          node.disjointMap.set(disjointNodeToString(disjoinDef), disjoinDef);
        }
      }
    }

    // build floats
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      for (let j = frame.floats.length - 1; j >= 0; j--) {
        const float = frame.floats[j];
        const floatName = float.variable?.value;
        if (floatName && varSet.has(floatName)) {
          node.floats.push(float);
          varSet.delete(floatName);
        }
      }
    }
    node.floats.reverse();
  }

  private decompressProof(proveNode: ProveNode) {
    if (proveNode.proof[0].value !== '(') {
      const decompressProof: Array<Node> = [];
      for (const token of proveNode.proof) {
        const node = this.lookUpLabel(token.value);
        if (node) {
          decompressProof.push(node);
        }
      }
      proveNode.decompressProof = decompressProof;
      return;
    }
    const floats = proveNode.floats;
    const essentials = proveNode.essentials;

    const opLabelInProof: Array<Node> = [];
    let idx = 0;
    for (; idx < proveNode.proof.length; idx++) {
      const token = proveNode.proof[idx];
      if (token.value === '(') {
        continue;
      } else if (token.value === ')') {
        idx++; // eat ')'
        break;
      } else {
        const labelNode = this.lookUpLabel(token.value);
        if (labelNode) {
          opLabelInProof.push(labelNode);
          token.tokenType = TokenType.OP_Label_IN_PROOF;
        } else {
          token.error = Error.LabelUndefined;
        }
      }
    }

    const compressdProof = proveNode.proof
      .slice(idx)
      .map((e) => e.value)
      .join();
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

    const floatEndIdx = floats.length;
    const essentialEndIdx = floatEndIdx + essentials.length;
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
        const labelNode = opLabelInProof[proofInt - essentialEndIdx];
        if (labelNode.nodeType === NodeType.AXIOM || labelNode.nodeType === NodeType.PROVE) {
          const hypNum = labelNode.essentials.length + labelNode.floats.length;
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
        decompressInts = decompressInts.concat(proof);
        prevProofs.push(proof);
      }
    }

    const decompressProof: Array<Node> = [];
    for (const di of decompressInts) {
      let node: Node | undefined;
      if (di < floatEndIdx) {
        node = floats[di];
      } else if (di < essentialEndIdx) {
        node = essentials[di - floatEndIdx];
      } else if (di < opLabelEndIdx) {
        node = opLabelInProof[di - essentialEndIdx];
      }
      if (node) {
        decompressProof.push(node);
      }
    }
    proveNode.decompressProof = decompressProof;
  }
  private verifyProof(proveNode: ProveNode) {
    if (proveNode.decompressProof === undefined) {
      this.decompressProof(proveNode);
    }
    const decompressProof = proveNode.decompressProof;
    if (decompressProof === undefined) {
      return;
    }
    let stack: Array<OpNode> = [];
    for (const node of decompressProof) {
      const opNode: OpNode = {
        nodeType: NodeType.OP,
        definition: node,
        argMap: new Map(),
        varSet: new Set(),
        children: [],
      };
      if (node.nodeType === NodeType.AXIOM || node.nodeType === NodeType.PROVE) {
        const floats = node.floats;
        const essentials = node.essentials;
        const disjointMap = node.disjointMap;
        const argNum: number = floats.length + essentials.length;
        let sp = stack.length - argNum;
        if (sp < 0) {
          opNode.error = Error.OpStackOverflow;
        } else {
          for (const float of floats) {
            const childOpNode = stack[sp];
            sp++;
            if (float.type?.value !== childOpNode.definition.type?.value) {
              childOpNode.error = Error.OpTypeError;
              opNode.error = Error.ArgOpTypeError;
              break;
            } else {
              if (float.variable) {
                opNode.argMap.set(float.variable.value, childOpNode);
                opNode.children.push(childOpNode);
              }
            }
          }
          for (const disjoint of disjointMap.values()) {
            const leftVarSet = opNode.argMap.get(disjoint.left.value)?.varSet;
            const rightVarSet = opNode.argMap.get(disjoint.right.value)?.varSet;
            if (leftVarSet && rightVarSet) {
              for (const leftvar of leftVarSet) {
                if (rightVarSet.has(leftvar)) {
                  opNode.error = Error.OpDisjointBreak;
                  break;
                }
              }
            }
            if (opNode.error) {
              break;
            }
          }
          for (const essential of essentials) {
            const childEssential = stack[sp];
            sp++;
            const subsInputToken = this.subsBody(essential.body, opNode.argMap);
            if (childEssential.body) {
              if (!this.tokensEq(childEssential.body, subsInputToken)) {
                opNode.error = Error.OpEssentialMissing;
                break;
              }
              opNode.children.push(childEssential);
            }
          }
          if (opNode.error === undefined && opNode.definition.body) {
            opNode.body = this.subsBody(opNode.definition.body, opNode.argMap);
          }
        }
        stack = stack.slice(0, stack.length - argNum);
        stack.push(opNode);
      } else if (node.nodeType === NodeType.FLOAT) {
        if (node.variable) {
          opNode.body = [node.variable];
        }
        stack.push(opNode);
      } else if (node.nodeType === NodeType.ESSENTIAL) {
        if (node.body) {
          opNode.body = node.body;
        }
        stack.push(opNode);
      }
    }
    proveNode.opTree = stack.pop();
    if (proveNode.opTree?.body) {
      const proveSuccess = this.tokensEq(proveNode.body, proveNode.opTree?.body);
      if (proveSuccess) {
        proveNode.isProved = true;
      }
    }
    if (!proveNode.isProved) {
      proveNode.error = Error.ProveFailed;
    }
  }
  private subsBody(tokens: Array<Token>, argMap: Map<string, OpNode>): Array<Token> {
    let subsEssentials: Array<Token> = [];
    for (const token of tokens) {
      const arg = argMap.get(token.value);
      if (arg && arg.body) {
        subsEssentials = subsEssentials.concat(arg.body);
      } else {
        subsEssentials.push(token);
      }
    }
    return subsEssentials;
  }
  private tokensEq(tokensA: Array<Token>, tokensB: Array<Token>): boolean {
    if (tokensA.length !== tokensB.length) {
      return false;
    }
    for (let i = 0; i < tokensA.length; i++) {
      if (tokensA[i].value !== tokensB[i].value) {
        return false;
      }
    }
    return true;
  }
}
