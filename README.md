# cel-parser

`cel-parser` is a parser for the [Common Expression Language (CEL)][cel].

It's generated with [Peggy], using the [`peggy-ts`][peggy-ts] plugin. It parses a CEL expression
into a [Protobuf-based][protobuf] abstract syntax tree. It does not execute expressions.

[cel]: https://cel.dev
[peggy]: https://peggyjs.org
[peggy-ts]: https://github.com/hudlow/peggy-ts
[protobuf]: https://github.com/bufbuild/protobuf-es
