import {
  Constant,
  Expr,
  Expr_Call,
  Expr_Comprehension,
  Expr_CreateList,
  Expr_CreateStruct,
  Expr_CreateStruct_Entry,
  Expr_Ident,
  Expr_Select,
  SourceInfo,
} from "./generated/proto/cel/expr/syntax_pb.ts";

const encoder = new TextEncoder();

export type Eventual<T> = () => T;

export class LazyBuilder {
  builder: ExprBuilder;

  constructor() {
    this.builder = new ExprBuilder();
  }

  public newCallExpr(offset: number, functionName: string, args: Eventual<Expr>[]): Eventual<Expr> {
    return () => this.builder.newCallExpr(offset, functionName, args.map(a => a()));
  }

  public newSelectExpr(offset: number, operand: Eventual<Expr>, field: string): Eventual<Expr> {
    return () => this.builder.newSelectExpr(offset, operand(), field);
  }

  public newMemberCallExpr(offset: number, target: Eventual<Expr>, functionName: string, args: Eventual<Expr>[]): Eventual<Expr> {
    return () => this.builder.newMemberCallExpr(offset, target(), functionName, args.map(a => a()));
  }

  public newIdentExpr(offset: number, name: string): Eventual<Expr> {
    return () => this.builder.newIdentExpr(offset, name);
  }

  public newStructExpr(offset: number, entries: Eventual<Expr_CreateStruct_Entry>[], messageName?: string): Eventual<Expr> {
    return () => this.builder.newStructExpr(offset, entries.map(a => a()), messageName);
  }

  public newListExpr(offset: number, elements: Eventual<Expr>[]): Eventual<Expr> {
    return () => this.builder.newListExpr(offset, elements.map(a => a()))
  }

  public newStructEntry(offset: number, field: string, value: Eventual<Expr>): Eventual<Expr_CreateStruct_Entry> {
    return () => this.builder.newStructEntry(offset, field, value());
  }

  public newMapEntry(offset: number, key: Eventual<Expr>, value: Eventual<Expr>): Eventual<Expr_CreateStruct_Entry> {
    return () => this.builder.newMapEntry(offset, key(), value());
  }

  public newInt64Expr(offset: number, digits: string): Eventual<Expr> {
    return () => this.builder.newInt64Expr(offset, digits);
  }

  public newUnsignedInt64Expr(offset: number, digits: string): Eventual<Expr> {
    return () => this.builder.newUnsignedInt64Expr(offset, digits);
  }

  public newDoubleExpr(offset: number, digits: string): Eventual<Expr> {
    return () => this.builder.newDoubleExpr(offset, digits);
  }

  public newStringExpr(offset: number, sequence: (string | number[])[]): Eventual<Expr> {
    return () => this.builder.newStringExpr(offset, sequence);
  }

  public newBytesExpr(offset: number, sequence: (string | number[])[]): Eventual<Expr> {
    return () => this.builder.newBytesExpr(offset, sequence);
  }

  public newBoolExpr(offset: number, keyword: "true" | "false"): Eventual<Expr> {
    return () => this.builder.newBoolExpr(offset, keyword);
  }

  public newNullExpr(offset: number): Eventual<Expr> {
    return () => this.builder.newNullExpr(offset);
  }
}

class ExprBuilder {
  private prevId = 0n;
  public sourceInfo: SourceInfo = new SourceInfo();

  public nextExpr(offset: number): Expr {
    const expr = new Expr();
    expr.id = ++this.prevId;
    this.sourceInfo.positions[expr.id.toString()] = offset;
    return expr;
  }

  public newConstExpr(
    offset: number,
    constantKind: Constant["constantKind"],
  ): Expr {
    const expr = this.nextExpr(offset);
    expr.exprKind = {
      case: "constExpr",
      value: new Constant({ constantKind }),
    };
    return expr;
  }

  public newCallExpr(offset: number, functionName: string, args: Expr[]): Expr {
    if (
      functionName === "has" &&
      args.length === 1 &&
      args[0].exprKind?.case === "selectExpr"
    ) {
      return this.expandHasMacro(offset, args[0]);
    }
    const expr = this.nextExpr(offset);
    expr.exprKind = {
      case: "callExpr",
      value: new Expr_Call({
        function: functionName,
        args: args,
      }),
    };
    return expr;
  }

  public newMemberCallExpr(
    offset: number,
    target: Expr,
    functionName: string,
    args: Expr[],
  ): Expr {
    const expr = this.nextExpr(offset);
    expr.exprKind = {
      case: "callExpr",
      value: new Expr_Call({
        function: functionName,
        target: target,
        args: args,
      }),
    };
    return this.maybeExpand(offset, expr);
  }

  public newStringExpr(offset: number, sequence: (string | number[])[]): Expr {
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

  public newBytesExpr(offset: number, sequence: (string | number[])[]): Expr {
    return this.newConstExpr(offset, {
      case: "bytesValue",
      value: new Buffer(
        sequence.reduce<number[]>((bytes: number[], chunk: string | number[]) => {
          if (typeof chunk === "string") {
            return [...bytes, ...encoder.encode(chunk)];
          }

          return [...bytes, ...chunk];
        }, []),
      ),
    });
  }

  public newBoolExpr(offset: number, keyword: "true" | "false"): Expr {
    return this.newConstExpr(offset, {
      case: "boolValue",
      value: keyword === "true",
    });
  }

  public newInt64Expr(offset: number, digits: string) {
    return this.newConstExpr(offset, {
      case: "int64Value",
      value: digits[0] === "-" ? -BigInt(digits.slice(1)) : BigInt(digits),
    });
  }

  public newUnsignedInt64Expr(offset: number, digits: string) {
    return this.newConstExpr(offset, {
      case: "uint64Value",
      value: BigInt(digits),
    });
  }

  public newDoubleExpr(offset: number, digits: string) {
    return this.newConstExpr(offset, {
      case: "doubleValue",
      value: parseFloat(digits),
    });
  }

  public newNullExpr(offset: number) {
    return this.newConstExpr(offset, {
      case: "nullValue",
      value: 0,
    });
  }

  public newIdentExpr(offset: number, name: string): Expr {
    const expr = this.nextExpr(offset);
    expr.exprKind = {
      case: "identExpr",
      value: new Expr_Ident({ name: name }),
    };
    return expr;
  }

  public newInfixExpr(offset: number, op: string, args: Expr[]): Expr {
    if (op === "in") {
      op = "@in";
    } else {
      op = "_" + op + "_";
    }
    return this.newCallExpr(offset, op, args);
  }

  public newSelectExpr(offset: number, operand: Expr, field: string): Expr {
    const expr = this.nextExpr(offset);
    expr.exprKind = {
      case: "selectExpr",
      value: new Expr_Select({
        operand: operand,
        field: field,
      }),
    };
    return expr;
  }

  public newIndexExpr(offset: number, operand: Expr, index: Expr): Expr {
    return this.newCallExpr(offset, "_[_]", [operand, index]);
  }

  public expandHasMacro(offset: number, target: Expr): Expr {
    if (target.exprKind.case !== "selectExpr") {
      return this.newCallExpr(offset, "has", [target]);
    }

    target.exprKind.value.testOnly = true;
    return target;
  }

  public newListExpr(offset: number, elements: Expr[]): Expr {
    const expr = this.nextExpr(offset);
    expr.exprKind = {
      case: "listExpr",
      value: new Expr_CreateList({
        elements: elements,
      }),
    };
    return expr;
  }

  newBoolMacro(
    offset: number,
    target: Expr,
    x: string,
    init: boolean,
    step: Expr,
    cond: Expr,
  ) {
    const expr = this.nextExpr(offset);
    expr.exprKind = {
      case: "comprehensionExpr",
      value: new Expr_Comprehension({
        accuVar: "__result__",
        accuInit: this.newConstExpr(offset, {
          case: "boolValue",
          value: init,
        }),
        iterVar: x,
        iterRange: target,
        loopStep: step,
        loopCondition: cond,
        result: this.newIdentExpr(offset, "__result__"),
      }),
    };
    return expr;
  }

  newListMacro(offset: number, target: Expr, x: string, step: Expr): Expr {
    const expr = this.nextExpr(offset);
    expr.exprKind = {
      case: "comprehensionExpr",
      value: new Expr_Comprehension({
        accuVar: "__result__",
        accuInit: this.newListExpr(offset, []),
        iterVar: x,
        iterRange: target,
        loopCondition: this.newConstExpr(offset, {
          case: "boolValue",
          value: true,
        }),
        loopStep: step,
        result: this.newIdentExpr(offset, "__result__"),
      }),
    };
    return expr;
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

  expandExistsOne(offset: number, target: Expr, x: string, step: Expr): Expr {
    const expr = this.nextExpr(offset);
    expr.exprKind = {
      case: "comprehensionExpr",
      value: new Expr_Comprehension({
        accuVar: "__result__",
        accuInit: this.newConstExpr(offset, {
          case: "int64Value",
          value: BigInt(0),
        }),
        iterVar: x,
        iterRange: target,
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
      }),
    };
    return expr;
  }

  public maybeExpand(offset: number, call: Expr): Expr {
    if (call.exprKind.case === "callExpr") {
      const callExpr = call.exprKind.value;
      const varName = callExpr.args[0];
      if (
        call.exprKind.value.target !== undefined &&
        callExpr.args.length === 2 &&
        varName.exprKind.case === "identExpr"
      ) {
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
      }
    }
    return call;
  }

  public newMapEntry(
    offset: number,
    key: Expr,
    value: Expr,
  ): Expr_CreateStruct_Entry {
    const id = ++this.prevId;
    this.sourceInfo.positions[id.toString()] = offset;
    return new Expr_CreateStruct_Entry({
      id: id,
      keyKind: {
        case: "mapKey",
        value: key,
      },
      value: value,
    });
  }

  public newStructExpr(
    offset: number,
    entries: Expr_CreateStruct_Entry[],
    messageName?: string,
  ): Expr {
    const expr = this.nextExpr(offset);
    expr.exprKind = {
      case: "structExpr",
      value: new Expr_CreateStruct({ entries }),
    };

    if (messageName !== undefined) {
      expr.exprKind.value.messageName = messageName;
    }

    return expr;
  }

  public newStructEntry(
    offset: number,
    field: string,
    value: Expr,
  ): Expr_CreateStruct_Entry {
    const id = ++this.prevId;
    this.sourceInfo.positions[id.toString()] = offset;
    return new Expr_CreateStruct_Entry({
      id: id,
      keyKind: {
        case: "fieldKey",
        value: field,
      },
      value: value,
    });
  }
}
