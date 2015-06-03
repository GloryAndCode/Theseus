var counter = 0;

var updateCounter = function() {
  counter++;
  postMessage({command: 'canvasUpdate', args: ['2d', [['clearRect', [0,0,9999,9999]], ['fillText', [counter + ' Hello World!', 5, 25]]]]});
  setTimeout(updateCounter, 1000);
};

postMessage({command: 'canvasUpdate', args: ['2d', [
  ['fillStyle', 'white'],
  ['font', '30px Arial'],
]]});

updateCounter();

