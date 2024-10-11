#!/bin/zsh

url=$(jq -r .utility.celSpec package.json)

rm -rf external/cel-spec
mkdir -p external/cel-spec
curl $url -L | tar -xzv --strip-components 1 -C external/cel-spec

cd utility/extract-conformance-tests

go run extract.go ../../external/cel-spec/tests/simple/testdata | jq . > ../../test/data/conformance.json

prettier --write ../../test/data/conformance.json