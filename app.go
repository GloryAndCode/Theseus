// TODO:
// If authentication request, attempt authentication
// Else
// Reject non-authenticated requests
// If user-preferences request, send user preferences
// If user-preferences put, save user preferences
// If file-hash request and if user-authorized, send file-hash
// If file request and if user-authorized, send file
// If file put and if user-authorized, save file

package main

import (
	"fmt"
	jwt "github.com/dgrijalva/jwt-go"
	bcrypt "golang.org/x/crypto/bcrypt"
	"gopkg.in/mgo.v2"
	"gopkg.in/mgo.v2/bson"
	"io/ioutil"
	"log"
	"net/http"
	"time"
)

type ApiHandler struct{}
type User struct {
	UserName string
	Hash     []byte
}

const (
	privKeyPath = "keys/app.rsa"     // openssl genrsa -out app.rsa keysize
	pubKeyPath  = "keys/app.rsa.pub" // openssl rsa -in app.rsa -pubout > app.rsa.pub
)

// keys are held in global variables
// i havn't seen a memory corruption/info leakage in go yet
// but maybe it's a better idea, just to store the public key in ram?
// and load the signKey on every signing request? depends on  your usage i guess
var (
	verifyKey, signKey []byte
	userDB, fileDB     *mgo.Collection
)

// read the key files before starting http handlers
func init() {
	var err error

	signKey, err = ioutil.ReadFile(privKeyPath)
	if err != nil {
		log.Fatal("Error reading private key")
		return
	}

	verifyKey, err = ioutil.ReadFile(pubKeyPath)
	if err != nil {
		log.Fatal("Error reading private key")
		return
	}
}

// just some html, to lazy for http.FileServer()
const (
	tokenName = "AccessToken"

	landingHtml = `<h2>Welcome to the JWT Test</h2>

<a href="/restricted">fun area</a>

<form action="/authenticate" method="POST">
  <input type="text" name="user">
  <input type="password" name="pass">
  <input type="submit">
</form>`

	successHtml    = `<h2>Token Set - have fun!</h2><p>Go <a href="/">Back...</a></p>`
	restrictedHtml = `<h1>Welcome!!</h1><img src="https://httpcats.herokuapp.com/200" alt="" />`
)

// serves the form and restricted link
func landingHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, landingHtml)
}

// reads the form values, checks them and creates the token
func authHandler(w http.ResponseWriter, r *http.Request) {
	// make sure its post
	if r.Method != "POST" {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintln(w, "No POST", r.Method)
		return
	}

	username := r.FormValue("user")
	pass := r.FormValue("pass")

	log.Printf("Authenticate: user[%s] pass[%s]\n", username, pass)

	user := User{}
	err := userDB.Find(bson.M{"username": username}).One(&user)

	err = bcrypt.CompareHashAndPassword(user.Hash, []byte(pass))

	// check values
	if err != nil {
		w.WriteHeader(http.StatusForbidden)
		fmt.Fprintln(w, "Wrong info")
		return
	}

	// create a signer for rsa 256
	t := jwt.New(jwt.GetSigningMethod("RS256"))

	// set our claims
	t.Claims["AccessToken"] = "level1"
	t.Claims["CustomUserInfo"] = struct {
		Name string
		Kind string
	}{username, "human"}

	// set the expire time
	// see http://tools.ietf.org/html/draft-ietf-oauth-json-web-token-20#section-4.1.4
	t.Claims["exp"] = time.Now().Add(time.Minute * 1).Unix()
	tokenString, err := t.SignedString(signKey)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintln(w, "Sorry, error while Signing Token!")
		log.Printf("Token Signing error: %v\n", err)
		return
	}

	// i know using cookies to store the token isn't really helpfull for cross domain api usage
	// but it's just an example and i did not want to involve javascript
	http.SetCookie(w, &http.Cookie{
		Name:       tokenName,
		Value:      tokenString,
		Path:       "/",
		RawExpires: "0",
	})

	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintln(w, successHtml)
}

// only accessible with a valid token
func restrictedHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		authHandler(w, r)
		return
	}
	// check if we have a cookie with out tokenName
	tokenCookie, err := r.Cookie(tokenName)
	switch {
	case err == http.ErrNoCookie:
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprintln(w, "No Token, no fun!")
		return
	case err != nil:
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintln(w, "Error while Parsing cookie!")
		log.Printf("Cookie parse error: %v\n", err)
		return
	}

	// just for the lulz, check if it is empty.. should fail on Parse anyway..
	if tokenCookie.Value == "" {
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprintln(w, "No Token, no fun!")
		return
	}

	// validate the token
	token, err := jwt.Parse(tokenCookie.Value, func(token *jwt.Token) (interface{}, error) {
		// since we only use the one private key to sign the tokens,
		// we also only use its public counter part to verify
		return verifyKey, nil
	})

	// branch out into the possible error from signing
	switch err.(type) {

	case nil: // no error

		if !token.Valid { // but may still be invalid
			w.WriteHeader(http.StatusUnauthorized)
			fmt.Fprintln(w, "WHAT? Invalid Token? F*** off!")
			return
		}

		// see stdout and watch for the CustomUserInfo, nicely unmarshalled
		log.Printf("Someone accessed resricted area! Token:%+v\n", token)
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, restrictedHtml)

	case *jwt.ValidationError: // something was wrong during the validation
		vErr := err.(*jwt.ValidationError)

		switch vErr.Errors {
		case jwt.ValidationErrorExpired:
			// w.WriteHeader(http.StatusUnauthorized)
			// fmt.Fprintln(w, "Token Expired, get a new one.")
			landingHandler(w, r)
			return

		default:
			w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintln(w, "Error while Parsing Token!")
			log.Printf("ValidationError error: %+v\n", vErr.Errors)
			return
		}

	default: // something else went wrong
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintln(w, "Error while Parsing Token!")
		log.Printf("Token parse error: %v\n", err)
		return
	}

}

func (s ApiHandler) ServeHTTP(
	w http.ResponseWriter,
	r *http.Request) {
}

func main() {
	// fs := http.FileServer(http.Dir("client"))
	// http.Handle("/", fs)
	// go http.ListenAndServeTLS(":8443", "certFile", "keyFile", &ApiHandler{})
	// log.Println("Listening...")
	// http.ListenAndServe(":3000", nil)

	// http.HandleFunc("/", landingHandler)
	// http.HandleFunc("/authenticate", authHandler)
	http.HandleFunc("/", restrictedHandler)
	session, err := mgo.Dial("localhost")
	if err != nil {
		panic(err)
	}
	defer session.Close()

	userDB = session.DB("Theseus").C("users")
	fileDB = session.DB("Theseus").C("files")

	// hash, _ := bcrypt.GenerateFromPassword([]byte("test"), 10)
	// testUser := User{"test", hash}
	// userDB.Insert(&testUser)

	log.Println("Listening...")
	http.ListenAndServe(":8080", nil)
}
