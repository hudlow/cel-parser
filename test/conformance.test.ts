import * as fs from "fs";

import { parse } from "../index.ts";
import {
  toDebugString,
  KindAdorner,
} from "../utility/debug/to-debug-string.ts";

const tests = JSON.parse(
  fs.readFileSync(`${__dirname}/data/conformance.json`, "utf8"),
);

const skip: string[] = [
  // should fail
  "cel.block([[1].exists(cel.iterVar(0, 0), cel.iterVar(0, 0) > 0), size([cel.index(0)]), [2].exists(cel.iterVar(0, 0), cel.iterVar(0, 0) > 1), size([cel.index(2)])], cel.index(1) + cel.index(1) + cel.index(3) + cel.index(3))",
  "cel.block([[1].exists(cel.iterVar(0, 0), cel.iterVar(0, 0) > 0), [cel.index(0)], ['a'].exists(cel.iterVar(0, 1), cel.iterVar(0, 1) == 'a'), [cel.index(2)]], cel.index(1) + cel.index(1) + cel.index(3) + cel.index(3))",
  "cel.block([[1].exists(cel.iterVar(0, 0), cel.iterVar(0, 0) > 0)], cel.index(0) && cel.index(0) && [1].exists(cel.iterVar(0, 0), cel.iterVar(0, 0) > 1) && [2].exists(cel.iterVar(0, 0), cel.iterVar(0, 0) > 1))",
  "cel.block([[1, 2, 3]], cel.index(0).map(cel.iterVar(0, 0), cel.index(0).map(cel.iterVar(1, 0), cel.iterVar(1, 0) + 1)))",
  "[1, 2].map(cel.iterVar(0, 0), [1, 2, 3].filter(cel.iterVar(1, 0), cel.iterVar(1, 0) == cel.iterVar(0, 0)))",
  "cel.block([[1, 2, 3], cel.index(0).map(cel.iterVar(0, 0), cel.index(0).map(cel.iterVar(1, 0), cel.iterVar(1, 0) + 1))], cel.index(1) == cel.index(1))",
  "cel.block([x - 1, cel.index(0) > 3], [cel.index(1) ? cel.index(0) : 5].exists(cel.iterVar(0, 0), cel.iterVar(0, 0) - 1 > 3) || cel.index(1))",
  "['foo', 'bar'].map(cel.iterVar(1, 0), [cel.iterVar(1, 0) + cel.iterVar(1, 0), cel.iterVar(1, 0) + cel.iterVar(1, 0)]).map(cel.iterVar(0, 0), [cel.iterVar(0, 0) + cel.iterVar(0, 0), cel.iterVar(0, 0) + cel.iterVar(0, 0)])",
  "((((((((((((((((((((((((((((((((7))))))))))))))))))))))))))))))))",
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
