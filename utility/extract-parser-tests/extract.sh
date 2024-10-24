#!/bin/zsh

url=$(jq -r .utility.celGo package.json)

rm -rf external/cel-go
mkdir -p external/cel-go
curl $url -L | tar -xzv --strip-components 1 -C external/cel-go

cd utility/extract-parser-tests
mkdir bin 2&> /dev/null
GOBIN=$(realpath ./bin) zsh -c "go install github.com/asty-org/asty"

ast=$(mktemp)
bin/asty go2json -input ../../external/cel-go/parser/parser_test.go -output $ast

jqexp='[.Decls[] | select(.Tok == "var") | .Specs[] | select(.Names[].Name | contains("testCases")) | .Values[0].Elts[].Elts | [.[] | {key: .Key.Name, value: .Value}] | from_entries]'

cat $ast | jq $jqexp > ../../test/data/parser.json

prettier --write ../../test/data/parser.json
