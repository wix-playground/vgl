export default {
    init,
    draw,
    loop,
    stop,
    resize,
    getWebGLContext
}

const animationFrameIDs = new Map();

function init (canvas, effects) {
    const gl = getWebGLContext(canvas);

    const programData = _initProgram(gl, effects);

    return {gl, data: programData};
}

function getWebGLContext (canvas) {
    return canvas.getContext('webgl', {
        preserveDrawingBuffer: false, // should improve performance - https://stackoverflow.com/questions/27746091/preservedrawingbuffer-false-is-it-worth-the-effort
        antialias: false, // should improve performance
        premultipliedAlpha: false // eliminates dithering edges in transparent video on Chrome
    });
}

function resize (gl) {
    let resized = false;
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
        resized = true;
    }

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    return resized;
}

function loop (gl, video, scene) {
    const id = window.requestAnimationFrame(() => loop(gl, video, scene));

    animationFrameIDs.set(gl, id);

    draw(gl, video, scene);
}

function draw (gl, video, data) {
    // resize the target canvas if its size in the DOM changed
    const resized = resize(gl);

    // these two fix bad dithered junk edges rendered in Safari
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ZERO);

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
            // tell webgl we're reading premultiplied data
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        }
        else {
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
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

function stop (gl) {
    window.cancelAnimationFrame(animationFrameIDs.get(gl));

    animationFrameIDs.delete(gl);
}

function destroy (gl, data) {
    // make sure  we're not animating
    stop(gl);

    _destroy(gl, data);
}

function _initProgram (gl, effects) {
    let lastTarget;
    const lastIndex = effects.length - 1;

    return effects.map((config, i) => {
        const {vertexSrc, fragmentSrc, attributes, uniforms} = config;

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
            const targetTexture = _createTexture(gl);

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
