//app principal
let stream = null; //Mediastream actual de la camara
let currentFacing = 'environment'; // User = frontal y enviroment = trasera
let mediaRecorder = null; //Instancia de mediarecorder para audio 
let chunks = []; //Buffers para audio grabado
let beforeInstallEvent = null; //Evento diferido para mostrar el boton de instalacion

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
const recStatus = $('#recStatus'); //indicador del estado de grabacion
const btnInstall = $('#btnInstall'); //boton para instalar la PWA

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
        cams.forEach((d,i) => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || `Camara ${i + 1}`;
            videoDevices.appendChild(opt);
            //deviceide que usaremos para getusermedia
            videoDevices.appendChild(opt);
        });
    }
    catch (err) {
        console.warn('No se pudo enumerar dispositivos:', err);
    }
}

async function startCam (constraints = {}) {
    //verifica el soporte de mediaDevices a traves de https
    if(!('mediaDevices' in navigator)) {
        alert('Este navegador no soporta el acceso a Camara/Microfono');
        return;
    } 
    try {
        //solicita ek stream de video (mas culaquier constraint recibidio)
        stream = await navigator.mediaDevices.getUserMedia({video: { facingMode: currentFacing, ...constraints },audio: false});
        //enlaza el stream al select de video para previzualizar
        video.srcObject = stream;

        //habilitar los controles relacionados
        btnStopCam.disabled = false;
        btnFlip.disabled = false;
        btnShot.disabled = false;
        btnTorch.disabled = false;

        //actualiza el listado de camaras disponibles
        await listVideoInputs();
    }
    catch (err) {
        alert('No se pudo iniciar la camara: ' + err.message);
        console.error(err);
    }
}

function stopCam () {
    //detiene todas las pistas del stream de video y libera la camara
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }

    stream = null;
    video.srcObject = null;

    //deshabilitar los controles relacionados
    btnStopCam.disabled = true;
    btnFlip.disabled = true;
    btnShot.disabled = true;
    btnTorch.disabled = true;
}

//botones de control de camara
btnStartCam.addEventListener('click', () => startCam());
btnStopCam.addEventListener('click', stopCam);
btnFlip.addEventListener('click', async () => {
    //alterna entre camara frontal y trasera y reinicia el strea,
    currentFacing = (currentFacing === 'environment') ? 'user' : 'environment';
    stopCam();
    await startCam();
});

videoDevices.addEventListener('change', async (e) => {
    //cambia a un devideId especifico elegido en el select});
    const id = e.target.value;
    stopCam();
    await startCam({deviceId: {exact: id}});
});

btnTorch.addEventListener('click', async () => {
    //algunas plataformas permiten activar la linterna con applyConstraints
    try {
        const [track] = stream ? stream.getVideoTracks() : [];
        if (!track) return;
        const cts = track.getConstraints();
        //alterna el estado del torch de forma simple (usando naive toggle)
        const torch = !(cts.advanced && cts.advanced[0]?.torch);
        await track.applyConstraints({advanced: [{torch}]});
    }
    catch (err) {
        alert('La linterna no e compatible con este dispositivo/navegador ');
    }
});

btnShot.addEventListener('click', () => {
    //captura un frame del select de video y loo descarga como png
    if (!stream) return;

    //Ajusta el canvas al tamaño real del video
    const t = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = t;
    canvas.height = h;
    //dibula el frame actual en el canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, t, h);

    //exporta el contenido del canvas a BLOD y lo muestra o dscarga
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        //enlace de descarga
        const a = document.createElement('a');
        a.href = url;
        a.download = `foto-${Date.now()}.png`;
        a.textContent = 'Descargar Foto';
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
    }, 'image/png'
);  
});

//mediaRecorder para audio
function supportRecorder () {
    return 'MediaRecorder' in window; //copmprobacion del soporte
}

btnStartRec.addEventListener('click', async () => {
    //inicia la grabacion de audio desde el microfono
    if (!supportRecorder()) {
        alert('no esta disponible en este navegador');
        return;
    }
    try {
        //solicita solo el audio del microfono 
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true,});
        //crear el recorder con mimeType web
        mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
        chunks = [];

        //acumula trozos o fragmentos de audio cuando estan disponibles
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };

        //actualiza el estado visual al iniciar/detener
        mediaRecorder.onstart = () => {
            recStatus.textContent = 'Grabando...';
        };
        mediaRecorder.onstop = () => {
            recStatus.textContent = '';

            //unir los chunks en un blob y agregar a la galeria
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);

            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = url;

            const link = document.createElement('a');
            link.href = url;
            link.download = `audio-${Date.now()}.webm`;
            link.textContent = 'Descargar Audio';
            link.className = 'btn';

            const wrap = document.createElement('div');
            wrap.appendChild(audio);
            wrap.appendChild(link);
            audios.prepend(wrap);
        };
    //comienza a grabar y actualiza botones
    mediaRecorder.start();
    btnStartRec.disabled = true; //sirve oara evitar el doble inicio de grabacion
    }catch (err) {
        alert('no se pudo iniciar el microfono ' + err.message);
    }
});
