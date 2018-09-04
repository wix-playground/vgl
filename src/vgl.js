import videogl from './videogl';

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
            if ( this.animationFrameId ) {
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
    Vgl
}
