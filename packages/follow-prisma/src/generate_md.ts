import fs from 'fs';
import { MarkdownBlock } from './CommentParser';

function formatName(str: string) {
  return str.toLowerCase().replace(/[. /-]+/g, '-');
}

export function generateMdFiles(book: MarkdownBlock, outputDir: string, index: number = 1) {
  const bookName = `${index}-` + formatName(book.title);
  const bookDir = outputDir + '/' + bookName;
  if (!fs.existsSync(bookDir)) {
    fs.mkdirSync(bookDir);
  }

  const filePath = bookDir + '/' + `${bookName}.md`;
  const fileContent = [
    '# ' + book.title,
    book.content,
    ...book.theorems.map((e, idx) => `## ${idx + 1}-${e} \n <FollowBlock name='${e}' \\>`),
  ];
  fs.writeFileSync(filePath, fileContent.join('\n'));

  book.children.forEach((subBook, idx) => {
    generateMdFiles(subBook, bookDir, idx + 1);
  });
}
