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

type File struct {
	FileName     string
	Owner        string
	FileContents string
}

const (
	privKeyPath = "keys/app.rsa"     // openssl genrsa -out app.rsa keysize
	pubKeyPath  = "keys/app.rsa.pub" // openssl rsa -in app.rsa -pubout > app.rsa.pub
)

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

// just some html, too lazy for http.FileServer()
const (
	tokenName = "AccessToken"

	landingHtml = `<h2>Welcome to the JWT Test</h2>

<a href="/restricted">fun area</a>

<form action="/authenticate" method="POST">
  <input type="text" name="user">
  <input type="password" name="pass">
  <input type="submit">
</form>`

	createUserHTML = `<h2>Welcome to the Test Sign up</h2>

<a href="/restricted">fun area</a>

<form action="/createUser" method="POST">
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

// serves user creation page
func createHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, createUserHTML)
		return
	}

	username := r.FormValue("user")
	pass := r.FormValue("pass")
	user := User{}
	err := userDB.Find(bson.M{"username": username}).One(&user)

	if user.UserName == username {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintln(w, "User already exists")
		return
	}

	if len(pass) < 8 {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintln(w, "Password must contain at least 8 characters")
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(pass), 10)
	user.UserName = username
	user.Hash = hash
	err = userDB.Insert(&user)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintln(w, "Error creating user.")
		return
	}

	loginHandler(w, r)
}

// reads the form values, checks them and creates the token
func loginHandler(w http.ResponseWriter, r *http.Request) {
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

	// include username in cookie
	t.Claims["username"] = username

	// set the expire time
	t.Claims["exp"] = time.Now().Add(time.Hour * 24 * 7).Unix()
	tokenString, err := t.SignedString(signKey)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintln(w, "Sorry, error while Signing Token!")
		log.Printf("Token Signing error: %v\n", err)
		return
	}

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
		loginHandler(w, r)
		return
	}
	// check if we have a cookie with our tokenName
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
		return verifyKey, nil
	})

	// branch out into the possible error from signing
	switch err.(type) {

	case nil: // no error

		if !token.Valid { // but may still be invalid
			w.WriteHeader(http.StatusUnauthorized)
			fmt.Fprintln(w, "Invalid Token.")
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

func storeFileHandler(w http.ResponseWriter, r *http.Request) {
	userName, authenticated := getAuth(r)
	if !authenticated {
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprintln(w, "Not authenticated.")
		return
	}

	var file File
	file.FileName = r.FormValue("fileName")
	file.Owner = userName
	file.FileContents = r.FormValue("fileContents")

	err := fileDB.Update(bson.M{"filename": file.FileName, "owner": file.Owner}, &file)
	// if there wasn't a file to update, insert file into DB
	if err != nil {
		err = fileDB.Insert(&file)
		if err != nil {
			w.WriteHeader(http.StatusOK)
			fmt.Fprintln(w, "Error inserting into DB.")
			return
		}
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintln(w, "Success!")
	return
}

func getFileHandler(w http.ResponseWriter, r *http.Request) {
	userName, authenticated := getAuth(r)
	if !authenticated {
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprintln(w, "Not authenticated.")
		return
	}

	var file File
	fileDB.Find(bson.M{"filename": r.FormValue("fileName"), "owner": userName}).One(&file)
	w.WriteHeader(http.StatusOK)
	fmt.Fprintln(w, file.FileContents)
	return
}

// returns username and boolean indicating if the token was valid
func getAuth(r *http.Request) (string, bool) {
	// check if we have a cookie with our tokenName
	tokenCookie, err := r.Cookie(tokenName)

	if err != nil {
		return "", false
	}

	// validate the token
	token, err := jwt.Parse(tokenCookie.Value, func(token *jwt.Token) (interface{}, error) {
		return verifyKey, nil
	})

	if err == nil && token.Valid {
		str, ok := token.Claims["username"].(string)
		if ok {
			return str, true
		} else {
			log.Print("token.Claims[\"username\"] Not a string.")
			return "", false
		}

	}

	return "", false
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

	http.HandleFunc("/createUser", createHandler)
	http.HandleFunc("/login", loginHandler)
	http.HandleFunc("/", restrictedHandler)
	http.HandleFunc("/getFile", getFileHandler)
	http.HandleFunc("/storeFile", storeFileHandler)

	session, err := mgo.Dial("localhost")
	if err != nil {
		panic(err)
	}
	defer session.Close()
	session.SetSafe(&mgo.Safe{})

	userDB = session.DB("Theseus").C("users")
	fileDB = session.DB("Theseus").C("files")

	log.Println("Listening on port 8080...")
	http.ListenAndServe(":8080", nil)
}