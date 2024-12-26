module github.com/hudlow/cel-parser/utility/extract-parser-tests

go 1.23.2

require (
	cel.dev/expr v0.19.1
	github.com/google/cel-go v0.22.1
	google.golang.org/protobuf v1.36.1
)

require (
	github.com/antlr4-go/antlr/v4 v4.13.1 // indirect
	github.com/asty-org/asty v0.1.8 // indirect
	github.com/stoewer/go-strcase v1.3.0 // indirect
	golang.org/x/exp v0.0.0-20241217172543-b2144cdd0a67 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20241223144023-3abc09e42ca8 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20241223144023-3abc09e42ca8 // indirect
)

replace github.com/google/cel-go => ../../external/cel-go
