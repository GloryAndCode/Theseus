// Require statements for view and fileSystem goes here
//var fs = require('./fileSystem.js');
//var view = require('./view.js');

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
  var appID = /\/(\w*)\.html/.exec(script)[1];
  this.runningApps[appID] = {
    name: appID,
    worker: new Worker(script),
    canvas: this.view.generateScreen()
  };
  
  this.runningApps[appID].worker.onmessage = function(e) {
    var cmd = e.data;
    var validCommands = ['fileRequest', 'fileWrite', 'canvasUpdate', 'closeApp'];

    if (validCommands.indexOf(cmd.command) !== -1) {
      this[cmd.command].apply(this, [appID].concat(cmd.args));
    }
  };
};

/**
 * helper function to send data into a specific web worker
 * @param {String} appID - internal reference to an app
 * @param {Object} data - data object to be passed into web worker
 */
Dispatcher.prototype.sendMessage = function(appID, data) {
  this.runningApps[appID].worker.sendMessage(data);
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
 * @param {String} method - method or property on canvas to run / set
 * @param {Array}  data - Arguments for function or data for property
 */
Dispatcher.prototype.canvasUpdate = function(appID, method, data) {
  
};

/**
 * Closes application
 * @param {String} appID - internal reference to an app
 */
Dispatcher.prototype.closeApp = function(appID) {
  
};
