import Scanner from './scanner';
import {
  ArgDefNode,
  AssumeNode,
  AxiomDefNode,
  BodyNode,
  ConstDefNode,
  DefNode,
  EofNode,
  Error,
  ImportNode,
  Node,
  NodeBase,
  NodeType,
  ParserOptions,
  ProofNode,
  PropDefNode,
  TargetNode,
  TheoremDefNode,
  Token,
  TokenType,
  TypeDefNode,
} from './types';

export default class Parser {
  private scanner: Scanner;
  private comments: Array<Token> = [];
  nodes: Array<Node> = [];
  currentNodeIdx: number = -1;
  importNodes: Array<ImportNode> = [];
  defNodes: Array<DefNode> = [];

  constructor(input: string, option?: ParserOptions) {
    this.scanner = new Scanner(input, option?.scannerOptions);
  }

  public eof(): boolean {
    return this.scanner.eof();
  }

  public lookAhead(): Node {
    if (this.currentNodeIdx + 1 >= this.nodes.length) {
      this.nodes.push(this.nextNode());
    }
    return this.nodes[this.currentNodeIdx + 1];
  }

  public peek(): Node {
    if (this.currentNodeIdx >= this.nodes.length) {
      this.nodes.push(this.nextNode());
    }
    return this.nodes[this.currentNodeIdx];
  }

  public back(): void {
    if (this.currentNodeIdx > -1) {
      this.currentNodeIdx--;
    }
  }

  public begin(): void {
    this.currentNodeIdx = -1;
  }

  public getNodes(): Array<Node> {
    while (this.currentNodeIdx < 0 || this.nodes[this.currentNodeIdx].nodeType !== NodeType.EOF) {
      this.next();
    }
    return this.nodes;
  }

  public next(): Node {
    if (this.currentNodeIdx >= 0 && this.nodes[this.currentNodeIdx].nodeType === NodeType.EOF) {
      return this.nodes[this.currentNodeIdx];
    }
    if (this.currentNodeIdx + 1 >= this.nodes.length) {
      this.nodes.push(this.nextNode());
    }
    this.currentNodeIdx++;
    return this.nodes[this.currentNodeIdx];
  }

  private nextNode(): Node {
    // eslint-disable-next-line no-constant-condition
    while (!this.scanner.eof()) {
      const currentToken = this.scanNext();
      switch (currentToken.tokenType) {
        case TokenType.IMPORT:
          return this.parseImport();
        case TokenType.TYPE:
          return this.parseTypeDef();
        case TokenType.CONST:
          return this.parseConstDef();
        case TokenType.PROP:
          return this.parsePropDef();
        case TokenType.AXIOM:
          return this.parseAxiomDef();
        case TokenType.THEOREM:
          return this.parseTheoremDef();
        case TokenType.EOF:
          return this.createEofNode();
        default:
          currentToken.error = Error.UnknownTokenOutOfBlock;
      }
    }
    return this.createEofNode();
  }

  private parseImport(): ImportNode {
    const importNode: ImportNode = {
      nodeType: NodeType.IMPORT,
      keyword: this.scanner.peek(),
    };
    const valueToken = this.scanNext();
    if (valueToken.tokenType === TokenType.STRING) {
      importNode.name = valueToken;
      const pathStr = valueToken.value;
      if (pathStr && pathStr.length > 2) {
        this.importNodes.push(importNode);
      } else {
        importNode.error = Error.ImportFileStringEmpty;
      }
    } else {
      this.scanner.back();
      importNode.error = Error.ImportFileStringMissing;
    }
    return importNode;
  }

  private parseTypeDef(): TypeDefNode {
    const typeDefNode: TypeDefNode = {
      nodeType: NodeType.TYPE_DEF,
      keyword: this.scanner.peek(),
    };
    this.parseType(typeDefNode);
    if (typeDefNode.error) {
      return typeDefNode;
    }
    this.defNodes.push(typeDefNode);
    return typeDefNode;
  }

  private parseConstDef(): ConstDefNode {
    const constDefNode: ConstDefNode = {
      nodeType: NodeType.CONST_DEF,
      keyword: this.scanner.peek(),
    };
    this.parseType(constDefNode);
    if (constDefNode.error) {
      return constDefNode;
    }
    this.parseName(constDefNode, TokenType.CONST_VAL);
    if (constDefNode.error) {
      return constDefNode;
    }
    this.defNodes.push(constDefNode);
    return constDefNode;
  }

  private parsePropDef(): PropDefNode {
    const propDefNode: PropDefNode = {
      nodeType: NodeType.PROP_DEF,
      keyword: this.scanner.peek(),
    };
    this.parseType(propDefNode);
    if (propDefNode.error) {
      return propDefNode;
    }
    this.parseName(propDefNode, TokenType.PROP_VAL);
    if (propDefNode.error) {
      return propDefNode;
    }
    this.parseParams(propDefNode);
    if (propDefNode.error) {
      return propDefNode;
    }
    this.defNodes.push(propDefNode);
    return propDefNode;
  }

  private parseAxiomDef(): AxiomDefNode {
    const axiomDefNode: AxiomDefNode = {
      nodeType: NodeType.AXIOM_DEF,
      keyword: this.scanner.peek(),
    };
    this.parseName(axiomDefNode, TokenType.AXIOM_VAL);
    if (axiomDefNode.error) {
      return axiomDefNode;
    }
    this.parseParams(axiomDefNode);
    if (axiomDefNode.error) {
      return axiomDefNode;
    }
    this.parseBody(axiomDefNode);
    if (axiomDefNode.error) {
      return axiomDefNode;
    }
    this.defNodes.push(axiomDefNode);
    return axiomDefNode;
  }

  private parseTheoremDef(): TheoremDefNode {
    const theoremDefNode: TheoremDefNode = {
      nodeType: NodeType.THEOREM_DEF,
      keyword: this.scanner.peek(),
    };
    this.parseName(theoremDefNode, TokenType.AXIOM_VAL);
    if (theoremDefNode.error) {
      return theoremDefNode;
    }
    this.parseParams(theoremDefNode);
    if (theoremDefNode.error) {
      return theoremDefNode;
    }
    this.parseBody(theoremDefNode);
    if (theoremDefNode.error) {
      return theoremDefNode;
    }
    this.parseProof(theoremDefNode);
    if (theoremDefNode.error) {
      return theoremDefNode;
    }
    this.defNodes.push(theoremDefNode);
    return theoremDefNode;
  }

  private createEofNode(): EofNode {
    return {
      nodeType: NodeType.EOF,
    };
  }

  private scanNext(): Token {
    let currentToken: Token = this.scanner.next();
    while (currentToken.tokenType === TokenType.LINE_COMMENT || currentToken.tokenType === TokenType.BLOCK_COMMENT) {
      this.comments.push(currentToken);
      currentToken = this.scanner.next();
    }
    return currentToken;
  }

  private parseType(defNode: NodeBase): void {
    const valueToken = this.scanNext();
    if (valueToken.tokenType === TokenType.WORD) {
      defNode.type = valueToken;
      valueToken.tokenType = TokenType.TYPE_VAL;
    } else {
      this.scanner.back();
      defNode.error = Error.TypeMissing;
    }
  }

  private parseName(defNode: NodeBase, tokenType: TokenType): void {
    const nameToken = this.scanNext();
    if (nameToken.tokenType === TokenType.WORD) {
      defNode.name = nameToken;
      nameToken.tokenType = tokenType;
    } else {
      this.scanner.back();
      defNode.error = Error.NameMissing;
    }
  }

  private parseParams(defNode: PropDefNode | AxiomDefNode | TheoremDefNode): void {
    const LParenToken = this.scanNext();
    if (LParenToken.tokenType !== TokenType.LPAREN) {
      this.scanner.back();
      defNode.error = Error.ParamsLeftParenMissing;
      return;
    }
    const paramsTokens: Array<Token> = [];
    let RParenToken = this.scanNext();
    while (RParenToken.tokenType === TokenType.WORD || RParenToken.tokenType === TokenType.COMMA) {
      if (RParenToken.tokenType === TokenType.WORD) {
        // ignore `,`
        paramsTokens.push(RParenToken);
      }
      RParenToken = this.scanNext();
    }
    if (RParenToken.tokenType !== TokenType.RPAREN) {
      this.scanner.back();
      defNode.error = Error.ParamsRightParenMissing;
      return;
    }

    let argDefNode: ArgDefNode;
    let idx = 0;
    const argNameRecord: Set<string> = new Set();
    const defNodeName = defNode.name?.value;
    if (defNodeName) {
      argNameRecord.add(defNodeName);
    }
    while (idx < paramsTokens.length) {
      if (idx + 1 >= paramsTokens.length) {
        paramsTokens[idx].error = Error.ArgNameMissing;
      }
      argDefNode = {
        nodeType: NodeType.ARG_DEF,
        type: paramsTokens[idx],
        name: paramsTokens[idx + 1],
      };
      paramsTokens[idx].tokenType = TokenType.TYPE_VAL;
      paramsTokens[idx + 1].tokenType = TokenType.ARG_VAL;
      const argName = paramsTokens[idx + 1].value;
      if (argName) {
        if (argNameRecord.has(argName)) {
          paramsTokens[idx + 1].error = Error.ArgNameDuplicated;
        } else {
          argNameRecord.add(argName);
          if (defNode.params === undefined) {
            defNode.params = [argDefNode];
          } else {
            defNode.params.push(argDefNode);
          }
        }
      }
      idx += 2;
    }
    if (defNode.params) {
      defNode.argDefMap = new Map();
      for (const param of defNode.params) {
        if (param.name?.value) {
          defNode.argDefMap.set(param.name?.value, param);
        }
      }
    }
  }

  private parseBody(defNode: AxiomDefNode | TheoremDefNode): void {
    const LBraceToken = this.scanNext();
    if (LBraceToken.tokenType !== TokenType.LBRACE) {
      defNode.error = Error.BodyLeftBraceMissing;
      return;
    }
    const bodyTokens: Array<Token> = [];
    let RBraceToken = this.scanNext();
    while (
      RBraceToken.tokenType === TokenType.WORD ||
      RBraceToken.tokenType === TokenType.ASSUME ||
      RBraceToken.tokenType === TokenType.TARGET ||
      RBraceToken.tokenType === TokenType.COMMA ||
      RBraceToken.tokenType === TokenType.LPAREN ||
      RBraceToken.tokenType === TokenType.RPAREN
    ) {
      if (
        RBraceToken.tokenType === TokenType.WORD ||
        RBraceToken.tokenType === TokenType.ASSUME ||
        RBraceToken.tokenType === TokenType.TARGET
      ) {
        // ignore `(`, `)` and `,`
        bodyTokens.push(RBraceToken);
      }
      RBraceToken = this.scanNext();
    }
    if (RBraceToken.tokenType !== TokenType.RBRACE) {
      defNode.error = Error.BodyRightBraceMissing;
      return;
    }

    let state: Token | undefined;
    let stateTokens: Array<Token> = [];
    const bodyNode: BodyNode = {
      nodeType: NodeType.BODY,
    };
    for (let i = 0; i < bodyTokens.length; i++) {
      const token = bodyTokens[i];
      if (token.tokenType === TokenType.WORD) {
        stateTokens.push(token);
      }
      if (i + 1 === bodyTokens.length || token.tokenType === TokenType.ASSUME || token.tokenType === TokenType.TARGET) {
        // the end of old block
        if (state) {
          if (state.tokenType === TokenType.ASSUME) {
            if (stateTokens.length === 0) {
              state.error = Error.AssumeEmpty;
            } else {
              const assumeNode: AssumeNode = {
                nodeType: NodeType.ASSUME,
                keyword: state,
                tokens: stateTokens,
              };
              if (bodyNode.assumes) {
                bodyNode.assumes.push(assumeNode);
              } else {
                bodyNode.assumes = [assumeNode];
              }
            }
          } else if (state.tokenType === TokenType.TARGET) {
            if (bodyNode.target) {
              state.error = Error.TargetDuplicated;
            } else if (stateTokens.length === 0) {
              state.error = Error.TargetEmpty;
            } else {
              const targetNode: TargetNode = {
                nodeType: NodeType.TARGET,
                keyword: state,
                tokens: stateTokens,
              };
              bodyNode.target = targetNode;
            }
          }
        }
        state = token;
        stateTokens = [];
      }
      if (bodyNode.target === undefined) {
        bodyNode.error = Error.BodyTargetMissing;
      }
    }
    defNode.body = bodyNode;
  }

  private parseProof(defNode: TheoremDefNode): void {
    const EqToken = this.scanNext();
    if (EqToken.tokenType !== TokenType.EQ) {
      defNode.error = Error.ProofEqMissing;
      return;
    }
    const LBraceToken = this.scanNext();
    if (LBraceToken.tokenType !== TokenType.LBRACE) {
      defNode.error = Error.ProofLeftBraceMissing;
      return;
    }
    const proofTokens: Array<Token> = [];
    let RBraceToken = this.scanNext();
    while (
      RBraceToken.tokenType === TokenType.WORD ||
      RBraceToken.tokenType === TokenType.COMMA ||
      RBraceToken.tokenType === TokenType.LPAREN ||
      RBraceToken.tokenType === TokenType.RPAREN
    ) {
      if (RBraceToken.tokenType === TokenType.WORD) {
        // ignore `(`, `)` and `,`
        proofTokens.push(RBraceToken);
      }
      RBraceToken = this.scanNext();
    }
    if (RBraceToken.tokenType !== TokenType.RBRACE) {
      defNode.error = Error.ProofRightBraceMissing;
      return;
    }
    if (proofTokens.length === 0) {
      defNode.error = Error.ProofEmpty;
      return;
    }
    const proofNode: ProofNode = {
      nodeType: NodeType.PROOF,
      tokens: proofTokens,
    };
    defNode.proof = proofNode;
  }
}
