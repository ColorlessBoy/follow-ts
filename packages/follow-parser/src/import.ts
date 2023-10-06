import Parser from './parser';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { Error, ImportNode, ParserOptions } from './types';

export default class ImportParser {
  documentMap: Map<string, Parser> = new Map();

  private checkExistsForImportNode(folderPath: string, node: ImportNode) {
    if (node.error) {
      return;
    }
    const importPath = node.value?.value;
    if (importPath) {
      const absPath = path.resolve(path.join(folderPath, importPath.slice(1, -1)));
      node.absPath = absPath;
      if (!existsSync(absPath)) {
        node.error = Error.ImportFileNotExist;
      } else {
        this.parseFile(absPath); // Does not need parserOptions, currently.
      }
    }
  }

  public parseFile(filePath: string, parserOptions?: ParserOptions) {
    const folderPath = path.dirname(filePath);
    const absPath = path.resolve(filePath);
    if (!this.documentMap.has(absPath) && existsSync(absPath)) {
      const input = readFileSync(filePath, 'utf-8');
      const parse = new Parser(input, parserOptions);
      parse.getNodes();
      this.documentMap.set(absPath, parse);
      for (const importNode of parse.importNodes) {
        this.checkExistsForImportNode(folderPath, importNode);
      }
    }
  }
}
