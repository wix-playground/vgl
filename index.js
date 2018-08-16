(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
   typeof define === 'function' && define.amd ? define(factory) :
   (global.vgl = factory());
}(this, (function () { 'use strict';

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
       return canvas.getContext('webgl', {
           preserveDrawingBuffer: false, // should improve performance - https://stackoverflow.com/questions/27746091/preservedrawingbuffer-false-is-it-worth-the-effort
           antialias: false, // should improve performance
           premultipliedAlpha: false // eliminates dithering edges in transparent video on Chrome
       });
   }

   /**
    * Resize the target canvas.
    *
    * @param {WebGLRenderingContext} gl
    * @param {{width: number, height: number}} [dimensions]
    * @return {boolean}
    */
   function resize (gl, dimensions) {
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
       // resize the target canvas if its size in the DOM changed
       const resized = resize(gl, dimensions);

       // these two fix bad dithered junk edges rendered in Safari
       // gl.enable(gl.BLEND);
       // gl.blendFunc(gl.SRC_ALPHA, gl.ZERO);

       data.forEach(layer => {
           const {program, source, target, attributes, uniforms} = layer;
           const isBufferTarget = Boolean(target && target.buffer);

           // then render to the target buffer or screen
           gl.bindFramebuffer(gl.FRAMEBUFFER, isBufferTarget ? target.buffer : null);

           // bind the source texture
           gl.bindTexture(gl.TEXTURE_2D, source.texture);

           // if source has no buffer then the media is the actual source
           if ( source.buffer === null ) {
               gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

               gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
           }

           if ( resized && isBufferTarget ) {
               _resizeTexture(gl, target);
               // re-bind the source texture
               gl.bindTexture(gl.TEXTURE_2D, source.texture);
           }

           // Tell it to use our program (pair of shaders)
           gl.useProgram(program);

           // set attribute buffers with data
           _enableVertexAttributes(gl, attributes);

           // set uniforms with data
           _setUniforms(gl, uniforms);

           // clear the buffer
           gl.clearColor(0.0, 0.0, 0.0, 0.0);
           gl.clear(gl.COLOR_BUFFER_BIT);

           // Draw the rectangle.
           gl.drawArrays(gl.TRIANGLES, 0, 6);
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
           const {program, vertexShader, fragmentShader} = _getWebGLProgram(gl, vertexSrc, fragmentSrc);

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

       console.log(gl.getProgramInfoLog(program));
       gl.deleteProgram(program);
   }

   function _createShader (gl, type, source) {
       const shader = gl.createShader(type);

       gl.shaderSource(shader, source);
       gl.compileShader(shader);

       const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

       if ( success ) {
           return shader;
       }

       console.log(gl.getShaderInfoLog(shader));
       gl.deleteShader(shader);
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

   var vgl = {
       init: init$1,
       start,
       stop: stop$1,
       destroy: destroy$1,
       Vgl
   };

   const targets = new Map();

   /**
    * Initialize a canvas with effects to be a target for rendering media into.
    *
    * @param {HTMLCanvasElement} target
    * @param {effectConfig[]} effects
    * @param {{width: number, height: number}} [dimensions]
    */
   function init$1 (target, effects, dimensions) {
       const scene = videogl.init(target, effects, dimensions);

       targets.set(target, scene);
   }

   /**
    * Start render loop of source media into target canvas.
    *
    * @param {HTMLCanvasElement} target
    * @param {HTMLVideoElement} src
    */
   function start (target, src) {
       const {gl, data, dimensions} = targets.get(target);

       videogl.loop(gl, src, data, dimensions);
   }

   /**
    * Stop the render loop for the given source canvas.
    *
    * @param {HTMLCanvasElement} target
    */
   function stop$1 (target) {
       const {gl} = targets.get(target);

       videogl.stop(gl);
   }

   /**
    * Detach and free all bound resources for the given target
    *
    * @param {HTMLCanvasElement} target
    */
   function destroy$1 (target) {
       const {gl, data} = targets.get(target);

       // delete all used resources
       videogl.destroy(gl, data);

       // remove cached scene from registered targets
       targets.delete(target);
   }

   class Vgl {
       constructor (config) {
           this.init(config);

           if ( this.media ) {
               this.start();
           }
       }

       init (config) {
           const {source, target, effects} = config;
           let type, media, width, height;

           if ( Object.prototype.toString.call(source) === '[object Object]' ) {
               ({type, media, width, height} = source);
           }
           else {
               media = source;
           }

           const {gl, data} = init$1(target, effects, { width, height });

           this.gl = gl;
           this.data = data;
           this.media = media;
           this.type = type;
           this.dimensions = {width, height};
       }

       start () {
           const loop = () => {
               this.animationFrameId = window.requestAnimationFrame(loop);
               videogl.draw(this.gl, this.media, this.data, this.dimensions);
           };
           this.animationFrameId = window.requestAnimationFrame(loop);
       }

       stop () {
           window.cancelAnimationFrame(this.animationFrameId);
           this.animationFrameId = null;
       }

       destroy () {
           this.stop();

           videogl.destroy(this.gl, this.data);

           this.gl = null;
           this.data = null;
           this.media = null;
       }
   }

   /**
    * @typedef {Object} effectConfig
    * @property {string} vertexSrc
    * @property {string} fragmentSrc
    * @property {Attribute[]} attributes
    * @property {Uniform[]} uniforms
    *
    * @typedef {Object} Attribute
    * @property {string} name
    * @property {number} size
    * @property {string} type
    * @property {ArrayBufferView} data
    *
    * @typedef {Object} Uniform
    * @property {string} name
    * @property {number} size
    * @property {string} type
    * @property {Array} data
    */

   return vgl;

})));
