import vgl from '../src/vgl';
import transparentVideo from '../src/effects/transparent-video';
import brightnessContrast from '../src/effects/brightness-contrast';
import hueSaturation from '../src/effects/hue-saturation';

const video = document.querySelector('#video');
const target = document.querySelector('#target');

let playing = false;
let timeupdate = false;

video.addEventListener('playing', isPlaying, true);
video.addEventListener('timeupdate', isTimeupdate, true);
video.addEventListener('canplay', () => video.play(), true);

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
        instance.setSource({media: video, type: 'video', width: 1080, height: 1080});
    }
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
    }

    if ( data ) {
        data[0] = parseFloat(target.value);
        e.target.nextElementSibling.textContent = data[0];
    }
}

const inputs = ['brightness', 'contrast', 'hue', 'saturation'];
const hs = hueSaturation();
const bc = brightnessContrast();

inputs.map(function (name) {
    return document.getElementById(name);
})
    .map(function (input) {
        input.addEventListener('input', handleRangeChange);
    });

const instance = new vgl.Vgl({target, effects: [transparentVideo(), hs, bc]});
//
// const gl = instance.gl;
// const ext = gl.getExtension('WEBGL_lose_context');
//
// document.addEventListener('keydown', function (ev) {
//     if ( ev.key === 'Enter' ) {
//         if  ( gl.isContextLost() ) {
//             console.log('RESTORE');
//             ext.restoreContext();
//         }
//         else {
//             console.log('LOSE');
//             ext.loseContext();
//         }
//     }
// });
