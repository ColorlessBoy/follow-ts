import Parser from './parser';
import path from 'path';
import { existsSync, readFileSync } from 'node:fs';
import {
  ArgDefNode,
  AssumeNode,
  DefNode,
  Error,
  Node,
  NodeType,
  OpNode,
  ParserOptions,
  opNodeToString,
  opNodeToStringFormat,
} from './types';
import { writeFileSync } from 'fs';

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

  public translate(input: string, output: string) {
    const compileInfo = this.buildOpTree(input);
    if (compileInfo === undefined) {
      return;
    }
    const propContents: Array<string> = [];
    const contents: Array<string> = [];
    const typeSet: Set<string> = new Set();
    const constMap: Map<string, Set<string>> = new Map();
    for (const defNode of compileInfo.parse.defNodes) {
      if (defNode.nodeType === NodeType.TYPE_DEF) {
        if (defNode.type?.value) {
          typeSet.add(defNode.type.value);
        }
      } else if (defNode.nodeType === NodeType.CONST_DEF) {
        if (defNode.type?.value && defNode.name?.value) {
          const constTypeSet = constMap.get(defNode.type.value) || new Set();
          constMap.set(defNode.type.value, constTypeSet);
          constTypeSet.add(defNode.name.value);
        }
      } else if (defNode.nodeType === NodeType.PROP_DEF) {
        const argStr = defNode.params
          ?.map((param) => {
            return `${param.type?.value} ${param.name?.value}`;
          })
          .join(', ');
        const propStr = `prop ${defNode.type?.value} ${defNode.name?.value}(${argStr})`;
        propContents.push(propStr);
      } else if (defNode.nodeType === NodeType.AXIOM_DEF || defNode.nodeType === NodeType.THEOREM_DEF) {
        const argStr =
          defNode.params
            ?.map((param) => {
              return `${param.type?.value} ${param.name?.value}`;
            })
            .join(', ') || '';
        if (defNode.nodeType === NodeType.AXIOM_DEF) {
          const axiomStr = `axiom ${defNode.name?.value}(${argStr}) {`;
          contents.push(axiomStr);
        } else {
          const thmStr = `thm ${defNode.name?.value}(${argStr}) {`;
          contents.push(thmStr);
        }
        if (defNode.body && defNode.body.target?.opTrees) {
          const targetOpTree = defNode.body.target.opTrees[0];
          const targetStr = opNodeToStringFormat(targetOpTree, '  |- ');
          contents.push(...targetStr);
          defNode.body.assumes?.forEach((assume) => {
            if (assume.opTrees && assume.opTrees.length > 0) {
              const assumeStr = opNodeToStringFormat(assume.opTrees[0], '  -| ');
              contents.push(...assumeStr);
            }
          });
        }
        if (defNode.nodeType === NodeType.THEOREM_DEF) {
          contents.push('} = {');
          const preSuggestions = defNode.preSuggestions?.map((e) => {
            return `  ${e}`;
          });
          if (preSuggestions && preSuggestions.length > 0) {
            contents.push(...preSuggestions);
          }
          const proofOpTrees = defNode.proof?.opTrees;
          if (proofOpTrees) {
            for (const opTree of proofOpTrees) {
              const opTreeStr = opNodeToStringFormat(opTree, '  ');
              contents.push(...opTreeStr);
            }
          }
          if (defNode.suggestions) {
            for (const op of defNode.suggestions) {
              contents.push(`  ${op}`);
            }
          }
        }
        contents.push('}');
        if (defNode.name?.value === 'a1i') {
          contents.push('thm a1ii(wff w0, wff w1) {');
          contents.push('  |- w0');
          contents.push('  -| w0');
          contents.push('  -| w1');
          contents.push('} = {');
          contents.push('  ax-mp w0 w1');
          contents.push('  a1i w1 w0');
          contents.push('}');
        }
      }
    }
    const typeStr = `type ` + [...typeSet].join(' ');
    const constStr: Array<string> = [];
    constMap.forEach((value, key) => {
      const s = `const ${key} ` + [...value].join(' ');
      constStr.push(s);
    });
    const diffAxioms = this.generateDiffAxioms(compileInfo.parse.defNodes);
    writeFileSync(output, [typeStr, ...constStr, ...propContents, ...diffAxioms, ...contents].join('\n'), {
      encoding: 'utf8',
      flag: 'w',
    });
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
        this.parseAssumeOrTargetTokens(compileInfo, defNode, body.target);
        if (body.assumes) {
          for (const assume of body.assumes) {
            this.parseAssumeOrTargetTokens(compileInfo, defNode, assume);
          }
        }
      }
      this.parseProofTokens(compileInfo, defNode, defNode.proof);
      this.generateSuggestions(defNode);
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
  private generateSuggestions(node: Node) {
    if (node.cumulatedAssumes) {
      const bodyAssumesStrMap: Map<string, AssumeNode> = new Map();
      if (node.body?.assumes) {
        for (const assume of node.body.assumes) {
          const s =
            assume.tokens
              ?.map((e) => {
                return e.value;
              })
              .join(' ') || '';
          bodyAssumesStrMap.set(s, assume);
        }
      }
      for (const [key, value] of node.cumulatedAssumes) {
        if (bodyAssumesStrMap.has(key)) {
          continue;
        }
        this.generateSuggestionForDiff(node, value);
      }
      const preSuggestions: Array<string> = [];
      for (const [key, value] of bodyAssumesStrMap) {
        if (!node.cumulatedAssumes.has(key) && value.tokens) {
          const head = value.tokens[0].value;
          if (!(head === 'diffss' || head === 'diffsw' || head === 'diffsc')) {
            continue;
          }
          const targetStr = node.body?.target?.tokens?.map((e) => e.value).join(' ');
          const assumeStr = value.tokens?.map((e) => e.value).join(' ');
          preSuggestions.push(`a1ii ${targetStr}`);
          preSuggestions.push(`     ${assumeStr}`);
        }
      }
      if (preSuggestions.length > 0) {
        node.preSuggestions = preSuggestions;
      }
    }
  }
  private generateSuggestionForDiff(node: Node, diffOpNode: OpNode | undefined) {
    if (diffOpNode === undefined) {
      return;
    }
    if (node.suggestions === undefined) {
      node.suggestions = [];
    }
    if (!(diffOpNode.children && diffOpNode.children.length === 2)) {
      return;
    }
    const rootName = diffOpNode.definition?.name?.value;
    if (rootName !== 'diffsw' && rootName !== 'diffsc' && rootName !== 'diffss') {
      return;
    }
    const leftOpNode = diffOpNode.children[0];
    const rightOpNode = diffOpNode.children[1];
    this.generateSuggestionForDiffDFS(node, leftOpNode, rightOpNode);

    if (node.suggestions && node.suggestions.length > 1) {
      const suggestionSet: Set<string> = new Set();
      const nextSuggestions: Array<string> = [];
      for (let i = node.suggestions.length - 1; i >= 0; i--) {
        const suggestion = node.suggestions[i];
        if (!suggestionSet.has(suggestion)) {
          suggestionSet.add(suggestion);
          nextSuggestions.push(suggestion);
        }
      }
      if (node.suggestions.length > nextSuggestions.length) {
        nextSuggestions.reverse();
        node.suggestions = nextSuggestions;
      }
    }
    return;
  }
  private generateSuggestionForDiffDFS(node: Node, leftOpNode: OpNode, rightOpNode: OpNode) {
    if (leftOpNode === undefined || rightOpNode === undefined) {
      return;
    }
    const leftStr = opNodeToString(leftOpNode);
    const rightStr = opNodeToString(rightOpNode);
    const rightChildrenStr = rightOpNode.children
      ?.map((e) => {
        return opNodeToString(e);
      })
      .join(' ');
    if (leftOpNode.definition?.nodeType === NodeType.CONST_DEF) {
      const rightType = rightOpNode.definition?.type?.value || 's';
      const suggestion = `diff.${leftStr}.${rightType[0]} ${rightStr}`;
      node.suggestions?.push(suggestion);
    } else if (rightOpNode.children === undefined || rightOpNode.children.length === 0) {
      if (rightOpNode.definition?.nodeType === NodeType.CONST_DEF) {
        if (rightOpNode.definition.type?.value === 'setvar') {
          node.suggestions?.push(`diffss.ex ${leftStr} ${rightStr}`);
        }
        node.suggestions?.push(`diff.${rightOpNode.definition.name?.value}.s ${leftStr}`);
      } else if (rightOpNode.definition?.type?.value === 'setvar' && leftStr > rightStr) {
        node.suggestions?.push(`diffss.ex ${leftStr} ${rightStr}`);
      }
    } else {
      if (rightOpNode.definition?.name?.value) {
        const suggestion = `diff.${rightOpNode.definition.name.value} ${leftStr} ${rightChildrenStr}`;
        node.suggestions?.push(suggestion);
      }
      if (rightOpNode.children) {
        for (const child of rightOpNode.children) {
          this.generateSuggestionForDiffDFS(node, leftOpNode, child);
        }
      }
    }
  }
  private generateDiffAxioms(defNodes: Array<DefNode>): Array<string> {
    const diffAxioms: Array<string> = [];
    diffAxioms.push('axiom diffss.ex (setvar s0, setvar s1) { |- diffss s0 s1 -| diffss s1 s0 }');

    for (const defNode of defNodes) {
      if (defNode.nodeType === NodeType.CONST_DEF) {
        if (defNode.type?.value && defNode.name?.value) {
          if (defNode.type.value === 'setvar') {
            diffAxioms.push(`axiom diff.${defNode.name.value}.s (setvar s0) { |- diffss ${defNode.name.value} s0 }`);
            diffAxioms.push(`axiom diff.${defNode.name.value}.c (class c0) { |- diffsc ${defNode.name.value} c0 }`);
            diffAxioms.push(`axiom diff.${defNode.name.value}.w (wff w0) { |- diffsw ${defNode.name.value} w0 }`);
          } else {
            diffAxioms.push(
              `axiom diff.${defNode.name.value}.s (setvar s0) { |- diffs${defNode.type.value[0]} s0 ${defNode.name.value} }`,
            );
          }
        }
      } else if (defNode.nodeType === NodeType.PROP_DEF) {
        if (defNode.type?.value && defNode.name?.value) {
          const argDefStr = defNode.params
            ?.map((param) => {
              return `${param.type?.value} ${param.name?.value}`;
            })
            .join(', ');
          diffAxioms.push(`axiom diff.${defNode.name?.value} (setvar sBase, ${argDefStr}) {`);
          const argStr = defNode.params
            ?.map((param) => {
              return param.name?.value;
            })
            .join(' ');
          diffAxioms.push(`  |- diffs${defNode.type.value[0]} sBase ${defNode.name.value} ${argStr}`);
          defNode.params?.forEach((param) => {
            if (param.type?.value && param.name?.value) {
              diffAxioms.push(`  -| diffs${param.type?.value[0]} sBase ${param.name.value}`);
            }
          });
          diffAxioms.push('}');
        }
      }
    }
    return diffAxioms;
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
    this.parseProofCumulatedInfo(node);
    defNode.cumulatedAssumes = node.cumulatedAssumes;
    defNode.cumulatedTarget = node.cumulatedTarget;
  }

  private parseProofCumulatedInfo(node: Node) {
    const cumulatedAssumes: Map<string, OpNode> = new Map();
    let cumulatedTarget: OpNode | undefined;

    const opTrees = node.opTrees;
    if (opTrees === undefined) {
      return;
    }
    for (const opTree of opTrees) {
      if (opTree.target === undefined) {
        continue;
      }
      if (cumulatedTarget === undefined) {
        cumulatedTarget = opTree.target;
      } else {
        const targetStr = opNodeToString(opTree.target);
        if (cumulatedAssumes.has(targetStr)) {
          cumulatedAssumes.delete(targetStr);
        }
      }
      opTree.cumulatedTarget = cumulatedTarget;

      if (opTree.assumes === undefined) {
        continue;
      }
      for (const assume of opTree.assumes) {
        const assumeStr = opNodeToString(assume);
        if (!cumulatedAssumes.has(assumeStr)) {
          cumulatedAssumes.set(assumeStr, assume);
        }
      }
      opTree.cumulatedAssumes = new Map(cumulatedAssumes);
    }
    node.cumulatedAssumes = cumulatedAssumes;
    node.cumulatedTarget = cumulatedTarget;
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
