import {
  AxiomNode,
  DisjointNode,
  Error,
  EssentialNode,
  FloatNode,
  Frame,
  NodeType,
  ProveNode,
  Token,
  TokenType,
  disjointNodeToString,
  stmtNodeToString,
} from './types';

export class FrameStack {
  private stack: Array<Frame> = [];

  public pushEmpty() {
    this.stack.push(this.createEmptyFrame());
  }

  public addConst(token: Token) {
    if (this.stack.length === 0) {
      this.pushEmpty();
    }
    const frame = this.stack[-1];
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
    const frame = this.stack[-1];
    if (frame.constants.has(token.value)) {
      token.error = Error.VarNameDuplicated;
    } else if (frame.variables.has(token.value)) {
      token.error = Error.VarNameDuplicated;
    } else {
      frame.variables.set(token.value, token);
    }
  }

  public addFloat(keyword: Token, tokens: Array<Token>, label?: Token) {
    if (this.stack.length === 0) {
      this.pushEmpty();
    }
    const frame = this.stack[-1];

    const floatNode: FloatNode = {
      nodeType: NodeType.FLOAT,
      keyword: keyword,
      label: label,
    };

    if (label) {
      label.tokenType = TokenType.FLOAT_LABEL;
    }

    let idx = 0;
    // parse type
    if (idx < tokens.length) {
      const token = tokens[idx];
      if (this.lookUpConst(token) === undefined) {
        token.tokenType = TokenType.TYPE_VAL;
        floatNode.type = token;
      } else {
        token.error = Error.TypeUndefined;
      }
      idx++;
    }
    // parse variable
    if (idx < tokens.length) {
      const token = tokens[idx];
      if (this.lookUpVar(token) === undefined) {
        token.tokenType = TokenType.VAR_VAL;
        floatNode.variable = token;
      } else {
        token.error = Error.VarUndefined;
      }
      idx++;
    }
    // error handling
    for (; idx < tokens.length; idx++) {
      const token = tokens[idx];
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
      const name = floatNode.variable?.value;
      if (name) {
        frame.floats.push(floatNode);
        frame.floatMap.set(name, floatNode);
      }
    } else {
      frame.errorNodes.push(floatNode);
    }
  }

  public addEssential(keyword: Token, tokens: Array<Token>, label?: Token) {
    if (this.stack.length === 0) {
      this.pushEmpty();
    }
    const frame = this.stack[-1];

    const essentialNode: EssentialNode = {
      nodeType: NodeType.ESSENTIAL,
      keyword: keyword,
      label: label,
      body: [],
    };

    if (label) {
      label.tokenType = TokenType.ESSENTIAL_LABEL;
    }

    let idx = 0;
    // parse type
    if (idx < tokens.length) {
      const token = tokens[idx];
      if (this.lookUpConst(token) === undefined) {
        token.tokenType = TokenType.TYPE_VAL;
        essentialNode.type = token;
      } else {
        token.error = Error.TypeUndefined;
      }
      idx++;
    }
    // parse body
    for (; idx < tokens.length; ++idx) {
      const token = tokens[idx];
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
      if (frame.essentialsMap.has(bodyStr)) {
        frame.essentials.push(essentialNode);
        frame.essentialsMap.set(bodyStr, essentialNode);
      }
    } else {
      frame.errorNodes.push(essentialNode);
    }
  }

  public addAxiom(keyword: Token, tokens: Array<Token>, label?: Token) {
    if (this.stack.length === 0) {
      this.pushEmpty();
    }
    const frame = this.stack[-1];

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
    }

    let idx = 0;
    // parse type
    if (idx < tokens.length) {
      const token = tokens[idx];
      if (this.lookUpConst(token) === undefined) {
        token.tokenType = TokenType.TYPE_VAL;
        axiomNode.type = token;
      } else {
        token.error = Error.TypeUndefined;
      }
      idx++;
    }
    // parse body
    for (; idx < tokens.length; ++idx) {
      const token = tokens[idx];
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
      const bodyStr: string = stmtNodeToString(axiomNode);
      if (frame.axiomsMap.has(bodyStr)) {
        frame.axioms.push(axiomNode);
        frame.axiomsMap.set(bodyStr, axiomNode);
      }
    } else {
      frame.errorNodes.push(axiomNode);
    }

    this.makeAssertion(axiomNode);
  }

  public addProve(keyword: Token, tokens: Array<Token>, proof: Array<Token>, label?: Token) {
    if (this.stack.length === 0) {
      this.pushEmpty();
    }
    const frame = this.stack[-1];

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
    }

    let idx = 0;
    // parse type
    if (idx < tokens.length) {
      const token = tokens[idx];
      if (this.lookUpConst(token) === undefined) {
        token.tokenType = TokenType.TYPE_VAL;
        proveNode.type = token;
      } else {
        token.error = Error.TypeUndefined;
      }
      idx++;
    }
    // parse body
    for (; idx < tokens.length; ++idx) {
      const token = tokens[idx];
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
      const bodyStr: string = stmtNodeToString(proveNode);
      if (frame.proveMap.has(bodyStr)) {
        frame.prove.push(proveNode);
        frame.proveMap.set(bodyStr, proveNode);
      }
    } else {
      frame.errorNodes.push(proveNode);
    }
    this.makeAssertion(proveNode);
  }

  public addDisjoint(keyword: Token, tokens: Array<Token>) {
    if (this.stack.length === 0) {
      this.pushEmpty();
    }
    const frame = this.stack[-1];
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
      const essentialDefToken = frame.essentialsMap.get(statement);
      if (essentialDefToken) {
        return essentialDefToken;
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
      essentialsMap: new Map(),
      axioms: [],
      axiomsMap: new Map(),
      prove: [],
      proveMap: new Map(),
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
}
