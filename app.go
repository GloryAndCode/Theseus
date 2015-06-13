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
	session            *mgo.Session
	fs                 http.Handler
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

	// set up DB
	session, err = mgo.Dial("localhost")
	if err != nil {
		panic(err)
	}
	session.SetSafe(&mgo.Safe{})

	userDB = session.DB("Theseus").C("users")
	fileDB = session.DB("Theseus").C("files")
	fs = http.FileServer(http.Dir("client"))
	http.HandleFunc("/", routeHandler)
}

const (
	tokenName = "AccessToken"
)

// serves user creation page
func createHandler(w http.ResponseWriter, r *http.Request) {
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

	r.URL.Path = "/login"
}

// reads the form values, checks them and creates the token
func loginHandler(w http.ResponseWriter, r *http.Request) {
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
	http.Redirect(w, r, "client.html", http.StatusTemporaryRedirect)
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

func routeHandler(w http.ResponseWriter, r *http.Request) {
	_, validToken := getAuth(r)
	if validToken {
		switch r.URL.Path {
		case "/getFile":
			getFileHandler(w, r)
		case "/storeFile":
			storeFileHandler(w, r)
		case "/":
			http.Redirect(w, r, "client.html", http.StatusTemporaryRedirect)
		default:
			fs.ServeHTTP(w, r)
		}
	} else {
		switch r.URL.Path {
		case "/createUser":
			createHandler(w, r)
			if r.URL.Path == "/login" {
				loginHandler(w, r)
			}
		case "/login":
			loginHandler(w, r)
		case "/authenticate":
			loginHandler(w, r)
		case "/client.html":
			http.Redirect(w, r, "login.html", http.StatusTemporaryRedirect)
		case "/":
			http.Redirect(w, r, "login.html", http.StatusTemporaryRedirect)
		default:
			fs.ServeHTTP(w, r)
		}
	}
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
	defer session.Close()

	log.Println("Listening on port 8080...")
	go http.ListenAndServeTLS(":8443", "keys/cert.pem", "keys/certprivate.pem", nil)
	http.ListenAndServe(":8080", nil)
}
