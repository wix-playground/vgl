(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.vgl = factory());
}(this, (function () { 'use strict';

    var videogl = {
        init,
        draw,
        loop,
        resize,
        getWebGLContext
    };

    function init (canvas, effects) {
        const gl = getWebGLContext(canvas);

        const programData = _initProgram(gl, effects);

        // create a target texture to render to
        const texture = _createTexture(gl);

        let framebuffer = null;

        if ( effects.length > 1 ) {
            // Create and bind the framebuffer
            framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

            // attach the texture as the first color attachment
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        }

        return {gl, data: programData, texture, framebuffer};
    }

    function getWebGLContext (canvas) {
        return canvas.getContext('webgl', {
            preserveDrawingBuffer: false, // should improve performance - https://stackoverflow.com/questions/27746091/preservedrawingbuffer-false-is-it-worth-the-effort
            antialias: false, // should improve performance
            premultipliedAlpha: false // eliminates dithering edges in transparent video on Chrome
        });
    }

    function resize (gl) {
        const canvas = gl.canvas;
        const realToCSSPixels = 1; //window.devicePixelRatio;

        // Lookup the size the browser is displaying the canvas.
        const displayWidth  = Math.floor(canvas.clientWidth * realToCSSPixels);
        const displayHeight = Math.floor(canvas.clientHeight * realToCSSPixels);

        // Check if the canvas is not the same size.
        if ( canvas.width  !== displayWidth ||
             canvas.height !== displayHeight ) {

            // Make the canvas the same size
            canvas.width  = displayWidth;
            canvas.height = displayHeight;
        }

        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

    function loop (gl, video, scene) {
        window.requestAnimationFrame(() => loop(gl, video, scene));
        draw(gl, video, scene);
    }

    function draw (gl, video, scene) {
        const {data, texture, framebuffer} = scene;
        const lastIndex = data.length - 1;

        let hasFramebuffer = false;

        if ( framebuffer ) {
            hasFramebuffer = true;
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        }

        // resize the target canvas if its size in the DOM changed
        resize(gl);

        // clear the buffer
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // these two fix bad dithered junk edges rendered in Safari
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ZERO);

        data.forEach((layer, i) => {
            const {program, attributes, uniforms} = layer;

            // if we have a framebuffer we're rendering into and this is the last effect in the chain
            if ( hasFramebuffer && i === lastIndex ) {
                // then render to screen
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            }

            // Tell it to use our program (pair of shaders)
            gl.useProgram(program);

            // set attribute buffers with data
            _enableVertexAttributes(gl, attributes);

            // set uniforms with data
            _setUniforms(gl, uniforms);

            gl.bindTexture(gl.TEXTURE_2D, texture);
            // tell webgl we're reading premultiplied data
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

            // only on first effect read the actual source
            if ( i === 0 ) {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
            }

            // Draw the rectangle.
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        });
    }

    function _initProgram (gl, effects) {
        return effects.map(config => {
            const {vertexSrc, fragmentSrc, attributes, uniforms} = config;
            const program = _getWebGLProgram(gl, vertexSrc, fragmentSrc);

            // setup the vertex data
            const attribBuffers = _initVertexAttributes(gl, program, attributes);

            // setup uniforms
            const uniformData = _initUniforms(gl, program, uniforms);

            return {
                program,
                attributes: attribBuffers,
                uniforms: uniformData
            };
        });
    }

    function _getWebGLProgram (gl, vertexSrc, fragmentSrc) {
        const vertexShader = _createShader(gl.VERTEX_SHADER, vertexSrc);
        const fragmentShader = _createShader(gl.FRAGMENT_SHADER, fragmentSrc);

        return _createProgram(gl, vertexShader, fragmentShader);
    }

    function _createProgram (gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        const success = gl.getProgramParameter(program, gl.LINK_STATUS);

        if ( success ) {
            return program;
        }

        // console.log(gl.getProgramInfoLog(program));
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

        // console.log(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
    }

    function _createTexture (gl) {
        const texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, texture);
        // tell webgl we're reading premultiplied data
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

        // Set the parameters so we can render any size image.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // Upload the image into the texture.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, null);

        return texture;
    }

    function _createBuffer (gl, program, name, data) {
        const attribLocation = gl.getAttribLocation(program, name);
        const buffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

        return [attribLocation, buffer];
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

    var vgl = {
        register,
        start
    };

    const targets = new Map();

    /**
     * Register and initialize a canvas with effects to be a target for rendering media into.
     *
     * @param {HTMLCanvasElement} target
     * @param {effectConfig[]} effects
     */
    function register (target, effects) {
        const scene = videogl.init(target, effects);

        targets.set(target, scene);
    }

    /**
     * Start render loop of source media into target canvas.
     *
     * @param {HTMLCanvasElement} target
     * @param {HTMLVideoElement} src
     */
    function start (target, src) {
        const {gl, data, texture, framebuffer} = target.get(target);

        videogl.loop(gl, src, {data, texture, framebuffer});
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
     * @property {ArrayBuffer} data
     *
     * @typedef {Object} Uniform
     * @property {string} name
     * @property {number} size
     * @property {string} type
     * @property {Array} data
     */

    return vgl;

})));
