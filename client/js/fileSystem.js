/**
 * File System module for Theseus
 * This one interfaces with localStorage
 * @require Mithril.js
 */

/**
 * Creates a FileSystem instance compatible with Dispatcher and backed by localStorage
 * @constructor
 * @return new FileSystem instance
 */
var FileSystem = function() {
  
};

/**
 * Syncs the local fileSystem cache with a remote server
 */
FileSystem.prototype.sync = function() {

};

/**
 * Pulls file from server and inserts it into cache if not already there
 * @param {String} fileName - filename to pull into cache
 */
FileSystem.prototype.forceCache = function(fileName) {

};

/**
 * Reads file from localStorage
 * @param {String} appID - name of script requesting the file
 * @param {String} fileName - name of file to read
 * @return {Promise} deferred promise object
 */
FileSystem.prototype.readFile = function(appID, fileName) {
  var deferred = m.deferred();

  setTimeout(function() {
    var file = localStorage.getItem(fileName);
    if (file.appID === undefined) {
      //check for file on server before we send this back

      deferred.resolve({err: "This file does not exist."});
    } else if (file.appID !== appID) {
      deferred.resolve({err: "This app does not have permission to access this file."});
    } else {
      deferred.resolve(file);
    }
  }, 0);

  return deferred.promise;
};

/**
 * Writes file to localStorage
 * @param {String} appID - name of script writing the file
 * @param {String} fileName - name of file to write
 * @param {Data} data - any value that can be converted to JSON
 * @return {Promise} deferred promise object
 */
FileSystem.prototype.writeFile = function(appID, fileName, data) {
  var deferred = m.deferred();

  setTimeout(function() {
    var file = localStorage.getItem(fileName);
    if (file.appID === undefined) {
      localStorage.setItem(fileName, JSON.stringify({
        appID: appID,
        name: fileName,
        updated: (new Date()).toJSON(),
        data: data
      }));
      deferred.resolve(localStorage.getItem(fileName));
    } else if (file.appID !== appID) {
      deferred.resolve({err: "This app does not have permission to access the requested file."});
    } else {
      file.data = JSON.stringify(data);
      file.updated = (new Date()).toJSON();
      localStorage.setItem(fileName, JSON.stringify(file));
      deferred.resolve(localStorage.getItem(fileName));
    }
  }, 0);

  return deferred.promise;
};

/**
 * Deletes file from localStorage
 * @abstract
 * @param {String} appID - name of script deleting the file
 * @param {String} fileName - name of file to delete
 * @return {Promise} deferred promise object
 */
FileSystem.prototype.deleteFile = function(appID, fileName) {
  throw new Error("I'm not implemented yet, who's calling me?");
};
