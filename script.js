let audioBlob = null;
let audioUrl = null;
let currentAudioName = '';
let deferredPrompt = null;

// Crop-related variables
let audioBuffer = null;
let audioContext = null;
let audioDuration = 0;
let cropStart = 0;
let cropEnd = 0;
let croppedBlob = null;
let previewSource = null;

// DOM elements (initialized in DOMContentLoaded)
let audioInput, fileDrop, fileName, audioName, generateBtn, resultSection,
    audioPlayer, displayName, downloadBtn, shareBtn, installSection, installBtn,
    cropSection, waveformCanvas, startSlider, endSlider, startTimeInput,
    endTimeInput, durationDisplay, previewBtn, resetCropBtn;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
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

    initApp();
});

function initApp() {
    // File input events
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

    // Crop event listeners
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

    // Generate QR Code
    generateBtn.addEventListener('click', async () => {
        if (!audioBlob) {
            alert('Please select an audio file.');
            return;
        }
        if (!audioName.value.trim()) {
            alert('Please enter student name.');
            return;
        }
        currentAudioName = audioName.value.trim();
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        const blobToShare = getAudioBlobForShare();
        
        // Try uploading to GitHub for cross-device sharing
        const fileNameToUpload = `${currentAudioName}_${Date.now()}${blobToShare.type.includes('wav') ? '.wav' : '.opus'}`;
        try {
            const uploadedUrl = await uploadToGitHub(blobToShare, fileNameToUpload);
            // Generate QR Code with uploaded URL
            const qrImg = new Image();
            qrImg.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(qrImg, 0, 0, 256, 256);
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.strokeRect(0, 0, 256, 256);
                document.getElementById('qrcode').innerHTML = '';
                document.getElementById('qrcode').appendChild(canvas);
                // Store the uploaded URL for later access
                localStorage.setItem('audio_url_' + currentAudioName, uploadedUrl);
            };
            qrImg.onerror = () => {
                console.error('Error generating QR Code via API');
                alert('Error generating QR Code. Check your connection.');
                return;
            };
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(uploadedUrl)}`;
        } catch (uploadErr) {
            console.error('GitHub upload failed, falling back to local-only sharing:', uploadErr);
            // Fall back to local URL (same device only)
            const shareUrl = generateShareUrl();
            const qrImg = new Image();
            qrImg.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(qrImg, 0, 0, 256, 256);
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.strokeRect(0, 0, 256, 256);
                document.getElementById('qrcode').innerHTML = '';
                document.getElementById('qrcode').appendChild(canvas);
            };
            qrImg.onerror = () => {
                console.error('Error generating QR Code via API');
                alert('Error generating QR Code. Check your connection.');
                return;
            };
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(shareUrl)}`;
            alert('Cross-device sharing unavailable. QR Code works for same device only.\nConfigure config.json with GitHub token for full sharing.');
        }
        
        // Store in localStorage for same-device access
        try {
            const base64Data = await blobToBase64(blobToShare);
            localStorage.setItem('audio_' + currentAudioName, JSON.stringify({
                name: currentAudioName,
                data: base64Data
            }));
        } catch (err) {
            console.error('Error saving to localStorage:', err);
        }
        
        displayName.textContent = currentAudioName;
        audioPlayer.src = URL.createObjectURL(blobToShare);
        resultSection.style.display = 'block';
        resultSection.scrollIntoView({ behavior: 'smooth' });
    });

    // Download QR Code image
    downloadBtn.addEventListener('click', () => {
        const qrDiv = document.getElementById('qrcode');
        const canvas = qrDiv.querySelector('canvas');
        if (!canvas) {
            alert('Generate the QR Code first.');
            return;
        }
        const link = document.createElement('a');
        link.download = `${currentAudioName}_qrcode.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Share
    shareBtn.addEventListener('click', async () => {
        if (!audioBlob) return;
        const shareUrl = generateShareUrl();
        if (navigator.share) {
            try {
                await navigator.share({
                    title: currentAudioName,
                    text: `Listen to this audio: ${currentAudioName}`,
                    url: shareUrl
                });
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Error sharing:', err);
                }
            }
        } else {
            copyToClipboard(shareUrl);
            alert('Link copied to clipboard!');
        }
    });

    // PWA install
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

    // Service Worker - only if not file:// protocol
    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then(registration => {
                console.log('SW registered:', registration);
            }).catch(err => {
                console.log('SW registration failed:', err);
            });
        });
    }

    // Check for shared files and URL params
    window.addEventListener('load', () => {
        checkSharedFile();
        checkUrlParams();
    });
}

function handleAudioFile(file) {
    const validExtensions = ['.opus', '.ogg'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!file.type.includes('audio/') && !hasValidExt) {
        alert('Please select a valid OPUS or OGG audio file.');
        return;
    }
    audioBlob = file;
    fileName.textContent = `File: ${file.name}`;
    if (!audioName.value) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        audioName.value = nameWithoutExt;
    }
    // Reset crop variables
    cropStart = 0;
    cropEnd = 0;
    croppedBlob = null;
    // Show crop section and decode audio
    cropSection.style.display = 'block';
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
        // Update UI
        durationDisplay.textContent = audioDuration.toFixed(1);
        endTimeInput.value = audioDuration.toFixed(1);
        endSlider.value = 100;
        startSlider.value = 0;
        startTimeInput.value = 0;
        cropEnd = audioDuration;
        // Draw waveform
        renderWaveform();
    } catch (err) {
        console.error('Error decoding audio:', err);
        alert('Error decoding audio. Try another file.');
    }
}

function renderWaveform() {
    if (!audioBuffer || !audioDuration) return;
    const canvas = waveformCanvas;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    // Background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);
    // Waveform
    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / width);
    const amp = height / 2;
    ctx.fillStyle = '#000000';
    for (let i = 0; i < width; i++) {
        let min = 1.0, max = -1.0;
        for (let j = 0; j < step; j++) {
            const datum = channelData[i * step + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
    // Crop overlay
    const startPixel = (cropStart / audioDuration) * width;
    const endPixel = (cropEnd / audioDuration) * width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, startPixel, height);
    ctx.fillRect(endPixel, 0, width - endPixel, height);
}

function updateCropFromSliders() {
    let startPercent = parseFloat(startSlider.value);
    let endPercent = parseFloat(endSlider.value);
    if (startPercent > endPercent) {
        // Swap if start > end
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
    // Stop previous preview if playing
    if (previewSource) {
        try { previewSource.stop(); } catch(e) {}
    }
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
    previewSource = source;
    // Stop after buffer duration
    setTimeout(() => {
        if (previewSource === source) {
            try { source.stop(); } catch(e) {}
            previewSource = null;
        }
    }, buffer.duration * 1000);
}

function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataLength = buffer.length * blockAlign;
    const headerLength = 44;
    const totalLength = headerLength + dataLength;
    const arrayBuffer = new ArrayBuffer(totalLength);
    const view = new DataView(arrayBuffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write interleaved channel data
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

// Returns the blob to be shared (cropped if applicable)
function getAudioBlobForShare() {
    if (!audioBuffer) return audioBlob;
    // If cropping is applied (start > 0 or end < duration)
    if (cropStart > 0.01 || cropEnd < audioDuration - 0.01) {
        const croppedBuffer = cropAudioBuffer(audioBuffer, cropStart, cropEnd);
        const wavBlob = audioBufferToWav(croppedBuffer);
        // Also store as croppedBlob for download
        croppedBlob = wavBlob;
        return wavBlob;
    } else {
        croppedBlob = null;
        return audioBlob;
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function base64ToBlob(base64, type = 'audio/ogg') {
    let binaryStr;
    if (base64.includes(',')) {
        binaryStr = atob(base64.split(',')[1]);
    } else {
        binaryStr = atob(base64);
    }
    const len = binaryStr.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        arr[i] = binaryStr.charCodeAt(i);
    }
    return new Blob([arr], { type });
}

function generateShareUrl() {
    // Check if we have an uploaded URL for this audio
    const uploadedUrl = localStorage.getItem('audio_url_' + currentAudioName);
    if (uploadedUrl) {
        return uploadedUrl;
    }
    // Fallback to local URL (same device only)
    const baseUrl = window.location.href.split('?')[0];
    return `${baseUrl}?audio=${encodeURIComponent(currentAudioName)}`;
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

function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const audioParam = urlParams.get('audio');
    if (audioParam) {
        const stored = localStorage.getItem('audio_' + audioParam);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                currentAudioName = data.name;
                const blob = base64ToBlob(data.data);
                audioUrl = URL.createObjectURL(blob);
                displayName.textContent = currentAudioName;
                audioPlayer.src = audioUrl;
                resultSection.style.display = 'block';
                audioBlob = blob;
            } catch (err) {
                console.error('Error loading audio:', err);
                alert('Error loading audio.');
            }
        } else {
            alert('Audio not found. It may have been removed or the link is invalid.');
        }
    }
}

// IndexedDB functions for shared files
function getSharedFile() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AudioQRDB', 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('sharedFiles')) {
                db.createObjectStore('sharedFiles', { keyPath: 'id' });
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction('sharedFiles', 'readwrite');
            const store = transaction.objectStore('sharedFiles');
            const getRequest = store.get('latest');
            getRequest.onsuccess = () => {
                const data = getRequest.result;
                if (data) {
                    store.delete('latest');
                    resolve(data);
                } else {
                    resolve(null);
                }
            };
            getRequest.onerror = reject;
        };
        request.onerror = reject;
    });
}

async function checkSharedFile() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('shared')) {
        try {
            const data = await getSharedFile();
            if (data && data.file) {
                handleAudioFile(data.file);
                if (data.name) {
                    audioName.value = data.name.replace(/\.[^/.]+$/, '');
                }
                window.history.replaceState({}, '', './index.html');
            }
        } catch (err) {
            console.error('Error loading shared file:', err);
        }
    }
}

// Upload audio to GitHub via secure Netlify Function
async function uploadToGitHub(blob, filename) {
    // 1. Convertemos o áudio para base64
    const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
    
    // 2. Enviamos o Base64 sem nenhuma senha para o servidor interno (Netlify Function)
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
        throw new Error(`Netlify upload falhou: ${errorData.message}`);
    }
    
    const data = await response.json();
    return data.url; // Retorna o link publico do GitHub!
}

