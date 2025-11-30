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
                // Scanner konnte nicht gestartet werden
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
        const audioUrl = this.getAudioUrlFromMapping(qrContent);
        
        if (audioUrl) {
            if (this.hasChannelWithUrl(audioUrl)) {
                return;
            }
            this.addChannel(audioUrl);
        } else if (this.isValidAudioUrl(qrContent)) {
            if (this.hasChannelWithUrl(qrContent)) {
                return;
            }
            this.addChannel(qrContent);
        }
    }
    
    hasChannelWithUrl(url) {
        // Normalisiere URL für Vergleich
        let normalizedUrl = url;
        try {
            normalizedUrl = new URL(url, window.location.href).href;
        } catch (e) {
            // Falls URL-Parsing fehlschlägt, verwende Original
        }
        
        // Prüfe alle Channels
        for (const [channelId, channel] of this.channels.entries()) {
            // Vergleiche sowohl die ursprüngliche URL als auch die absolute URL
            if (channel.url === url || 
                channel.absoluteUrl === normalizedUrl ||
                channel.url === normalizedUrl ||
                channel.absoluteUrl === url) {
                return true;
            }
        }
        return false;
    }

    getAudioUrlFromMapping(qrContent) {
        if (typeof audioMapping !== 'undefined') {
            if (audioMapping[qrContent]) {
                return audioMapping[qrContent];
            }
            const trimmed = qrContent.trim();
            if (audioMapping[trimmed]) {
                return audioMapping[trimmed];
            }
        }
        return null;
    }

    isValidAudioUrl(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }
        
        try {
            // Unterstütze sowohl absolute als auch relative URLs
            const urlObj = new URL(url, window.location.href);
            const path = urlObj.pathname.toLowerCase();
            const validExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm'];
            
            // Prüfe Dateiendung
            if (validExtensions.some(ext => path.endsWith(ext))) {
                return true;
            }
            
            // Prüfe URL-Parameter
            if (urlObj.searchParams.has('audio')) {
                return true;
            }
            
            // Prüfe Content-Type (asynchron, aber wir geben true zurück wenn es eine URL ist)
            // Die eigentliche Prüfung erfolgt beim Laden
            return true;
        } catch {
            // Für relative URLs, prüfe die Dateiendung direkt
            const path = url.toLowerCase();
            const validExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm'];
            return validExtensions.some(ext => path.endsWith(ext));
        }
    }

    getUrlFilename(url) {
        try {
            // Versuche absolute URL zu parsen
            const urlObj = new URL(url, window.location.href);
            const pathname = urlObj.pathname;
            return pathname.split('/').pop() || url.split('/').pop() || 'Unbekannt';
        } catch {
            // Falls URL-Parsing fehlschlägt, versuche den Dateinamen aus dem Pfad zu extrahieren
            return url.split('/').pop() || url || 'Unbekannt';
        }
    }

    async addChannel(audioUrl) {
        const channelId = `channel-${this.nextChannelId++}`;
        
        // Verwende die URL direkt - keine Konvertierung für absolute URLs
        let absoluteUrl = audioUrl;
        
        if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://') && !audioUrl.startsWith('data:')) {
            try {
                absoluteUrl = new URL(audioUrl, window.location.href).href;
            } catch (e) {
                // URL-Konvertierung fehlgeschlagen
            }
        }
        
        let finalUrl = absoluteUrl;
        
        if (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://')) {
            try {
                const response = await fetch(absoluteUrl);
                if (response.ok) {
                    const blob = await response.blob();
                    finalUrl = URL.createObjectURL(blob);
                }
            } catch (fetchError) {
                finalUrl = absoluteUrl;
            }
        }
        
        const audio = new Audio(finalUrl);
        audio.preload = 'auto';
        
        audio.addEventListener('error', (e) => {
            setTimeout(() => {
                if (audio.error) {
                    this.removeChannel(channelId);
                }
            }, 100);
        });

        audio.addEventListener('canplay', () => {
            audio.play().catch(() => {});
        });
        
        audio.addEventListener('canplaythrough', () => {
            if (audio.paused && !audio.ended) {
                audio.play().catch(() => {});
            }
        });
        
        const channel = {
            id: channelId,
            audio: audio,
            url: audioUrl,
            absoluteUrl: absoluteUrl,
            blobUrl: finalUrl.startsWith('blob:') ? finalUrl : null, // Speichere Blob-URL für Cleanup
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
            channel.audio.play().catch(() => {});
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
            
            if (channel.blobUrl) {
                URL.revokeObjectURL(channel.blobUrl);
            }
            
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

}

document.addEventListener('DOMContentLoaded', () => {
    new AudioChannelManager();
});

