import Parser from './parser';
import path from 'path';
import { existsSync, readFileSync } from 'node:fs';
import { DefNode, Error, ParserOptions } from './types';
import { createHash } from 'node:crypto';

interface CompileNode {
  absPath: string;
  md5Round1: string;
  parse: Parser;
  parents?: Array<string>;
  children?: Array<string>;
  md5Round2?: string;
  defNodeMap?: Map<string, DefNode>;
}

export default class Compiler {
  documentMap: Map<string, CompileNode> = new Map();

  public parseFileRound1(filePath: string, parserOptions?: ParserOptions): CompileNode | undefined {
    const folderPath = path.dirname(filePath);
    const absPath = path.resolve(filePath);
    if (!existsSync(absPath)) {
      return;
    }
    const input = readFileSync(filePath, 'utf-8');
    const md5 = createHash('md5').update(input).digest('hex');
    const compilerInfo = this.documentMap.get(absPath);
    if (compilerInfo && compilerInfo.md5Round1 === md5) {
      return;
    }
    const parse = new Parser(input, parserOptions);
    const compileNode: CompileNode = {
      absPath: absPath,
      md5Round1: md5,
      parse: parse,
    };
    parse.getNodes();
    this.documentMap.set(absPath, compileNode);
    for (const importNode of parse.importNodes) {
      if (importNode.error === undefined) {
        const importPath = importNode.name?.value;
        if (importPath) {
          const absPath = path.resolve(path.join(folderPath, importPath.slice(1, -1)));
          if (!existsSync(absPath)) {
            importNode.error = Error.ImportFileNotExist;
          } else {
            if (compileNode.parents === undefined) {
              compileNode.parents = [absPath];
            } else {
              compileNode.parents.push(absPath);
            }
            this.parseFileRound1(absPath);
          }
        }
      }
    }
    return compileNode;
  }

  public parseFileRound2(filePath: string, parserOptions?: ParserOptions) {
    const compileInfo = this.parseFileRound1(filePath, parserOptions);
    if (compileInfo === undefined) {
      return;
    }
    const dfsTrajectory = this.buildDfsTrajectory(compileInfo);
    for (const compileNode of dfsTrajectory.reverse()) {
      if (compileNode.md5Round2 && compileNode.md5Round2 === compileNode.md5Round1) {
        // This file has not been changed after last parseFileRound2().
        // Lazy update for duplicate name checking.
        continue;
      }
      compileNode.defNodeMap = new Map();
    }
  }

  private buildDfsTrajectory(compileInfo: CompileNode): Array<CompileNode> {
    // build dfs trajectory
    const inputStack: Array<CompileNode> = [compileInfo];
    const inputRecord: Set<string> = new Set();
    const outputStack: Array<CompileNode> = [];
    while (inputStack.length > 0) {
      const inputNode = inputStack.pop();
      if (inputNode === undefined) {
        continue;
      }
      inputRecord.add(inputNode.absPath);
      outputStack.push(inputNode);
      const parents = inputNode.parents;
      if (parents) {
        for (const parent of parents) {
          if (inputRecord.has(parent)) {
            continue;
          }
          const parentCompileNode = this.documentMap.get(parent);
          if (parentCompileNode) {
            inputStack.push(parentCompileNode);
          }
        }
      }
    }
    return outputStack;
  }
}
