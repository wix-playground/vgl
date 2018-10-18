import {Vgl, Ticker} from '../src/vgl';
import transparentVideo from '../src/effects/transparent-video';
import brightnessContrast from '../src/effects/brightness-contrast';
import hueSaturation from '../src/effects/hue-saturation';
import duotone from '../src/effects/duotone';

const video = document.querySelector('#video');
let target = document.querySelector('#target');

let playing = false;
let timeupdate = false;

video.addEventListener('playing', isPlaying, true);
video.addEventListener('timeupdate', isTimeupdate, true);
video.addEventListener('canplay', canPlay, true);

function canPlay () {
    video.play();
}

function isPlaying () {
    playing = true;
    video.removeEventListener('playing', isPlaying, true);
    check();
}
function isTimeupdate () {
    timeupdate = true;
    video.removeEventListener('timeupdate', isTimeupdate, true);
    check();
}

function check () {
    if (playing && timeupdate) {
        instance.setSource({media: video, type: 'video', width: 704, height: 992});
        instance.play();
        video.removeEventListener('canplay', canPlay, true);
    }
}

function hex2vec4 (hex) {
    const s = hex.substring(1);
    return [s[0] + s[1], s[2] + s[3], s[4] + s[5], 'ff'].map(h => parseInt(h, 16) / 255);
}

function handleRangeChange (e) {
    const target = e.target;
    const effect = target.id;
    let data;

    switch ( effect ) {
        case 'brightness':
        case 'contrast':
            data = bc.uniforms.filter(u => u.name === `u_${effect}`)[0].data;
            break;
        case 'hue':
        case 'saturation':
            data = hs.uniforms.filter(u => u.name === `u_${effect}`)[0].data;
            break;
        case 'duotone-light':
            instance.data[3].uniforms[0].data = hex2vec4(target.value);
            e.target.nextElementSibling.textContent = target.value;
            break;
        case 'duotone-dark':
            instance.data[3].uniforms[1].data = hex2vec4(target.value);
            e.target.nextElementSibling.textContent = target.value;
            break;
    }

    if ( data ) {
        data[0] = parseFloat(target.value);
        e.target.nextElementSibling.textContent = data[0];
    }
}

const inputs = ['brightness', 'contrast', 'hue', 'saturation', 'duotone-light', 'duotone-dark'];
const hs = hueSaturation();
const bc = brightnessContrast();
const dt = duotone();
const tv = transparentVideo();

const effects = [tv, bc, hs, dt];

inputs.map(function (name) {
    return document.getElementById(name);
})
    .map(function (input) {
        input.addEventListener('input', handleRangeChange);
    });

document.querySelector('#toggle-duotone').addEventListener('input', e => {
    const checked = e.target.checked;

    instance.destroy();

    // Works around an issue with working with the old context
    const newCanvas = document.createElement('canvas');
    target.parentElement.replaceChild(newCanvas, target);
    target = newCanvas;


    if ( checked ) {
        effects.push(dt);
    }
    else {
        effects.pop();
    }

    instance.init({target, effects, ticker});
    instance.setSource({media: video, type: 'video', width: 704, height: 992});
    instance.play();
});

const ticker = new Ticker();
let instance = new Vgl({target, effects, ticker});

ticker.start();

// const gl = instance.gl;
// const ext = gl.getExtension('WEBGL_lose_context');

// document.addEventListener('keydown', function (ev) {
//     if ( ev.key === 'Enter' ) {
        // const height = 1;
        // const delta = 1;
        // const buffer = new Uint8Array(gl.drawingBufferWidth * height * 4);
        //
        // gl.readPixels(0, gl.drawingBufferHeight - delta, gl.drawingBufferWidth, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
        //
        // const colors = {};
        // for ( let i=0; i < buffer.length; i += 4) {
        //     const r = buffer[i];
        //     const g = buffer[i+1];
        //     const b = buffer[i+2];
        //     const a = buffer[i+3];
        //     const rgba = `${r},${g},${b},${a}`;
        //
        //     colors[i] = rgba;
        // }
        // console.log(colors);
        // if  ( gl.isContextLost() ) {
        //     console.log('RESTORE');
        //     ext.restoreContext();
        // }
        // else {
        //     console.log('LOSE');
        //     ext.loseContext();
        // }
//     }
// });
