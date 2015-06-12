/**
 * Creates Dispatcher instance
 * @constructor
 * @param {FileSystem} fileSystem - instance of FileSystem for dispatcher to use
 * @param {View} view - instance of View for dispatcher to use
 * @return {Dispatcher} returns initialized Dispatcher instance
 */
var Dispatcher = function(fileSystem, view) {
  this.runningApps = {};
  this.fileSystem = fileSystem;
  this.view = view;
};

/**
 * Initializes application
 * @param {String} script - uri for application script
 */
Dispatcher.prototype.initApp = function(script) {
  var appID = /\/(\w*)\.js/.exec(script)[1];
  this.runningApps[appID] = {
    name: appID,
    worker: new Worker(script),
    canvas: this.view.generateScreen()
  };
  var app = this.runningApps[appID];

  // send width and height info to mockCanvas and bind incoming keyboard events
  app.worker.postMessage({"width": app.canvas.width, "height": app.canvas.height});
  app.canvas.on(function(event){
    app.worker.postMessage(event);
  });

  var self = this;

  this.runningApps[appID].worker.onmessage = function(e) {
    var cmd = e.data;
    var validCommands = ['fileRequest', 'fileWrite', 'canvasUpdate', 'closeApp'];

    if (validCommands.indexOf(cmd.command) !== -1) {
      self[cmd.command].apply(self, [appID].concat(cmd.args));
    }
  };
};

/**
 * helper function to send data into a specific web worker
 * @param {String} appID - internal reference to an app
 * @param {Object} data - data object to be passed into web worker
 */
Dispatcher.prototype.sendMessage = function(appID, data) {
  this.runningApps[appID].worker.postMessage(data);
};

/**
 * Handles fileSystem reads for apps
 * @param {String} appID - internal reference to an app
 * @param {String} fileName - full path to the file
 */
Dispatcher.prototype.fileRequest = function(appID, fileName) {
  this.fileSystem.readFile(appID, fileName).then(this.sendMessage.bind(this, appID));
};

/**
 * Handles fileSystem writes for apps
 * @param {String} appID - internal reference to an app
 * @param {String} fileName - full path to the file
 * @param {Object} data - data to write to file
 */
Dispatcher.prototype.fileWrite = function(appID, fileName, data) {
  this.fileSystem.writeFile(appID, fileName, data).then(this.sendMessage.bind(this, appID));
};

/**
 * Updates Canvas element associated with an app
 * @param {String} appID - internal reference to an app
 * @param {String} ctx - context to run all commands in (currently only supports '2d')
 * @param {Array} commands - Array of command sequences, of the format [method, data...]
 * @param {String} method - method or property on canvas to run / set
 * @param {Array || ALL}  data - Arguments for function or data for property
 */
Dispatcher.prototype.canvasUpdate = function(appID, ctx, commands) {
  var canvas = this.runningApps[appID].canvas;
  var self = this;
  try {
    var context = canvas.contexts[ctx];
  } catch (e) {
    this.sendMessage(appID, {err: ctx + ' is not a supported Canvas context.'});
  }
  if (context !== undefined) {
    commands.forEach(function(command) {
      if (typeof context[command[0]] === 'function') {
       context[command[0]].apply(context, command[1]);
      } else if (context[command[0]] !== undefined) {
        context[command[0]] = command[1];
      } else {
        self.sendMessage(appID, {err: command[0] + 'is not a valid Canvas property.'});
      }
    });
    canvas.updateTexture();
  }
};

/**
 * Closes application
 * @param {String} appID - internal reference to an app
 */
Dispatcher.prototype.closeApp = function(appID) {
  var app = this.runningApps[appID];
  app.worker.terminate();
  app.canvas.destroyScreen();
  delete this.runningApps[appID];
};

module.exports = Dispatcher;
