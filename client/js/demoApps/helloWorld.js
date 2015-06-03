
var counter = 0;

var updateCounter = function() {
  counter++;
  postMessage({command: "canvasUpdate", args: ['2d', [['fillText', [counter, 10, 10]]]]});
  setTimeout(updateCounter, 1000);
};

postMessage({command: "canvasUpdate", args: ['2d', [
  ['fillStyle', 'white'],
  ['fill', []],
  ['font', '30px Arial'],
  ['fillText', ['Hello World!', 10, 50]]
]]});
updateCounter();
