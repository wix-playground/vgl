(function () {
   'use strict';

   var videogl = {
       init,
       draw,
       destroy,
       resize,
       getWebGLContext
   };

   /**
    * Initialize a rendering context and compiled WebGLProgram for the given canvas and effects.
    *
    * @private
    * @param {HTMLCanvasElement} canvas
    * @param effects
    * @param dimensions
    * @return {{gl: WebGLRenderingContext, data: vglSceneData, [dimensions]: {width: number, height: number}}}
    */
   function init (canvas, effects, dimensions) {
       const gl = getWebGLContext(canvas);

       const programData = _initProgram(gl, effects, dimensions);

       return {gl, data: programData, dimensions: dimensions || {}};
   }

   /**
    * Get a webgl context for the given canvas element.
    *
    * @private
    * @param {HTMLCanvasElement} canvas
    * @return {WebGLRenderingContext}
    */
   function getWebGLContext (canvas) {
       let context;

       const config = {
           preserveDrawingBuffer: false, // should improve performance - https://stackoverflow.com/questions/27746091/preservedrawingbuffer-false-is-it-worth-the-effort
           antialias: false, // should improve performance
           depth: false, // turn off for explicitness - and in some cases perf boost
           stencil: false // turn off for explicitness - and in some cases perf boost
       };

       context = canvas.getContext('webgl', config);

       if ( ! context ) {
           context = canvas.getContext('experimental-webgl', config);
       }

       return context;
   }

   /**
    * Resize the target canvas.
    *
    * @private
    * @param {WebGLRenderingContext} gl
    * @param {{width: number, height: number}} [dimensions]
    * @param {vglSceneData} [data]
    * @return {boolean}
    */
   function resize (gl, dimensions, data) {
       let resized = false;
       const canvas = gl.canvas;
       const realToCSSPixels = 1; //window.devicePixelRatio;
       const {width, height} = dimensions || {};
       let displayWidth, displayHeight;

       if ( width && height ) {
           displayWidth = width;
           displayHeight = height;
       }
       else {
           // Lookup the size the browser is displaying the canvas.
           displayWidth = Math.floor(canvas.clientWidth * realToCSSPixels);
           displayHeight = Math.floor(canvas.clientHeight * realToCSSPixels);
       }

       // Check if the canvas is not the same size.
       if ( canvas.width !== displayWidth ||
            canvas.height !== displayHeight ) {

           // Make the canvas the same size
           canvas.width  = displayWidth;
           canvas.height = displayHeight;
           resized = true;
       }

       // if there was a size change and we got the scene data
       if ( resized && data ) {
           // only resize target textures that are bound to framebuffers
           data.forEach(layer => {
               const {source, target} = layer;
               const isBufferTarget = Boolean(target && target.buffer);

               if ( isBufferTarget ) {
                   _resizeTexture(gl, target);
                   // re-bind the source texture
                   gl.bindTexture(gl.TEXTURE_2D, source.texture);
               }
           });
       }

       gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

       return resized;
   }

   /**
    * Draw a given scene
    *
    * @private
    * @param {WebGLRenderingContext} gl
    * @param {HTMLVideoElement} video
    * @param {vglSceneData} data
    * @param {{width: number, height: number}} dimensions
    */
   function draw (gl, video, data, dimensions) {
       if ( video.readyState < video.HAVE_CURRENT_DATA ) {
           return;
       }

       // resize the target canvas if its size in the DOM changed
       // const resized = resize(gl, dimensions);

       // these two fix bad dithered junk edges rendered in Safari
       // gl.enable(gl.BLEND);
       // gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

       data.forEach(function (layer) {
           const {program, source, target, attributes, uniforms} = layer;
           const isBufferTarget = Boolean(target && target.buffer);

           // then render to the target buffer or screen
           gl.bindFramebuffer(gl.FRAMEBUFFER, isBufferTarget ? target.buffer : null);

           // bind the source texture
           gl.bindTexture(gl.TEXTURE_2D, source.texture);

           // if source has no buffer then the media is the actual source
           if ( source.buffer === null ) {
               gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
           }

           /*if ( resized && isBufferTarget ) {
               _resizeTexture(gl, target);
               // re-bind the source texture
               gl.bindTexture(gl.TEXTURE_2D, source.texture);
           }*/

           // Tell it to use our program (pair of shaders)
           gl.useProgram(program);

           // set attribute buffers with data
           _enableVertexAttributes(gl, attributes);

           // set uniforms with data
           _setUniforms(gl, uniforms);

           // no need since while we're updating the entire canvas
           // clear the buffer
           // gl.clearColor(0.0, 0.0, 0.0, 0.0);
           // gl.clear(gl.COLOR_BUFFER_BIT);

           // Draw the rectangle.
           gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
       });
   }

   /**
    * Free all resources attached to a specific webgl context.
    *
    * @private
    * @param {WebGLRenderingContext} gl
    * @param {vglSceneData} data
    */
   function destroy (gl, data) {
       _destroy(gl, data);
   }

   function _initProgram (gl, effects, dimensions) {
       let lastTarget;
       const lastIndex = effects.length - 1;

       return effects.map((config, i) => {
           const {vertexSrc, fragmentSrc, attributes, uniforms} = config;
           const {width, height} = dimensions || {};

           let source;
           let target = null;

           if ( i === 0 ) {
               // create a source texture to render into
               source = {
                   texture: _createTexture(gl).texture,
                   buffer: null
               };

               // flip Y axis for source texture
               gl.bindTexture(gl.TEXTURE_2D, source.texture);
               gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
           }
           else {
               source = lastTarget;
           }

           // last node (or one node) just renders to the screen
           if ( i !== lastIndex ) {
               // Prepare a framebuffer as a target to render to
               // create a secondary target texture to render the source media into
               const targetTexture = _createTexture(gl, width, height);

               // Create and bind the framebuffer
               const framebuffer = gl.createFramebuffer();

               gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

               // attach the texture as the first color attachment
               gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTexture.texture, 0);

               target = targetTexture;
               target.buffer = framebuffer;

               // cache this target for next iteration, so it can serve as source for the next node
               lastTarget = target;
           }

           // compile the GLSL program
           const {program, vertexShader, fragmentShader, error, type} = _getWebGLProgram(gl, vertexSrc, fragmentSrc);

           if ( error ) {
               throw new Error(`${type} error:: ${error}`);
           }

           // setup the vertex data
           const attribBuffers = _initVertexAttributes(gl, program, attributes);

           // setup uniforms
           const uniformData = _initUniforms(gl, program, uniforms);

           return {
               program,
               vertexShader,
               fragmentShader,
               source,
               target,
               attributes: attribBuffers,
               uniforms: uniformData
           };
       });
   }

   function _resizeTexture (gl, textureObject) {
       textureObject.width = gl.canvas.width;
       textureObject.height = gl.canvas.height;

       gl.bindTexture(gl.TEXTURE_2D, textureObject.texture);
       // resize our target texture
       gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureObject.width, textureObject.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
   }

   function _getWebGLProgram (gl, vertexSrc, fragmentSrc) {
       const vertexShader = _createShader(gl, gl.VERTEX_SHADER, vertexSrc);
       const fragmentShader = _createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);

       if ( vertexShader.error ) {
           return vertexShader;
       }

       if ( fragmentShader.error ) {
           return fragmentShader;
       }

       return _createProgram(gl, vertexShader, fragmentShader);
   }

   function _createProgram (gl, vertexShader, fragmentShader) {
       const program = gl.createProgram();

       gl.attachShader(program, vertexShader);
       gl.attachShader(program, fragmentShader);
       gl.linkProgram(program);

       const success = gl.getProgramParameter(program, gl.LINK_STATUS);

       if ( success ) {
           return {program, vertexShader, fragmentShader};
       }

       const exception = {
           error: gl.getProgramInfoLog(program),
           type: 'program'
       };

       gl.deleteProgram(program);

       return exception;
   }

   function _createShader (gl, type, source) {
       const shader = gl.createShader(type);

       gl.shaderSource(shader, source);
       gl.compileShader(shader);

       const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

       if ( success ) {
           return shader;
       }

       const exception = {
           error: gl.getShaderInfoLog(shader),
           type: type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT'
       };

       gl.deleteShader(shader);

       return exception;
   }

   function _createTexture (gl, width=1, height=1) {
       const texture = gl.createTexture();

       gl.bindTexture(gl.TEXTURE_2D, texture);

       // Set the parameters so we can render any size image.
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

       // Upload the image into the texture.
       gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

       return {texture, width, height};
   }

   function _createBuffer (gl, program, name, data) {
       const location = gl.getAttribLocation(program, name);
       const buffer = gl.createBuffer();

       gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
       gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

       return {location, buffer};
   }

   function _initVertexAttributes (gl, program, data) {
       return (data || []).map(attr => {
           const {location, buffer} = _createBuffer(gl, program, attr.name, attr.data);

           return {
               name: attr.name,
               location,
               buffer,
               type: attr.type,
               size: attr.size
           };
       });
   }

   function _initUniforms (gl, program, uniforms) {
       return (uniforms || []).map(uniform => {
           const location = gl.getUniformLocation(program, uniform.name);

           return {
               location,
               size: uniform.size,
               type: uniform.type,
               data: uniform.data
           };
       });
   }

   function _setUniforms (gl, uniformData) {
       (uniformData || []).forEach(uniform => {
           const {size, type, location, data} = uniform;

           gl[`uniform${size}${type}v`](location, data);
       });
   }

   function _enableVertexAttributes (gl, attributes) {
       (attributes || []).forEach(attrib => {
           const {location, buffer, size, type} = attrib;

           gl.enableVertexAttribArray(location);
           gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
           gl.vertexAttribPointer(location, size, gl[type], false, 0, 0);
       });
   }

   function _destroy (gl, data) {
       data.forEach(layer => {
           const {program, vertexShader, fragmentShader, source, target, attributes} = layer;

           // delete buffers
           (attributes || []).forEach(attr => gl.deleteBuffer(attr.buffer));

           // delete textures and framebuffers
           if ( source ) {
               if ( source.texture ) {
                   gl.deleteTexture(source.texture);
               }
               if ( source.buffer ) {
                   gl.deleteFramebuffer(source.buffer);
               }
           }

           if ( target ) {
               if ( target.texture ) {
                   gl.deleteTexture(target.texture);
               }
               if ( target.buffer ) {
                   gl.deleteFramebuffer(target.buffer);
               }
           }

           // delete program
           gl.deleteProgram(program);

           // delete shaders
           gl.deleteShader(vertexShader);
           gl.deleteShader(fragmentShader);
       });
   }

   /**
    * @private
    * @typedef {vglLayer[]} vglSceneData
    *
    * @typedef {Object} vglLayer
    * @property {WebGLProgram} program
    * @property {WebGLShader} vertexShader
    * @property {WebGLShader} fragmentShader
    * @property {vglLayerTarget} source
    * @property {vglLayerTarget} target
    * @property {vglAttribute[]} attributes
    *
    * @typedef {Object} vglLayerTarget
    * @property {WebGLTexture} texture
    * @property {WebGLFramebuffer|null} buffer
    * @property {number} [width]
    * @property {number} [height]
    *
    * @typedef {Object} vglAttribute
    * @property {string} name
    * @property {GLint} location
    * @property {WebGLBuffer} buffer
    * @property {string} type
      @property {number} size
    */

   /**
    * Initialize a ticker instance for batching animation of multiple Vgl instances.
    *
    * @class Ticker
    */
   class Ticker {
       constructor () {
           this.pool = [];
       }

       /**
        * Starts the animation loop.
        */
       start () {
           if ( ! this.animationFrameId ) {
               const loop = () => {
                   this.animationFrameId = window.requestAnimationFrame(loop);
                   this.draw();
               };

               this.animationFrameId = window.requestAnimationFrame(loop);
           }
       }

       /**
        * Stops the animation loop.
        */
       stop () {
           window.cancelAnimationFrame(this.animationFrameId);
           this.animationFrameId = null;
       }

       /**
        * Invoke draw() on all instances in the pool.
        */
       draw () {
           this.pool.forEach(instance => instance.draw());
       }

       /**
        * Add an instance to the pool.
        *
        * @param {Vgl} instance
        */
       add (instance) {
           const index = this.pool.indexOf(instance);

           if ( ! ~ index ) {
               this.pool.push(instance);
           }
       }

       /**
        * Remove an instance form the pool.
        *
        * @param {Vgl} instance
        */
       remove (instance) {
           const index = this.pool.indexOf(instance);

           if ( ~ index ) {
               this.pool.splice(index, 1);
           }
       }
   }

   /**
    * Initialize a webgl target with effects.
    *
    * @class Vgl
    * @param {VglConfig} config
    */
   class Vgl {
       /**
        * @constructor
        */
       constructor (config) {
           this.init(config);

           this._restoreContext = (e) => {
               e.preventDefault();
               this.config.target.removeEventListener('webglcontextrestored', this._restoreContext, true);

               this.init(this.config);

               if ( this._restoreLoop ) {
                   delete this._restoreLoop;

                   if ( this._source ) {
                       this.setSource(this._source);
                   }
               }

               delete this._source;
           };

           this._loseContext = (e) => {
               e.preventDefault();
               this.gl.canvas.addEventListener('webglcontextrestored', this._restoreContext, true);

               // if animation loop is running
               if ( this.animationFrameId || this.playing ) {
                   // cache this state for restoring animation loop as well
                   this._restoreLoop = true;
               }

               this.destroy(true);
           };

           this.gl.canvas.addEventListener('webglcontextlost', this._loseContext, true);
       }

       /**
        * Initializes a Vgl instance.
        * This is called inside the constructor, but can be called again after {@link Vgl#desotry()}.
        *
        * @param {VglConfig} config
        */
       init (config) {
           const {target, effects, ticker} = config;

           const {gl, data} = videogl.init(target, effects, this.dimensions);

           this.gl = gl;
           this.data = data;

           // cache for restoring context
           this.config = config;
           this.ticker = ticker;
       }

       /**
        * Set the source config.
        *
        * @param {HTMLVideoElement|vglSource} source
        */
       setSource (source) {
           if ( ! source ) return;

           let type, media, width, height;

           if ( Object.prototype.toString.call(source) === '[object Object]' ) {
               ({type, media, width, height} = source);
           }
           else {
               media = source;
           }

           if ( width && height ) {
               this.dimensions = { width, height };
           }

           // resize the target canvas if needed
           videogl.resize(this.gl, this.dimensions, this.data);

           this.media = media;
           this.type = type || this.type;
       }

       /**
        * Draw current scene.
        */
       draw () {
           videogl.draw(this.gl, this.media, this.data, this.dimensions);
       }

       /**
        * Starts the animation loop.
        */
       play () {
           if ( this.ticker ) {
               if ( this.animationFrameId ) {
                   this.stop();
               }

               if ( ! this.playing ) {
                   this.playing = true;
                   this.ticker.add(this);
               }
           }
           else if ( ! this.animationFrameId ) {
               const loop = () => {
                   this.animationFrameId = window.requestAnimationFrame(loop);
                   this.draw();
               };

               this.animationFrameId = window.requestAnimationFrame(loop);
           }

       }

       /**
        * Stops the animation loop.
        */
       stop () {
           if ( this.animationFrameId ) {
               window.cancelAnimationFrame(this.animationFrameId);
               this.animationFrameId = null;
           }

           if ( this.playing ) {
               this.playing = false;
               this.ticker.remove(this);
           }
       }

       /**
        * Stops animation loop and frees all resources.
        */
       destroy (keepState) {
           this.stop();

           videogl.destroy(this.gl, this.data);

           if ( keepState ) {
               const dims = this.dimensions || {};

               this._source = {
                   type: this.type,
                   media: this.media,
                   width: dims.width,
                   height: dims.height
               };
           }
           else {
               this.config = null;
               this.dimensions = null;

               this.gl.canvas.removeEventListener('webglcontextlost', this._loseContext, true);
           }

           this.gl = null;
           this.data = null;
           this.media = null;
           this.type = null;
       }
   }

   const VERTEX_SRC = `
precision mediump float;

uniform vec2 u_texOffset;

attribute vec2 a_texCoord;
attribute vec2 a_position;

varying vec2 v_texColorCoord;
varying vec2 v_texAlphaCoord;

void main() {
    v_texColorCoord = a_texCoord;
    v_texAlphaCoord = v_texColorCoord + u_texOffset;

    gl_Position = vec4(a_position.xy, 0.0, 1.0);
}`;

   const FRAGMENT_SRC = `
precision mediump float;

varying vec2 v_texColorCoord;
varying vec2 v_texAlphaCoord;

uniform sampler2D u_source;

void main() {
    float luma = texture2D(u_source, v_texAlphaCoord).r;
    vec3 color = texture2D(u_source, v_texColorCoord).rgb;
    
    gl_FragColor = vec4(color * luma, luma);
}`;

   function transparentVideo () {
       return {
           vertexSrc: VERTEX_SRC,
           fragmentSrc: FRAGMENT_SRC,
           uniforms: [
               {
                   name: 'u_texOffset',
                   size: 2,
                   type: 'f',
                   data: [0.0, -0.5]
               }
           ],
           attributes: [
               {
                   name: 'a_position',
                   data: new Float32Array([
                       -1.0, -1.0,
                       -1.0, 1.0,
                       1.0, -1.0,
                       1.0, 1.0]),
                   size: 2,
                   type: 'FLOAT'
               },
               {
                   name: 'a_texCoord',
                   data: new Float32Array([
                       0.0, 0.5,
                       0.0, 1.0,
                       1.0, 0.5,
                       1.0, 1.0]),
                   size: 2,
                   type: 'FLOAT'
               }
           ]
       };
   }

   const VERTEX_SRC$1 = `
precision mediump float;

attribute vec2 a_texCoord;
attribute vec2 a_position;

varying vec2 v_texCoord;

void main() {
    v_texCoord = a_texCoord;

    gl_Position = vec4(a_position, 0.0, 1.0);
}`;

   const FRAGMENT_SRC$1 = `
precision mediump float;

varying vec2 v_texCoord;

uniform float u_contrast;
uniform float u_brightness;
uniform sampler2D u_source;

const vec3 half3 = vec3(0.5);

void main() {
    vec4 pixel = texture2D(u_source, v_texCoord);
    vec3 color = pixel.rgb * u_brightness;
    color = (color - half3) * u_contrast + half3;

    gl_FragColor = vec4(color, pixel.a);
}`;

   function brightnessContrast () {
       return {
           vertexSrc: VERTEX_SRC$1,
           fragmentSrc: FRAGMENT_SRC$1,
           uniforms: [
               /**
                * 0.0 is completely black.
                * 1.0 is no change.
                *
                * @min 0.0
                * @default 1.0
                */
               {
                   name: 'u_brightness',
                   size: 1,
                   type: 'f',
                   data: [1.0]
               },
               /**
                * 0.0 is completely gray.
                * 1.0 is no change.
                *
                * @min 0.0
                * @default 1.0
                */
               {
                   name: 'u_contrast',
                   size: 1,
                   type: 'f',
                   data: [1.0]
               }
           ],
           attributes: [
               {
                   name: 'a_position',
                   data: new Float32Array([
                       -1.0, -1.0,
                       -1.0, 1.0,
                       1.0, -1.0,
                       1.0, 1.0]),
                   size: 2,
                   type: 'FLOAT'
               },
               {
                   name: 'a_texCoord',
                   data: new Float32Array([
                       0.0, 0.0,
                       0.0, 1.0,
                       1.0, 0.0,
                       1.0, 1.0]),
                   size: 2,
                   type: 'FLOAT'
               }
           ]
       };
   }

   const VERTEX_SRC$2 = `
precision mediump float;

attribute vec2 a_texCoord;
attribute vec2 a_position;

uniform float u_hue;

varying vec2 v_texCoord;
varying vec3 v_weights;

void main() {
	float angle = u_hue * 3.14159265358979323846264;
	float s = sin(angle);
	float c = cos(angle);
	v_weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;
	v_texCoord = a_texCoord;
	
	gl_Position = vec4(a_position, 0.0, 1.0);
}`;

   const FRAGMENT_SRC$2 = `
precision mediump float;

uniform float u_hue;
uniform float u_saturation;
uniform sampler2D u_source;

varying vec2 v_texCoord;
varying vec3 v_weights;

void main() {
    vec4 pixel = texture2D(u_source, v_texCoord);

    pixel.rgb = vec3(
        dot(pixel.rgb, v_weights.xyz),
        dot(pixel.rgb, v_weights.zxy),
        dot(pixel.rgb, v_weights.yzx)
    );
    
    vec3 adjustment = (pixel.r + pixel.g + pixel.b) / 3.0 - pixel.rgb;
    if (u_saturation > 0.0) {
        adjustment *= (1.0 - 1.0 / (1.0001 - u_saturation));
    }
    else {
        adjustment *= (-u_saturation);
    }
    pixel.rgb += adjustment;

    gl_FragColor = vec4(pixel.rgb, pixel.a);
}`;

   function hueSaturation () {
       return {
           vertexSrc: VERTEX_SRC$2,
           fragmentSrc: FRAGMENT_SRC$2,
           uniforms: [
               /**
                * 0.0 is no change.
                * -1.0 is -180deg hue rotation.
                * 1.0 is +180deg hue rotation.
                *
                * @min -1.0
                * @max 1.0
                * @default 0.0
                */
               {
                   name: 'u_hue',
                   size: 1,
                   type: 'f',
                   data: [0.0]
               },
               /**
                * 0.0 is no change.
                * -1.0 is grayscale.
                * 1.0 is max saturation.
                *
                * @min -1.0
                * @max 1.0
                * @default 0.0
                */
               {
                   name: 'u_saturation',
                   size: 1,
                   type: 'f',
                   data: [0.0]
               }
           ],
           attributes: [
               {
                   name: 'a_position',
                   data: new Float32Array([
                       -1.0, -1.0,
                       -1.0, 1.0,
                       1.0, -1.0,
                       1.0, 1.0]),
                   size: 2,
                   type: 'FLOAT'
               },
               {
                   name: 'a_texCoord',
                   data: new Float32Array([
                       0.0, 0.0,
                       0.0, 1.0,
                       1.0, 0.0,
                       1.0, 1.0]),
                   size: 2,
                   type: 'FLOAT'
               }
           ]
       };
   }

   const VERTEX_SRC$3 = `
precision mediump float;

attribute vec2 a_texCoord;
attribute vec2 a_position;

varying vec2 v_texCoord;

void main() {
	v_texCoord = a_texCoord;
	
	gl_Position = vec4(a_position, 0.0, 1.0);
}`;

   const FRAGMENT_SRC$3 = `
precision mediump float;

varying vec2 v_texCoord;

uniform sampler2D u_source;
uniform vec4 u_light;
uniform vec4 u_dark;

const vec3 lumcoeff = vec3(0.2125, 0.7154, 0.0721);

void main() {
    vec4 pixel = texture2D(u_source, v_texCoord);
    vec3 gray = vec3(dot(lumcoeff, pixel.rgb / pixel.a));
    vec3 tonedColor = mix(u_dark.rgb, u_light.rgb, gray);
    gl_FragColor = vec4(tonedColor, 1.0) * pixel.a;
}`;

   function duotone () {
       return {
           vertexSrc: VERTEX_SRC$3,
           fragmentSrc: FRAGMENT_SRC$3,
           uniforms: [
               /**
                * Light tone
                */
               {
                   name: 'u_light',
                   size: 4,
                   type: 'f',
                   data: [0.9882352941, 0.7333333333, 0.05098039216, 1]
               },
               /**
                * Dark tone
                */
               {
                   name: 'u_dark',
                   size: 4,
                   type: 'f',
                   data: [0.7411764706, 0.0431372549, 0.568627451, 1]
               }
           ],
           attributes: [
               {
                   name: 'a_position',
                   data: new Float32Array([
                       -1.0, -1.0,
                       -1.0, 1.0,
                       1.0, -1.0,
                       1.0, 1.0]),
                   size: 2,
                   type: 'FLOAT'
               },
               {
                   name: 'a_texCoord',
                   data: new Float32Array([
                       0.0, 0.0,
                       0.0, 1.0,
                       1.0, 0.0,
                       1.0, 1.0]),
                   size: 2,
                   type: 'FLOAT'
               }
           ]
       };
   }

   const video = document.querySelector('#video');
   let target = document.querySelector('#target');

   let playing = false;
   let timeupdate = false;

   video.addEventListener('playing', isPlaying, true);
   video.addEventListener('timeupdate', isTimeupdate, true);
   video.addEventListener('canplay', canPlay, true);

   function canPlay () {
       video.play();
   }

   function isPlaying () {
       playing = true;
       video.removeEventListener('playing', isPlaying, true);
       check();
   }
   function isTimeupdate () {
       timeupdate = true;
       video.removeEventListener('timeupdate', isTimeupdate, true);
       check();
   }

   function check () {
       if (playing && timeupdate) {
           width = video.videoWidth;
           height = video.videoHeight / 2;
           target.style.width = `${width}px`;
           target.style.height = `${height}px`;
           instance.setSource({media: video, type: 'video', width, height});
           instance.play();
           video.removeEventListener('canplay', canPlay, true);
       }
   }

   function hex2vec4 (hex) {
       const s = hex.substring(1);
       return [s[0] + s[1], s[2] + s[3], s[4] + s[5], 'ff'].map(h => parseInt(h, 16) / 255);
   }

   function handleRangeChange (e) {
       const target = e.target;
       const effect = target.id;
       let data;

       switch ( effect ) {
           case 'brightness':
           case 'contrast':
               data = bc.uniforms.filter(u => u.name === `u_${effect}`)[0].data;
               break;
           case 'hue':
           case 'saturation':
               data = hs.uniforms.filter(u => u.name === `u_${effect}`)[0].data;
               break;
           case 'duotone-light':
               // instance.data[3].uniforms[0].data = hex2vec4(target.value);
               instance.data[1].uniforms[0].data = hex2vec4(target.value);
               e.target.nextElementSibling.textContent = target.value;
               break;
           case 'duotone-dark':
               // instance.data[3].uniforms[1].data = hex2vec4(target.value);
               instance.data[1].uniforms[1].data = hex2vec4(target.value);
               e.target.nextElementSibling.textContent = target.value;
               break;
       }

       if ( data ) {
           data[0] = parseFloat(target.value);
           e.target.nextElementSibling.textContent = data[0];
       }
   }

   // const inputs = ['brightness', 'contrast', 'hue', 'saturation', 'duotone-light', 'duotone-dark'];
   const inputs = ['duotone-light', 'duotone-dark'];
   const hs = hueSaturation();
   const bc = brightnessContrast();
   const dt = duotone();
   const tv = transparentVideo();

   // const effects = [tv, hs, bc, dt];
   const effects = [tv];
   const [, src] = decodeURIComponent(window.location.search).match(/\?(.*)/) || [];
   let width = 0, height = 0;

   video.src = `https://video.wixstatic.com/video/${decodeURIComponent(src)}/mp4/file.mp4`;

   inputs.map(function (name) {
       return document.getElementById(name);
   })
       .map(function (input) {
           input.addEventListener('input', handleRangeChange);
       });

   document.querySelector('#toggle-duotone').addEventListener('input', e => {
       const checked = e.target.checked;

       instance.destroy();

       // Works around an issue with working with the old context
       const newCanvas = document.createElement('canvas');
       target.parentElement.replaceChild(newCanvas, target);
       target = newCanvas;


       if ( checked ) {
           effects.push(dt);
       }
       else {
           effects.pop();
       }

       instance.init({target, effects, ticker});
       target.style.width = `${width}px`;
       target.style.height = `${height}px`;
       instance.setSource({media: video, type: 'video', width, height});
       instance.play();
   });

   const ticker = new Ticker();
   let instance = new Vgl({target, effects, ticker});

   ticker.start();

   // const gl = instance.gl;
   // const ext = gl.getExtension('WEBGL_lose_context');

   // document.addEventListener('keydown', function (ev) {
   //     if ( ev.key === 'Enter' ) {
           // const height = 1;
           // const delta = 1;
           // const buffer = new Uint8Array(gl.drawingBufferWidth * height * 4);
           //
           // gl.readPixels(0, gl.drawingBufferHeight - delta, gl.drawingBufferWidth, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
           //
           // const colors = {};
           // for ( let i=0; i < buffer.length; i += 4) {
           //     const r = buffer[i];
           //     const g = buffer[i+1];
           //     const b = buffer[i+2];
           //     const a = buffer[i+3];
           //     const rgba = `${r},${g},${b},${a}`;
           //
           //     colors[i] = rgba;
           // }
           // console.log(colors);
           // if  ( gl.isContextLost() ) {
           //     console.log('RESTORE');
           //     ext.restoreContext();
           // }
           // else {
           //     console.log('LOSE');
           //     ext.loseContext();
           // }
   //     }
   // });

}());
