const videogl = require('./src/videogl');
const brightnessContrast = require('./src/brightness-contrast')();
const assert = require('assert');

describe('videogl', function() {
    describe('#getWebGLContext()', function() {
        it('should return a webgl context', function() {
            const canvas = document.createElement('canvas');
            const context = videogl.getWebGLContext(canvas);

            assert(context);

            const attributes = context.getContextAttributes();

            assert.strictEqual(attributes.antialias, false);
            assert.strictEqual(attributes.premultipliedAlpha, false);
            assert.strictEqual(attributes.preserveDrawingBuffer, false);
        });
    });

    describe('#init()', function() {
        it('should return an object with webgl context and scene data', function() {
            const canvas = document.createElement('canvas');
            const {gl, data} = videogl.init(canvas, [brightnessContrast]);

            assert(gl);
            assert(data);

            videogl.destroy(gl, data);
        });

        it('should return scene data with complete WebGL program data', function() {
            const canvas = document.createElement('canvas');
            const {gl, data} = videogl.init(canvas, [brightnessContrast]);

            assert(gl);
            assert(data);
            assert(data.length === 1);

            const {
                program,
                vertexShader,
                fragmentShader,
                source,
                target,
                attributes,
                uniforms
            } = data[0];

            assert(program instanceof WebGLProgram);
            assert(vertexShader instanceof WebGLShader);
            assert(fragmentShader instanceof WebGLShader);
            assert(source);
            assert(source.texture instanceof WebGLTexture);
            assert.strictEqual(target, null);
            assert(attributes);
            assert(uniforms);

            videogl.destroy(gl, data);
        });
    });

    // TODO: implement
    describe('#draw()', function () {
        let canvas, video, scene, gl;

        beforeEach(function () {
            video = document.createElement('video');
            canvas = document.createElement('canvas');

            const initData = videogl.init(canvas, [brightnessContrast]);

            gl = initData.gl;
            scene = initData.data;
        });

        it('should draw blank video to the target canvas', function () {
            videogl.draw(gl, video, scene);
        });

        afterEach(function () {
            videogl.destroy(gl, scene);
        });
    });

    // TODO: implement
    describe('#loop()', function () {
        let canvas, video, scene, gl;

        beforeEach(function () {
            video = document.createElement('video');
            canvas = document.createElement('canvas');

            const initData = videogl.init(canvas, [brightnessContrast]);

            gl = initData.gl;
            scene = initData.data;
        });

        it('should draw blank video to the target canvas', function () {
            videogl.loop(gl, video, scene);
            videogl.stop(gl, video, scene);
        });

        afterEach(function () {
            videogl.destroy(gl, scene);
        });
    });

    // TODO: implement
    describe('#stop()', function () {
        let canvas, video, scene, gl;

        beforeEach(function () {
            video = document.createElement('video');
            canvas = document.createElement('canvas');

            const initData = videogl.init(canvas, [brightnessContrast]);

            gl = initData.gl;
            scene = initData.data;
        });

        it('should stop a started drawing loop', function () {
            videogl.loop(gl, video, scene);
            videogl.stop(gl, video, scene);
        });

        afterEach(function () {
            videogl.destroy(gl, scene);
        });
    });

    describe('#resize()', function () {
        let canvas, scene, gl;

        beforeEach(function () {
            canvas = document.createElement('canvas');

            const initData = videogl.init(canvas, [brightnessContrast]);

            gl = initData.gl;
            scene = initData.data;
        });

        it('should resize target canvas when its display dimensions change', function () {
            assert.strictEqual(canvas.width, 300);
            assert.strictEqual(canvas.height, 150);

            videogl.resize(gl);

            // default size of init texture is 1x1
            assert.strictEqual(gl.drawingBufferWidth, 1);
            assert.strictEqual(gl.drawingBufferHeight, 1);

            // detached from document
            assert.strictEqual(canvas.width, 0);
            assert.strictEqual(canvas.height, 0);

            document.body.appendChild(canvas);
            canvas.style.width = '250px';
            canvas.style.height = '250px';

            videogl.resize(gl);

            assert.strictEqual(canvas.width, 250);
            assert.strictEqual(canvas.height, 250);
        });

        it('should resize target to supplied dimensions and ignore canvas CSS dimensions', function () {
            assert.strictEqual(canvas.height, 150);

            videogl.resize(gl, {width: 850, height: 480});

            assert.strictEqual(gl.drawingBufferWidth, 850);
            assert.strictEqual(gl.drawingBufferHeight, 480);
        });

        afterEach(function () {
            videogl.destroy(gl, scene);
        });
    });

    // TODO: implement
    describe('#destroy()', function () {
        let canvas, scene, gl;

        beforeEach(function () {
            canvas = document.createElement('canvas');

            const initData = videogl.init(canvas, [brightnessContrast]);

            gl = initData.gl;
            scene = initData.data;
        });

        it('dispose of all target canvas\' resources', function () {
            const {
                program,
                vertexShader,
                fragmentShader,
                source,
                target,
                attributes,
                uniforms
            } = scene[0];

            assert.strictEqual(gl.isTexture(source.texture), true);
            assert.strictEqual(gl.isBuffer(attributes[0].buffer), true);
            assert.strictEqual(gl.isShader(vertexShader), true);
            assert.strictEqual(gl.isShader(fragmentShader), true);
            assert.strictEqual(gl.isProgram(program), true);

            videogl.destroy(gl, scene);

            assert.strictEqual(gl.isTexture(source.texture), false);
            assert.strictEqual(gl.isBuffer(attributes[0].buffer), false);
            assert.strictEqual(gl.isShader(vertexShader), false);
            assert.strictEqual(gl.isShader(fragmentShader), false);
            assert.strictEqual(gl.isProgram(program), false);
        });
    });
});
