package main

import (
  "fmt"
  "log"
  "os"
  "io"
	"reflect"
	"encoding/json"
  
  "github.com/google/cel-go/common"
  "github.com/google/cel-go/common/ast"
  "github.com/google/cel-go/common/debug"
	"github.com/google/cel-go/common/types"
  "github.com/google/cel-go/parser"
)

func main() {
  if (len(os.Args) != 1) {
    fmt.Printf("Usage: <JSON array> | parse")
    os.Exit(1)
  }
  
  input, _ := io.ReadAll(os.Stdin)
  
  var inputArray []string
  _ = json.Unmarshal(input, &inputArray)
  
  outputArray := parseExpressions(inputArray)
  
  output, _ := json.Marshal(outputArray)
  fmt.Println(string(output))
}

type ParserTest struct {
  Expression string `json:"expr"`
  Ast string        `json:"ast,omitempty"`
  Error string      `json:"error,omitempty"`
}

func exprToParserTest(p *parser.Parser, expression string) *ParserTest {
  s := common.NewTextSource(expression)
  
  ast, errors := p.Parse(s)
  
  if len(errors.GetErrors()) == 0 {
    return &ParserTest{
      expression,
      debug.ToAdornedDebugString(
        ast.Expr(),
        &kindAdorner{},
      ),
      "",
    } 
  } else {
    return &ParserTest{
      expression,
      "",
      errors.ToDisplayString(),
    } 
  }
}

func newParser() *parser.Parser {
  defaultOpts := []parser.Option{
    parser.Macros(parser.AllMacros...),
    parser.MaxRecursionDepth(32),
    parser.ErrorRecoveryLimit(4),
    parser.ErrorRecoveryLookaheadTokenLimit(4),
    parser.PopulateMacroCalls(true),
    parser.EnableVariadicOperatorASTs(true),
  }
  opts := append([]parser.Option{}, defaultOpts...)
  p, err := parser.NewParser(opts...)
  if err != nil {
    log.Fatalf("NewParser() failed: %v", err)
  }
  return p
}

func parseExpressions(expressions []string) []*ParserTest {
  parser := newParser()
  
  var parserTests []*ParserTest
  for _, test := range expressions {
    
    result := exprToParserTest(parser, test)
    
    if result != nil {
      parserTests = append(parserTests, result)  
    }
  }
  
  return parserTests
}

type kindAdorner struct {
	sourceInfo *ast.SourceInfo
}

func (k *kindAdorner) GetMetadata(elem any) string {
	switch e := elem.(type) {
	case ast.Expr:
		if macroCall, found := k.sourceInfo.GetMacroCall(e.ID()); found {
			return fmt.Sprintf("^#%s#", macroCall.AsCall().FunctionName())
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
		return fmt.Sprintf("^#%s#", valType)
	case ast.EntryExpr:
		return fmt.Sprintf("^#%s#", "*expr.Expr_CreateStruct_Entry")
	}
	return ""
}