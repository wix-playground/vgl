const vgl = require('./src/vgl');
const brightnessContrast = require('./src/brightness-contrast')();
const assert = require('assert');

describe('vgl', function() {
    describe('new Vgl()', function () {
        let canvas, instance;

        beforeEach(function () {
            canvas = document.createElement('canvas');

            instance = new vgl.Vgl({target: canvas, effects: [brightnessContrast]});
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

            const instance = new vgl.Vgl({target: canvas, effects: [brightnessContrast]});
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
    });

    describe('Vgl webglcontextrestored', function () {
        it('should restore a destroyed instance on webglcontextrestored event', function (done) {
            const canvas = document.createElement('canvas');

            const instance = new vgl.Vgl({target: canvas, effects: [brightnessContrast]});
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

            instance = new vgl.Vgl({target: canvas, effects: [brightnessContrast]});
        });

        it('should set media to given HTMLVideoElement and start animation loop', function () {
            assert(instance);
            assert(instance.gl instanceof WebGLRenderingContext);
            assert(instance.data);
            assert(instance.data[0].target === null);

            instance.setSource(video);
            assert(instance.media instanceof HTMLVideoElement);
            assert(instance.animationFrameId);
        });

        it('should set media to given object with media:HTMLVideoElement and start animation loop', function () {
            assert(instance);
            assert(instance.gl instanceof WebGLRenderingContext);
            assert(instance.data);
            assert(instance.data[0].target === null);

            instance.setSource({media: video});
            assert(instance.media instanceof HTMLVideoElement);
            assert(instance.animationFrameId);
        });

        afterEach(function () {
            instance.destroy();
            canvas = null;
            video = null;
        });
    });
});

// TODO: test static API
