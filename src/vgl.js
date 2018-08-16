import videogl from './videogl';

const targets = new Map();

/**
 * Initialize a canvas with effects to be a target for rendering media into.
 *
 * @param {HTMLCanvasElement} target
 * @param {effectConfig[]} effects
 * @param {{width: number, height: number}} [dimensions]
 */
function init (target, effects, dimensions) {
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
function stop (target) {
    const {gl} = targets.get(target);

    videogl.stop(gl);
}

/**
 * Detach and free all bound resources for the given target
 *
 * @param {HTMLCanvasElement} target
 */
function destroy (target) {
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

        const {gl, data} = videogl.init(target, effects, { width, height });

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

export default {
    init,
    start,
    stop,
    destroy,
    Vgl
}
