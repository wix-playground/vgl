import videogl from './videogl';

export default {
    init,
    start,
    stop,
    destroy
}

const targets = new Map();

/**
 * Initialize a canvas with effects to be a target for rendering media into.
 *
 * @param {HTMLCanvasElement} target
 * @param {effectConfig[]} effects
 */
function init (target, effects) {
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
    const {gl, data} = targets.get(target);

    videogl.loop(gl, src, data);
}

/**
 * Stop the render loop for the given source canvas.
 *
 * @param {HTMLCanvasElement} target
 */
function stop (target) {
    const {gl, data} = targets.get(target);

    videogl.stop(gl, data);
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
