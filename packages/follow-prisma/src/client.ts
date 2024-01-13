import { PrismaClient, setmm_followblock } from '@prisma/client';
import { Absurd, AxiomTheorem, Parser, Prop, Scanner, read } from './parser';
import { randomUUID } from 'node:crypto';
import { CommentParser, MarkdownBlock } from './CommentParser';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

type StmtBlock = {
  origin: string;
  pretty: string;
};

type JsonProofNodeItem = {
  name: string;
  args: StmtBlock[];
  target: StmtBlock;
  assumptions: StmtBlock[];
  cumulatedTarget: StmtBlock;
  cumulatedAssumptions: StmtBlock[];
};
export class FollowPrismaClient {
  private client: PrismaClient;

  constructor() {
    this.client = new PrismaClient();
  }

  public async getAllConstProps(): Promise<string> {
    try {
      await this.client.$connect();
      console.log('Connected to the database.');
    } catch (error) {
      console.error('Failed to connect to the database.', error);
      return Promise.reject(error);
    }
    const propList = await this.client.setmm_followblock.findMany({
      where: {
        bType: {
          equals: 'prop',
        },
      },
      orderBy: {
        bIdx: 'asc',
      },
      select: {
        name: true,
        target: true,
      },
    });
    const propStrList = propList.map((prop) => {
      return `${prop.name} : ${prop.target}`;
    });

    const constList = await this.client.setmm_followblock.findMany({
      where: {
        bType: {
          equals: 'const',
        },
      },
      orderBy: {
        bIdx: 'asc',
      },
      select: {
        name: true,
        target: true,
      },
    });
    const constStrList = constList.map((c) => {
      return `${c.name} : ${c.target}`;
    });

    await this.client.$disconnect();
    return [...propStrList, ...constStrList].join('\n');
  }

  private formatName(str: string) {
    return str
      .toLowerCase()
      .replace(/[:. /-]+/g, '-')
      .replace(/["',()]+/g, '');
  }

  private followBlockToMarkdown(block: setmm_followblock): string {
    if (block.bType === 'type') {
      return ['```follow', `type ${block.name}`, '```'].join('\n');
    } else if (block.bType === 'const') {
      const content = [`const ${block.type} ${block.name}`];
      if (block.target) {
        const stmt = ' { ' + block.target.replace(/ /g, '') + ' }';
        content.push(stmt);
      }
      return ['```follow', content.join(''), '```'].join('\n');
    } else if (block.bType === 'prop') {
      const params = block.params.replace(/,/g, ', ');
      const content = [`prop ${block.type} ${block.name}(${params})`];
      if (block.target) {
        const stmt = ' { ' + block.target.replace(/\[ /g, '[').replace(/ \]/g, ']') + ' }';
        content.push(stmt);
      }
      return ['```follow', content.join(''), '```'].join('\n');
    } else if (block.bType === 'absurd') {
      const params = block.params.replace(/,/g, ', ');
      const head = [`absurd ${block.type} ${block.name}(${params})`];
      const targetOrigin = '|-| ' + block.target.replace(/ /g, '').replace(/,/g, ', ');
      const targetPretty = 'ʜ ' + block.propTarget.replace(/\[ /g, '[').replace(/ \]/g, ']');
      const content = [
        '::: code-tabs#follow',
        '@tab:active pretty',
        '```follow',
        head + ' { ' + targetPretty + ' }',
        '```',
        '@tab:active origin',
        '```follow',
        head + ' { ' + targetOrigin + ' }',
        '```',
        ':::',
      ];
      return content.join('\n');
    } else if (block.bType === 'axiom') {
      const params = block.params.replace(/,/g, ', ');
      const head = `axiom ${block.name}(${params})`;
      const bodyOrigin = ['  |- ' + block.target.replace(/ /g, '').replace(/,/g, ', ')];
      const bodyPretty = ['  ⊢ ' + block.propTarget.replace(/\[ /g, '[').replace(/ \]/g, ']')];
      if (block.assumptions.length > 0) {
        const assumeOrigin = block.assumptions.split(';').map((a) => {
          return '  -| ' + a.replace(/ /g, '').replace(/,/g, ', ');
        });
        bodyOrigin.push(...assumeOrigin);
        const assumePretty = block.propAssumptions.split(';').map((a) => {
          return '  ⊣ ' + a.replace(/\[ /g, '[').replace(/ \]/g, ']');
        });
        bodyPretty.push(...assumePretty);
      }
      const content = [
        '::: code-tabs#follow',
        '@tab:active pretty',
        '```follow',
        head + ' {',
        ...bodyPretty,
        '}',
        '```',
        '@tab origin',
        '```follow',
        head + ' {',
        ...bodyOrigin,
        '}',
        ':::',
      ];
      return content.join('\n');
    } else if (block.bType === 'thm') {
      const params = block.params.replace(/,/g, ', ');
      const head = `thm ${block.name}(${params})`;
      const bodyOrigin = ['  |- ' + block.target.replace(/ /g, '').replace(/,/g, ', ')];
      const bodyPretty = ['  ⊢ ' + block.propTarget.replace(/\[ /g, '[').replace(/ \]/g, ']')];
      if (block.assumptions.length > 0) {
        const assumeOrigin = block.assumptions.split(';').map((a) => {
          return '  -| ' + a.replace(/ /g, '').replace(/,/g, ', ');
        });
        bodyOrigin.push(...assumeOrigin);
        const assumePretty = block.propAssumptions.split(';').map((a) => {
          return '  ⊣ ' + a.replace(/\[ /g, '[').replace(/ \]/g, ']');
        });
        bodyPretty.push(...assumePretty);
      }
      const proofStmts: JsonProofNodeItem[] = JSON.parse(block.proofStmts);
      const proofOrigin = [];
      const proofPretty = [];
      for (const block of proofStmts) {
        proofOrigin.push(
          '  ' +
            block.name +
            '(' +
            block.args.map((a) => a.origin.replace(/ /g, '').replace(/,/g, ', ')).join(', ') +
            ')',
        );
        proofPretty.push(
          '  ' +
            block.name +
            '(' +
            block.args.map((a) => a.pretty.replace(/\[ /g, '[').replace(/ \]/g, ']')).join(', ') +
            ')',
        );
      }
      const originDetails: string[] = [];
      const prettyDetails: string[] = [];
      for (const block of proofStmts) {
        const originStmt =
          block.name + '(' + block.args.map((a) => a.origin.replace(/ /g, '').replace(/,/g, ', ')).join(', ') + ')';
        const originTarget = '|- ' + block.target.origin.replace(/ /g, '').replace(/,/g, ', ');
        const originAssume = block.assumptions.map((a) => {
          return '-| ' + a.origin.replace(/ /g, '').replace(/,/g, ', ');
        });
        const originCTarget = '|- ' + block.cumulatedTarget.origin.replace(/ /g, '').replace(/,/g, ', ');
        const originCAssume = block.assumptions.map((a) => {
          return '-| ' + a.origin.replace(/ /g, '').replace(/,/g, ', ');
        });
        const originBlock = [
          `<details><summary>${originStmt}</summary>`,
          '<table><thead><tr>Current State</tr><tr>Cumulated State</tr></thead><tbody>',
          "<tr><pre class='language-follow'><code>",
          [originTarget, ...originAssume].join('\n'),
          '</code></pre></tr>',
          "<tr><pre class='language-follow'><code>",
          [originCTarget, ...originCAssume].join('\n'),
          '</code></pre></tr>',
          '</tbody></table>',
          '</details>',
        ].join('\n');

        const prettyStmt =
          block.name + '(' + block.args.map((a) => a.pretty.replace(/\[ /g, '[').replace(/ \]/g, ']')).join(', ') + ')';
        const prettyTarget = '⊢ ' + block.target.pretty.replace(/ /g, '').replace(/,/g, ', ');
        const prettyAssume = block.assumptions.map((a) => {
          return '⊣ ' + a.pretty.replace(/\[ /g, '[').replace(/ \]/g, ']');
        });
        const prettyCTarget = '⊢ ' + block.cumulatedTarget.pretty.replace(/\[ /g, '[').replace(/ \]/g, ']');
        const prettyCAssume = block.assumptions.map((a) => {
          return '⊣ ' + a.pretty.replace(/\[ /g, '[').replace(/ \]/g, ']');
        });
        const prettyBlock = [
          `<details><summary>${prettyStmt}</summary>`,
          '<table><thead><tr>Current State</tr><tr>Cumulated State</tr></thead><tbody>',
          "<tr><pre class='language-follow'><code>",
          [prettyTarget, ...prettyAssume].join('\n'),
          '</code></pre></tr>',
          "<tr><pre class='language-follow'><code>",
          [prettyCTarget, ...prettyCAssume].join('\n'),
          '</code></pre></tr>',
          '</tbody></table>',
          '</details>',
        ].join('\n');
        originDetails.push(originBlock);
        prettyDetails.push(prettyBlock);
      }
      const content = [
        '::: code-tabs#follow',
        '@tab:active pretty',
        '```follow',
        head + ' {',
        ...bodyPretty,
        '} = {',
        ...proofPretty,
        '}',
        '```',
        '@tab origin',
        '```follow',
        head + ' {',
        ...bodyOrigin,
        '} = {',
        ...proofOrigin,
        '}',
        ':::',
      ];

      /*
        '::: tabs#follow',
        '@tab:active pretty',
        prettyDetails.join('\n'),
        '@tab origin',
        originDetails.join('\n'),
        ':::',
      */
      return content.join('\n');
    }
    return '';
  }

  public async generateMdFiles(
    book: MarkdownBlock,
    baseDir: string,
    outputDir: string,
    index: number = 0,
    blockPathMap: Map<string, string>,
  ) {
    const head = index > 0 ? `${index}-` : '';
    const bookName = head + this.formatName(book.title);
    const bookDir = outputDir + bookName + '/';
    const absBookDir = baseDir + bookDir;
    const absFilePath = absBookDir + `README.md`;
    const filePath = outputDir + bookName;

    if (!existsSync(absBookDir)) {
      mkdirSync(absBookDir);
    }

    const fileContent = [
      '---',
      'title: "' + book.title.replace(/"/g, '\\"') + '"',
      'dir.link: true',
      'dir.index: true',
      `dir.order: ${index === 0 ? 1 : index}`,
      '---',
      '',
      book.content,
      '',
    ];

    if (book.theorems.length > 0) {
      for (const name of book.theorems) {
        blockPathMap.set(name, filePath);
        try {
          const block = await this.client.setmm_followblock.findFirst({ where: { name: name } });
          if (block) {
            fileContent.push(`## ${name}`, block.comment + '  ');
            fileContent.push(this.followBlockToMarkdown(block));
            fileContent.push('');
            /*
            if (block.parent) {
              const links: string[] = [];
              block.parent.split(',').map((p) => {
                const parentLink = blockPathMap.get(p)?.replace(/["',()]+/g, '');
                if (parentLink) {
                  links.push(`[${p}](${parentLink}.md#${p})`);
                }
              });
              fileContent.push('::: details Parent Blocks', links.join('\n'), ':::');
            }
            */
            if (block.children) {
              /*
              const links: string[] = [];
              block.children.split(',').map((c) => {
                const childLink = blockPathMap.get(c)?.replace(/["',()]+/g, '');
                if (childLink) {
                  links.push(`[${c}](${childLink}.md#${c})`);
                }
              });
              fileContent.push('::: details Child Blocks', links.join('\n'), ':::');
              */
              fileContent.push('::: details Child Blocks', block.children, ':::');
            }
          }
        } catch (e) {
          console.log(e);
        }
      }
    }
    writeFileSync(absFilePath, fileContent.join('\n'));
    for (let idx = 0; idx < book.children.length; idx++) {
      const subBook = book.children[idx];
      if (index === 0) {
        await this.generateMdFiles(subBook, baseDir + bookDir, '', idx + 1, blockPathMap);
      } else {
        await this.generateMdFiles(subBook, baseDir, bookDir, idx + 1, blockPathMap);
      }
    }
  }

  public async toMarkdown(input: string, bookName: string): Promise<MarkdownBlock> {
    try {
      await this.client.$connect();
      console.log('Connected to the database.');
    } catch (error) {
      console.error('Failed to connect to the database.', error);
      return Promise.reject(error);
    }
    const commentParser = new CommentParser();
    commentParser.parseInput(input);
    const markdownBlockOrigin = commentParser.toMarkdown(bookName);
    const stack: MarkdownBlock[] = [markdownBlockOrigin];
    let lastBIdx: number = -1;
    while (stack.length > 0) {
      const markdownBlock = stack.pop();
      if (markdownBlock && markdownBlock.theorems.length > 0) {
        let lastName = markdownBlock.theorems[markdownBlock.theorems.length - 1];
        if (lastName === 'wi') {
          lastName = 'diff.hc20.w';
        }
        const lastData = await this.client.setmm_followblock.findFirst({ where: { name: lastName } });
        if (lastData) {
          const data = await this.client.setmm_followblock.findMany({
            where: { AND: [{ bIdx: { gt: lastBIdx } }, { bIdx: { lte: lastData.bIdx } }] },
            orderBy: { bIdx: 'asc' },
            select: { name: true },
          });
          lastBIdx = lastData.bIdx;
          markdownBlock.theorems = data.map((e) => e.name);
        }
      }
      if (markdownBlock && markdownBlock.children.length > 0) {
        const children = [...markdownBlock.children];
        children.reverse();
        stack.push(...children);
      }
    }
    await this.client.$disconnect();
    return markdownBlockOrigin;
  }

  public async addComments(input: string) {
    try {
      await this.client.$connect();
      console.log('Connected to the database.');
    } catch (error) {
      console.error('Failed to connect to the database.', error);
      return;
    }
    const commentParser = new CommentParser();
    commentParser.parseInput(input);
    for await (const commentBlock of commentParser.commentBlocks) {
      if (commentBlock.theorems !== undefined) {
        const comment = commentBlock.content;
        for await (const theorem of commentBlock.theorems) {
          try {
            await this.client.setmm_followblock.update({
              where: {
                name: theorem,
              },
              data: {
                comment: comment,
              },
            });
          } catch (error) {
            console.error(`${theorem} Not Found`, error);
          }
        }
      }
    }
    await this.client.$disconnect();
  }

  public async importFromFollow(inputFile: string, startParseProofIdx: number = 0, parentChildEnable: boolean = false) {
    try {
      await this.client.$connect();
      console.log('Connected to the database.');
    } catch (error) {
      console.error('Failed to connect to the database.', error);
      return;
    }
    await this.client.setmm_followblock.deleteMany({
      where: {
        bIdx: {
          gte: startParseProofIdx,
        },
      },
    });
    const scanner = new Scanner();
    const parser = new Parser('', startParseProofIdx, parentChildEnable);
    let idx = startParseProofIdx;
    const nameSet: Set<string> = new Set();
    await read(inputFile, async (chunk) => {
      scanner.scanNewInput(chunk);
      for (const token of scanner.outputTokens()) {
        parser.parseNextToken(token, false, false, false);
      }
      for (; idx < parser.blockOrder.length; idx++) {
        const name = parser.blockOrder[idx];
        if (nameSet.has(name)) {
          console.log(`duplicate ${name}`);
          continue;
        } else {
          nameSet.add(name);
        }
        if (parser.typeSet.has(name)) {
          await this.addType(idx, name);
          // } else if (parser.constMap.has(name)) {
          //   const type = parser.constMap.get(name);
          //   if (type) {
          //     await this.addConst(idx, type, name);
          //   }
        } else if (parser.propMap.has(name)) {
          const prop = parser.propMap.get(name);
          if (prop) {
            await this.addProp(idx, prop);
          }
        } else if (parser.absurdMap.has(name)) {
          const absurd = parser.absurdMap.get(name);
          if (absurd) {
            await this.addAbsurd(idx, absurd);
          }
        } else if (parser.axiomTheoremMap.has(name)) {
          const block = parser.axiomTheoremMap.get(name);
          if (block) {
            await this.addAxiomTheorem(idx, block);
          }
        }
      }
    });
    for await (const theorem of parser.axiomTheoremMap.values()) {
      try {
        await this.client.setmm_followblock.update({
          where: {
            name: theorem.name,
          },
          data: {
            children: theorem.children.join(','),
          },
        });
      } catch (error) {
        console.error(`${theorem} Not Found`, error);
      }
    }
    await this.client.$disconnect();
  }

  public async addType(blockIdx: number, name: string) {
    if (name === undefined || name.length === 0) {
      return;
    }
    await this.client.setmm_followblock.create({
      data: {
        id: randomUUID().replace(/-/g, ''),
        bIdx: blockIdx,
        bType: 'type',
        type: '',
        name: name,
        params: '',
        target: '',
        assumptions: '',
        propTarget: '',
        propAssumptions: '',
        proofStmts: '',
        parent: '',
        children: '',
        comment: '',
      },
    });
  }
  public async addConst(blockIdx: number, type: string, name: string) {
    if (type?.length > 0 && name?.length > 0) {
      const info = await this.client.setmm_followblock.create({
        data: {
          id: randomUUID().replace(/-/g, ''),
          bIdx: blockIdx,
          bType: 'const',
          type: type,
          name: name,
          params: '',
          target: '',
          assumptions: '',
          propTarget: '',
          propAssumptions: '',
          proofStmts: '',
          parent: '',
          children: '',
          comment: '',
        },
      });
      console.log(info);
    }
  }

  public async addAbsurd(blockIdx: number, absurd: Absurd) {
    await this.client.setmm_followblock.create({
      data: {
        id: randomUUID().replace(/-/g, ''),
        bIdx: blockIdx,
        bType: 'absurd',
        type: '',
        name: absurd.name,
        params: absurd.params.join(','),
        target: absurd.stmt.join(' '),
        assumptions: '',
        propTarget: absurd.propStmt,
        propAssumptions: '',
        proofStmts: '',
        parent: '',
        children: '',
        comment: '',
      },
    });
  }

  public async addProp(blockIdx: number, prop: Prop) {
    if (prop.params.length === 0) {
      await this.client.setmm_followblock.create({
        data: {
          id: randomUUID().replace(/-/g, ''),
          bIdx: blockIdx,
          bType: 'const',
          type: prop.type,
          name: prop.name,
          params: '',
          target: prop.stmt.join(''),
          assumptions: '',
          propTarget: '',
          propAssumptions: '',
          proofStmts: '',
          parent: '',
          children: '',
          comment: '',
        },
      });
    } else {
      await this.client.setmm_followblock.create({
        data: {
          id: randomUUID().replace(/-/g, ''),
          bIdx: blockIdx,
          bType: 'prop',
          type: prop.type,
          name: prop.name,
          params: prop.params.join(','),
          target: prop.stmt.join(' '),
          assumptions: '',
          propTarget: '',
          propAssumptions: '',
          proofStmts: '',
          parent: '',
          children: '',
          comment: '',
        },
      });
    }
  }
  public async addAxiomTheorem(blockIdx: number, block: AxiomTheorem) {
    if (block.proofNodes === undefined || block.proofNodes.length === 0) {
      // axiom
      await this.client.setmm_followblock.create({
        data: {
          id: randomUUID().replace(/-/g, ''),
          bIdx: blockIdx,
          bType: 'axiom',
          type: '',
          name: block.name,
          params: block.params.join(','),
          target: block.target,
          assumptions: block.assumptions.join(';'),
          propTarget: block.propTarget,
          propAssumptions: block.propAssumptions.join(';'),
          proofStmts: '',
          parent: '',
          children: '',
          comment: '',
        },
      });
    } else {
      // theorem
      const proofStmts = block.proofOpToStr();
      block.cleanProofNodes();
      await this.client.setmm_followblock.create({
        data: {
          id: randomUUID().replace(/-/g, ''),
          bIdx: blockIdx,
          bType: 'thm',
          type: '',
          name: block.name,
          params: block.params.join(','),
          target: block.target,
          assumptions: block.assumptions.join(';'),
          propTarget: block.propTarget,
          propAssumptions: block.propAssumptions.join(';'),
          proofStmts: proofStmts,
          parent: block.parent.join(','),
          children: '',
          comment: '',
        },
      });
    }
  }
}
