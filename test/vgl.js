const {Vgl, Ticker} = require('./src/vgl');
const brightnessContrast = require('./src/brightness-contrast')();
const assert = require('assert');

describe('vgl', function() {
    describe('new Vgl()', function () {
        let canvas, instance;

        beforeEach(function () {
            canvas = document.createElement('canvas');

            instance = new Vgl({target: canvas, effects: [brightnessContrast]});
        });

        it('should instantiate a Vgl instance with a target canvas', function () {
            assert(instance);
            assert(instance.gl instanceof WebGLRenderingContext);
            assert(instance.data);
            assert(instance.data[0].target === null);
        });

        afterEach(function () {
            instance.destroy();
            canvas = null;
        });
    });

    describe('Vgl webglcontextlost', function () {
        it('should destroy the instance on webglcontextlost event', function (done) {
            const canvas = document.createElement('canvas');

            const instance = new Vgl({target: canvas, effects: [brightnessContrast]});
            let calledTimes = 0;

            assert(instance);

            const _des = instance.destroy.bind(instance);

            instance.destroy = function () {
                calledTimes += 1;
                _des();
                assert.strictEqual(calledTimes, 1);
                done();
            };

            instance.gl.getExtension('WEBGL_lose_context').loseContext();
        });

        it('should should NOT trigger webglcontextlost event if destroy()\'ed', function (done) {
            const canvas = document.createElement('canvas');

            const instance = new Vgl({target: canvas, effects: [brightnessContrast]});
            let calledTimes = 0;

            assert(instance);

            const ext = instance.gl.getExtension('WEBGL_lose_context');

            instance.destroy();

            const _des = instance.destroy.bind(instance);

            instance.destroy = function () {
                calledTimes += 1;
                _des();
                assert.strictEqual(calledTimes, 0);
                done();
            };

            ext.loseContext();

            setTimeout(() => {
                assert.strictEqual(calledTimes, 0);
                done();
            }, 10);
        });
    });

    describe('Vgl webglcontextrestored', function () {
        it('should restore a destroyed instance on webglcontextrestored event', function (done) {
            const canvas = document.createElement('canvas');

            const instance = new Vgl({target: canvas, effects: [brightnessContrast]});
            let calledTimes = 0;

            assert(instance);

            const _des = instance.destroy.bind(instance);
            const _ini = instance.init.bind(instance);
            const gl = instance.gl;
            const ext = gl.getExtension('WEBGL_lose_context');

            instance.destroy = function (arg) {
                calledTimes += 1;
                _des(arg);
                assert.strictEqual(calledTimes, 1);
            };

            instance.init = function (arg) {
                calledTimes += 1;
                _ini(arg);
                assert.strictEqual(calledTimes, 2);

                // check we restored instance' state
                assert(instance);
                assert(instance.gl instanceof WebGLRenderingContext);
                assert(instance.data);
                assert(instance.data[0].target === null);

                done();
            };

            ext.loseContext();
            setTimeout(() => ext.restoreContext(), 10);
        });
    });

    describe('Vgl#setSource', function () {
        let canvas, instance, video;

        beforeEach(function () {
            canvas = document.createElement('canvas');
            video = document.createElement('video');

            instance = new Vgl({target: canvas, effects: [brightnessContrast]});
        });

        it('should set media to given HTMLVideoElement and start animation loop', function () {
            assert(instance);
            assert(instance.gl instanceof WebGLRenderingContext);
            assert(instance.data);
            assert(instance.data[0].target === null);

            instance.setSource(video);
            assert(instance.media instanceof HTMLVideoElement);
        });

        it('should set media to given object with media:HTMLVideoElement and start animation loop', function () {
            assert(instance);
            assert(instance.gl instanceof WebGLRenderingContext);
            assert(instance.data);
            assert(instance.data[0].target === null);

            instance.setSource({media: video});
            assert(instance.media instanceof HTMLVideoElement);
        });

        afterEach(function () {
            instance.destroy();
            canvas = null;
            video = null;
        });
    });

    describe('Vgl#play', function () {
        let canvas, instance, video;

        beforeEach(function () {
            canvas = document.createElement('canvas');
            video = document.createElement('video');
        });

        it('should start animation loop', function () {
            instance = new Vgl({target: canvas, effects: [brightnessContrast]});

            assert(instance);
            assert(instance.gl instanceof WebGLRenderingContext);
            assert(instance.data);
            assert(instance.data[0].target === null);

            instance.setSource(video);
            assert(instance.media instanceof HTMLVideoElement);

            instance.play();

            assert(instance.animationFrameId);
        });

        it('should start animation loop with a ticker', function () {
            const ticker = new Ticker();
            instance = new Vgl({target: canvas, effects: [brightnessContrast], ticker});

            assert(instance);
            assert(instance.gl instanceof WebGLRenderingContext);
            assert(instance.data);
            assert(instance.data[0].target === null);

            instance.setSource({media: video});
            assert(instance.media instanceof HTMLVideoElement);

            instance.play();

            assert(!instance.animationFrameId);
            assert.strictEqual(instance.playing, true);

            assert.strictEqual(instance.ticker, ticker);
            assert.strictEqual(ticker.pool[0], instance);
        });

        afterEach(function () {
            instance.destroy();
            canvas = null;
            video = null;
        });
    });

    describe('Vgl#stop', function () {
        let canvas, instance, video;

        beforeEach(function () {
            canvas = document.createElement('canvas');
            video = document.createElement('video');
        });

        it('should stop a started animation loop', function () {
            instance = new Vgl({target: canvas, effects: [brightnessContrast]});

            assert(instance);
            assert(instance.gl instanceof WebGLRenderingContext);
            assert(instance.data);
            assert(instance.data[0].target === null);

            instance.setSource(video);
            assert(instance.media instanceof HTMLVideoElement);

            instance.play();

            assert(instance.animationFrameId);

            instance.stop();

            assert(!instance.animationFrameId);
        });

        it('should stop a started animation loop with a ticker', function () {
            const ticker = new Ticker();
            instance = new Vgl({target: canvas, effects: [brightnessContrast], ticker});

            assert(instance);
            assert(instance.gl instanceof WebGLRenderingContext);
            assert(instance.data);
            assert(instance.data[0].target === null);

            instance.setSource({media: video});
            assert(instance.media instanceof HTMLVideoElement);

            instance.play();

            assert(!instance.animationFrameId);

            assert.strictEqual(instance.ticker, ticker);
            assert.strictEqual(ticker.pool[0], instance);

            instance.stop();

            assert.strictEqual(ticker.pool.length, 0);
            assert.strictEqual(instance.playing, false);
            assert(!instance.animationFrameId);
        });

        afterEach(function () {
            instance.destroy();
            canvas = null;
            video = null;
        });
    });
});
