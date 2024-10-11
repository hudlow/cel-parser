import * as fs from "fs";

import { parse } from "../index.ts";
import { fromJson } from "@bufbuild/protobuf";
import { ExprSchema } from "../external/proto/dev/cel/expr/syntax_pb.ts";
import type {
  Expr,
  Expr_Call,
} from "../external/proto/dev/cel/expr/syntax_pb.ts";

const files = JSON.parse(
  fs.readFileSync(`${__dirname}/data/conformance.json`, "utf8"),
);

const skip = [
  "fields.in.mixed_numbers_and_keys_present",
  "optionals.optionals.optional_chaining_1",
  "optionals.optionals.optional_chaining_7",
  "optionals.optionals.optional_chaining_8",
  "optionals.optionals.optional_chaining_10",
  "parse.repeat.or",
  "parse.repeat.and",
  "string_ext.char_at.multiple",
];

for (const f of files) {
  if (f.sections === null) {
    continue;
  }
  describe(f.name, () => {
    for (const s of f.sections) {
      describe(s.name, () => {
        for (const t of s.tests) {
          const func = () => {
            const actual = parse(t.expression);
            const expected = fromJson(ExprSchema, t.result.expr);
            normalizeForTest(actual);
            normalizeForTest(expected);
            expect(actual).toStrictEqual(expected);
          };

          if (skip.includes(`${f.name}.${s.name}.${t.name}`)) {
            test.skip(t.name, func);
          } else {
            test(t.name, func);
          }
        }
      });
    }
  });
}

function normalizeForTest(expr: Expr | undefined) {
  if (expr === undefined) {
    return;
  }
  expr.id = 0n;
  switch (expr.exprKind.case) {
    case "callExpr":
      normalizeForTest(expr.exprKind.value.target);
      for (const arg of expr.exprKind.value.args) {
        normalizeForTest(arg);
      }
      break;
    case "listExpr":
      for (const elem of expr.exprKind.value.elements) {
        normalizeForTest(elem);
      }
      break;
    case "structExpr":
      for (const elem of expr.exprKind.value.entries) {
        switch (elem.keyKind.case) {
          case "mapKey":
            normalizeForTest(elem.keyKind.value);
            break;
          default:
            break;
        }
        normalizeForTest(elem.value);
        elem.id = 0n;
      }
      break;
    case "comprehensionExpr":
      normalizeForTest(expr.exprKind.value.iterRange);
      normalizeForTest(expr.exprKind.value.accuInit);
      normalizeForTest(expr.exprKind.value.loopCondition);
      normalizeForTest(expr.exprKind.value.loopStep);
      normalizeForTest(expr.exprKind.value.result);
      break;
    case "selectExpr":
      normalizeForTest(expr.exprKind.value.operand);
      break;
    default:
      break;
  }
}

// function runTestFile(path: string) {
//   const testCases = loadTestCases(path);
//   testCases.forEach((testCase) => {
//     test("Parse - " + path + " - " + testCase.input, () => {
//       const actual = parse(testCase.input);
//       normalizeForTest(actual);
//       normalizeForTest(testCase.expected);
//       expect(actual).toStrictEqual(testCase.expected);
//     });
//   });
// }
