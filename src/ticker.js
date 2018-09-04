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

export default Ticker;
