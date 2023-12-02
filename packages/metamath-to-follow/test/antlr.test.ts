import { expect, test } from 'vitest';
import { antlrParse } from '../src/antlr';

test('#1 Scanner', () => {
  // const text =
  //   ' ( ( ( ( N e. NN /\\ A e. ( EE ` N ) /\\ B e. ( EE ` N ) ) /\\ ( ( C e. ( EE ` N ) /\\ D e. ( EE ` N ) /\\ c e. ( EE ` N ) ) /\\ ( d e. ( EE ` N ) /\\ b e. ( EE ` N ) /\\ E e. ( EE ` N ) ) ) /\\ ( P e. ( EE ` N ) /\\ Q e. ( EE ` N ) /\\ R e. ( EE ` N ) ) ) /\\ ( ( ( ( A =/= B /\\ B =/= C /\\ C =/= c ) /\\ ( B Btwn <. A , C >. /\\ B Btwn <. A , D >. ) ) /\\ ( ( D Btwn <. A , c >. /\\ <. D , c >. Cgr <. C , D >. ) /\\ ( C Btwn <. A , d >. /\\ <. C , d >. Cgr <. C , D >. ) ) /\\ ( ( c Btwn <. A , b >. /\\ <. c , b >. Cgr <. C , B >. ) /\\ ( d Btwn <. A , b >. /\\ <. d , b >. Cgr <. D , B >. ) ) ) /\\ ( ( E Btwn <. C , c >. /\\ E Btwn <. D , d >. ) /\\ ( ( C Btwn <. c , P >. /\\ <. C , P >. Cgr <. C , d >. ) /\\ ( C Btwn <. d , R >. /\\ <. C , R >. Cgr <. C , E >. ) /\\ ( R Btwn <. P , Q >. /\\ <. R , Q >. Cgr <. R , P >. ) ) ) ) ) -> D = d ) ';
  const text = ' ( E! ( x wl-in A ) ph <-> ( E. ( x wl-in A ) ph /\\ E* ( x wl-in A ) ph ) ) ';
  const [tree, error] = antlrParse(text);
  if (error) {
    console.log(error);
  }
  expect(tree.length).toBe(48);
});
