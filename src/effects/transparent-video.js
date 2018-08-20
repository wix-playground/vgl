const VERTEX_SRC = `
precision mediump float;

uniform vec2 u_texOffset;

attribute vec2 a_texCoord;
attribute vec2 a_position;

varying vec2 v_texColorCoord;
varying vec2 v_texAlphaCoord;

void main() {
    v_texColorCoord = a_texCoord;
    v_texAlphaCoord = v_texColorCoord + u_texOffset;

    gl_Position = vec4(a_position.xy, 0.0, 1.0);
}`;

const FRAGMENT_SRC = `
precision mediump float;

varying vec2 v_texColorCoord;
varying vec2 v_texAlphaCoord;

uniform sampler2D u_source;

void main() {
    float luma = texture2D(u_source, v_texAlphaCoord).r;
    vec3 color = texture2D(u_source, v_texColorCoord).rgb;
    gl_FragColor = vec4(color, luma);
}`;

export default function () {
    return {
        vertexSrc: VERTEX_SRC,
        fragmentSrc: FRAGMENT_SRC,
        uniforms: [
            {
                name: 'u_texOffset',
                size: 2,
                type: 'f',
                data: [0.0, -0.5]
            }
        ],
        attributes: [
            {
                name: 'a_position',
                data: new Float32Array([
                    -1.0, -1.0,
                    -1.0, 1.0,
                    1.0, -1.0,
                    1.0, 1.0]),
                size: 2,
                type: 'FLOAT'
            },
            {
                name: 'a_texCoord',
                data: new Float32Array([
                    0.0, 0.5,
                    0.0, 1.0,
                    1.0, 0.5,
                    1.0, 1.0]),
                size: 2,
                type: 'FLOAT'
            }
        ]
    };
};
