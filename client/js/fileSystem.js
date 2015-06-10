/**
 * File system module for Theseus
 * Backed by server itself
 */

var m = require('mithril');

/**
 * Initializer for Theseus
 * @constructor
 */
var FileSystem = function() {
  
};

/**
 * Reads file from server
 * @param {String} appID - internal ID of app
 * @param {String} fileName - name of file to grab
 */
FileSystem.prototype.readFile = function (appID, fileName) {
  return m.request({
    method: "POST",
    url: "/getFile",
    background: true,
    data: {fileName: fileName}
  });
};

/**
 * Writes file to server
 * @param {String} appID - internal ID of app
 * @param {String} fileName - name of file to write
 * @param {ANY} data - any data that can be serialized to JSON
 */
FileSystem.prototype.writeFile = function (appID, fileName, data) {
  return m.request({
    method: "POST",
    url: "/storeFile",
    background: true,
    data: {
      fileName: fileName,
      fileContents: data
    }
  });
};

module.exports = FileSystem;
