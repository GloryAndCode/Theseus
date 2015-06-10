var View = require('./view.js');
var FileSystem = require('./fileSystem.js');
var Dispatcher = require('./dispatcher.js');

var view = new View();
var fs = new FileSystem();

var app = new Dispatcher(fs, view);

app.initApp('js/demoApps/chip8.js');
app.initApp('js/demoApps/helloWorld.js');
