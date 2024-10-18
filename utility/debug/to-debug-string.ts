import type {
  Constant,
  Expr,
  Expr_Ident,
  Expr_Select,
  Expr_Call,
  Expr_CreateList,
  Expr_CreateStruct,
  Expr_Comprehension,
} from "../../external/proto/dev/cel/expr/syntax_pb.ts";

import type { Message } from "@bufbuild/protobuf";

const decoder = new TextDecoder();

export default function toDebugString(
  expr: Expr,
  adorner: Adorner = EmptyAdorner.singleton,
): string {
  const writer = new Writer(adorner);
  writer.buffer(expr);

  return writer.toString();
}

class Writer {
  adorner: Adorner;
  content: string = "";
  indent: number = 0;
  lineStart: boolean = true;

  constructor(adorner: Adorner) {
    this.adorner = adorner;
  }

  buffer(e?: Expr): void {
    if (e == undefined) {
      return;
    }

    switch (e.exprKind.case) {
      case "constExpr":
        this.append(formatLiteral(e.exprKind.value));
        break;
      case "identExpr":
        this.append(e.exprKind.value.name);
        break;
      case "selectExpr":
        this.appendSelect(e.exprKind.value);
        break;
      case "callExpr":
        this.appendCall(e.exprKind.value);
        break;
      case "listExpr":
        this.appendList(e.exprKind.value);
        break;
      case "structExpr":
        this.appendStruct(e.exprKind.value);
        break;
      case "comprehensionExpr":
        this.appendComprehension(e.exprKind.value);
        break;
    }

    this.adorn(e);
  }

  appendSelect(sel: Expr_Select): void {
    this.buffer(sel.operand);
    this.append(".");
    this.append(sel.field);

    if (sel.testOnly) {
      this.append("~test-only~");
    }
  }

  appendCall(call: Expr_Call): void {
    if (call.target !== undefined) {
      // above check is equivalent to `call.isMemberFunction()`
      this.buffer(call.target);
      this.append(".");
    }
    this.append(call.function);
    this.append("(");
    if (call.args.length > 0) {
      this.addIndent();
      this.appendLine();
      for (let i = 0; i < call.args.length; ++i) {
        if (i > 0) {
          this.append(",");
          this.appendLine();
        }
        this.buffer(call.args[i]);
      }
      this.removeIndent();
      this.appendLine();
    }
    this.append(")");
  }

  appendList(list: Expr_CreateList): void {
    this.append("[");
    if (list.elements.length > 0) {
      this.appendLine();
      this.addIndent();
      for (let i = 0; i < list.elements.length; ++i) {
        if (i > 0) {
          this.append(",");
          this.appendLine();
        }
        this.buffer(list.elements[i]);
      }
      this.removeIndent();
      this.appendLine();
    }
    this.append("]");
  }

  appendStruct(obj: Expr_CreateStruct) {
    this.append(obj.messageName);
    this.append("{");
    if (obj.entries.length > 0) {
      this.appendLine();
      this.addIndent();
      for (let i = 0; i < obj.entries.length; ++i) {
        const entry = obj.entries[i];
        if (i > 0) {
          this.append(",");
          this.appendLine();
        }

        if (entry.optionalEntry) {
          this.append("?");
        }

        if (entry.keyKind.case === "fieldKey") {
          this.append(entry.keyKind.value);
        } else {
          this.buffer(entry.keyKind.value);
        }

        this.append(":");
        this.buffer(entry.value);
        this.adorn(entry);
      }
      this.removeIndent();
      this.appendLine();
    }
    this.append("}");
  }

  appendComprehension(comprehension: Expr_Comprehension) {
    this.append("__comprehension__(");
    this.addIndent();
    this.appendLine();
    this.append("// Variable");
    this.appendLine();
    this.append(comprehension.iterVar);
    this.append(",");
    this.appendLine();
    this.append("// Target");
    this.appendLine();
    this.buffer(comprehension.iterRange);
    this.append(",");
    this.appendLine();
    this.append("// Accumulator");
    this.appendLine();
    this.append(comprehension.accuVar);
    this.append(",");
    this.appendLine();
    this.append("// Init");
    this.appendLine();
    this.buffer(comprehension.accuInit);
    this.append(",");
    this.appendLine();
    this.append("// LoopCondition");
    this.appendLine();
    this.buffer(comprehension.loopCondition);
    this.append(",");
    this.appendLine();
    this.append("// LoopStep");
    this.appendLine();
    this.buffer(comprehension.loopStep);
    this.append(",");
    this.appendLine();
    this.append("// Result");
    this.appendLine();
    this.buffer(comprehension.result);
    this.append(")");
    this.removeIndent();
  }

  append(s: string) {
    this.doIndent();
    this.content += s;
  }

  doIndent() {
    if (this.lineStart) {
      this.lineStart = false;
      this.content += " ".repeat(this.indent);
    }
  }

  adorn(e: Message) {
    this.append(this.adorner.GetMetadata(e));
  }

  appendLine() {
    this.content += "\n";
    this.lineStart = true;
  }

  addIndent() {
    this.indent++;
  }

  removeIndent() {
    this.indent--;
    if (this.indent < 0) {
      throw new Error("negative indent");
    }
  }

  toString(): string {
    return this.content;
  }
}

interface Adorner {
  GetMetadata(context: Message): string;
}

class EmptyAdorner implements Adorner {
  static readonly singleton = new EmptyAdorner();
  private constructor() {}

  GetMetadata(): string {
    return "";
  }
}

function formatLiteral(c: Constant): string {
  const kind = c.constantKind;

  switch (kind.case) {
    case "boolValue":
      return kind.value ? "true" : "false";
    case "bytesValue":
      return `b${JSON.stringify(decoder.decode(kind.value))}`;
    case "doubleValue":
      if (Math.floor(kind.value) == kind.value) {
        return `{value.toString()}.0`;
      } else {
        return kind.value.toString();
      }
    case "int64Value":
      return kind.value.toString();
    case "stringValue":
      return JSON.stringify(kind.value);
    case "uint64Value":
      return kind.value.toString();
    case "nullValue":
      return "null";
    default:
      throw new Error(`Unknown constant type: ${kind.case}`);
  }
}
