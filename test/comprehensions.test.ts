import * as fs from "fs";

import { parse } from "../index.ts";
import {
  toDebugString,
  KindAdorner,
} from "../utility/debug/to-debug-string.ts";

const tests = JSON.parse(
  fs.readFileSync(`${__dirname}/data/comprehensions.json`, "utf8"),
);

const skip: string[] = [];

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
