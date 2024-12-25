#!/bin/zsh

url=$(jq -r .utility.celGo package.json)
rm -rf external/cel-go
mkdir -p external/cel-go
curl $url -L | tar -xzv --strip-components 1 -C external/cel-go

url=$(jq -r .utility.celSpec package.json)
rm -rf external/cel-spec
mkdir -p external/cel-spec
curl $url -L | tar -xzv --strip-components 1 -C external/cel-spec

rm -rf test/data
mkdir test/data 2&> /dev/null

cd utility/generate-tests
mkdir bin 2&> /dev/null
GOBIN=$(realpath ./bin) zsh -c "go install github.com/asty-org/asty"

ast=$(mktemp)
bin/asty go2json -input ../../external/cel-go/parser/parser_test.go -output $ast

jqexp='[.Decls[] | select(.Tok == "var") | .Specs[] | select(.Names[].Name | contains("testCases")) | .Values[0].Elts[].Elts | [.[] | {key: .Key.Name, value: .Value}] | from_entries | .I.Value]'

cat $ast | jq $jqexp | go run unquote.go | go run parse.go > ../../test/data/parser.json

ast=$(mktemp)
bin/asty go2json -input ../../external/cel-go/ext/comprehensions_test.go -output $ast

jqexp='[.Decls[] | select(.NodeType == "FuncDecl" and (.Name.Name | startswith("Test"))).Body.List[0].Rhs[] | select(.NodeType == "CompositeLit") | .Elts[].Elts[] | select(.Key.Name == "expr").Value.Value]'

cat $ast | jq $jqexp | go run unquote.go | go run parse.go > ../../test/data/comprehensions.json

go run extract-conformance.go ../../external/cel-spec/tests/simple/testdata | go run parse.go > ../../test/data/conformance.json

prettier -w ../../test/data
