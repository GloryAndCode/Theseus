importScripts('../../libs/mockCanvas.js');

var Keyboarder = function() {
  var keyState = {};

  this.isDown = function(keyCode) {
    return keyState[keyCode] === true;
  };

  onmessage = function(e) {
    if (e.data.key !== undefined) {
      if (e.data.event === "keyUp") {
        keyState[e.data.key] = false;
      } else {
        keyState[e.data.key] = true;
      }
    }
  };

  this.KEYS = {
    0x1: 49, // "1",
    0x2: 50, // "2",
    0x3: 51, // "3",
    0xC: 52, // "4",
    0x4: 81, // "Q",
    0x5: 87, // "W",
    0x6: 69, // "E",
    0xD: 82, // "R",
    0x7: 65, // "A",
    0x8: 83, // "S",
    0x9: 68, // "D",
    0xE: 70, // "F",
    0xA: 90, // "Z",
    0x0: 88, // "X",
    0xB: 67, // "C",
    0xF: 86, // "V"

  };
};

// the Display class provides functions to interface between the chip8's screenBuffer and an html canvas
var Display = function() {
  var display = {};

  // this function takes the screenBuffer and draws white pixels where 1's occur and Black pixels where 0's occur
  display.render = function(screenBuffer) {
    // var canvas = $('#chip8Screen')[0];
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    // since 64 x 32 is really small, we made a 640 x 320 canvas. This means we have to scale up our pixels
    var scaleFactor = Math.floor(width / 64);

    // we want 'on' pixels to be white
    // and 'off' pixels to be black
    
    // first we reset the screen to all black
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // loop through the screenBuffer, if the bit is white, draw a white rect
    ctx.fillStyle = "#fff";
    var x, y;
    for (var i = 0; i < screenBuffer.length; i++) {
      x = (i % 64) * scaleFactor;
      y = Math.floor(i / 64) * scaleFactor;
      if (screenBuffer[i]) {
        ctx.fillRect(x, y, scaleFactor, scaleFactor);
      }
    }
  };

  return display;
};

// core CPU

var Chip8 = function() {
  var chip = {};

  // keyboard testing
  chip.keyboarder = new Keyboarder();

  // the chip8 keypad supports 16 input buttons.
  chip.keyBuffer = new Uint8Array(16);

  /* initialize state variables */

  // the chip8 has 4096 bytes of ram, but I am adding an extra byte to be used as a flag for async stuff. see loadProgram
  chip.memory = new Uint8Array(4097);

  // CHIP-8 has 16 8-bit data registers named from V0 to VF. The VF register doubles as a carry flag.
  chip.V = new Uint8Array(16);
  // the address register, named 'I'
  chip.I = 0x0;
  // the program counter
  chip.pc = 0x200;

  // the stack stores return addresses. Supports 16 levels of nesting
  chip.stack = [];
  // chip.stackPointer = 0;

  chip.delayTimer = 0;
  chip.soundTimer = 0;


  // the screen buffer. The resolution of the chip8 is 64 x 32. 
  // If a bit is '1', the pixel should be white. If a bit is '0', the pixel should be black
  chip.screenBuffer = new Uint8Array(64 * 32); 

  // display provides utility functions for interfacing with a graphics api
  chip.display = Display();

  // display an error and stop program execution when an unsupported opcode is encountered
  chip.unsupportedOpcode = function(opcode) {
    console.log("Error: " + opcode.toString(16) + " is not a supported opcode.");
    throw 'unsupported opcode';
  };

  // loads a ROM into memory
  // currently I'm using "python -m SimpleHTTPServer" to serve up files
  chip.loadProgram = function(fileName) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "ROMs/"+fileName, true);
    xhr.responseType = "arraybuffer";

    xhr.onload = function () {
      // loaded flag to prevent async from ruining my day
      chip.memory[4096] = true;
       var program = new Uint8Array(xhr.response);
       for (var i = 0; i < program.length; i++) {
        // load program into memory, starting at address 0x200
        // this is a convention from old times when chip8's typically stored the interpreter itself in memory from 0x0-0x200
        chip.memory[0x200 + i] = program[i];
      }
    };

    xhr.send();
    console.log('Loaded ' + fileName + ' into memory.');
    // console.log(memory);
  };


  chip.loadFonts = function() {
      var fonts = [
        0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
        0x20, 0x60, 0x20, 0x20, 0x70, // 1
        0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
        0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
        0x90, 0x90, 0xF0, 0x10, 0x10, // 4
        0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
        0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
        0xF0, 0x10, 0x20, 0x40, 0x40, // 7
        0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
        0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
        0xF0, 0x90, 0xF0, 0x90, 0x90, // A
        0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
        0xF0, 0x80, 0x80, 0x80, 0xF0, // C
        0xE0, 0x90, 0x90, 0x90, 0xE0, // D
        0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
        0xF0, 0x80, 0xF0, 0x80, 0x80  // F
      ];

      for (var i = 0; i < fonts.length; i++) {
        chip.memory[i] = fonts[i];
      }
    };

  chip.setKeyBuffer = function() {
    for(var key in chip.keyboarder.KEYS) {
      // check if the key is being pressed, if it is, set the corresponding key in keybuffer to 1.
      if (chip.keyboarder.isDown(chip.keyboarder.KEYS[key])) {
        chip.keyBuffer[key] = 1;
        // console.log('PRESSED KEY: ' + key.toString(16));
      } else {
        chip.keyBuffer[key] = 0;
      }
    }
  };

  // used to extract the 'x' portion of an opcode
  chip.getX = function(opcode) {
    return (opcode & 0x0F00) >> 8;
  };

  // used to extract the 'y' portion of an opcode
  chip.getY = function(opcode) {
    return (opcode & 0x00F0) >> 4;
  };

  // used to extract the 'kk' portion of an opcode
  chip.getKK = function(opcode) {
    return opcode & 0x00FF;
  };

  // used to increment the program counter when ready for next instruction
  chip.incrementPC = function() {
    chip.pc += 2;
  };


  /*
    Documentation for all opcodes was found here: http://devernay.free.fr/hacks/chip8/C8TECH10.HTM#8xy0
    I copy/pasted the opcode descriptions as comments above each case in the main run switch
  */

  // object that stores all opcodes with their corresponding function
  chip.opcodes = {
    '00E0': function(opcode) {
      for (i = 0; i < chip.screenBuffer.length; i++) {
        chip.screenBuffer[i] = 0;
      }
      chip.incrementPC();
    },

    '00EE': function(opcode) {
      // LOOK INTO THIS:
      // console.log(chip.stack); // stack is totally empty... so pc gets set to 0 + 2 = 2
      chip.pc = chip.stack.pop();
      // console.log('Returning to ' + chip.pc.toString(16));
    },

    '1nnn': function(opcode) {
      n = opcode & 0x0FFF;
      chip.pc = n;
      // console.log('Jumping to ' + chip.pc.toString(16));
    },

    '2nnn': function(opcode) {
      // console.log('PC: ' + chip.pc);
      chip.incrementPC(); // HERE LIES THE KEY TO THE INFINITE LOOP BUG! I didn't realize I needed to increment pc here.
      chip.stack.push(chip.pc);
      chip.pc = opcode & 0x0FFF;
      // console.log("Calling " + chip.pc.toString(16) + ' from ' + chip.stack[chip.stack.length-1].toString(16));
    },

    '3xkk': function(opcode) {
      var x = chip.getX(opcode);
      var kk = chip.getKK(opcode);
      if (chip.V[x] === kk) {
        chip.incrementPC();
        chip.incrementPC();
        // console.log('Skipping next instruction, V['+x+'] === ' + kk);
      } else {
        chip.incrementPC();
        // console.log('Not skipping next instruction, V['+x+'] !== ' + kk);
      }
    },

    '4xkk': function(opcode) {
      var x = chip.getX(opcode);
      var kk = chip.getKK(opcode);
      if (chip.V[x] !== kk) {
        chip.incrementPC();
      }
      chip.incrementPC();
    },

    '5xy0': function(opcode) {
      var x = chip.getX(opcode);
      var y = chip.getY(opcode);
      if (chip.V[x] === chip.V[y]) {
        chip.incrementPC();
      }
    },

    '6xkk': function(opcode) {
      var x = chip.getX(opcode);
      chip.V[x] = chip.getKK(opcode);
      chip.incrementPC();
      // console.log("Setting V["+x+"] to " + chip.V[x]);
    },

    '7xkk': function(opcode) {
      var x = chip.getX(opcode);
      chip.V[x] += chip.getKK(opcode);
      chip.incrementPC();
      // console.log("Adding " + (chip.getKK(opcode)) + " to  V["+x+"] = " + chip.V[x]);
    },

    '8xy0': function(opcode) {
      var x = chip.getX(opcode);
      var y = chip.getY(opcode);
      chip.V[x] = chip.V[y];
      chip.incrementPC();
    },

    '8xy1': function(opcode) {
      var x = chip.getX(opcode);
      var y = chip.getY(opcode);
      chip.V[x] = chip.V[x] | chip.V[y];
      chip.incrementPC();
    },

    '8xy2': function(opcode) {
      var x = chip.getX(opcode);
      var y = chip.getY(opcode);
      chip.V[x] = chip.V[x] & chip.V[y];
      chip.incrementPC();
    },

    '8xy3': function(opcode) {
      var x = chip.getX(opcode);
      var y = chip.getY(opcode);
      chip.V[x] = chip.V[x] ^ chip.V[y];
      chip.incrementPC();
    },

    '8xy4': function(opcode) {
        var x = chip.getX(opcode);
        var y = chip.getY(opcode);

        if (chip.V[x] + chip.V[y] > 255) {
          chip.V[0xF] = 1;
        } else {
          chip.V[0xF] = 0;
        }
        // this will drop bits that are higher than 255
        chip.V[x] = (chip.V[x] + chip.V[y]) & 0xFF;
        chip.incrementPC();
    },

    '8xy5': function(opcode) {
      var x = chip.getX(opcode);
      var y = chip.getY(opcode);

      if (chip.V[x] > chip.V[y]) {
        chip.V[0xF] = 1;
      } else {
        chip.V[0xF] = 0;
      }

      chip.V[x] = (chip.V[x] - chip.V[y]) & 0xFF;

      chip.incrementPC();
    },

    '8xy6': function(opcode) {
      var x = chip.getX(opcode);
      chip.V[0xF] = chip.V[x] & 0x01;
      chip.V[x] = chip.V[x] >> 1;
      chip.incrementPC();
    },

    '8xy7': function(opcode) {
      var x = chip.getX(opcode);
      var y = chip.getY(opcode);
      if (chip.V[x] > chip.V[y]) {
        chip.V[0xF] = 0;
      } else {
        chip.V[0xF] = 1;
      }

      chip.V[x] = chip.V[y] - chip.V[x];
      chip.incrementPC();
    },

    '8xyE': function(opcode) {
      var x = chip.getX(opcode);
      chip.V[0xF] = chip.V[x] & 0x80;
      chip.V[x] = chip.V[x] << 1;
      chip.incrementPC();
    },

    '9xy0': function(opcode) {
      var x = chip.getX(opcode);
      var y = chip.getY(opcode);
      if (chip.V[x] != chip.V[y]) {
        chip.incrementPC();
      }
      chip.incrementPC();
    },

    'Annn': function(opcode) {
      chip.I = opcode & 0x0FFF;
      chip.incrementPC();
      // console.log("Setting I to " + chip.I.toString(16));
    },

    'Bnnn': function(opcode) {
      var n = (opcode & 0x0FFF);
      chip.pc = n + chip.V[0];
    },

    'Cxkk': function(opcode) {
      var x = chip.getX(opcode);
      var kk = chip.getKK(opcode);
      var randomNum = Math.floor((Math.random() * 255)) & kk;
      chip.V[x] = randomNum;
      chip.incrementPC();
      // console.log('random number generated: ' + randomNum);
    },

    'Dxyn': function(opcode) {
      // tell chip it needs to render since it is drawing
      chip.needsRender = true;

      var x = chip.V[chip.getX(opcode)];
      var y = chip.V[chip.getY(opcode)];
      var n = opcode & 0x000F;

      chip.V[0xF] = 0;

      for (var i = 0; i < n; i++) {
        var line = chip.memory[chip.I + i];
        for (var j = 0; j < 8; j++) {
          var pixel = line & (0x80 >> j);
          if (pixel !== 0) {
            var totalX = x + j;
            var totalY = y + i;

            // screen wrap
            totalX = totalX % 64;
            totalY = totalY % 32;

            var index = totalY * 64 + totalX;

            if (chip.screenBuffer[index] === 1) {
              chip.V[0xF] = 1;
            }

            chip.screenBuffer[index] ^= 1;
          }
        }
      }

      chip.incrementPC();
      // console.log('Drawing at V['+(chip.getX(opcode))+'] = ' + x + ', V['+(chip.getY(opcode))+'] = ' + y);
    },

    'Ex9E': function(opcode) {
      var x = chip.getX(opcode);
      key = chip.V[x];
      if (chip.keyBuffer[key] === 1) {
        chip.incrementPC();
      }
      chip.incrementPC();
    },

    'ExA1': function(opcode) {
      var x = chip.getX(opcode);
      var key = chip.V[x];
      if (chip.keyBuffer[key] === 0) {
        chip.incrementPC();
      }
      chip.incrementPC();
    },

    'Fx07': function(opcode) {
      var x = chip.getX(opcode);
      chip.V[x] = chip.delayTimer;
      chip.incrementPC();
      // console.log("V["+x+'] has been set to ' + chip.delayTimer);
    },

    'Fx0A': function(opcode) {
      var x = chip.getX(opcode);
      for(var i = 0; i < chip.keyBuffer.length; i++) {
        if(chip.keyBuffer[i] === 1) {
          chip.V[x] = i;
          chip.incrementPC();
          break;
        }
      }
    },

    'Fx15': function(opcode) {
      var x = opcode & 0x0F00;
      chip.delayTimer = chip.V[x];
      chip.incrementPC();
      // console.log("setting DT to V["+x+'] = ' + chip.V[x]);
    },

    'Fx18': function(opcode) {
      var x = chip.getX(opcode);
      chip.soundTimer = chip.V[x];
      chip.incrementPC();
    },

    'Fx1E': function(opcode) {
      var x = chip.getX(opcode);
      chip.I += chip.V[x];
      chip.incrementPC();
    },

    'Fx29': function(opcode) {
      var x = chip.getX(opcode);
      var character = chip.V[x];
      chip.I = character * 5;
      // console.log("setting I to character V["+x+'] = ' + chip.V[x] + ' offset to 0x' + chip.I.toString(16));
      chip.incrementPC();
    },

    'Fx33': function(opcode) {
      var x = chip.getX(opcode);
      var value = chip.V[x];

      var hundreds = (value - (value % 100)) / 100;
      value -= hundreds * 100;
      var tens = (value - (value % 10)) / 10;
      value -= tens * 10;
      var ones = value;
      chip.memory[chip.I] = hundreds;
      chip.memory[chip.I + 1] = tens;
      chip.memory[chip.I + 2] = ones;
      chip.incrementPC();
      // console.log('Storing binary-encoded decimal V['+x+'] = '+chip.V[chip.getX(opcode)] + 'as {' + hundreds + ', ' + tens + ' , ' + ones + '}');
    },

    'Fx55': function(opcode) {
      var x = chip.getX(opcode);
      for (var i = 0; i <= x; i++) {
        chip.memory[chip.I + i] = chip.V[i];
      }
      chip.incrementPC();
    },

    'Fx65': function(opcode) {
      var x = chip.getX(opcode);
      // note: <= not <
      for (var i = 0; i <= x; i++) {
        chip.V[i] = chip.memory[chip.I + i];
      }
      // console.log('Setting V[0] to V['+x+'] to the values in memory[0x'+(chip.I & 0xFFFF).toString(16)+']');

      // not sure if this is needed
      chip.I += x + 1;

      chip.incrementPC();
    }

  };

  chip.run = function() {
    // check loaded flag
    if(!chip.memory[4096]) {
      setTimeout(chip.run.bind(this), 1000);
      return;
    }

    // fetch opcode
    // each opcode is 2 bytes. Here we grab 2 bytes from memory and merge them together with a left shift and a bitwise 'OR'.
    var opcode = (chip.memory[chip.pc] << 8) | chip.memory[chip.pc + 1];

    // console.log('opcode: ' + opcode.toString(16));

    // decode opcode
    switch(opcode & 0xF000) { // grab first nibble

      // mulit-case
      case 0x0000:
        switch(opcode & 0x00FF) {

          // 00E0 - CLS
          // clear screen
          case 0x00E0:
            chip.opcodes['00E0'](opcode);
            break;

          // 00EE - RET
          // Return from a subroutine.
          case 0x00EE:
            chip.opcodes['00EE'](opcode);
            break;

          // 0NNN (don't need to implement this)
          default:
            chip.unsupportedOpcode(opcode);
            break;
        }
        break;

      // 1nnn - JP addr
      // Jump to location nnn.
      case 0x1000:
        chip.opcodes['1nnn'](opcode);
        break;

      // 2nnn - CALL addr
      // Call subroutine at nnn.
      case 0x2000:
        chip.opcodes['2nnn'](opcode);
        break;

      // 3xkk - SE Vx, byte
      // Skip next instruction if Vx = kk.
      case 0x3000:
        chip.opcodes['3xkk'](opcode);
        break;

      // 4xkk - SNE Vx, byte
      // Skip next instruction if Vx != kk.
      case 0x4000:
        chip.opcodes['4xkk'](opcode);
        break;

      // 5xy0 - SE Vx, Vy
      // Skip next instruction if Vx = Vy.
      case 0x5000:
        chip.opcodes['5xy0'](opcode);
        break;

      // 6xkk - LD Vx, byte
      // Set Vx = kk.
      case 0x6000:
        chip.opcodes['6xkk'](opcode);
        break;

      // 7xkk - ADD Vx, byte
      // Set Vx = Vx + kk.
      case 0x7000:
        chip.opcodes['7xkk'](opcode);
        break;

      // more data in last nibble, could be one of many instructions
      case 0x8000: 
        switch(opcode & 0x000F) {

          // 8xy0 - LD Vx, Vy
          // Set Vx = Vy.
          case 0x0000:
            chip.opcodes['8xy0'](opcode);
            break;

          // 8xy1 - OR Vx, Vy
          // Set Vx = Vx OR Vy.
          case 0x0001:
            chip.opcodes['8xy1'](opcode);
            break;

          // 8xy2 - AND Vx, Vy
          // Set Vx = Vx AND Vy.
          case 0x0002:
            chip.opcodes['8xy2'](opcode);
            break;

          // 8xy3 - XOR Vx, Vy
          // Set Vx = Vx XOR Vy.
          case 0x0003:
            chip.opcodes['8xy3'](opcode);
            break;

          // 8xy4 - ADD Vx, Vy
          // Set Vx = Vx + Vy, set VF = carry.
          case 0x0004:
            chip.opcodes['8xy4'](opcode);
            break;

          // 8xy5 - SUB Vx, Vy
          // Set Vx = Vx - Vy, set VF = NOT borrow.
          case 0x0005:
            chip.opcodes['8xy5'](opcode);
            break;

          // 8xy6 - SHR Vx {, Vy}
          // Set Vx = Vx SHR 1.
          case 0x0006:
            chip.opcodes['8xy6'](opcode);
            break;

          // 8xy7 - SUBN Vx, Vy
          // Set Vx = Vy - Vx, set VF = NOT borrow.
          case 0x0007:
            chip.opcodes['8xy7'](opcode);
            break;

          // 8xyE - SHL Vx {, Vy}
          // Set Vx = Vx SHL 1.
          case 0x000E:
            chip.opcodes['8xyE'](opcode);
            break;


          default:
            chip.unsupportedOpcode(opcode);
            break;
        }
        break;

      // 9xy0 - SNE Vx, Vy
      // Skip next instruction if Vx != Vy.
      case 0x9000:
        chip.opcodes['9xy0'](opcode);
        break;

      // Annn - LD I, addr
      // Set I = nnn.
      case 0xA000:
        chip.opcodes['Annn'](opcode);
        break;

      // Bnnn - JP V0, addr
      // Jump to location nnn + V0.
      case 0xB000:
        chip.opcodes['Bnnn'](opcode);
        break;

      // Cxkk - RND Vx, byte
      // Set Vx = random byte AND kk.
      case 0xC000:
        chip.opcodes['Cxkk'](opcode);
        break;

      // Dxyn - DRW Vx, Vy, nibble
      // Display n-byte sprite starting at memory location I at (Vx, Vy), set VF = collision.
      case 0xD000:
        chip.opcodes['Dxyn'](opcode);
        break;

      // multi-case
      case 0xE000:
        switch(chip.getKK(opcode)) {

          // Ex9E - SKP Vx
          // Skip next instruction if key with the value of Vx is pressed.
          case 0x009E:
            chip.opcodes['Ex9E'](opcode);
            break;

          // ExA1 - SKNP Vx
          // Skip next instruction if key with the value of Vx is not pressed.
          case 0x00A1:
            chip.opcodes['ExA1'](opcode);
            break;

          default:
            chip.unsupportedOpcode();
            break;
        }
        break;

      // multi-case
      case 0xF000:
        switch(chip.getKK(opcode)) {


          // Fx07 - LD Vx, DT
          // Set Vx = delay timer value.
          case 0x0007:
            chip.opcodes['Fx07'](opcode);
            break;

          // Fx0A - LD Vx, K
          // Wait for a key press, store the value of the key in Vx.
          case 0x000A:
            chip.opcodes['Fx0A'](opcode);
            break;


          // Fx15 - LD DT, Vx
          // Set delay timer = Vx.
          case 0x0015:
            chip.opcodes['Fx15'](opcode);
            break;

          // Fx18 - LD ST, Vx
          // Set sound timer = Vx.
          case 0x0018:
            chip.opcodes['Fx18'](opcode);
            break;

          // Fx1E - ADD I, Vx
          // Set I = I + Vx.
          case 0x001E:
            chip.opcodes['Fx1E'](opcode);
            break;

          // Fx29 - LD F, Vx
          // Set I = location of sprite for digit Vx.
          case 0x0029:
            chip.opcodes['Fx29'](opcode);
            break;

          // Fx33 - LD B, Vx
          // Store BCD representation of Vx in memory locations I, I+1, and I+2.
          case 0x0033:
            chip.opcodes['Fx33'](opcode);
            break;


          // Fx55 - LD [I], Vx
          // Store registers V0 through Vx in memory starting at location I.
          case 0x0055:
            chip.opcodes['Fx55'](opcode);
            break;

          // Fx65 - LD Vx, [I]
          // Read registers V0 through Vx from memory starting at location I.
          case 0x065:
            chip.opcodes['Fx65'](opcode);
            break;

          default:
            chip.unsupportedOpcode(opcode);
        }
        break;

      default:
        chip.unsupportedOpcode(opcode);
    }
  
    if (chip.soundTimer > 0) {
      chip.soundTimer--;
      // this is where you would play a beep sound
    }
    if (chip.delayTimer > 0) {
      chip.delayTimer--;
    }
  };

  return chip;
};

var chip = Chip8();
chip.loadFonts();
chip.loadProgram("BRIX"); 

var tick = function() {
  setTimeout(tick, 10);
  chip.setKeyBuffer();
  chip.run();
  chip.run();
  chip.run();
  chip.run();
  chip.display.render(chip.screenBuffer);
};

tick();

