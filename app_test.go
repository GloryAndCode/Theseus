package main

import (
	jwt "github.com/dgrijalva/jwt-go"
	bcrypt "golang.org/x/crypto/bcrypt"
	"gopkg.in/mgo.v2/bson"
	"io/ioutil"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

var (
	client http.Client
)

func TestCreateHandler(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(createHandler))
	defer ts.Close()

	userDB = session.DB("TheseusTest").C("testUsers")
	userDB.DropCollection()

	res, err := http.PostForm(ts.URL, url.Values{"user": {"user"}, "pass": {"password"}})
	res.Body.Close()
	if err != nil {
		t.Error(err)
	}

	var user User
	err = userDB.Find(bson.M{"username": "user"}).One(&user)
	if err != nil {
		t.Error(err)
	}
	err = bcrypt.CompareHashAndPassword(user.Hash, []byte("password"))
	if err != nil {
		t.Error("unable to create/find/auth new user")
	}

	res, err = http.PostForm(ts.URL, url.Values{"user": {"user"}, "pass": {"password123"}})
	res.Body.Close()
	if err != nil {
		t.Error(err)
	}

	user = User{}
	err = userDB.Find(bson.M{"username": "user"}).One(&user)
	if err != nil {
		t.Error(err)
	}
	err = bcrypt.CompareHashAndPassword(user.Hash, []byte("password"))
	if err != nil {
		t.Error("existing user can be overwritten by new user")
	}

}

func TestGetAuth(t *testing.T) {
	token := jwt.New(jwt.GetSigningMethod("RS256"))
	token.Claims["username"] = "usernameisrequired"
	cookie, _ := token.SignedString(signKey)
	cookie = "AccessToken=" + cookie

	r := http.Request{}
	r.Header = make(map[string][]string)
	r.Header["Cookie"] = []string{cookie}

	_, auth := getAuth(&r)
	if !auth {
		t.Error("expected getAuth to return true")
	}

	cookie = "AccessToken=yougotpwned"
	r.Header["Cookie"] = []string{cookie}
	_, auth = getAuth(&r)
	if auth {
		t.Error("expected getAuth to return false")
	}
}

// relies on TestCreateUser passing
func TestLoginHandler(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(loginHandler))
	defer ts.Close()

	cJar, err := cookiejar.New(nil)
	if err != nil {
		t.Error(err)
	}
	client = http.Client{
		Jar: cJar,
	}

	res, err := client.PostForm(ts.URL, url.Values{"user": {"user"}, "pass": {"password"}})
	res.Body.Close()
	if err != nil {
		t.Error(err)
	}

	if len(res.Header["Set-Cookie"]) == 0 {
		t.Error("expected response header to have a 'Set-Cookie' key.")
	}

	res, err = http.PostForm(ts.URL, url.Values{"user": {"user"}, "pass": {"password123"}})
	res.Body.Close()
	if err != nil {
		t.Error(err)
	}

	if len(res.Header["Set-Cookie"]) != 0 {
		t.Error("expected response header to not have a 'Set-Cookie' key.")
	}
}

func TestFileHandlers(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(storeFileHandler))

	fileDB = session.DB("TheseusTest").C("testFiles")
	fileDB.DropCollection()

	res, err := client.PostForm(ts.URL, url.Values{"fileName": {"myFileName"}, "fileContents": {"myFileContents"}})
	res.Body.Close()
	if err != nil {
		t.Error(err)
	}

	var file File
	err = fileDB.Find(bson.M{"filename": "myFileName"}).One(&file)
	if err != nil {
		t.Error(err)
	}
	if file.FileContents != "myFileContents" {
		t.Error("expected storeFileHandler to save to DB")
	}

	ts.Close()
	ts = httptest.NewServer(http.HandlerFunc(getFileHandler))
	defer ts.Close()

	res, err = client.PostForm(ts.URL, url.Values{"fileName": {"myFileName"}})
	if err != nil {
		t.Error(err)
	}
	body, err := ioutil.ReadAll(res.Body)
	res.Body.Close()
	if err != nil {
		t.Error(err)
	}

	if !strings.Contains(string(body), ("myFileContents")) {
		t.Error("expected response body to equal 'myFileContents', got ", string(body))
	}
}

func TestStaticFile(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(routeHandler))
	defer ts.Close()

	// get create page
	res, err := http.Get(ts.URL + "/create.html")
	if err != nil {
		t.Error(err)
	}

	body, err := ioutil.ReadAll(res.Body)
	res.Body.Close()
	if err != nil {
		t.Error(err)
	}
	if !strings.Contains(string(body), "<form action=\"/createUser\" method=\"POST\">") {
		t.Error("Expected response body to contain '<form action=\"/createUser\" method=\"POST\">'")
	}

	//get client page with valid token
	res, err = client.Get(ts.URL + "/client.html")
	if err != nil {
		t.Error(err)
	}

	body, err = ioutil.ReadAll(res.Body)
	res.Body.Close()
	if err != nil {
		t.Error(err)
	}
	if !strings.Contains(string(body), "<script src=\"js/bundle.js\"></script>") {
		t.Error("Expected response body to contain '<script src=\"js/bundle.js\"></script>'")
	}

	//fail to get client page without valid token
	res, err = http.Get(ts.URL + "/client.html")
	if err != nil {
		t.Error(err)
	}

	body, err = ioutil.ReadAll(res.Body)
	res.Body.Close()
	if err != nil {
		t.Error(err)
	}
	if strings.Contains(string(body), "<script src=\"js/bundle.js\"></script>") {
		t.Error("Expected response body to not contain '<script src=\"js/bundle.js\"></script>'")
	}
}
