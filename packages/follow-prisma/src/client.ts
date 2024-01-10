import { PrismaClient, setmm_followblock } from '@prisma/client';
import { Absurd, AxiomTheorem, Parser, Prop, Scanner, read } from './parser';
import { randomUUID } from 'node:crypto';
import { CommentParser, MarkdownBlock } from './CommentParser';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

type Content = {
  title: string;
  children: Content[];
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
    return str.toLowerCase().replace(/[. /-]+/g, '-');
  }

  private followBlockToJson(block: setmm_followblock) {
    const assumePair: {
      origin: string;
      pretty: string;
    }[] = [];
    if (block.assumptions.length > 0) {
      const arr1 = block.assumptions.split(';');
      const arr2 = block.propAssumptions.split(';');
      arr1.forEach((a, idx) => {
        assumePair.push({
          origin: a,
          pretty: arr2[idx],
        });
      });
    }
    const obj = {
      bIdx: block.bIdx,
      bType: block.bType,
      type: block.type,
      name: block.name,
      params:
        block.params.length > 0
          ? block.params.split(',').map((e) => {
              const paramPair = e.split(' ');
              return {
                type: paramPair[0],
                name: paramPair[1],
              };
            })
          : [],
      target: {
        origin: block.target,
        pretty: block.propTarget,
      },
      assumptions: assumePair,
      proofStmts: block.proofStmts ? JSON.parse(block.proofStmts) : null,
      parent: block.parent.length > 0 ? block.parent.split(',') : [],
      children: block.children.length > 0 ? block.children.split(',') : [],
      comment: block.comment,
    };
    return obj;
  }

  public generateMdFiles(
    book: MarkdownBlock,
    baseDir: string,
    outputDir: string,
    index: number = 1,
    blockPathMap: Map<string, string>,
  ): Content {
    const bookName = `${index}-` + this.formatName(book.title);
    const bookDir = outputDir + bookName + '/';
    const absBookDir = baseDir + bookDir;
    if (!existsSync(absBookDir)) {
      mkdirSync(absBookDir);
    }

    const absFilePath = absBookDir + `${bookName}.md`;
    const fileContent = [
      '# ' + book.title,
      book.content,
      ...book.theorems.map((e) => `## ${e} \n <FollowBlock name='${e}' \\>`),
    ];
    writeFileSync(absFilePath, fileContent.join('\n'));

    if (book.theorems.length > 0) {
      const absTheoremDir = absBookDir + 'theorems/';
      if (!existsSync(absTheoremDir)) {
        mkdirSync(absTheoremDir);
      }
      book.theorems.forEach((name) => {
        blockPathMap.set(name, bookDir);
        this.client.setmm_followblock
          .findFirst({
            where: {
              name: name,
            },
          })
          .then((block) => {
            if (block) {
              const absBlockFileName = (absTheoremDir + block.name + '.json') as string;
              writeFileSync(absBlockFileName, JSON.stringify(this.followBlockToJson(block)));
            }
          });
      });
    }

    const content: Content = {
      title: bookName,
      children: [],
    };

    book.children.forEach((subBook, idx) => {
      const nextContent = this.generateMdFiles(subBook, baseDir, bookDir, idx + 1, blockPathMap);
      content.children.push(nextContent);
    });
    return content;
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
