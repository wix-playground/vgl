import progress from 'rollup-plugin-progress';
import babel from 'rollup-plugin-babel';

const config = {
    experimentalCodeSplitting: true,
    input: [
        '../src/videogl.js',
        '../src/effects/brightness-contrast.js'
    ],
    output: {
        dir: './src',
        format: 'cjs',
        sourcemap: false
    },
    plugins: [
        progress({
            clearLine: false
        }),
        babel()
    ]
};

export default config;
