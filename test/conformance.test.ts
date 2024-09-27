import * as fs from "fs";

import { parse } from "../index.ts";
import { fromBinary } from "@bufbuild/protobuf";
import { ExprSchema } from "../generated/proto/cel/expr/syntax_pb.ts";
import type { Expr, Expr_Call } from "../generated/proto/cel/expr/syntax_pb.ts";

interface ParseTestCase {
  input: string;
  expected: Expr;
}

function loadTestCases(path: string): ParseTestCase[] {
  const result: ParseTestCase[] = [];
  const fileName = `${__dirname}/${path}.ast.text`;
  // Open the file
  const data = fs.readFileSync(fileName);
  // Split the file into lines
  const lines = data.toString().split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const testCase = line.split(" ");
    if (testCase.length !== 2) {
      continue;
    }
    // Base64 decode the input string
    const inputBytes = Buffer.from(testCase[0], "base64");
    const input = new TextDecoder("utf-8").decode(inputBytes);
    const binaryExpected = testCase[1];
    // base64 decode the input
    const bytes = Buffer.from(binaryExpected, "base64");

    const expected = fromBinary(ExprSchema, bytes);
    result.push({ input, expected });
  }
  return result;
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

function runTestFile(path: string) {
  const testCases = loadTestCases(path);
  testCases.forEach((testCase) => {
    test("Parse - " + path + " - " + testCase.input, () => {
      const actual = parse(testCase.input);
      normalizeForTest(actual);
      normalizeForTest(testCase.expected);
      expect(actual).toStrictEqual(testCase.expected);
    });
  });
}

runTestFile("data/basic");
runTestFile("data/comparisons");
runTestFile("data/conversions");
runTestFile("data/fields");
runTestFile("data/fp_math");
runTestFile("data/integer_math");
runTestFile("data/lists");
runTestFile("data/logic");
runTestFile("data/macros");
runTestFile("data/namespace");
runTestFile("data/parse");
runTestFile("data/plumbing");
runTestFile("data/string");
runTestFile("data/timestamps");
