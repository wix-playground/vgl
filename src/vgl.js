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


    const _restore = function () {
        target.removeEventListener('webglcontextrestored', _restore, true);

        init(target, effects, dimensions);
    };

    const _lose = function () {
        target.addEventListener('webglcontextrestored', _restore, true);

        destroy(target);
    };

    target.addEventListener('webglcontextlost', _lose, true);

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

    // resize the target canvas if its size in the DOM changed
    videogl.resize(gl, dimensions, data);

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

        const _restore = (e) => {
            e.preventDefault();
            this.config.target.removeEventListener('webglcontextrestored', _restore, true);

            this.init(this.config);

            if ( this._restoreLoop ) {
                delete this._restoreLoop;

                if ( this._source ) {
                    this.setSource(this._source);
                }
            }

            delete this._source;
        };

        const _lose = (e) => {
            e.preventDefault();
            this.gl.canvas.addEventListener('webglcontextrestored', _restore, true);

            // if animation loop is running
            if ( this.animationFrameId ) {
                // cache this state for restoring animation loop as well
                this._restoreLoop = true;
            }

            this.destroy(true);
        };

        this.gl.canvas.addEventListener('webglcontextlost', _lose, true);
    }

    /**
     * Initializes a Vgl instance.
     * This is called inside the constructor, but can be called again after {@link Vgl#desotry()}.
     *
     * @param {VglConfig} config
     */
    init (config) {
        const {target, effects} = config;

        const {gl, data} = videogl.init(target, effects, this.dimensions);

        this.gl = gl;
        this.data = data;

        // cache for restoring context
        this.config = config;
    }

    /**
     * Starts the animation loop.
     *
     * @param {HTMLVideoElement|vglSource} [source]
     */
    setSource (source) {
        if ( source ) {
            this._initMedia(source);
        }

        if ( ! this.animationFrameId ) {
            const loop = () => {
                this.animationFrameId = window.requestAnimationFrame(loop);
                videogl.draw(this.gl, this.media, this.data, this.dimensions);
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

/**
 * @typedef {Object} VglConfig
 * @property {HTMLCanvasElement} target
 * @property {effectConfig[]} effects
 */

/**
 * @typedef {Object} vglSource
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
