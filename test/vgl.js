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

        it('should instanciate a Vgl instanec with a target canvas', function () {
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
