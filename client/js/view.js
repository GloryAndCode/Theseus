var THREE = require('./three.shim');

// This class creates the entire display and manages the virtual screens
var View = function() {
  // Make all the variables
  this.init();
  // Start animating
  this.animate();
};

View.prototype.init = function() {
  var view = this;

  // Set the clock
  this.clock = new THREE.Clock();

  // Make an array to house the animation functions
  this.animations = [];

  // Store the current screens
  this.screensOn = {0 : false, 1 : false, 2 : false,
                  3 : false, 4 : false, 5 : false};

  // keep track of the focus screen
  this.focusScreen = undefined;
  this.keysDown = {};
  this.keepDefault = {
    123 : true  // Exception to keep F12 working
  };
  this.controlKeys = {
    65 : view.prevScreen,
    68 : view.nextScreen,
    83 : view.generateScreen,
    88 : function() {
      if(view.focusScreen) {
        view.focusScreen.destroyScreen();
      }
    }
  };

  // Create the renderer
  this.renderer = new THREE.WebGLRenderer();

  // Make a DOM element for the display to use
  this.element = this.renderer.domElement;

  // Put the entire display into the document;
  this.container = document.getElementById('example');
  this.container.appendChild(this.element);

  this.orientationBinding = this.setOrientationControls.bind(this);

  // Make the 3d work
  if (window.DeviceOrientationEvent !== undefined) {
    this.effect = new THREE.StereoEffect(this.renderer);
    window.addEventListener('deviceorientation',
                          this.orientationBinding,
                          true);
  };

  // Add a scene and a camera
  this.scene = new THREE.Scene();

  this.camera = new THREE.PerspectiveCamera(90,1,0.001,700);
  this.camera.position.set(0,10,0);
  this.scene.add(this.camera);

  // Make the scene rotateable
  this.controls = new THREE.OrbitControls(this.camera, this.element);
  this.controls.rotateUp(Math.PI / 4);
  this.controls.target.set(
    this.camera.position.x + 0.1,
    this.camera.position.y,
    this.camera.position.z
  );
  this.controls.noZoom = true;
  this.controls.noPan = true;

  // Add some light to the scene
  this.light = new THREE.HemisphereLight(0x777777, 0x000000, 0.6);
  this.scene.add(this.light);

  // Add the floor to the scene
  // First make the floor's texture
  var floorTexture = THREE.ImageUtils.loadTexture(
    '../assets/textures/checker.png'
  );
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat = new THREE.Vector2(50,50);
  floorTexture.anisotropy = this.renderer.getMaxAnisotropy();

  // Turn the floor's texture into a material
  var floorMat = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    specular: 0xffffff,
    shininess: 20,
    shading: THREE.FlatShading,
    map: floorTexture
  });

  // Generate the floor's geometry, make a mesh and add it to the scene
  var floorGeo = new THREE.PlaneBufferGeometry(1000,1000);
  this.floor = new THREE.Mesh(floorGeo, floorMat);
  this.floor.rotation.x = -Math.PI / 2;
  this.scene.add(this.floor);

  // Build a skybox.  Start with the images to patch
  var skyPrefix = '../assets/images/';
  var skyUrls = [skyPrefix + "1_xpos.png", skyPrefix + "1_xneg.png",
                 skyPrefix + "1_ypos.png", skyPrefix + "1_yneg.png",
                 skyPrefix + "1_zpos.png", skyPrefix + "1_zneg.png"];
  var skyMats = [];
  skyUrls.forEach(function(url) {
    skyMats.push(new THREE.MeshBasicMaterial({
      map: THREE.ImageUtils.loadTexture(url),
      side: THREE.BackSide
    }));
  });

  // Make the actual box
  var skyGeo = new THREE.BoxGeometry(750,750,750);
  var skyMaterial = new THREE.MeshFaceMaterial(skyMats);

  // Build the skybox mesh and add it to the scene
  var skyboxMesh = new THREE.Mesh(skyGeo, skyMaterial);
  this.scene.add(skyboxMesh);

  // Listen for events
  window.addEventListener('resize', this.resize, false);
  document.onkeydown = function(e){
    if (this.keepDefault[e.which] === true) {
      return;
    }
    e.preventDefault();
    if (!this.keysDown[e.which]) {
      if (Object.keys(this.controlKeys).indexOf(String(e.which)) > -1  && this.keysDown[17] === true) {
        this.controlKeys[e.which].apply(this);
      } else {
        this.emit({key : e.which, event : 'keyDown'});
      }
      this.keysDown[e.which] = true;
    }
  }.bind(this);
  document.onkeyup = function(e){
    e.preventDefault();
    if (this.keysDown[e.which]) {
      this.emit({key : e.which, event : 'keyUp'});
      this.keysDown[e.which] = false;
    }
  }.bind(this);
  setTimeout(this.resize, 1);
};

// Method bound to event to manage orientation controls
View.prototype.setOrientationControls = function(e) {
  if (!e.alpha) {
    return;
  }

  this.controls = new THREE.DeviceOrientationControls(this.camera, true);
  this.controls.connect();
  this.controls.update();

  this.element.addEventListener('click', this.fullscreen.bind(this), false);
  window.removeEventListener('deviceorientation',
                             this.orientationBinding,
                             true);
};

// Method to call when the screen is resized
View.prototype.resize = function() {
  // Get the Width and Height from the container and calculate the aspect
  if (this.container) {
    var width = this.container.offsetWidth;
    var height = this.container.offsetHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // Update the renderer
    this.renderer.setSize(width, height);
    this.effect ? this.effect.setSize(width, height) : null;
  }
};

// Wrapping method for resizing, updating controls and camera
View.prototype.update = function(dt) {
  this.resize();
  this.camera.updateProjectionMatrix();
  this.controls.update(dt);
};

// Rendering method
View.prototype.render = function(dt) {
  this.effect ?
  this.effect.render(this.scene, this.camera) :
  this.renderer.render(this.scene, this.camera);
};

// Animate everything and run the render loop
View.prototype.animate = function(t) {
  // Repeat self
  requestAnimationFrame(this.animate.bind(this));

  // Run through any frame by frame animations, if any
  this.animations.forEach(function(change) {
    change();
  });

  // Run updater and render
  this.update(this.clock.getDelta());
  this.render(this.clock.getDelta());
};

// Method for requesting fullscreen depending on the browser
View.prototype.fullscreen = function() {
  if (this.container.requestFullscreen) {
    this.container.requestFullscreen();
  } else if (this.container.msRequestFullscreen) {
    this.container.msRequestFullscreen();
  } else if (this.container.mozRequestFullScreen) {
    this.container.mozRequestFullScreen();
  } else if (this.container.webkitRequestFullscreen) {
    this.container.webkitRequestFullscreen();
  }
};

View.prototype.getNextScreen = function() {
  for (var number in this.screensOn) {
    if (this.screensOn[number] === false) {
      return number;
    }
  }
  return null;
};

View.prototype.getNewFocus = function() {
  for (var i = 0; i < 6; i++) {
    if (this.screensOn[i] !== false) {
      return this.screensOn[i];
    }
  }
  return undefined;
};

// Method for creating a new virtual screen
View.prototype.generateScreen = function() {
  var positions = [{x : 9.5, y : 7.5, z : 0, ry : 1.5 * Math.PI, rx : 0},
               {x : 5, y : 7.5, z : 10.5, ry : 1.25 * Math.PI, rx : 0},
               {x : 5, y : 7.5, z : -10.5, ry : 0.75 * Math.PI, rx : 0},
               {x : 9.5, y : 17, z : 0, ry : 1.5 * Math.PI, rx : 0.25 * Math.PI},
               {x : 5, y : 17, z : 10.5, ry : 1.25 * Math.PI, rx : 0.25 * Math.PI},
               {x : 5, y : 17, z : -10.5, ry : 0.75 * Math.PI, rx : 0.25 * Math.PI}];
  var size = {width : 12,height : 9};
  var screenNumber = this.getNextScreen();
  if (screenNumber === null) {
    return null;
  }
  return this.addScreen(positions[screenNumber], size, screenNumber);
};

View.prototype.highlightScreen = function(screenNumber) {
  var positions = [{x : 9.7, y : 7.5, z : 0, ry : 1.5 * Math.PI, rx : 0},
               {x : 5.2, y : 7.5, z : 10.5, ry : 1.25 * Math.PI, rx : 0},
               {x : 5.2, y : 7.5, z : -10.5, ry : 0.75 * Math.PI, rx : 0},
               {x : 9.7, y : 17, z : 0, ry : 1.5 * Math.PI, rx : 0.25 * Math.PI},
               {x : 5.2, y : 17, z : 10.5, ry : 1.25 * Math.PI, rx : 0.25 * Math.PI},
               {x : 5.2, y : 17, z : -10.5, ry : 0.75 * Math.PI, rx : 0.25 * Math.PI}];

  var size = {width : 13,height : 10.3};
  if (this.highlight) {
    this.scene.remove(this.highlight);
    this.highlight = undefined;
  }
  this.addHighlight(positions[screenNumber], size);
};

View.prototype.addScreen = function(position, size, screenNumber) {
  // Make a new canvas to generate the screen from
  var newCanvas = document.createElement('canvas');
  var screenTexture = new THREE.Texture(newCanvas);
  screenTexture.minFilter = THREE.NearestFilter;

  // Generate a Plane and add the canvas to it
  var screenGeo = new THREE.PlaneBufferGeometry(size.width,size.height);
  var screenMat = new THREE.MeshBasicMaterial({
    map: screenTexture,
    side: THREE.DoubleSide
  });
  var newScreen = new THREE.Mesh(
    screenGeo,
    screenMat
  );
  newScreen.screenNumber = screenNumber;

  // Position the new canvas and add it to the scene
  newScreen.position.setX(position.x);
  newScreen.position.setY(position.y);
  newScreen.position.setZ(position.z);
  newScreen.rotation.y = position.ry;

  this.scene.add(newScreen);

  // Now add the highlight
  this.highlightScreen(screenNumber);

  // Add the screen, texture, and scene object as a param on the canvas
  newCanvas.texture = screenTexture;
  newCanvas.screen = newScreen;
  newCanvas.scene = this.scene;
  newCanvas.screensOn = this.screensOn;
  newCanvas.contexts = {};
  newCanvas.contexts['2d'] = newCanvas.getContext('2d');
  newCanvas.contexts['3d'] = newCanvas.getContext('3d');
  newCanvas.screenNumber = screenNumber;
  this.screensOn[screenNumber] = newCanvas;
  this.focusScreen = newCanvas;
  var view = this;
  newCanvas.eventCallbacks = [];

  // Make a function to update the texture when the
  // canvas is changed.
  newCanvas.updateTexture = function() {
    this.texture.needsUpdate = true;
  };
  newCanvas.on = function(callback) {
    if (typeof callback === "function") {
      newCanvas.eventCallbacks.push(callback);
    }
  };

  // Make a function to remove the screen from the scene
  newCanvas.destroyScreen = function() {
    this.screensOn[screenNumber] = false;
    if (view.focusScreen === this) {
      view.focusScreen = view.getNewFocus();
      if (view.focusScreen) {
        view.highlightScreen(view.focusScreen.screenNumber);
      } else {
        view.scene.remove(view.highlight);
        view.highlight = 0;
      }
    }
    this.scene.remove(this.screen);
  };

  // Return the canvas
  return newCanvas;
};

View.prototype.emit = function(event) {
  if (this.focusScreen !== undefined) {
    this.focusScreen.eventCallbacks.forEach(function(callback){
      callback(event);
    });
  }
};

View.prototype.prevScreen = function() {
  var keep = [];
  Object.keys(this.screensOn).forEach(function(key) {
    if (this.screensOn[key] !== false) {
      keep.push(key);
    }
  }.bind(this));

  if (keep.length < 2) {
    if (this.focusScreen) {
      console.log(this.focusScreen.screenNumber);
    }
    return;

  }
  var current = this.focusScreen.screenNumber;
  if (current === keep[0]) {
    // Make top screen
    this.focusScreen = this.screensOn[keep[keep.length - 1]];
    this.highlightScreen(this.focusScreen.screenNumber);
    return;
  }
  //go to the previous screen
  this.focusScreen = this.screensOn[keep[keep.indexOf(current) - 1]];
  this.highlightScreen(this.focusScreen.screenNumber);
  return;
};


View.prototype.nextScreen = function() {
  var keep = [];
  Object.keys(this.screensOn).forEach(function(key) {
    if (this.screensOn[key] !== false) {
      keep.push(key);
    }
  }.bind(this));

  if (keep.length < 2) {
    if (this.focusScreen) {
      console.log(this.focusScreen.screenNumber);
    }
    return;

  }
  var current = this.focusScreen.screenNumber;
  if (current === keep[keep.length  - 1]) {
    // Make bottom screen
    this.focusScreen = this.screensOn[keep[0]];
    this.highlightScreen(this.focusScreen.screenNumber);
    return;
  }
  //go to the previous screen
  this.focusScreen = this.screensOn[keep[keep.indexOf(current) + 1]];
  this.highlightScreen(this.focusScreen.screenNumber);
  return;
};

View.prototype.addHighlight = function(position, size) {
  var newCanvas = document.createElement('canvas');
  newCanvas.getContext("2d").fillStyle = "#CCFF66";
  newCanvas.getContext("2d").fillRect(0,0,500,500);
  var screenTexture = new THREE.Texture(newCanvas);
  screenTexture.minFilter = THREE.NearestFilter;

  // Generate a Plane and add the canvas to it
  var screenGeo = new THREE.PlaneBufferGeometry(size.width,size.height);
  var screenMat = new THREE.MeshBasicMaterial({
    map: screenTexture,
    side: THREE.DoubleSide
  });
  var newScreen = new THREE.Mesh(
    screenGeo,
    screenMat
  );

  screenTexture.needsUpdate = true;

  // Set postition and add to scene
  newScreen.position.setX(position.x);
  newScreen.position.setY(position.y);
  newScreen.position.setZ(position.z);
  newScreen.rotation.y = position.ry;

  this.highlight = newScreen;

  this.scene.add(newScreen);
};

module.exports = View;

