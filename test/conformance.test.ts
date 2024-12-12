import * as fs from "fs";

import { parse } from "../index.ts";
import { fromJson } from "@bufbuild/protobuf";
import { ExprSchema } from "../external/cel/expr/syntax_pb.ts";
import type { Expr, Expr_Call } from "../external/cel/expr/syntax_pb.ts";
import { toDebugString, KindAdorner } from "../utility/debug/to-debug-string.ts";

const tests = JSON.parse(
  fs.readFileSync(`${__dirname}/data/conformance.json`, "utf8"),
);

const skip: string[] = [];

for (const t of tests) {
  if (t.ast !== undefined) {
    const func = () => {
      const actual = toDebugString(parse(t.expr), KindAdorner.singleton);
      const expected = t.ast;
      expect(actual).toStrictEqual(expected);
    };
  
    if (skip.includes(t.expr)) {
      test.skip(t.expr, func);
    } else {
      test(t.expr, func);
    }
  }
}