const VERTEX_SRC = `
precision mediump float;

attribute vec2 a_texCoord;
attribute vec2 a_position;

uniform float u_hue;

varying vec2 v_texCoord;
varying vec3 v_weights;

void main() {
	float angle = u_hue * 3.14159265358979323846264;
	float s = sin(angle);
	float c = cos(angle);
	v_weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;
	v_texCoord = a_texCoord;
	
	gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SRC = `
precision mediump float;

uniform float u_hue;
uniform float u_saturation;
uniform sampler2D u_source;

varying vec2 v_texCoord;
varying vec3 v_weights;

void main() {
    vec4 pixel = texture2D(u_source, v_texCoord);

    pixel.rgb = vec3(
        dot(pixel.rgb, v_weights.xyz),
        dot(pixel.rgb, v_weights.zxy),
        dot(pixel.rgb, v_weights.yzx)
    );
    
    vec3 adjustment = (pixel.r + pixel.g + pixel.b) / 3.0 - pixel.rgb;
    if (u_saturation > 0.0) {
        adjustment *= (1.0 - 1.0 / (1.0001 - u_saturation));
    }
    else {
        adjustment *= (-u_saturation);
    }
    pixel.rgb += adjustment;

    gl_FragColor = vec4(pixel.rgb, pixel.a);
}`;

export default function () {
    return {
        vertexSrc: VERTEX_SRC,
        fragmentSrc: FRAGMENT_SRC,
        uniforms: [
            /**
             * 0.0 is no change.
             * -1.0 is -180deg hue rotation.
             * 1.0 is +180deg hue rotation.
             *
             * @min -1.0
             * @max 1.0
             * @default 0.0
             */
            {
                name: 'u_hue',
                size: 1,
                type: 'f',
                data: [0.0]
            },
            /**
             * 0.0 is no change.
             * -1.0 is grayscale.
             * 1.0 is max saturation.
             *
             * @min -1.0
             * @max 1.0
             * @default 0.0
             */
            {
                name: 'u_saturation',
                size: 1,
                type: 'f',
                data: [0.0]
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
                    0.0, 1.0,
                    1.0, 1.0,
                    0.0, 0.0,
                    0.0, 0.0,
                    1.0, 1.0,
                    1.0, 0.0]),
                size: 2,
                type: 'FLOAT'
            }
        ]
    };
};
