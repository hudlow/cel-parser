package main

import (
  "fmt"
  "log"
  "os"
  "reflect"
  "sort"
  "strings"
  "path/filepath"
	"encoding/json"
  
  "google.golang.org/protobuf/encoding/protojson"
  "google.golang.org/protobuf/encoding/prototext"
  
  "cel.dev/expr/proto/test/v1/testpb"
  
  "github.com/google/cel-go/common"
  "github.com/google/cel-go/common/ast"
  "github.com/google/cel-go/common/debug"
  "github.com/google/cel-go/common/types"
  "github.com/google/cel-go/parser"

	_ "cel.dev/expr/proto/test/v1/proto2/test_all_types"
	_ "cel.dev/expr/proto/test/v1/proto3/test_all_types"
)

type metadata interface {
  GetLocation(exprID int64) (common.Location, bool)
}

type kindAndIDAdorner struct {
  sourceInfo *ast.SourceInfo
}

func (k *kindAndIDAdorner) GetMetadata(elem any) string {
  switch e := elem.(type) {
  case ast.Expr:
    if macroCall, found := k.sourceInfo.GetMacroCall(e.ID()); found {
      return fmt.Sprintf("^#%d:%s#", e.ID(), macroCall.AsCall().FunctionName())
    }
    var valType string
    switch e.Kind() {
    case ast.CallKind:
      valType = "*expr.Expr_CallExpr"
    case ast.ComprehensionKind:
      valType = "*expr.Expr_ComprehensionExpr"
    case ast.IdentKind:
      valType = "*expr.Expr_IdentExpr"
    case ast.LiteralKind:
      lit := e.AsLiteral()
      switch lit.(type) {
      case types.Bool:
        valType = "*expr.Constant_BoolValue"
      case types.Bytes:
        valType = "*expr.Constant_BytesValue"
      case types.Double:
        valType = "*expr.Constant_DoubleValue"
      case types.Int:
        valType = "*expr.Constant_Int64Value"
      case types.Null:
        valType = "*expr.Constant_NullValue"
      case types.String:
        valType = "*expr.Constant_StringValue"
      case types.Uint:
        valType = "*expr.Constant_Uint64Value"
      default:
        valType = reflect.TypeOf(lit).String()
      }
    case ast.ListKind:
      valType = "*expr.Expr_ListExpr"
    case ast.MapKind, ast.StructKind:
      valType = "*expr.Expr_StructExpr"
    case ast.SelectKind:
      valType = "*expr.Expr_SelectExpr"
    }
    return fmt.Sprintf("^#%d:%s#", e.ID(), valType)
  case ast.EntryExpr:
    return fmt.Sprintf("^#%d:%s#", e.ID(), "*expr.Expr_CreateStruct_Entry")
  }
  return ""
}

type locationAdorner struct {
  sourceInfo *ast.SourceInfo
}

var _ metadata = &locationAdorner{}

func (l *locationAdorner) GetLocation(exprID int64) (common.Location, bool) {
  loc := l.sourceInfo.GetStartLocation(exprID)
  return loc, loc != common.NoLocation
}

func (l *locationAdorner) GetMetadata(elem any) string {
  var elemID int64
  switch elem := elem.(type) {
  case ast.Expr:
    elemID = elem.ID()
  case ast.EntryExpr:
    elemID = elem.ID()
  }
  location, _ := l.GetLocation(elemID)
  return fmt.Sprintf("^#%d[%d,%d]#", elemID, location.Line(), location.Column())
}

func convertMacroCallsToString(source *ast.SourceInfo) string {
  macroCalls := source.MacroCalls()
  keys := make([]int64, len(macroCalls))
  adornedStrings := make([]string, len(macroCalls))
  i := 0
  for k := range macroCalls {
    keys[i] = k
    i++
  }
  fac := ast.NewExprFactory()
  // Sort the keys in descending order to create a stable ordering for tests and improve readability.
  sort.Slice(keys, func(i, j int) bool { return keys[i] > keys[j] })
  i = 0
  for _, key := range keys {
    call := macroCalls[int64(key)].AsCall()
    var callWithID ast.Expr
    if call.IsMemberFunction() {
      callWithID = fac.NewMemberCall(int64(key), call.FunctionName(), call.Target(), call.Args()...)
    } else {
      callWithID = fac.NewCall(int64(key), call.FunctionName(), call.Args()...)
    }
    adornedStrings[i] = debug.ToAdornedDebugString(
      callWithID,
      &kindAndIDAdorner{sourceInfo: source})
    i++
  }
  return strings.Join(adornedStrings, ",\n")
}

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
  
  var files []*testpb.SimpleTestFile
  for _, entry := range filePaths {
    name := entry.Name()
    if (strings.HasSuffix(name, ".textproto")) {
      filePath := filepath.Join(directoryPath, name)
      b, err := os.ReadFile(filePath)
      if err != nil {
        log.Fatalf("failed to read file %q: %v", filePath, err)
      }
      file := &testpb.SimpleTestFile{}
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