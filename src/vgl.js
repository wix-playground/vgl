import videogl from './videogl';

const targets = new Map();

/**
 * Initialize a canvas with effects to be a target for rendering media into.
 *
 * @name vgl.init
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
 * @name vgl.start
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
 * @name vgl.stop
 * @param {HTMLCanvasElement} target
 */
function stop (target) {
    const {gl} = targets.get(target);

    videogl.stop(gl);
}

/**
 * Detach and free all bound resources for the given target
 *
 * @name vgl.destroy
 * @param {HTMLCanvasElement} target
 */
function destroy (target) {
    const {gl, data} = targets.get(target);

    // delete all used resources
    videogl.destroy(gl, data);

    // remove cached scene from registered targets
    targets.delete(target);
}

/**
 * Initialize a webgl target with video source and effects, and start animation loop.
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

        if ( this.media ) {
            this.start();
        }
    }

    /**
     * Initializes a Vgl instance.
     * This is called inside the constructor, but can be called again after {@Vgl#desotry()}.
     *
     * @param {VglConfig} config
     */
    init (config) {
        const {source, target, effects} = config;

        this._initMedia(source);

        const {gl, data} = videogl.init(target, effects, this.dimensions);

        this.gl = gl;
        this.data = data;

    }

    /**
     * Starts the animation loop.
     *
     * @param {HTMLVideoElement|VglConfigSource} [source]
     */
    start (source) {
        const loop = () => {
            this.animationFrameId = window.requestAnimationFrame(loop);
            videogl.draw(this.gl, this.media, this.data, this.dimensions);
        };

        if ( source ) {
            this._initMedia(source);
        }

        this.animationFrameId = window.requestAnimationFrame(loop);
    }

    /**
     * Stops the animation loop.
     */
    stop () {
        window.cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
    }

    /**
     * Stops animation loop and frees all resources.
     */
    destroy () {
        this.stop();

        videogl.destroy(this.gl, this.data);

        this.gl = null;
        this.data = null;
        this.media = null;
        this.type = null;
        this.dimensions = null;
    }

    _initMedia (source) {
        let type, media, width, height;

        if ( Object.prototype.toString.call(source) === '[object Object]' ) {
            ({type, media, width, height} = source);
        }
        else {
            media = source;
        }

        this.media = media;
        this.type = type;
        this.dimensions = { width, height };
    }
}

/**
 * @typedef {Object} VglConfig
 * @property {HTMLCanvasElement} target
 * @property {HTMLVideoElement|VglConfigSource} source
 * @property {effectConfig[]} effects
 */

/**
 * @typedef {Object} VglConfigSource
 * @property {HTMLVideoElement} media
 * @property {string} type
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} effectConfig
 * @property {string} vertexSrc
 * @property {string} fragmentSrc
 * @property {Attribute[]} attributes
 * @property {Uniform[]} uniforms
 */

/**
 * @typedef {Object} Attribute
 * @property {string} name
 * @property {number} size
 * @property {string} type
 * @property {ArrayBufferView} data
 */

/**
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
