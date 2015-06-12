var canvas = {};
var _2dContext = {};
var _queue = [];

canvas.getContext = function() {
  return _2dContext;
};

Object.defineProperty(canvas, "width", {
  "get": function() {
    return canvas._width;
  },
  "set": function(newValue) {
    throw "Can't set width";
  }
});

Object.defineProperty(canvas, "height", {
  "get": function() {
    return canvas._height;
  },
  "set": function(newValue) {
    throw "Can't set height";
  }
});

self.addEventListener("message", function(e) {
  if (e.data.width !== undefined) {
    canvas._width = e.data.width;
    canvas._height = e.data.height;
  }
});

var properties = ['fillStyle', 'font', 'globalAlpha', 'globalCompositeOperation', 'lineCap', 'lineDashOffset', 'lineJoin', 'lineWidth',
  'miterLimit', 'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'strokeStyle', 'textAlign', 'textBaseline'];

for (var i = 0; i < properties.length; i++) {
  Object.defineProperty(_2dContext, properties[i], {
    "get": function() {throw "getter not implemented";},
    "set": (function(j) {
      return function(newValue) {
        _queue.push([properties[j], newValue]);
      }
    })(i)
  });
}

// mockCanvas doesn't have access to path2d objects
var methods = ['arc', 'arcTo', 'beginPath', 'bezierCurveTo', 'clearRect', 'clip', 'closePath','fill', 
  'fillRect', 'fillText', 'lineTo', 'moveTo',  'quadraticCurveTo', 'rect', 'restore', 'rotate', 'save',
  'scale', 'setLineDash', 'setTransform', 'stroke', 'strokeRect', 'strokeText', 'transform', 'translate'];

var notImplementedMethods = ['createImageData', 'createLinearGradient', 'createPattern', 'createRadialGradient', 
'drawFocusIfNeeded', 'drawImage', 'getImageData', 'getLineDash', 'isPointInPath', 'isPointInStroke', 'measureText', 'putImageData'];

for (var i = 0; i < methods.length; i++) {
  _2dContext[methods[i]] = (function(j) {
    return function() {
      _queue.push([methods[j], Array.prototype.slice.call(arguments)]);
    };
  })(i);
}

for (var i = 0; i < notImplementedMethods.length; i++) {
  _2dContext[notImplementedMethods[i]] = (function(j) {
    return function() {
      throw "method " + methods[j] + " is not implemented";
    };
  })(i);
}

var postQueue = function() {
  if (_queue.length > 0) {
    postMessage({command: 'canvasUpdate', args: ['2d', _queue]});
    _queue = [];
  }
  setTimeout(postQueue, 100);
};

postQueue();




