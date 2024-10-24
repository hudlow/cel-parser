# cel-parser

`cel-parser` is a parser for the [Common Expression Language (CEL)][cel].

It's generated with [Peggy], using the [`peggy-ts`][peggy-ts] plugin. It parses a CEL expression
into a [Protobuf-based][protobuf] abstract syntax tree. It does not evaluate expressions.

It is 100% TypeScript, passing strict checks (without any `any`-typing or `as`-casting) and it
has no runtime dependencies.

It includes a test suite derived from the [`cel-spec` conformance tests][conformance] tests.
However, because these tests are also for evaluation, the derived tests use the AST produced by the
[`cel-go`][cel-go] parser as the expected output. This extraction can be re-run by with
`npm run extract-conformance-tests` but does require an environment with `go`.

It is currently passing all of the 1,916 derived conformance tests and most of [`cel-go`'s parser 
tests][cel-go-parser-tests].

To generate the parser after cloning the repo, simply run `npm ci`. To compile to JavaScript
bundles, use `npm run bundle`. After bundling, you can experiment with the parser using `demo.html`.

A [live, in-browser parser demo][live-demo] is also available.

[cel]: https://cel.dev
[peggy]: https://peggyjs.org
[peggy-ts]: https://github.com/hudlow/peggy-ts
[protobuf]: https://github.com/bufbuild/protobuf-es
[conformance]: https://github.com/google/cel-spec/tree/master/tests/simple/testdata
[cel-go]: https://github.com/google/cel-go
[cel-go-parser-tests]: https://github.com/google/cel-go/blob/master/parser/parser_test.go
[live-demo]: https://hudlow.github.io/cel-parser/
