// Copyright 2024 Dan Hudlow
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

{{
  import type { Expr, Expr_CreateStruct_Entry } from "./external/proto/dev/cel/expr/syntax_pb.ts";
  import { LazyBuilder } from "./builder.ts";
  import type { Eventual } from "./builder.ts";
  const builder = new LazyBuilder();
}}

Entry               = expr:Expr { return expr(); }

Expr                = or:ConditionalOr S
                      tail:TernaryTail?
                      {
                        /* : Eventual<Expr> */
                        if (tail === null) {
                          return or;
                        } else {
                          return builder.newCallExpr(offset(), "_?_:_", [or, ...tail]);
                        }
                      }

TernaryTail         = "?" t:ConditionalOr S ":" f:Expr S
                      {
                        /* : [Eventual<Expr>, Eventual<Expr>] */
                        return [t, f];
                      }

ConditionalOr       = and:ConditionalAnd|1.., S "||"|
                      {
                        /* : Eventual<Expr> */
                        if (and.length === 1) {
                          return and[0];
                        } else {
                          return builder.newCallExpr(offset(), "_||_", and);
                        }
                      }

ConditionalAnd      = relation:Relation|1.., S "&&"|
                      {
                        /* : Eventual<Expr> */
                        if (relation.length === 1) {
                          return relation[0];
                        } else {
                          return builder.newCallExpr(offset(), "_&&_", relation);
                        }
                      }

Relation            = addition:Addition tail:RelationTail?
                      {
                        /* : Eventual<Expr> */
                        if (tail === null) {
                          return addition;
                        } else {
                          return tail.reduce((expr, op) => op(expr), addition);
                        }
                      }

RelationTail        = (
                        S operator:Relop nextExpr:Addition
                        { return ((prevExpr: Eventual<Expr>) => builder.newCallExpr(offset(), operator, [prevExpr, nextExpr])) }
                      )+

Relop               = (
                        operator:("<=" / "<" / ">=" / ">" / "==" / "!=")
                        { return `_${operator}_` }
                      )
                      / "in" { return "@in" }

Addition            = multiplication:Multiplication tail:AdditionTail?
                      {
                        /* : Eventual<Expr> */
                        if (tail === null) {
                          return multiplication;
                        } else {
                          return tail.reduce((expr, op) => op(expr), multiplication);
                        }
                      }

AdditionTail        = (
                        S operator:( o:[+-] { return `_${o}_` } ) nextExpr:Multiplication
                        { return ((prevExpr: Eventual<Expr>) => builder.newCallExpr(offset(), operator, [prevExpr, nextExpr])) }
                      )+

Multiplication      = unary:Unary tail:MultiplicationTail?
                      {
                        /* : Eventual<Expr> */
                        if (tail === null) {
                          return unary;
                        } else {
                          return tail.reduce((expr, op) => op(expr), unary);
                        }
                      }

MultiplicationTail  = (
                        S operator:( o:[*/%] { return `_${o}_` } ) nextExpr:Unary
                        { return ((prevExpr: Eventual<Expr>) => builder.newCallExpr(offset(), operator, [prevExpr, nextExpr])) }
                      )+

Unary               = Member
                    / S ops:( "!"+ / "-"+ ) expr:Member
                      {
                        /* : Eventual<Expr> */
                        if (ops.length % 2 === 0) {
                          return expr;
                        } else {
                          return builder.newCallExpr(offset(), `${ops[0]}_`, [expr]);
                        }
                      }

Member              = S primary:Primary tail:MemberTail
                      {
                        /* : Eventual<Expr> */
                        if (tail.length === 0) {
                          return primary;
                        } else {
                          return tail.reduce((expr, op) => op(expr), primary);
                        }
                      }

MemberTail          = (S @Access)*

Access              = "." S field:Identifier S ![(]
                      { return ((prevExpr: Eventual<Expr>) => builder.newSelectExpr(offset(), prevExpr, field)) }
                    / "." S Identifier:Identifier S "(" args:ExprList ")"
                      { return ((prevExpr: Eventual<Expr>) => builder.newMemberCallExpr(offset(), prevExpr, Identifier, args)) }
                    / "[" index:Expr "]"
                      { return ((prevExpr: Eventual<Expr>) => builder.newCallExpr(offset(), "_[_]", [prevExpr, index])) }

Primary             = Literal
                    / "."? S name:Identifier !(S [({]) !("." Identifier|1.., "."| "{")
                      { return builder.newIdentExpr(offset(), name) }
                    / "."? S Identifier:Identifier S "(" args:ExprList ")"
                      { return builder.newCallExpr(offset(), Identifier, args) }
                    / "."? name:$Identifier|1.., "."| S "{" entries:FieldInits (",")? "}"
                      { return builder.newStructExpr(offset(), entries, name) }
                    / "(" @Expr ")"
                    / elements:("[" @ExprList (",")? "]")
                      { return builder.newListExpr(offset(), elements) }
                    / entries:("{" @MapInits (",")? "}")
                      { return builder.newStructExpr(offset(), entries) }

ExprList            = Expr|0.., ","|

FieldInits          = (
                        S Identifier:Identifier S ":" value:Expr
                        { return builder.newStructEntry(offset(), Identifier, value) }
                      )|0.., ","|

MapInits            = (
                        key:Expr ":" value:Expr
                        { return builder.newMapEntry(offset(), key, value) }
                      )|0.., ","|

Identifier               = !Reserved
                      @$([_a-zA-Z][_a-zA-Z0-9]*)

Literal             = FloatLiteral / UnsignedIntLiteral / IntLiteral / StringLiteral / BytesLiteral / BooleanLiteral / NullLiteral

IntLiteral          = digits:$("-"? ("0x" HexDigit+ / Digit+))
                    { return builder.newInt64Expr(offset(), digits) }

UnsignedIntLiteral  = digits:$("0x" HexDigit+ / Digit+) [uU]
                    { return builder.newUnsignedInt64Expr(offset(), digits) }

FloatLiteral        = digits: $("-"? Digit* "." Digit+ Exponent? / "-"? Digit+ Exponent)
                    { return builder.newDoubleExpr(offset(), digits) }

Digit               = [0-9]

HexDigit            = [0-9abcdefABCDEF]

Exponent            = [eE] [+-]? Digit+

StringLiteral       = bytes:CharacterSequence
                    { return builder.newStringExpr(offset(), bytes) }

BytesLiteral        = [bB] bytes:CharacterSequence
                    { return builder.newBytesExpr(offset(), bytes) }

CharacterSequence   = [rR] @( '"""'  @(!'"""' @.)*                  '"""'
                    / "'''"  @(!"'''" @.)*                          "'''"
                    / '"'    @(!( '"' / NewLine ) @.)*              '"'
                    / "'"    @(!( "'" / NewLine ) @.)*              "'")
                    /       ( '"""'  @(Escape / $(!'"""' @.))*      '"""'
                    / "'''"  @(Escape / $(!"'''" @.))*              "'''"
                    / '"'    @(Escape / $(!( '"' / NewLine ) @.))*  '"'
                    / "'"    @(Escape / $(!( "'" / NewLine ) @.))*  "'")

Escape              = ByteSequence
                    / "\\" value:[abfnrtv]
                    {
                      switch(value) {
                        case 'a': return "\x07";
                        case 'b': return "\b";
                        case 'f': return "\f";
                        case 'n': return "\n";
                        case 'r': return "\r";
                        case 't': return "\t";
                        case 'v': return "\v";
                      }

                      throw new Error();
                      }
                      / "\\" @$[\"\'\`\\?]

ByteSequence        = Bytes+

Bytes               = "\\x" value:$Byte|1|            { return parseInt(value, 16) }
                    / "\\u" value:$Byte|2|            { return parseInt(value, 16) }
                    / "\\U" value:$Byte|4|            { return parseInt(value, 16) }
                    / "\\" value:$([0-3] [0-7] [0-7]) { return parseInt(value, 8) }

Byte                = $(HexDigit HexDigit)

NewLine             = "\r\n" / "\r" / "\n"

BooleanLiteral      = keyword:("true" / "false")
                    { return builder.newBoolExpr(offset(), keyword) }

NullLiteral         = "null" ![_a-zA-Z0-9]
                    { return builder.newNullExpr(offset()) }

                    // Note we don't use BooleanLiteral or NullLiteral below
                    // Because they include actions, and we want this code path
                    // to be highly optimized.
Reserved            = ("true" / "false" / "null" / "in"
                    / "as" / "break" / "const" / "continue" / "else"
                    / "for" / "function" / "if" / "import" / "let"
                    / "loop" / "package" / "namespace" / "return"
                    / "var" / "void" / "while") ![_a-zA-Z0-9]

S                   = WhiteSpace?

WhiteSpace          = [\t\n\f\r ]+

Comment             = '//' !NewLine* NewLine
