class AudioChannelManager {
    constructor() {
        this.channels = new Map();
        this.scannerActive = false;
        this.html5QrCode = null;
        this.nextChannelId = 1;
        this.initializeScanner();
        this.setupEventListeners();
    }

    initializeScanner() {
        this.html5QrCode = new Html5Qrcode("qr-reader");
    }

    setupEventListeners() {
        const toggleButton = document.getElementById('toggle-scanner');
        const stopAllButton = document.getElementById('stop-all');

        toggleButton.addEventListener('click', () => this.toggleScanner());
        stopAllButton.addEventListener('click', () => this.stopAllChannels());
    }

    async toggleScanner() {
        const toggleButton = document.getElementById('toggle-scanner');
        
        if (!this.scannerActive) {
            try {
                await this.startScanner();
                toggleButton.textContent = 'Scanner stoppen';
                toggleButton.classList.remove('btn-primary');
                toggleButton.classList.add('btn-danger');
            } catch (error) {
                this.showError('Fehler beim Starten des Scanners: ' + error.message);
            }
        } else {
            this.stopScanner();
            toggleButton.textContent = 'Scanner starten';
            toggleButton.classList.remove('btn-danger');
            toggleButton.classList.add('btn-primary');
        }
    }

    async startScanner() {
        try {
            await this.html5QrCode.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 }
                },
                (decodedText) => this.onQRCodeScanned(decodedText),
                (errorMessage) => {
                    // Fehler werden ignoriert, da sie während des Scannings häufig auftreten
                }
            );
            this.scannerActive = true;
        } catch (error) {
            this.scannerActive = false;
            throw error;
        }
    }

    stopScanner() {
        if (this.scannerActive) {
            this.html5QrCode.stop().catch(() => {});
            this.scannerActive = false;
        }
    }

    onQRCodeScanned(qrContent) {
        // Zuerst im Mapping nachschauen
        const audioUrl = this.getAudioUrlFromMapping(qrContent);
        
        if (audioUrl) {
            this.addChannel(audioUrl);
            this.showSuccess(`Audio-Datei hinzugefügt: ${this.getUrlFilename(audioUrl)}`);
        } else if (this.isValidAudioUrl(qrContent)) {
            // Falls nicht im Mapping, prüfe ob es direkt eine gültige Audio-URL ist
            this.addChannel(qrContent);
            this.showSuccess(`Audio-Datei hinzugefügt: ${this.getUrlFilename(qrContent)}`);
        } else {
            this.showError(`QR-Code nicht gefunden im Mapping und keine gültige Audio-URL: ${qrContent}`);
        }
    }

    getAudioUrlFromMapping(qrContent) {
        // Prüfe ob audioMapping definiert ist (aus audio-mapping.js)
        if (typeof audioMapping !== 'undefined' && audioMapping[qrContent]) {
            return audioMapping[qrContent];
        }
        return null;
    }

    isValidAudioUrl(url) {
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname.toLowerCase();
            const validExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm'];
            return validExtensions.some(ext => path.endsWith(ext)) || 
                   urlObj.searchParams.has('audio') ||
                   this.isAudioContentType(url);
        } catch {
            return false;
        }
    }

    async isAudioContentType(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            const contentType = response.headers.get('content-type');
            return contentType && contentType.startsWith('audio/');
        } catch {
            return false;
        }
    }

    getUrlFilename(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            return pathname.split('/').pop() || 'Unbekannt';
        } catch {
            return 'Unbekannt';
        }
    }

    addChannel(audioUrl) {
        const channelId = `channel-${this.nextChannelId++}`;
        const audio = new Audio(audioUrl);
        
        audio.addEventListener('error', (e) => {
            this.showError(`Fehler beim Laden von ${this.getUrlFilename(audioUrl)}`);
            this.removeChannel(channelId);
        });

        audio.addEventListener('loadeddata', () => {
            this.showSuccess(`Audio geladen: ${this.getUrlFilename(audioUrl)}`);
        });

        const channel = {
            id: channelId,
            audio: audio,
            url: audioUrl,
            volume: 1.0,
            isPlaying: false,
            isPaused: false
        };

        this.channels.set(channelId, channel);
        this.renderChannel(channel);
    }

    renderChannel(channel) {
        const container = document.getElementById('channels-container');
        const channelCard = document.createElement('div');
        channelCard.className = 'channel-card';
        channelCard.id = channel.id;

        const filename = this.getUrlFilename(channel.url);
        const statusClass = channel.isPlaying ? 'status-playing' : 
                           channel.isPaused ? 'status-paused' : 'status-stopped';
        const statusText = channel.isPlaying ? 'Wiedergabe' : 
                          channel.isPaused ? 'Pausiert' : 'Gestoppt';

        channelCard.innerHTML = `
            <div class="channel-header">
                <div class="channel-title">
                    <span class="status-indicator ${statusClass}"></span>
                    ${filename}
                </div>
            </div>
            <div style="font-size: 0.85em; color: #666; margin-bottom: 10px; word-break: break-all;">
                ${channel.url}
            </div>
            <div style="margin-bottom: 10px; font-size: 0.9em; color: #666;">
                Status: ${statusText}
            </div>
            <div class="volume-control">
                <label>Lautstärke: <span id="${channel.id}-volume-value">${Math.round(channel.volume * 100)}%</span></label>
                <input type="range" 
                       class="volume-slider" 
                       min="0" 
                       max="100" 
                       value="${channel.volume * 100}"
                       id="${channel.id}-volume">
            </div>
            <div class="channel-controls">
                <button class="btn btn-primary" id="${channel.id}-play">Abspielen</button>
                <button class="btn btn-secondary" id="${channel.id}-pause">Pausieren</button>
                <button class="btn btn-danger" id="${channel.id}-stop">Stoppen</button>
                <button class="btn btn-secondary" id="${channel.id}-remove">Entfernen</button>
            </div>
        `;

        container.appendChild(channelCard);

        this.attachChannelEventListeners(channel);
    }

    attachChannelEventListeners(channel) {
        const playButton = document.getElementById(`${channel.id}-play`);
        const pauseButton = document.getElementById(`${channel.id}-pause`);
        const stopButton = document.getElementById(`${channel.id}-stop`);
        const removeButton = document.getElementById(`${channel.id}-remove`);
        const volumeSlider = document.getElementById(`${channel.id}-volume`);
        const volumeValue = document.getElementById(`${channel.id}-volume-value`);

        playButton.addEventListener('click', () => this.playChannel(channel.id));
        pauseButton.addEventListener('click', () => this.pauseChannel(channel.id));
        stopButton.addEventListener('click', () => this.stopChannel(channel.id));
        removeButton.addEventListener('click', () => this.removeChannel(channel.id));

        volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            this.setChannelVolume(channel.id, volume);
            volumeValue.textContent = `${Math.round(volume * 100)}%`;
        });

        channel.audio.addEventListener('play', () => this.updateChannelStatus(channel.id, 'playing'));
        channel.audio.addEventListener('pause', () => this.updateChannelStatus(channel.id, 'paused'));
        channel.audio.addEventListener('ended', () => this.updateChannelStatus(channel.id, 'stopped'));
    }

    playChannel(channelId) {
        const channel = this.channels.get(channelId);
        if (channel) {
            channel.audio.play().catch(error => {
                this.showError(`Fehler beim Abspielen: ${error.message}`);
            });
            channel.isPlaying = true;
            channel.isPaused = false;
        }
    }

    pauseChannel(channelId) {
        const channel = this.channels.get(channelId);
        if (channel) {
            channel.audio.pause();
            channel.isPlaying = false;
            channel.isPaused = true;
        }
    }

    stopChannel(channelId) {
        const channel = this.channels.get(channelId);
        if (channel) {
            channel.audio.pause();
            channel.audio.currentTime = 0;
            channel.isPlaying = false;
            channel.isPaused = false;
        }
    }

    setChannelVolume(channelId, volume) {
        const channel = this.channels.get(channelId);
        if (channel) {
            channel.audio.volume = volume;
            channel.volume = volume;
        }
    }

    removeChannel(channelId) {
        const channel = this.channels.get(channelId);
        if (channel) {
            this.stopChannel(channelId);
            channel.audio.src = '';
            this.channels.delete(channelId);
            
            const channelCard = document.getElementById(channelId);
            if (channelCard) {
                channelCard.remove();
            }
        }
    }

    stopAllChannels() {
        this.channels.forEach((channel, channelId) => {
            this.stopChannel(channelId);
        });
        this.showSuccess('Alle Kanäle gestoppt');
    }

    updateChannelStatus(channelId, status) {
        const channel = this.channels.get(channelId);
        if (!channel) return;

        const channelCard = document.getElementById(channelId);
        if (!channelCard) return;

        const statusIndicator = channelCard.querySelector('.status-indicator');
        const statusText = channelCard.querySelector('.channel-header').nextElementSibling.nextElementSibling;

        statusIndicator.className = 'status-indicator';
        channel.isPlaying = false;
        channel.isPaused = false;

        switch (status) {
            case 'playing':
                statusIndicator.classList.add('status-playing');
                channel.isPlaying = true;
                if (statusText) statusText.textContent = 'Status: Wiedergabe';
                break;
            case 'paused':
                statusIndicator.classList.add('status-paused');
                channel.isPaused = true;
                if (statusText) statusText.textContent = 'Status: Pausiert';
                break;
            case 'stopped':
                statusIndicator.classList.add('status-stopped');
                if (statusText) statusText.textContent = 'Status: Gestoppt';
                break;
        }
    }

    showError(message) {
        this.showMessage(message, 'error-message');
    }

    showSuccess(message) {
        this.showMessage(message, 'success-message');
    }

    showMessage(message, className) {
        const container = document.querySelector('.container');
        const messageDiv = document.createElement('div');
        messageDiv.className = className;
        messageDiv.textContent = message;
        
        container.insertBefore(messageDiv, container.firstChild);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

// Initialisierung beim Laden der Seite
document.addEventListener('DOMContentLoaded', () => {
    new AudioChannelManager();
});

