(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
   typeof define === 'function' && define.amd ? define(['exports'], factory) :
   (factory((global.vgl = {})));
}(this, (function (exports) { 'use strict';

   var videogl = {
       init,
       draw,
       loop,
       stop,
       destroy,
       resize,
       getWebGLContext
   };

   const animationFrameIDs = new Map();

   /**
    * Initialize a rendering context and compiled WebGLProgram for the given canvas and effects.
    *
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
    *
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
    * Start an animation loop that draws given video to target webgl context.
    *
    * @param {WebGLRenderingContext} gl
    * @param {HTMLVideoElement} video
    * @param {vglSceneData} data
    * @param {{width: number, height: number}} dimensions
    */
   function loop (gl, video, data, dimensions) {
       const id = window.requestAnimationFrame(() => loop(gl, video, data, dimensions));

       animationFrameIDs.set(gl, id);

       draw(gl, video, data, dimensions);
   }

   /**
    * Draw a given scene
    *
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
    * Stop an animation loop related to the given target webgl context.
    *
    * @param {WebGLRenderingContext} gl
    */
   function stop (gl) {
       window.cancelAnimationFrame(animationFrameIDs.get(gl));

       animationFrameIDs.delete(gl);
   }

   /**
    * Free all resources attached to a specific webgl context.
    *
    * @param {WebGLRenderingContext} gl
    * @param {vglSceneData} data
    */
   function destroy (gl, data) {
       // make sure  we're not animating
       stop(gl);

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
        * @param {HTMLVideoElement|vglSource} [source]
        */
       setSource (source) {
           if ( source ) {
               this._initMedia(source);
           }
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

       _initMedia (source) {
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
   }

   exports.Vgl = Vgl;
   exports.Ticker = Ticker;

   Object.defineProperty(exports, '__esModule', { value: true });

})));
