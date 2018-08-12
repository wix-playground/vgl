export default {
    vertexSrc: `
precision mediump float;

uniform vec2 u_texOffset;

attribute vec2 a_texCoord;
attribute vec2 a_position;

varying vec2 v_texCoord;

void main() {
    v_texCoord = a_texCoord;

    gl_Position = vec4(a_position, 0.0, 1.0);
}`,
    fragmentSrc: `
precision mediump float;

varying vec2 v_texCoord;

uniform float u_contrast;
uniform float u_brightness;
uniform sampler2D u_source;

const vec3 half3 = vec3(0.5);

void main() {
    vec4 pixel = texture2D(u_source, v_texCoord);
    vec3 color = pixel.rgb * u_brightness;
    color = (color - half3) * u_contrast + half3;

    gl_FragColor = vec4(color, pixel.a);
}`,
    uniforms: [
        {
            name: 'u_brightness',
            size: 1,
            type: 'f',
            data: [1.0]
        },
        {
            name: 'u_contrast',
            size: 1,
            type: 'f',
            data: [1.0]
        }
    ],
    attributes: [
        {
            name: 'a_position',
            data: new Float32Array([
                -1.0, 1.0,
                1.0, 1.0,
                -1.0, -1.0,
                -1.0, -1.0,
                1.0, 1.0,
                1.0, -1.0]),
            size: 2,
            type: 'FLOAT'
        },
        {
            name: 'a_texCoord',
            data: new Float32Array([
                0.0, 0.0,
                1.0, 0.0,
                0.0, 1.0,
                0.0, 1.0,
                1.0, 0.0,
                1.0, 1.0]),
            size: 2,
            type: 'FLOAT'
        }
    ]
};
