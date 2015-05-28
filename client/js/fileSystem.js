/**
 * File System module for Theseus
 * This one interfaces with localStorage
 * @require Mithril.js#deferred
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
  
};

/**
 * Writes file to localStorage
 * @param {String} appID - name of script writing the file
 * @param {String} fileName - name of file to write
 * @return {Promise} deferred promise object
 */
FileSystem.prototype.writeFile = function(appID, fileName) {
  
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
