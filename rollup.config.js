import progress from 'rollup-plugin-progress';
import filesize from 'rollup-plugin-filesize';

const config = {
    input: 'src/vgl.js',
    output: {
        name: 'vgl',
        file: 'index.js',
        format: 'umd',
        sourcemap: false
    },
    plugins: [
        progress({
            clearLine: false
        }),
        filesize()
    ]
};

export default config;
