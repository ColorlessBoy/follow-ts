import { Parser } from './parser2';

class Rule {
  label: string;
  lhs: string;
  rhs: string[];
  constructor(label: string, lhs: string, rhs: string[]) {
    this.label = label;
    this.lhs = lhs;
    this.rhs = rhs;
  }
}

export class Translator {
  public parser: Parser;
  public grammar: Rule[];
  public typeSet: Set<string>;

  constructor(fileList: string[], quick: boolean = false) {
    this.parser = new Parser(fileList, quick);
    this.grammar = [];
    this.typeSet = new Set();
  }

  public *toFollow() {
    // this.parser.parseAllBlocks();

    yield 'type wff setvar class\n';

    for (const block of this.parser.parseNextBlockV2()) {
      const content: string[] = [];
      const axiom = this.parser.propAxiomMap.get(block) || this.parser.axiomMap.get(block);
      if (axiom) {
        const args = axiom.getFollowArgs();
        if (axiom.type === '|-') {
          content.push(`axiom ${axiom.label}(${args}) {`);
          content.push(...axiom.getFollowBody());
          content.push('}');
        } else {
          if (args.length > 0) {
            content.push(`prop ${axiom.type} ${axiom.label}(${args}) // ${axiom.value}`);
          } else {
            content.push(`const ${axiom.type} ${axiom.label} // ${axiom.value}`);
          }
        }
      } else {
        const theorem = this.parser.theoremMap.get(block);
        if (theorem) {
          if (
            theorem.label === 'weq' ||
            theorem.label === 'wel' ||
            theorem.label === 'idi' ||
            theorem.label === 'a1ii'
          ) {
            continue;
          }
          const args = theorem.getFollowArgs();
          content.push(`thm ${theorem.label}(${args}) {`);
          content.push(...theorem.getFollowBody());
          content.push('} = {');
          content.push(theorem.proof);
          content.push('}');
        }
      }
      yield content.join('\n') + '\n';
    }
  }

  public buildGrammar() {
    this.parser.parseAllBlocks();

    this.grammar = [];
    const floatVarSet: Set<string> = new Set();
    this.typeSet = new Set();
    this.parser.frameStack.stack.forEach((frame) => {
      frame.floats.forEach((float) => {
        if (!floatVarSet.has(float.value)) {
          floatVarSet.add(float.value);
          this.grammar.push(new Rule(float.label, float.type, [float.value]));
          this.typeSet.add(float.type);
        }
      });
    });
    for (const label of this.parser.blockOrder) {
      if (label === 'weq' || label === 'wel') {
        // conflict
        continue;
      }
      const prop = this.parser.propAxiomMap.get(label);
      if (prop) {
        const targetBody = prop.absValue.split(' ');
        this.grammar.push(new Rule(prop.label, prop.type, targetBody));
        this.typeSet.add(prop.type);
      }
    }
  }

  public generateAntlrGrammar(grammarName: string): string {
    // return antlr format grammar file .g4
    if (this.grammar.length === 0) {
      this.buildGrammar();
    }

    const head: string = [
      `grammar ${grammarName};\n`,
      'WS: [ \\t]+ -> skip;',
      "NL: ('\\r\\n' | '\\r' | '\\n') -> skip;",
      "SC: (';') -> skip;",
      '\nroot: wff;',
    ].join(' \n');

    const result: string[] = [head];
    for (const t of this.typeSet) {
      const labelList: string[] = [];
      for (const rule of this.grammar) {
        if (rule.lhs === t) {
          const tmp: string[] = [];
          for (const op of rule.rhs) {
            if (this.typeSet.has(op)) {
              tmp.push(op);
            } else {
              const rawOp = op.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
              tmp.push(`'${rawOp}'`);
            }
          }
          const transLabel = rule.label.replace(/-/g, '_b_').replace(/\./g, '_x_');
          result.push(`${transLabel} : ${tmp.join(' ')};`);
          labelList.push(transLabel);
        }
      }
      result.push(`${t} : ${labelList.join(' | ')};`);
    }
    return result.join(' \n');
  }
}
