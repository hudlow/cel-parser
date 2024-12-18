import * as fs from "fs";

import { parse } from "../index.ts";

import toDebugString from "../utility/debug/to-debug-string.ts";
import type { Adorner } from "../utility/debug/to-debug-string.ts";

import type {
  Constant,
  Expr,
  Expr_CreateStruct_Entry as Entry,
} from "../external/cel/expr/syntax_pb.ts";

import type { Message } from "@bufbuild/protobuf";

const tests = JSON.parse(
  fs.readFileSync(`${__dirname}/data/parser.json`, "utf8"),
);

function trimQuotes(s: string): string {
  if (s[0] === "`" && s[s.length - 1] === "`") {
    return s.slice(1, -1);
  } else if (s[0] === '"' && s[s.length - 1] === '"') {
    return decodeURIComponent(JSON.parse(s));
  }

  throw new Error("expected a string");
}

const skip: string[] = [
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

const only: string[] = [
  //"{"
];

describe("parser", () => {
  for (const t of tests) {
    const input = trimQuotes(t.I.Value);
    let func = () => {};

    if (t.P?.Value !== undefined) {
      const expected = normalizeDebugString(trimQuotes(t.P.Value));

      func = () => {
        const actual = normalizeDebugString(
          toDebugString(parse(input), KindAndIDAdorner.singleton),
        );
        expect(actual).toStrictEqual(expected);
      };
    } else if (t.E?.Value !== undefined) {
      const expected = normalizeDebugString(trimQuotes(t.E.Value));

      func = () => {
        let error = false;

        try {
          parse(input);
        } catch (e) {
          error = true;
        }

        expect(error).toEqual(true);
      };
    } else {
      throw new Error("expected result or error");
    }

    if (only.includes(input)) {
      test.only(input, func);
    } else if (skip.includes(input)) {
      test.skip(input, func);
    } else {
      test(input, func);
    }
  }
});

function normalizeDebugString(d: string): string {
  return d.replace(/\^\#\d+\:/g, "^#0:").replace(/[\n\r\t ]+/g, "");
}

class KindAndIDAdorner implements Adorner {
  static readonly singleton = new KindAndIDAdorner();
  private constructor() {}

  GetMetadata(context: Message): string {
    let valueType = "";

    if (isExpr(context)) {
      valueType = getExprType(context);
    } else if (isEntry(context)) {
      valueType = "*expr.Expr_CreateStruct_Entry";
    } else {
      throw new Error("unexpected message type: " + context.$typeName);
    }

    return `^#0:${valueType}#`;
  }
}

function getExprType(e: Expr): string {
  switch (e.exprKind.case) {
    case "constExpr":
      return getConstantType(e.exprKind.value);
    case "identExpr":
      return "*expr.Expr_IdentExpr";
    case "selectExpr":
      return "*expr.Expr_SelectExpr";
    case "callExpr":
      return "*expr.Expr_CallExpr";
    case "listExpr":
      return "*expr.Expr_ListExpr";
    case "structExpr":
      return "*expr.Expr_StructExpr";
    case "comprehensionExpr":
      return "*expr.Expr_ComprehensionExpr";
    default:
      throw new Error("unexpected expression type: " + e.exprKind);
  }
}

function getConstantType(c: Constant): string {
  switch (c.constantKind.case) {
    case "nullValue":
      return "*expr.Constant_NullValue";
    case "boolValue":
      return "*expr.Constant_BoolValue";
    case "int64Value":
      return "*expr.Constant_Int64Value";
    case "uint64Value":
      return "*expr.Constant_Uint64Value";
    case "doubleValue":
      return "*expr.Constant_DoubleValue";
    case "stringValue":
      return "*expr.Constant_StringValue";
    case "bytesValue":
      return "*expr.Constant_BytesValue";
    default:
      throw new Error("unexpected constant type: " + c.constantKind.case);
  }
}

function isExpr(m: Message): m is Expr {
  return m.$typeName === "cel.expr.Expr";
}

function isEntry(m: Message): m is Expr {
  return m.$typeName === "cel.expr.Expr.CreateStruct.Entry";
}
