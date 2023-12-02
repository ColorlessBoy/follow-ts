import {
  ANTLRErrorListener,
  CharStreams,
  CommonTokenStream,
  ParserRuleContext,
  RecognitionException,
  Recognizer,
} from 'antlr4ts';
import { AntlrMetamathParser } from './antlr/AntlrMetamathParser';
import { AntlrMetamathLexer } from './antlr/AntlrMetamathLexer';
import { AntlrMetamathListener } from './antlr/AntlrMetamathListener';
import { ParseTreeWalker } from 'antlr4ts/tree/ParseTreeWalker';

export function antlrParse(text: string): [string, string[]] {
  const inputStream = CharStreams.fromString(text);
  const lexer = new AntlrMetamathLexer(inputStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new AntlrMetamathParser(tokenStream);
  const syntaxErrorListener = new SyntaxErrorListener();
  parser.addErrorListener(syntaxErrorListener);
  parser.buildParseTree = true;
  const root = parser.root();
  const listener = new TransformTreeListener();
  ParseTreeWalker.DEFAULT.walk(listener, root);
  const rulenames = parser.ruleNames;
  const typeSet = new Set(['wff', 'setvar', 'class', 'root']);
  const stmt = listener.statement
    .map((idx) => {
      const rulename = rulenames[idx].replace(/_b_/g, '-').replace(/_x_/g, '.');
      return rulename;
    })
    .filter((e) => {
      return !typeSet.has(e);
    })
    .join(' ');
  return [stmt, syntaxErrorListener.diagnosticList];
}

class TransformTreeListener implements AntlrMetamathListener {
  public statement: number[] = [];
  public enterEveryRule(ctx: ParserRuleContext): void {
    this.statement.push(ctx.ruleIndex);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class SyntaxErrorListener implements ANTLRErrorListener<any> {
  public diagnosticList: string[] = [];
  public syntaxError<T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _recognizer: Recognizer<T, any>,
    offendingSymbol: T,
    line: number,
    charPositionInLine: number,
    msg: string,
    _e: RecognitionException | undefined,
  ): void {
    this.diagnosticList.push(`line ${line} pos ${charPositionInLine} : ${msg} \n ${_e?.message}\n`);
  }
}
