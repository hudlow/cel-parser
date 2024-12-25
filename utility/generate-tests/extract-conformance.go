package main

import (
  "fmt"
  "log"
  "os"
  "strings"
  "path/filepath"
	"encoding/json"

  "google.golang.org/protobuf/encoding/prototext"

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
  tests := extractConformanceTests(path)
  testsJson, _ := json.Marshal(tests)
  fmt.Println(string(testsJson))
}

func extractConformanceTests(directoryPath string) []string {
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

  var tests []string
  for _, file := range files {
    for _, section := range file.GetSection() {
      for _, test := range section.GetTest() {
        tests = append(tests, test.Expr)
      }
    }
  }

  return tests
}
