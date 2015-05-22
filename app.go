package main

import (
  "log"
  "net/http"
  "fmt"
)

type apiHandler struct {}

func (s apiHandler) ServeHTTP(
  w http.ResponseWriter,
  r *http.Request) {

// TODO: 
  // If authentication request, attempt authentication
  // Else
    // Reject non-authenticated requests
    // If user-preferences request, send user preferences
    // If user-preferences put, save user preferences
    // If file-hash request and if user-authorized, send file-hash
    // If file request and if user-authorized, send file
    // If file put and if user-authorized, save file

}

func main() {
  fs := http.FileServer(http.Dir("client"))
  http.Handle("/", fs)
  http.Handle("/api", apiHandler{})

  log.Println("Listening...")
  http.ListenAndServe(":3000", nil)
}
