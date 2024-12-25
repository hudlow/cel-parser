import * as fs from "fs";

import { parse } from "../index.ts";
import {
  toDebugString,
  KindAdorner,
} from "../utility/debug/to-debug-string.ts";

const tests = JSON.parse(
  fs.readFileSync(`${__dirname}/data/parser.json`, "utf8"),
);

const skip: string[] = [
  // should fail
  "has(m)",
  "[].existsOne(__result__, __result__)",
  "m.map(__result__, __result__)",
  "m.filter(__result__, false)",
  "m.filter(a.b, false)",

  // Optional syntax not yet supported
  "a.?b[?0] && a[?c]",
  "{?'key': value}",
  "[?a, ?b]",
  "[?a[?b]]",
  "Msg{?field: value}",

  // Logic balancing not (yet?) supported
  "a || b || c || d || e || f ",
  "a && b && c && d && e && f && g",
  "a && b && c && d || e && f && g && h",

  // Size / depth checks not yet supported
  "0xFFFFFFFFFFFFFFFFF",
  "0xFFFFFFFFFFFFFFFFFu",
  "1.99e90000009",
  "[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[\n\t\t\t[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[['too many']]]]]]]]]]]]]]]]]]]]]]]]]]]]\n\t\t\t]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]",
  "y!=y!=y!=y!=y!=y!=y!=y!=y!=-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y\n\t\t!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y\n\t\t!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y\n\t\t!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y\n\t\t!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y\n\t\t!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y!=-y!=-y-y!=-y",
  "[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[['not fine']]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]",
  "1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10\n\t\t+ 11 + 12 + 13 + 14 + 15 + 16 + 17 + 18 + 19 + 20\n\t\t+ 21 + 22 + 23 + 24 + 25 + 26 + 27 + 28 + 29 + 30\n\t\t+ 31 + 32 + 33 + 34",
  "a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z.A.B.C.D.E.F.G.H",
  "a[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20]\n\t\t     [21][22][23][24][25][26][27][28][29][30][31][32][33]",
  "a < 1 < 2 < 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < 11\n\t\t      < 12 < 13 < 14 < 15 < 16 < 17 < 18 < 19 < 20 < 21\n\t\t\t  < 22 < 23 < 24 < 25 < 26 < 27 < 28 < 29 < 30 < 31\n\t\t\t  < 32 < 33",
  "a[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20] !=\n\t\ta[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20] !=\n\t\ta[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20] !=\n\t\ta[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20] !=\n\t\ta[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20] !=\n\t\ta[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20] !=\n\t\ta[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20] !=\n\t\ta[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20] !=\n\t\ta[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20] !=\n\t\ta[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20] !=\n\t\ta[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20] !=\n\t\ta[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20] !=\n\t\ta[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20] !=\n\t\ta[1][2][3][4][5][6][7][8][9][10][11][12][13][14][15][16][17][18][19][20]",

  // Needs investigation
  "1.all(2, 3)",
  '"\\a\\b\\f\\n\\r\\t\\v\\\'\\"\\\\\\? Illegal escape \\>"',
];

for (const t of tests) {
  let func;
  if (t.ast !== undefined) {
    func = () => {
      const actual = toDebugString(parse(t.expr), KindAdorner.singleton);
      const expected = t.ast;
      expect(actual).toStrictEqual(expected);
    };
  } else {
    func = () => {
      expect(() => parse(t.expr)).toThrow();
    };
  }

  if (skip.includes(t.expr)) {
    test.skip(t.expr, func);
  } else {
    test(t.expr, func);
  }
}
