import Parser from './parser';
import path from 'path';
import { existsSync, readFileSync } from 'node:fs';
import { ArgDefNode, DefNode, Error, Node, NodeType, OpNode, ParserOptions } from './types';

interface CompileNode {
  absPath: string;
  parse: Parser;
  parents?: Set<CompileNode>;
  children?: Set<CompileNode>;
  defNodeMap?: Map<string, DefNode>;
  error?: Error;
}

export default class Compiler {
  documentMap: Map<string, CompileNode> = new Map();

  public buildCompileGraph(
    filePath: string,
    parserOptions?: ParserOptions,
    visited?: Array<string>,
  ): CompileNode | undefined {
    const folderPath = path.dirname(filePath);
    const absPath = path.resolve(filePath);
    if (!existsSync(absPath)) {
      return;
    }
    if (this.documentMap.has(absPath)) {
      return this.documentMap.get(absPath);
    }
    const input = readFileSync(filePath, 'utf-8');
    if (parserOptions === undefined) {
      parserOptions = {};
    }
    if (parserOptions.scannerOptions === undefined) {
      parserOptions.scannerOptions = {
        sourceFilename: absPath,
      };
    }
    const parse = new Parser(input, parserOptions);
    const compileNode: CompileNode = {
      absPath: absPath,
      parse: parse,
    };
    parse.getNodes();
    this.documentMap.set(absPath, compileNode);

    if (visited === undefined) {
      visited = [absPath];
    } else {
      visited.push(absPath);
    }
    for (const importNode of parse.importNodes) {
      if (importNode.error === undefined) {
        const importPath = importNode.name?.value;
        if (importPath) {
          const parentAbsPath = path.resolve(path.join(folderPath, importPath.slice(1, -1)));
          if (!existsSync(parentAbsPath)) {
            importNode.error = Error.ImportFileNotExist;
          } else {
            if (visited.includes(parentAbsPath)) {
              importNode.error = Error.HasImportCircle;
              compileNode.error = Error.HasImportCircle;
            }

            const parentCompileNode = this.buildCompileGraph(parentAbsPath, undefined, visited);
            if (parentCompileNode) {
              if (compileNode.parents === undefined) {
                compileNode.parents = new Set([parentCompileNode]);
              } else {
                compileNode.parents.add(parentCompileNode);
              }
              if (parentCompileNode.children === undefined) {
                parentCompileNode.children = new Set([compileNode]);
              } else {
                parentCompileNode.children.add(compileNode);
              }
              if (parentCompileNode.error === Error.HasImportCircle) {
                importNode.error = Error.HasImportCircle;
                compileNode.error = Error.HasImportCircle;
              }
            } else {
              importNode.error = Error.ImportFileNotExist;
            }
          }
        }
      }
    }
    visited.pop();
    return compileNode;
  }

  public buildOpTree(
    filePath: string,
    parserOptions?: ParserOptions,
    visited?: Array<string>,
  ): CompileNode | undefined {
    const compileInfo = this.buildCompileGraph(filePath, parserOptions);
    if (compileInfo === undefined) {
      return;
    }

    if (visited === undefined) {
      visited = [compileInfo.absPath];
    } else if (visited.includes(compileInfo.absPath)) {
      return compileInfo;
    } else {
      visited.push(compileInfo.absPath);
    }
    if (compileInfo.parents) {
      for (const parent of compileInfo.parents) {
        this.buildOpTree(parent.absPath, undefined, visited);
      }
    }

    const defNodes = compileInfo.parse.defNodes;
    for (const defNode of defNodes) {
      this.checkDefNode(compileInfo, defNode);
      if (defNode.error === undefined) {
        const name = defNode.name?.value;
        if (name) {
          if (compileInfo.defNodeMap) {
            compileInfo.defNodeMap.set(name, defNode);
          } else {
            compileInfo.defNodeMap = new Map([[name, defNode]]);
          }
        }
      }
      const params = defNode.params;
      if (params) {
        for (const param of params) {
          this.checkDefNode(compileInfo, param);
        }
      }
      const body = defNode.body;
      if (body) {
        if (body.assumes) {
          for (const assume of body.assumes) {
            this.parseAssumeOrTargetTokens(compileInfo, defNode, assume);
          }
        }
        this.parseAssumeOrTargetTokens(compileInfo, defNode, body.target);
      }
      this.parseProofTokens(compileInfo, defNode, defNode.proof);
    }
    return compileInfo;
  }

  private checkDefNode(compileInfo: CompileNode, defNode: DefNode) {
    const type = defNode.type;
    if (type) {
      const typeDefinition = this.findDefinition(compileInfo, type.value);
      if (typeDefinition === undefined) {
        type.error = Error.TypeDefMissing;
      }
    }
    const name = defNode.name;
    if (name) {
      const nameDefinition = this.findDefinition(compileInfo, name.value);
      if (nameDefinition) {
        name.error = Error.NameDefDuplicated;
      }
    }
  }

  private parseAssumeOrTargetTokens(compileInfo: CompileNode, defNode: DefNode, node: Node | undefined) {
    if (node === undefined) {
      return;
    }
    this.parseTokens(compileInfo, defNode, node);
    const opTrees = node.opTrees;
    if (opTrees) {
      for (let i = 1; i < opTrees.length; i++) {
        if (opTrees[i].error === undefined) {
          opTrees[i].error = Error.RedundantOpTree;
        }
      }
    }
  }
  private parseProofTokens(compileInfo: CompileNode, defNode: DefNode, node: Node | undefined) {
    if (node === undefined) {
      return;
    }
    this.parseTokens(compileInfo, defNode, node);
    const opTrees = node.opTrees;
    if (opTrees === undefined) {
      return;
    }
    for (const opTree of opTrees) {
      if (
        opTree.error === undefined &&
        !(opTree.definition?.nodeType === NodeType.THEOREM_DEF || opTree.definition?.nodeType === NodeType.AXIOM_DEF)
      ) {
        opTree.error = Error.RedundantOpTree;
      }
      if (opTree.error) {
        continue;
      }
      const argMapping: Map<string, OpNode> = new Map();
      if (opTree.children) {
        for (const child of opTree.children) {
          const argname = child.targetDefNode?.name?.value;
          if (argname) {
            argMapping.set(argname, child);
          }
        }
      }
      const defBody = opTree.definition?.body;
      if (defBody === undefined) {
        continue;
      }
      if (defBody.assumes) {
        opTree.assumes = [];
        for (const assume of defBody.assumes) {
          if (assume.opTrees) {
            const newAssumeOpTree = this.generateOpTreeByReplacing(assume.opTrees[0], argMapping);
            opTree.assumes.push(newAssumeOpTree);
          }
        }
      }
      if (defBody.target && defBody.target.opTrees) {
        const newTargetOpTree = this.generateOpTreeByReplacing(defBody.target.opTrees[0], argMapping);
        opTree.target = newTargetOpTree;
      }
    }
  }

  private generateOpTreeByReplacing(opTree: OpNode, argMapping: Map<string, OpNode>): OpNode {
    const name = opTree.name?.value;
    if (name) {
      const newOpTree = argMapping.get(name);
      if (newOpTree) {
        return newOpTree;
      }
    }
    const newOpTree: OpNode = {
      nodeType: opTree.nodeType,
      name: opTree.name,
      definition: opTree.definition,
    };
    if (opTree.children) {
      newOpTree.children = [];
      for (const child of opTree.children) {
        const newChild = this.generateOpTreeByReplacing(child, argMapping);
        if (newChild.error) {
          newOpTree.children.push(child);
        } else {
          newOpTree.children.push(newChild); // implicit correction
        }
      }
    }
    return newOpTree;
  }

  private parseTokens(compileInfo: CompileNode, defNode: DefNode, node: Node | undefined) {
    if (node === undefined) {
      return;
    }
    const tokens = node.tokens;
    if (tokens === undefined) {
      return;
    }
    const opNodes: Array<OpNode> = [];
    for (const token of tokens) {
      const tokenDefinition =
        this.findArgDefinition(defNode, token.value) || this.findDefinition(compileInfo, token.value);
      const opNode: OpNode = {
        nodeType: NodeType.OP,
        name: token,
        definition: tokenDefinition,
      };
      if (tokenDefinition === undefined) {
        opNode.error = Error.DefinitionMissing;
      } else if (tokenDefinition.name?.tokenType) {
        token.tokenType = tokenDefinition.name?.tokenType;
      }
      opNodes.push(opNode);
    }

    const opNodeStack: Array<OpNode> = [];
    for (let i = opNodes.length - 1; i >= 0; i--) {
      const opNode = opNodes[i];
      const params = opNode.definition?.params;
      if (params === undefined) {
        opNodeStack.push(opNode);
        continue;
      }
      opNode.children = [];
      for (const param of params) {
        let arg = opNodeStack.pop();
        if (arg === undefined) {
          arg = {
            nodeType: NodeType.OP,
            error: Error.ArgMissing,
          };
        } else if (
          arg.definition?.nodeType === NodeType.AXIOM_DEF ||
          arg.definition?.nodeType === NodeType.THEOREM_DEF
        ) {
          opNodeStack.push(arg);
          arg = {
            nodeType: NodeType.OP,
            error: Error.ArgMissing,
          };
        }
        arg.targetDefNode = param;
        opNode.children.push(arg);
        if (arg.error === undefined && arg.definition?.type?.value !== arg.targetDefNode.type?.value) {
          arg.error = Error.ArgTypeWrong;
        }
        if (arg.error) {
          opNode.error = Error.HasArgProblem;
        }
      }
      opNodeStack.push(opNode);
    }
    opNodeStack.reverse();
    node.opTrees = opNodeStack;
  }

  private findArgDefinition(defNode: DefNode, name: string | undefined): ArgDefNode | undefined {
    if (name === undefined) {
      return;
    }
    return defNode.argDefMap?.get(name);
  }

  private findDefinition(compileInfo: CompileNode, name: string | undefined): DefNode | undefined {
    if (name === undefined) {
      return;
    }
    let definition = compileInfo.defNodeMap?.get(name);
    if (definition) {
      return definition;
    }
    if (compileInfo.parents) {
      for (const parent of compileInfo.parents) {
        if (parent.error !== Error.HasImportCircle) {
          definition = this.findDefinition(parent, name);
          if (definition) {
            return definition;
          }
        }
      }
    }
  }
}
