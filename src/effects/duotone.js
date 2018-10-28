const VERTEX_SRC = `
precision mediump float;

attribute vec2 a_texCoord;
attribute vec2 a_position;

varying vec2 v_texCoord;

void main() {
	v_texCoord = a_texCoord;
	
	gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SRC = `
precision mediump float;

varying vec2 v_texCoord;

uniform sampler2D u_source;
uniform vec4 u_light;
uniform vec4 u_dark;

const vec3 lumcoeff = vec3(0.2125, 0.7154, 0.0721);

void main() {
    vec4 pixel = texture2D(u_source, v_texCoord);
    vec3 gray = vec3(dot(lumcoeff, pixel.rgb / pixel.a));
    vec3 tonedColor = mix(u_dark.rgb, u_light.rgb, gray);
    gl_FragColor = vec4(tonedColor, 1.0) * pixel.a;
}`;

export default function () {
    return {
        vertexSrc: VERTEX_SRC,
        fragmentSrc: FRAGMENT_SRC,
        uniforms: [
            /**
             * Light tone
             */
            {
                name: 'u_light',
                size: 4,
                type: 'f',
                data: [0.9882352941, 0.7333333333, 0.05098039216, 1]
            },
            /**
             * Dark tone
             */
            {
                name: 'u_dark',
                size: 4,
                type: 'f',
                data: [0.7411764706, 0.0431372549, 0.568627451, 1]
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
                    0.0, 0.0,
                    0.0, 1.0,
                    1.0, 0.0,
                    1.0, 1.0]),
                size: 2,
                type: 'FLOAT'
            }
        ]
    };
};
