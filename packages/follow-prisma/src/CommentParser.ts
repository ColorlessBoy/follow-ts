const globalAliasMap: Map<string, string> = new Map([
  ['c0', 'emptycls'],
  ['cvv', 'universe'],
  ['df-v', 'df-universe'],
  ['cc0', 'nat0'],
  ['c1', 'nat1'],
  ['c2', 'nat2'],
  ['c3', 'nat3'],
  ['c4', 'nat4'],
  ['c5', 'nat5'],
  ['c6', 'nat6'],
  ['c7', 'nat7'],
  ['c8', 'nat8'],
  ['c9', 'nat9'],
  ['vx', 'x'],
  ['vy', 'y'],
  ['vf', 'f'],
  ['vg', 'g'],
]);

class CommentBlock {
  content: string;
  type: number;
  theorems?: string[];
  title?: string;

  constructor(comment: string[]) {
    this.type = -1;
    if (comment[0] === '###############################################################################') {
      this.type = 1;
      let idx = 1;
      const titles: string[] = [];
      while (comment[idx] !== '###############################################################################') {
        titles.push(comment[idx]);
        idx++;
      }
      this.title = titles.join(' ');
      comment = comment.slice(idx + 1);
    } else if (comment[0] === '#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#') {
      this.type = 2;
      let idx = 1;
      const titles: string[] = [];
      while (comment[idx] !== '#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#*#') {
        titles.push(comment[idx]);
        idx++;
      }
      this.title = titles.join(' ');
      comment = comment.slice(idx + 1);
    } else if (comment[0] === '=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=') {
      this.type = 3;
      let idx = 1;
      const titles: string[] = [];
      while (comment[idx] !== '=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=') {
        titles.push(comment[idx]);
        idx++;
      }
      this.title = titles.join(' ');
      comment = comment.slice(idx + 1);
    } else if (comment[0] === '-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-') {
      this.type = 4;
      let idx = 1;
      const titles: string[] = [];
      while (comment[idx] !== '-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-') {
        titles.push(comment[idx]);
        idx++;
      }
      this.title = titles.join(' ');
      comment = comment.slice(idx + 1);
    }
    this.content = comment.join(' ');
  }
}

export class MarkdownBlock {
  type: number;
  title: string;
  content: string;
  theorems: string[];
  children: MarkdownBlock[];

  constructor(commentBlock?: CommentBlock, defaultType: number = -1, defaultTitle: string = '') {
    this.type = commentBlock?.type || defaultType;
    this.title = commentBlock?.title || defaultTitle;
    this.content = commentBlock?.content || '';
    this.theorems = [];
    this.children = [];
  }

  public addTheorem(theorem: string) {
    this.theorems.push(theorem);
  }
}

export class CommentParser {
  commentBlocks: CommentBlock[];

  constructor() {
    this.commentBlocks = [];
  }

  public toMarkdown(bookName: string): MarkdownBlock {
    const result: MarkdownBlock[] = [new MarkdownBlock(undefined, 0, bookName)];
    this.commentBlocks.forEach((block) => {
      if (block.type >= 0) {
        result.push(new MarkdownBlock(block));
      } else if (block.theorems) {
        const lastMarkdownBlock = result[result.length - 1];
        if (lastMarkdownBlock) {
          let theorems = lastMarkdownBlock.theorems;
          if (theorems === undefined) {
            theorems = [];
            lastMarkdownBlock.theorems = theorems;
          }
          theorems.push(...block.theorems);
        }
      }
    });
    const stack: MarkdownBlock[] = [];
    for (const block of result) {
      if (block.title === 'Inferences for assisting proof development') {
        continue;
      }
      let top = stack.pop();
      while (top && top.type >= block.type) {
        top = stack.pop();
      }
      if (top) {
        top.children.push(block);
        stack.push(top);
      }
      stack.push(block);
    }
    return stack[0];
  }

  private addTheorem(theorem: string) {
    if (this.commentBlocks.length > 0) {
      const lastCommentBlock = this.commentBlocks[this.commentBlocks.length - 1];
      let theoremList = lastCommentBlock.theorems;
      if (!theoremList) {
        theoremList = [];
        lastCommentBlock.theorems = theoremList;
      }
      theoremList.push(globalAliasMap.get(theorem) || theorem);
    }
  }

  public parseInput(input: string) {
    const words = input.split(/[ \n]+/g);
    let idx = 0;
    while (idx < words.length) {
      let word = words[idx];
      idx++;
      if (word === '$(') {
        const comment = [];
        while (idx < words.length && (word = words[idx]) != '$)') {
          idx++;
          comment.push(word);
        }
        this.commentBlocks.push(new CommentBlock(comment));
      } else if (word[0] !== '$') {
        const nextWord = words[idx];
        if (nextWord === '$p' || nextWord === '$a') {
          this.addTheorem(word);
        }
      }
    }
    this.commentBlocks = this.commentBlocks.filter((block) => {
      return block.type !== undefined || block.theorems != undefined;
    });
  }
}
