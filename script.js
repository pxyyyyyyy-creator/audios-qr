let audioBlob = null;
let audioUrl = null;
let currentAudioName = '';
let deferredPrompt = null;

let audioBuffer = null;
let audioContext = null;
let audioDuration = 0;
let cropStart = 0;
let cropEnd = 0;
let croppedBlob = null;
let previewSource = null;
let currentPlayhead = -1;
let animationId = null;

let audioInput, fileDrop, fileName, audioName, generateBtn, resultSection,
    audioPlayer, displayName, downloadBtn, shareBtn, installSection, installBtn,
    cropSection, waveformCanvas, startSlider, endSlider, startTimeInput,
    endTimeInput, durationDisplay, previewBtn, resetCropBtn,
    mainHeader, uploadSection, viewerSection, viewerName, viewerAudio;

document.addEventListener('DOMContentLoaded', () => {
    audioInput = document.getElementById('audioInput');
    fileDrop = document.getElementById('fileDrop');
    fileName = document.getElementById('fileName');
    audioName = document.getElementById('audioName');
    generateBtn = document.getElementById('generateBtn');
    resultSection = document.getElementById('resultSection');
    audioPlayer = document.getElementById('audioPlayer');
    displayName = document.getElementById('displayName');
    downloadBtn = document.getElementById('downloadBtn');
    shareBtn = document.getElementById('shareBtn');
    installSection = document.getElementById('installSection');
    installBtn = document.getElementById('installBtn');
    cropSection = document.getElementById('cropSection');
    waveformCanvas = document.getElementById('waveformCanvas');
    startSlider = document.getElementById('startSlider');
    endSlider = document.getElementById('endSlider');
    startTimeInput = document.getElementById('startTime');
    endTimeInput = document.getElementById('endTime');
    durationDisplay = document.getElementById('durationDisplay');
    previewBtn = document.getElementById('previewBtn');
    resetCropBtn = document.getElementById('resetCropBtn');
    
    mainHeader = document.getElementById('mainHeader');
    uploadSection = document.getElementById('uploadSection');
    viewerSection = document.getElementById('viewerSection');
    viewerName = document.getElementById('viewerName');
    viewerAudio = document.getElementById('viewerAudio');

    initApp();
});

function initApp() {
    fileDrop.addEventListener('click', () => audioInput.click());

    fileDrop.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDrop.style.background = '#e5e5e5';
    });

    fileDrop.addEventListener('dragleave', () => {
        fileDrop.style.background = '#ffffff';
    });

    fileDrop.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDrop.style.background = '#ffffff';
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleAudioFile(files[0]);
        }
    });

    audioInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleAudioFile(e.target.files[0]);
        }
    });

    startSlider.addEventListener('input', updateCropFromSliders);
    endSlider.addEventListener('input', updateCropFromSliders);
    startTimeInput.addEventListener('change', updateCropFromInputs);
    endTimeInput.addEventListener('change', updateCropFromInputs);

    previewBtn.addEventListener('click', () => {
        if (!audioBuffer || cropStart >= cropEnd) return;
        const cropped = cropAudioBuffer(audioBuffer, cropStart, cropEnd);
        playBuffer(cropped);
    });

    resetCropBtn.addEventListener('click', () => {
        cropStart = 0;
        cropEnd = audioDuration;
        startSlider.value = 0;
        endSlider.value = 100;
        startTimeInput.value = 0;
        endTimeInput.value = audioDuration.toFixed(1);
        renderWaveform();
    });

    generateBtn.addEventListener('click', async () => {
        if (!audioBlob) {
            alert('Por favor, selecione um arquivo de áudio.');
            return;
        }
        if (!audioName.value.trim()) {
            alert('Por favor, digite o nome do aluno.');
            return;
        }

        generateBtn.disabled = true;
        generateBtn.textContent = 'Gerando QR Code...';
        
        currentAudioName = audioName.value.trim();
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        const blobToShare = getAudioBlobForShare();
        
        const fileNameToUpload = `${currentAudioName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}${blobToShare.type.includes('wav') ? '.wav' : '.opus'}`;
        
        try {
            const uploadedGitHubUrl = await uploadToGitHub(blobToShare, fileNameToUpload);
            
            const baseUrl = window.location.href.split('?')[0];
            const viewerLink = `${baseUrl}?play=${encodeURIComponent(uploadedGitHubUrl)}&name=${encodeURIComponent(currentAudioName)}`;

            const qrImg = new Image();
            // Permite carregar a imagem da API contornando problemas de CORS no download
            qrImg.crossOrigin = 'Anonymous';
            qrImg.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 620;
                const ctx = canvas.getContext('2d');
                
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                ctx.drawImage(qrImg, 0, 0, 512, 512);
                
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 4;
                ctx.strokeRect(2, 2, 508, 616);
                
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 40px Arial';
                ctx.textAlign = 'center';
                
                let displayNameText = currentAudioName;
                if (displayNameText.length > 20) {
                    displayNameText = displayNameText.substring(0, 18) + '...';
                }
                ctx.fillText(displayNameText, 256, 580);
                
                // Mantém o tamanho visual menor na tela, mas preserva a resolução interna alta
                canvas.style.maxWidth = '100%';
                canvas.style.width = '256px';
                canvas.style.height = 'auto';
                
                document.getElementById('qrcode').innerHTML = '';
                document.getElementById('qrcode').appendChild(canvas);
                
                generateBtn.disabled = false;
                generateBtn.textContent = 'Gerar QR Code';
            };
            qrImg.onerror = () => {
                alert('Erro ao gerar QR Code. Verifique sua conexão.');
                generateBtn.disabled = false;
                generateBtn.textContent = 'Gerar QR Code';
            };
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(viewerLink)}`;
            
            currentShareLink = viewerLink;
            
        } catch (uploadErr) {
            alert('Falha ao enviar arquivo para o GitHub. Verifique as configurações do Netlify.');
            generateBtn.disabled = false;
            generateBtn.textContent = 'Gerar QR Code';
            return;
        }
        
        displayName.textContent = currentAudioName;
        resultSection.style.display = 'block';
        resultSection.scrollIntoView({ behavior: 'smooth' });
    });

    downloadBtn.addEventListener('click', () => {
        const qrDiv = document.getElementById('qrcode');
        const canvas = qrDiv.querySelector('canvas');
        if (!canvas) {
            alert('Gere o QR Code primeiro.');
            return;
        }
        const link = document.createElement('a');
        link.download = `${currentAudioName}_qrcode.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    shareBtn.addEventListener('click', async () => {
        if (!currentShareLink) return;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: currentAudioName,
                    text: `Escutar áudio de: ${currentAudioName}`,
                    url: currentShareLink
                });
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Erro ao compartilhar:', err);
                }
            }
        } else {
            copyToClipboard(currentShareLink);
            alert('Link do visualizador copiado para a área de transferência!');
        }
    });

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installSection.style.display = 'block';
    });

    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            installSection.style.display = 'none';
        }
        deferredPrompt = null;
    });

    window.addEventListener('appinstalled', () => {
        installSection.style.display = 'none';
        deferredPrompt = null;
    });

    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(() => {});
        });
    }

    window.addEventListener('load', () => {
        checkViewerMode();
    });
}

function checkViewerMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const playUrl = urlParams.get('play');
    const nameStr = urlParams.get('name') || 'Áudio Compartilhado';

    if (playUrl) {
        mainHeader.style.display = 'none';
        uploadSection.style.display = 'none';
        resultSection.style.display = 'none';
        
        viewerSection.style.display = 'block';
        viewerName.textContent = nameStr;
        viewerAudio.src = playUrl;
        
        document.title = `${nameStr} - Áudio QR`;
    }
}

function handleAudioFile(file) {
    const validExtensions = ['.opus', '.ogg'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!file.type.includes('audio/') && !hasValidExt) {
        alert('Por favor, selecione um arquivo OPUS ou OGG válido.');
        return;
    }
    audioBlob = file;
    fileName.textContent = `Arquivo: ${file.name}`;
    if (!audioName.value) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        audioName.value = nameWithoutExt;
    }
    cropStart = 0;
    cropEnd = 0;
    croppedBlob = null;
    cropSection.style.display = 'block';
    resultSection.style.display = 'none';
    decodeAudio(file);
}

async function decodeAudio(file) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const arrayBuffer = await file.arrayBuffer();
    try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioDuration = audioBuffer.duration;
        durationDisplay.textContent = audioDuration.toFixed(1);
        endTimeInput.value = audioDuration.toFixed(1);
        endSlider.value = 100;
        startSlider.value = 0;
        startTimeInput.value = 0;
        cropEnd = audioDuration;
        renderWaveform();
    } catch (err) {
        alert('Erro ao decodificar arquivo de áudio. Tente outro arquivo.');
    }
}

function renderWaveform() {
    if (!audioBuffer || !audioDuration) return;
    const canvas = waveformCanvas;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const channelData = audioBuffer.getChannelData(0);
    const barWidth = 2;
    const gap = 1;
    const barCount = Math.floor(width / (barWidth + gap));
    const step = Math.floor(channelData.length / barCount);
    const amp = height / 2;

    for (let i = 0; i < barCount; i++) {
        let max = 0;
        for (let j = 0; j < step; j++) {
            const datum = Math.abs(channelData[i * step + j]);
            if (datum > max) max = datum;
        }
        
        const x = i * (barWidth + gap);
        const barHeight = Math.max(2, max * amp * 1.5);
        const y = amp - barHeight / 2;

        const timeAtBar = (i / barCount) * audioDuration;
        const isSelected = timeAtBar >= cropStart && timeAtBar <= cropEnd;

        ctx.fillStyle = isSelected ? '#000000' : '#d4d4d4';
        ctx.fillRect(x, y, barWidth, barHeight);
    }

    const startPixel = (cropStart / audioDuration) * width;
    const endPixel = (cropEnd / audioDuration) * width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, startPixel, height);
    ctx.fillRect(endPixel, 0, width - endPixel, height);

    if (currentPlayhead >= 0) {
        const playheadX = (currentPlayhead / audioDuration) * width;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(playheadX, 0, 2, height);
    }
}

function updateCropFromSliders() {
    let startPercent = parseFloat(startSlider.value);
    let endPercent = parseFloat(endSlider.value);
    if (startPercent > endPercent) {
        const temp = startPercent;
        startPercent = Math.min(startPercent, endPercent);
        endPercent = Math.max(temp, endPercent);
        startSlider.value = startPercent;
        endSlider.value = endPercent;
    }
    cropStart = (startPercent / 100) * audioDuration;
    cropEnd = (endPercent / 100) * audioDuration;
    startTimeInput.value = cropStart.toFixed(1);
    endTimeInput.value = cropEnd.toFixed(1);
    renderWaveform();
}

function updateCropFromInputs() {
    let startVal = parseFloat(startTimeInput.value);
    let endVal = parseFloat(endTimeInput.value);
    if (isNaN(startVal)) startVal = 0;
    if (isNaN(endVal)) endVal = audioDuration;
    startVal = Math.max(0, Math.min(startVal, audioDuration));
    endVal = Math.max(0, Math.min(endVal, audioDuration));
    if (startVal >= endVal) {
        startVal = Math.max(0, endVal - 0.1);
    }
    cropStart = startVal;
    cropEnd = endVal;
    startSlider.value = (cropStart / audioDuration) * 100;
    endSlider.value = (cropEnd / audioDuration) * 100;
    startTimeInput.value = cropStart.toFixed(1);
    endTimeInput.value = cropEnd.toFixed(1);
    renderWaveform();
}

function cropAudioBuffer(buffer, start, end) {
    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.floor(end * sampleRate);
    const lengthSamples = endSample - startSample;
    if (lengthSamples <= 0) return buffer;
    const newBuffer = audioContext.createBuffer(
        buffer.numberOfChannels,
        lengthSamples,
        sampleRate
    );
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        const newChannelData = newBuffer.getChannelData(channel);
        for (let i = 0; i < lengthSamples; i++) {
            newChannelData[i] = channelData[startSample + i];
        }
    }
    return newBuffer;
}

function playBuffer(buffer) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (previewSource) {
        try { previewSource.stop(); } catch(e) {}
        cancelAnimationFrame(animationId);
    }
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
    previewSource = source;

    const startTime = audioContext.currentTime;
    const duration = buffer.duration;
    
    function updateProgress() {
        const elapsed = audioContext.currentTime - startTime;
        if (elapsed < duration) {
            currentPlayhead = cropStart + elapsed;
            renderWaveform();
            animationId = requestAnimationFrame(updateProgress);
        } else {
            currentPlayhead = -1;
            renderWaveform();
        }
    }
    
    updateProgress();

    setTimeout(() => {
        if (previewSource === source) {
            previewSource = null;
        }
    }, duration * 1000);
}

function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataLength = buffer.length * blockAlign;
    const headerLength = 44;
    const totalLength = headerLength + dataLength;
    const arrayBuffer = new ArrayBuffer(totalLength);
    const view = new DataView(arrayBuffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    const channels = [];
    for (let c = 0; c < numChannels; c++) {
        channels.push(buffer.getChannelData(c));
    }
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let c = 0; c < numChannels; c++) {
            const sample = Math.max(-1, Math.min(1, channels[c][i]));
            const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, val, true);
            offset += 2;
        }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function getAudioBlobForShare() {
    if (!audioBuffer) return audioBlob;
    if (cropStart > 0.01 || cropEnd < audioDuration - 0.01) {
        const croppedBuffer = cropAudioBuffer(audioBuffer, cropStart, cropEnd);
        const wavBlob = audioBufferToWav(croppedBuffer);
        croppedBlob = wavBlob;
        return wavBlob;
    } else {
        croppedBlob = null;
        return audioBlob;
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

async function uploadToGitHub(blob, filename) {
    const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
    
    const response = await fetch('/.netlify/functions/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            filename: filename,
            content: base64Data
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
    }
    
    const data = await response.json();
    return data.url;
}
