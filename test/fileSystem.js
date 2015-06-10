var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var chaiAsPromised = require('chai-as-promised');
var expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);

var FileSystem = require('../client/js/fileSystem.js');

describe('FileSystem', function() {

  var fs = new FileSystem();
  var server;

  beforeEach(function() {
    server = sinon.fakeServer.create();
  });

  afterEach(function() {
    server.restore();
  });
  
  describe('constructor', function() {
    it('should return an initialized Filesystem instance', function() {
      expect(fs).to.be.an.instanceof(FileSystem);
    });
  });

  describe('method', function() {
    describe('readFile', function() {
      it('should be a function', function() {
        expect(fs.readFile).to.be.a('function');
      });

      it('should request a passed in file name from the server', function() {
        fs.readFile('fake', '/syncFile');

        var req = server.requests[0];

        expect(req.method).to.equal('POST');
        expect(req.url).to.equal('/getFile');
        expect(JSON.parse(req.requestBody).fileName).to.equal('/syncFile');
      });

      it('should return a promise', function() {
        expect(fs.readFile('fake', '/syncFile')).to.eventually.equal('fakeData');

        server.requests[0].respond(
          200,
          { "Content-Type": "application/json" },
          JSON.stringify('fakeData')
        );
      });
    });

    describe('writeFile', function() {
      it('should be a function', function() {
        expect(fs.writeFile).to.be.a('function');
      });

      it('should post updated file data to the server', function() {
        fs.writeFile('fake', '/syncFile', 'fakeData');

        var req = server.requests[0];

        expect(req.method).to.equal('POST');
        expect(req.url).to.equal('/storeFile');
        expect(JSON.parse(req.requestBody).fileName).to.equal('/syncFile');
        expect(JSON.parse(req.requestBody).fileContents).to.equal('fakeData');
      });

      it('should return a promise', function() {
        expect(fs.writeFile('fake', '/syncFile', 'fakeData')).to.eventually.equal('fakeData');

        server.requests[0].respond(
          200,
          { "Content-Type": "application/json" },
          JSON.stringify('fakeData')
        );
      });
    });
  });
});
