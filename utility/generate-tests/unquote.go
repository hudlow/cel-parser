package main

import (
  "encoding/json"
  "fmt"
  "io"
  "os"
  "strconv"
)

func main() {
  if (len(os.Args) != 1) {
    fmt.Printf("Usage: <JSON array> | unquote")
    os.Exit(1)
  }
  
  input, _ := io.ReadAll(os.Stdin)
  
  var inputArray []string
  _ = json.Unmarshal(input, &inputArray)
  
  var outputArray []string
  for _, item := range inputArray {
    unquotedItem, _ := strconv.Unquote(item)
    outputArray = append(outputArray, unquotedItem)
  }
  
  output, _ := json.Marshal(outputArray)
  fmt.Println(string(output))
}