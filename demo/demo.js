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
        vgl.start(target, video);
    }
}

vgl.register(target, [transparentVideo, hueSaturation, brightnessContrast]);
