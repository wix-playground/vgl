const vgl = require('./src/vgl');
const brightnessContrast = require('./src/brightness-contrast')();
const assert = require('assert');

describe('vgl', function() {
    describe('new Vgl()', function () {
        let canvas, video, instance;

        beforeEach(function () {
            video = document.createElement('video');
            canvas = document.createElement('canvas');

            instance = new vgl.Vgl({source: {media: video}, target: canvas, effects: [brightnessContrast]});
        });

        it('should draw blank video to the target canvas', function () {
            assert(instance);
            assert(instance.gl instanceof WebGLRenderingContext);
            assert(instance.data);
            assert(instance.data[0].target === null);
            assert(instance.media instanceof HTMLVideoElement);
            assert(instance.animationFrameId);
        });

        afterEach(function () {
            instance.destroy();
        });
    });
});
