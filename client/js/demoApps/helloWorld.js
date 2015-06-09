importScripts('../../libs/mockCanvas.js');

var counter = 0;

var updateCounter = function() {
  counter++;
  //postMessage({command: 'canvasUpdate', args: ['2d', [['clearRect', [0,0,9999,9999]], ['fillText', [counter + ' Hello World!', 5, 25]]]]});
  _2dContext.clearRect(0, 0, canvas.width, canvas.height);
  _2dContext.fillText(counter + ' Hello World!', 5, 25);
  setTimeout(updateCounter, 1000);
};

setTimeout(function() {
  postMessage({command: 'canvasUpdate', args: ['2d', [
    ['fillStyle', 'white'],
    ['font', '30px Arial'],
  ]]});
  updateCounter();
}, 1000);

