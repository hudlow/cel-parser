package main

import (
  "fmt"
  "log"
  "os"
  "strings"
  "path/filepath"
	"encoding/json"
  
  "google.golang.org/protobuf/encoding/protojson"
  "google.golang.org/protobuf/encoding/prototext"
  
  
  "github.com/google/cel-go/common"
  "github.com/google/cel-go/common/ast"
  "github.com/google/cel-go/parser"
  
  "cel.dev/expr/conformance/test"
	_ "cel.dev/expr/conformance/proto2"
	_ "cel.dev/expr/conformance/proto3"
)

func main() {
  if (len(os.Args) != 2) {
    fmt.Printf("Usage: extract <test data directory>\n")
    os.Exit(1)
  }
  
  path := os.Args[1]
  files := extractConformanceTests(path)
  filesJson, _ := json.Marshal(files)
  fmt.Println(string(filesJson))
}

type ParserTestFile struct {
  Name string                       `json:"name"`
  Sections []*ParserTestFileSection `json:"sections"`
}

type ParserTestFileSection struct {
  Name string                       `json:"name"`
  Tests []*ParserTest               `json:"tests"`
}

type ParserTest struct {
  Name string
  Expression string
  Result string
}

func (t ParserTest) MarshalJSON() ([]byte, error) {
  name, error := json.Marshal(t.Name)
  
  if error != nil {
    return nil, error
  }
  
  expr, error := json.Marshal(t.Expression)
  
  if error != nil {
    return nil, error
  }
  
  return []byte(`{` +
    `"name":` + string(name) + `,` +
    `"expression":` + string(expr) + `,` +
    `"result":` + t.Result +
  `}`), nil
}

func exprToParserTest(p *parser.Parser, name string, expression string) *ParserTest {
  s := common.NewTextSource(expression)
  
  result, errors := p.Parse(s)
  
  if len(errors.GetErrors()) == 0 {
    pb, pbError := ast.ToProto(result)
    if (pbError != nil) {
      log.Fatal(pbError);  
    }
    
    json, jsonError := protojson.Marshal(pb)
    if (jsonError != nil) {
      log.Fatal(jsonError);  
    }
    
    return &ParserTest{
      name,
      expression,
      string(json),
    }
  }
  
  return nil
}

func newParser(options ...parser.Option) *parser.Parser {
  defaultOpts := []parser.Option{
    parser.Macros(parser.AllMacros...),
    parser.MaxRecursionDepth(32),
    parser.ErrorRecoveryLimit(4),
    parser.ErrorRecoveryLookaheadTokenLimit(4),
    parser.PopulateMacroCalls(true),
    parser.EnableVariadicOperatorASTs(true),
  }
  opts := append([]parser.Option{}, defaultOpts...)
  opts = append(opts, options...)
  p, err := parser.NewParser(opts...)
  if err != nil {
    log.Fatalf("NewParser() failed: %v", err)
  }
  return p
}

func extractConformanceTests(directoryPath string) []*ParserTestFile {
  parser := newParser()
  
  filePaths, err := os.ReadDir(directoryPath)
  if err != nil {
    log.Fatalf("failed to read directory %q: %v", directoryPath, err)
  }
  
  var files []*test.SimpleTestFile
  for _, entry := range filePaths {
    name := entry.Name()
    if (strings.HasSuffix(name, ".textproto")) {
      filePath := filepath.Join(directoryPath, name)
      b, err := os.ReadFile(filePath)
      if err != nil {
        log.Fatalf("failed to read file %q: %v", filePath, err)
      }
      file := &test.SimpleTestFile{}
      err = prototext.Unmarshal(b, file)
      if err != nil {
        log.Fatalf("failed to parse file %q: %v", filePath, err)
      }
      files = append(files, file)
    }
  }
  
  var parserTestFiles []*ParserTestFile
  for _, file := range files {
    var parserTestFileSections []*ParserTestFileSection
    for _, section := range file.GetSection() {
      var parserTests []*ParserTest
      for _, test := range section.GetTest() {
        
        result := exprToParserTest(parser, test.Name, test.Expr)
        
        if result != nil {
          parserTests = append(parserTests, result)  
        }
      }
      parserTestFileSections = append(
        parserTestFileSections,
        &ParserTestFileSection{ section.Name, parserTests },
      )
    }
    parserTestFiles = append(
      parserTestFiles,
      &ParserTestFile{ file.Name, parserTestFileSections },
    )
  }
  
  return parserTestFiles
}