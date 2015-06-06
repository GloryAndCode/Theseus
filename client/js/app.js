var view = new View();
var fs = new FileSystem();

var app = new Dispatcher(fs, view);

app.initApp('js/demoApps/helloWorld.js');
