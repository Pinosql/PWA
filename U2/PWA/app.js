//app principal
let stream = null; //Mediastream actual de la camara
let currentFacing = 'environment'; // User = frontal y enviroment = trasera
let mediaRecorder = null; //Instancia de mediarecorder para audio 
let chunks = []; //Buffers para audio grabado
let audioStream = null; //Stream de microfono
let beforeInstallEvent = null; //Evento diferido para mostrar el boton de instalacion
let vibrateInterval = null; //Intervalo para vibracion
let isRinging = false; //Estado del tono de llamada

//Accesos rapidos al DOM
const $ = (sel) => document.querySelector(sel);
const video = $('#video'); //etiqueta video donde se muestra el string
const canvas = $('#canvas'); //contenedor de capturar fotos
const photos = $('#photos'); //contenedor de fotos capturadas
const audios = $('#audios'); //contenedor para audios grabados
const btnStartCam = $('#btnStartCam'); //boton iniciar camara
const btnStopCam = $('#btnStopCam'); //boton detener camara
const btnFlip = $('#btnFlip'); //boton alternar camara
const btnTorch = $('#btnTorch'); //boton para linterna
const btnShot = $('#btnShot'); //boton para tomar foto
const videoDevices = $('#videoDevices'); //select para camaras disponibles
const btnStartRec = $('#btnStartRec'); //boton iniciar grabacion audio
const btnStopRec = $('#btnStopRec'); //boton detener grabacion audio
const recStatus= $('#recStatus'); //indicador del estado de grabacion
const btnInstall = $('#btnInstall'); //boton para instalar la PWA
const btnVibrar = $('#btnVibrar'); //boton para vibracion
const btnRingtone = $('#btnRingtone'); //boton para tono

const ringtone = new Audio('assets/old_phone_ring.mp3'); //tono de llamada
ringtone.loop = true;

//instalacion de la PWA (A2HS)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); //evita que el navegador muestre el prompt por defecto
    beforeInstallEvent = e; //guarda el evento para lanzarlo manualmente
    btnInstall.hidden = false; //muestra el boton de instalacion
});

btnInstall.addEventListener('click', async () => {
    if (!beforeInstallEvent) return; //si no hay evento almacenado no hacemos nada
    beforeInstallEvent.prompt(); //dispara el dialogo de instalacion
    await beforeInstallEvent.userChoice; //espera la eleccion del usuario
    btnInstall.hidden = true; //oculta el boton tras la decision
    beforeInstallEvent = null; //limpia la referencia
});

//camara listado y control
async function listVideoInputs () {
    try {
        //pide al navegador todos los dispositivos multimedia
        const devices = await navigator.mediaDevices.enumerateDevices();
        //filtro solo entradas de video
        const cams = devices.filter(d => d.kind === 'videoinput');
        //vacia el select y lo rrellena con las camaras detectadas
        videoDevices.innerHTML = '';
        cams.forEach((d, i) => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || `Camara ${i + 1}`;
            //deviceId que usaremos para getUserMedia
            videoDevices.appendChild(opt);
        });
    }
    catch (err) {
        console.warn('No se pudo enumerar dispositivos:', err);
    }
}

async function startCam (constraints = {}) {
    //Verifica el sorporte de mediadevices a traves de https
    if (!('mediaDevices' in navigator)) {
        alert('Este navegador no soporta el acceso a Camara/microfono');
        return;
    }
    try{
        //solicita el strean de video (mas cualquier constraint extra recivido)
        stream = await navigator.mediaDevices.getUserMedia({
            video : {facingMode: currentFacing, ...constraints},
            audio: false
        });
        //Enlaza el stream al select de video para previsualizar
        video.srcObject = stream;
        //Habilitar los controles relacionados
        btnStopCam.disabled = false;
        btnShot.disabled = false;
        btnFlip.disabled = false;
        btnTorch.disabled = false;

        //Actualizar el listado de camaras disponibles
        await listVideoInputs();
    } catch (err) {
        alert('no se pudo iniciar la camara: ' + err.message);
        console.error(err);
    }
}

async function stopCam () {
    //Detiene todas las pistas del stream de video y libera la camara
    if ( stream) { stream.getTracks().forEach(t => t.stop()); }
    stream = null;
    video.srcObject = null;
    //desahabilitar los controles de la camara
    btnStopCam.disabled = true;
    btnShot.disabled = true;
    btnFlip.disabled = true;
    btnTorch.disabled = true;
}

//bootones de control de camara
btnStartCam.addEventListener('click', () => startCam());
btnStopCam.addEventListener('click', () => stopCam());

btnFlip.addEventListener('click', async () => {
    //alterna entre camara frontal y trasera
    currentFacing = (currentFacing === 'environment') ? 'user' : 'environment';
    stopCam();
    await startCam();
});

videoDevices.addEventListener('change', async (e) => {
    //cambia a un deviceID especifico elegido en el select
    const id = e.target.value;
    stopCam();
    await startCam({deviceId: {exact: id}});
});

btnTorch.addEventListener('click', async () => {
    //añguinas plataformas permiten acitivar la linterna de la camara con applyConstraints
    try {
        const [track] = stream ? stream.getVideoTracks() : [];
        if (!track) return;
        const cts = track.getConstraints();
        //alterna el estado del torch de forma simple (usando bauve toggle)
        const torch = !(cts.advanced && cts.advanced[0]?.torch);
        await track.applyConstraints({ advanced: [{torch}] });
    } catch (err) {
        alert('La linterna no es compatible con este dispositivo/navegador', err);
    }
});

btnShot.addEventListener('click', () => {
    //captura un frame del select de video y lo desxarga como png
    if (!stream) return;

    //ajuste el canvas al tamaño real del video
    const t = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = t;
    canvas.height = h;

    //dibuja el frame actual del video en el canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, t, h);

    //exporta el coontenido del canvas a blob y lo mustra o lo descarga
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        //enlace de descarga
        const a = document.createElement('a');
        a.href = url;
        a.download = `foto-${Date.now()}.png`;
        a.textContent = 'Descargar foto';
        a.className = 'btn';

        //miniatura
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'captura';
        img.style.width = '100%';

        //envoltura y push a la galeria
        const wrap = document.createElement('div');
        wrap.appendChild(img);
        wrap.appendChild(a);
        photos.prepend(wrap);
    }, 'image/png');
});

//grabacion de audio
btnStartRec.addEventListener('click', async () => {
    if (!('mediaDevices' in navigator)) {
        alert('Este navegador no soporta el acceso a microfono');
        return;
    }
    try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(audioStream);
        chunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);

            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = url;

            const a = document.createElement('a');
            a.href = url;
            a.download = `audio-${Date.now()}.webm`;
            a.textContent = 'Descargar audio';
            a.className = 'btn';

            const wrap = document.createElement('div');
            wrap.appendChild(audio);
            wrap.appendChild(a);
            audios.prepend(wrap);

            recStatus.textContent = 'Audio guardado';
            chunks = [];
            if (audioStream) {
                audioStream.getTracks().forEach(t => t.stop());
                audioStream = null;
            }
            btnStartRec.disabled = false;
            btnStopRec.disabled = true;
        };

        mediaRecorder.start();
        recStatus.textContent = 'Grabando...';
        btnStartRec.disabled = true;
        btnStopRec.disabled = false;
    } catch (err) {
        alert('No se pudo iniciar la grabacion: ' + err.message);
        console.error(err);
    }
});

btnStopRec.addEventListener('click', () => {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
    mediaRecorder.stop();
    recStatus.textContent = 'Procesando audio...';
});

//vibracion
function stopVibration () {
    if (vibrateInterval) {
        clearInterval(vibrateInterval);
        vibrateInterval = null;
    }
    navigator.vibrate(0);
    btnVibrar.textContent = 'Vibrar';
}

const supportsVibration = () =>
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

function startVibration () {
    const pattern = [400, 150, 400, 150, 500, 200, 500]; //patron mas largo y marcado
    const total = pattern.reduce((a, b) => a + b, 0);
    if (navigator.userActivation && !navigator.userActivation.isActive) {
        alert('La vibracion requiere una interaccion directa del usuario. Toca el boton nuevamente.');
        return;
    }
    const ok = navigator.vibrate(pattern);
    if (ok === false) {
        alert('La vibracion fue bloqueada o no es compatible en este dispositivo');
        return;
    }
    vibrateInterval = setInterval(() => {
        const allowed = navigator.vibrate(pattern);
        if (allowed === false) {
            stopVibration();
        }
    }, total + 250);
    btnVibrar.textContent = 'Detener vibracion';
}

btnVibrar.addEventListener('click', () => {
    if (!supportsVibration()) {
        alert('Vibracion no soportada en este dispositivo/navegador');
        return;
    }
    if (vibrateInterval) {
        stopVibration();
    } else {
        startVibration();
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        stopVibration();
    }
});
document.addEventListener('pagehide', stopVibration);

//tono de llamada
btnRingtone.addEventListener('click', async () => {
    if (isRinging) {
        ringtone.pause();
        ringtone.currentTime = 0;
        isRinging = false;
        btnRingtone.textContent = 'Reproducir tono';
        return;
    }
    try {
        await ringtone.play();
        isRinging = true;
        btnRingtone.textContent = 'Detener tono';
    } catch (err) {
        alert('No se pudo reproducir el tono: ' + err.message);
    }
});

//registro del service worker
async function registerServiceWorker () {
    if (!('serviceWorker' in navigator)) return;
    try {
        await navigator.serviceWorker.register('./script.js');
    } catch (err) {
        console.warn('No se pudo registrar el Service Worker', err);
    }
}

window.addEventListener('load', registerServiceWorker);
