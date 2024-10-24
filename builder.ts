import type {
  Constant,
  Expr,
  Expr_CreateStruct_Entry,
  SourceInfo,
} from "./external/proto/dev/cel/expr/syntax_pb.ts";

const encoder = new TextEncoder();

export type Eventual<T> = () => T;

export class LazyBuilder {
  builder: Builder = new Builder();

  newCallExpr(
    offset: number,
    functionName: string,
    args: Eventual<Expr>[],
  ): Eventual<Expr> {
    return () =>
      this.builder.newCallExpr(
        offset,
        functionName,
        args.map((a) => a()),
      );
  }

  newSelectExpr(
    offset: number,
    operand: Eventual<Expr>,
    field: string,
  ): Eventual<Expr> {
    return () => this.builder.newSelectExpr(offset, operand(), field);
  }

  newMemberCallExpr(
    offset: number,
    target: Eventual<Expr>,
    functionName: string,
    args: Eventual<Expr>[],
  ): Eventual<Expr> {
    return () =>
      this.builder.newMemberCallExpr(
        offset,
        target(),
        functionName,
        args.map((a) => a()),
      );
  }

  newIdentExpr(offset: number, name: string): Eventual<Expr> {
    return () => this.builder.newIdentExpr(offset, name);
  }

  newStructExpr(
    offset: number,
    entries: Eventual<Expr_CreateStruct_Entry>[],
    messageName?: string,
  ): Eventual<Expr> {
    return () =>
      this.builder.newStructExpr(
        offset,
        entries.map((a) => a()),
        messageName,
      );
  }

  newListExpr(offset: number, elements: Eventual<Expr>[]): Eventual<Expr> {
    return () =>
      this.builder.newListExpr(
        offset,
        elements.map((a) => a()),
      );
  }

  newStructEntry(
    offset: number,
    field: string,
    value: Eventual<Expr>,
  ): Eventual<Expr_CreateStruct_Entry> {
    return () => this.builder.newStructEntry(offset, field, value());
  }

  newMapEntry(
    offset: number,
    key: Eventual<Expr>,
    value: Eventual<Expr>,
  ): Eventual<Expr_CreateStruct_Entry> {
    return () => this.builder.newMapEntry(offset, key(), value());
  }

  newInt64Expr(offset: number, digits: string): Eventual<Expr> {
    return () => this.builder.newInt64Expr(offset, digits);
  }

  newUnsignedInt64Expr(offset: number, digits: string): Eventual<Expr> {
    return () => this.builder.newUnsignedInt64Expr(offset, digits);
  }

  newDoubleExpr(offset: number, digits: string): Eventual<Expr> {
    return () => this.builder.newDoubleExpr(offset, digits);
  }

  newStringExpr(
    offset: number,
    sequence: (string | number[])[],
  ): Eventual<Expr> {
    return () => this.builder.newStringExpr(offset, sequence);
  }

  newBytesExpr(
    offset: number,
    sequence: (string | number[])[],
  ): Eventual<Expr> {
    return () => this.builder.newBytesExpr(offset, sequence);
  }

  newBoolExpr(offset: number, keyword: "true" | "false"): Eventual<Expr> {
    return () => this.builder.newBoolExpr(offset, keyword);
  }

  newNullExpr(offset: number): Eventual<Expr> {
    return () => this.builder.newNullExpr(offset);
  }
}

class Builder {
  #prevId = 0n;

  sourceInfo: SourceInfo = {
    $typeName: "dev.cel.expr.SourceInfo",
    syntaxVersion: "",
    location: "",
    lineOffsets: [],
    positions: {},
    macroCalls: {},
  };

  nextExpr(offset: number, exprKind: Expr["exprKind"]): Expr {
    this.sourceInfo.positions[(++this.#prevId).toString()] = offset;

    return {
      $typeName: "dev.cel.expr.Expr",
      id: this.#prevId,
      exprKind,
    };
  }

  nextEntry(
    offset: number,
    keyKind: Expr_CreateStruct_Entry["keyKind"],
    value: Expr,
  ): Expr_CreateStruct_Entry {
    this.sourceInfo.positions[(++this.#prevId).toString()] = offset;

    return {
      $typeName: "dev.cel.expr.Expr.CreateStruct.Entry",
      id: this.#prevId,
      keyKind,
      value,
      optionalEntry: false,
    };
  }

  newConstExpr(offset: number, constantKind: Constant["constantKind"]): Expr {
    return this.nextExpr(offset, {
      case: "constExpr",
      value: { $typeName: "dev.cel.expr.Constant", constantKind },
    });
  }

  newCallExpr(offset: number, functionName: string, args: Expr[]): Expr {
    if (
      functionName === "has" &&
      args.length === 1 &&
      args[0].exprKind?.case === "selectExpr"
    ) {
      return this.expandHasMacro(offset, args[0]);
    } else {
      return this.nextExpr(offset, {
        case: "callExpr",
        value: {
          $typeName: "dev.cel.expr.Expr.Call",
          function: functionName,
          args,
        },
      });
    }
  }

  newMemberCallExpr(
    offset: number,
    target: Expr,
    functionName: string,
    args: Expr[],
  ): Expr {
    return this.maybeExpand(
      offset,
      this.nextExpr(offset, {
        case: "callExpr",
        value: {
          $typeName: "dev.cel.expr.Expr.Call",
          function: functionName,
          target,
          args,
        },
      }),
    );
  }

  newStringExpr(offset: number, sequence: (string | number[])[]): Expr {
    return this.newConstExpr(offset, {
      case: "stringValue",
      value: sequence.reduce<string>(
        (string: string, chunk: string | number[]) => {
          if (typeof chunk !== "string") {
            return string + String.fromCodePoint(...chunk);
          }

          return string + chunk;
        },
        "",
      ),
    });
  }

  newBytesExpr(offset: number, sequence: (string | number[])[]): Expr {
    return this.newConstExpr(offset, {
      case: "bytesValue",
      value: new Uint8Array(
        sequence.reduce<number[]>(
          (bytes: number[], chunk: string | number[]) => {
            if (typeof chunk === "string") {
              return [...bytes, ...encoder.encode(chunk)];
            }

            return [...bytes, ...chunk];
          },
          [],
        ),
      ),
    });
  }

  newBoolExpr(offset: number, keyword: "true" | "false"): Expr {
    return this.newConstExpr(offset, {
      case: "boolValue",
      value: keyword === "true",
    });
  }

  newInt64Expr(offset: number, digits: string) {
    return this.newConstExpr(offset, {
      case: "int64Value",
      value: digits[0] === "-" ? -BigInt(digits.slice(1)) : BigInt(digits),
    });
  }

  newUnsignedInt64Expr(offset: number, digits: string) {
    return this.newConstExpr(offset, {
      case: "uint64Value",
      value: BigInt(digits),
    });
  }

  newDoubleExpr(offset: number, digits: string) {
    return this.newConstExpr(offset, {
      case: "doubleValue",
      value: parseFloat(digits),
    });
  }

  newNullExpr(offset: number) {
    return this.newConstExpr(offset, {
      case: "nullValue",
      value: 0,
    });
  }

  newIdentExpr(offset: number, name: string): Expr {
    const expr = this.nextExpr(offset, {
      case: "identExpr",
      value: { $typeName: "dev.cel.expr.Expr.Ident", name },
    });
    return expr;
  }

  newInfixExpr(offset: number, op: string, args: Expr[]): Expr {
    return this.newCallExpr(offset, op === "in" ? "@in" : `_${op}_`, args);
  }

  newSelectExpr(offset: number, operand: Expr, field: string): Expr {
    return this.nextExpr(offset, {
      case: "selectExpr",
      value: {
        $typeName: "dev.cel.expr.Expr.Select",
        operand,
        field,
        testOnly: false,
      },
    });
  }

  newIndexExpr(offset: number, operand: Expr, index: Expr): Expr {
    return this.newCallExpr(offset, "_[_]", [operand, index]);
  }

  expandHasMacro(offset: number, target: Expr): Expr {
    if (target.exprKind.case !== "selectExpr") {
      return this.newCallExpr(offset, "has", [target]);
    }

    target.exprKind.value.testOnly = true;
    return target;
  }

  newListExpr(offset: number, elements: Expr[]): Expr {
    return this.nextExpr(offset, {
      case: "listExpr",
      value: {
        $typeName: "dev.cel.expr.Expr.CreateList",
        elements,
        optionalIndices: [],
      },
    });
  }

  newBoolMacro(
    offset: number,
    iterRange: Expr,
    iterVar: string,
    init: boolean,
    loopStep: Expr,
    loopCondition: Expr,
  ) {
    return this.nextExpr(offset, {
      case: "comprehensionExpr",
      value: {
        $typeName: "dev.cel.expr.Expr.Comprehension",
        accuVar: "__result__",
        accuInit: this.newConstExpr(offset, {
          case: "boolValue",
          value: init,
        }),
        iterVar,
        iterRange,
        loopStep,
        loopCondition,
        result: this.newIdentExpr(offset, "__result__"),
      },
    });
  }

  newListMacro(
    offset: number,
    iterRange: Expr,
    iterVar: string,
    loopStep: Expr,
  ): Expr {
    return this.nextExpr(offset, {
      case: "comprehensionExpr",
      value: {
        $typeName: "dev.cel.expr.Expr.Comprehension",
        accuVar: "__result__",
        accuInit: this.newListExpr(offset, []),
        iterVar,
        iterRange,
        loopCondition: this.newConstExpr(offset, {
          case: "boolValue",
          value: true,
        }),
        loopStep,
        result: this.newIdentExpr(offset, "__result__"),
      },
    });
  }

  expandExistsMacro(offset: number, target: Expr, x: string, test: Expr): Expr {
    return this.newBoolMacro(
      offset,
      target,
      x,
      false,
      this.newCallExpr(offset, "_||_", [
        this.newIdentExpr(offset, "__result__"),
        test,
      ]),
      this.newCallExpr(offset, "@not_strictly_false", [
        this.newCallExpr(offset, "!_", [
          this.newIdentExpr(offset, "__result__"),
        ]),
      ]),
    );
  }

  expandAllMacro(offset: number, target: Expr, x: string, test: Expr): Expr {
    return this.newBoolMacro(
      offset,
      target,
      x,
      true,
      this.newCallExpr(offset, "_&&_", [
        this.newIdentExpr(offset, "__result__"),
        test,
      ]),
      this.newCallExpr(offset, "@not_strictly_false", [
        this.newIdentExpr(offset, "__result__"),
      ]),
    );
  }

  expandMapMacro(offset: number, target: Expr, x: string, step: Expr): Expr {
    return this.newListMacro(
      offset,
      target,
      x,
      this.newCallExpr(offset, "_+_", [
        this.newIdentExpr(offset, "__result__"),
        this.newListExpr(offset, [step]),
      ]),
    );
  }

  expandMapFilterMacro(
    offset: number,
    target: Expr,
    x: string,
    test: Expr,
    step: Expr,
  ): Expr {
    return this.newListMacro(
      offset,
      target,
      x,
      this.newCallExpr(offset, "_?_:_", [
        test,
        this.newCallExpr(offset, "_+_", [
          this.newIdentExpr(offset, "__result__"),
          this.newListExpr(offset, [step]),
        ]),
        this.newIdentExpr(offset, "__result__"),
      ]),
    );
  }

  expandFilterMacro(offset: number, target: Expr, x: string, step: Expr): Expr {
    return this.newListMacro(
      offset,
      target,
      x,
      this.newCallExpr(offset, "_?_:_", [
        step,
        this.newCallExpr(offset, "_+_", [
          this.newIdentExpr(offset, "__result__"),
          this.newListExpr(offset, [this.newIdentExpr(offset, x)]),
        ]),
        this.newIdentExpr(offset, "__result__"),
      ]),
    );
  }

  expandExistsOne(
    offset: number,
    iterRange: Expr,
    iterVar: string,
    step: Expr,
  ): Expr {
    return this.nextExpr(offset, {
      case: "comprehensionExpr",
      value: {
        $typeName: "dev.cel.expr.Expr.Comprehension",
        accuVar: "__result__",
        accuInit: this.newConstExpr(offset, {
          case: "int64Value",
          value: BigInt(0),
        }),
        iterVar,
        iterRange,
        loopCondition: this.newConstExpr(offset, {
          case: "boolValue",
          value: true,
        }),
        loopStep: this.newCallExpr(offset, "_?_:_", [
          step,
          this.newCallExpr(offset, "_+_", [
            this.newIdentExpr(offset, "__result__"),
            this.newConstExpr(offset, {
              case: "int64Value",
              value: BigInt(1),
            }),
          ]),
          this.newIdentExpr(offset, "__result__"),
        ]),
        result: this.newCallExpr(offset, "_==_", [
          this.newIdentExpr(offset, "__result__"),
          this.newConstExpr(offset, {
            case: "int64Value",
            value: BigInt(1),
          }),
        ]),
      },
    });
  }

  maybeExpand(offset: number, call: Expr): Expr {
    if (call.exprKind.case === "callExpr") {
      const callExpr = call.exprKind.value;
      const varName = callExpr.args[0];
      if (
        varName !== undefined &&
        call.exprKind.value.target !== undefined &&
        varName.exprKind?.case === "identExpr"
      ) {
        if (callExpr.args.length === 2) {
          switch (callExpr.function) {
            case "exists":
              return this.expandExistsMacro(
                offset,
                call.exprKind.value.target,
                varName.exprKind.value.name,
                call.exprKind.value.args[1],
              );
            case "all":
              return this.expandAllMacro(
                offset,
                call.exprKind.value.target,
                varName.exprKind.value.name,
                call.exprKind.value.args[1],
              );
            case "map":
              return this.expandMapMacro(
                offset,
                call.exprKind.value.target,
                varName.exprKind.value.name,
                call.exprKind.value.args[1],
              );
            case "filter":
              return this.expandFilterMacro(
                offset,
                call.exprKind.value.target,
                varName.exprKind.value.name,
                call.exprKind.value.args[1],
              );
            case "exists_one":
              return this.expandExistsOne(
                offset,
                call.exprKind.value.target,
                varName.exprKind.value.name,
                call.exprKind.value.args[1],
              );
          }
        } else if (callExpr.args.length === 3 && callExpr.function == "map") {
          return this.expandMapFilterMacro(
            offset,
            call.exprKind.value.target,
            varName.exprKind.value.name,
            call.exprKind.value.args[1],
            call.exprKind.value.args[2],
          );
        }
      }
    }
    return call;
  }

  newMapEntry(offset: number, key: Expr, value: Expr): Expr_CreateStruct_Entry {
    return this.nextEntry(
      offset,
      {
        case: "mapKey",
        value: key,
      },
      value,
    );
  }

  newStructExpr(
    offset: number,
    entries: Expr_CreateStruct_Entry[],
    messageName: string = "",
  ): Expr {
    return this.nextExpr(offset, {
      case: "structExpr",
      value: {
        $typeName: "dev.cel.expr.Expr.CreateStruct",
        entries,
        messageName,
      },
    });
  }

  newStructEntry(
    offset: number,
    field: string,
    value: Expr,
  ): Expr_CreateStruct_Entry {
    return this.nextEntry(
      offset,
      {
        case: "fieldKey",
        value: field,
      },
      value,
    );
  }
}
