# QR Audio Player - Mehrkanal

Ein HTML/JavaScript-basierter Audio-Player, der QR-Codes scannt und Audio-Dateien als übereinandergelegte Kanäle abspielt.

## Features

- **QR-Code-Scanner**: Scannt QR-Codes, die URLs zu Audio-Dateien enthalten
- **Mehrkanal-Wiedergabe**: Mehrere Audio-Dateien können gleichzeitig abgespielt werden
- **Individuelle Steuerung**: Jeder Kanal kann einzeln gesteuert werden (Play, Pause, Stop, Lautstärke)
- **Moderne UI**: Responsive Design mit intuitiver Bedienung

## Unterstützte Audio-Formate

- MP3
- WAV
- OGG
- M4A
- AAC
- WebM

## Verwendung

1. Öffne `index.html` in einem modernen Webbrowser
2. Klicke auf "Scanner starten" und erlaube den Zugriff auf die Kamera
3. Scanne QR-Codes, die URLs zu Audio-Dateien enthalten
4. Jeder gescannte QR-Code fügt einen neuen Kanal hinzu
5. Steuere jeden Kanal individuell über die Buttons und den Lautstärke-Slider

## Technische Details

- **QR-Scanner**: html5-qrcode Bibliothek (via CDN)
- **Audio-Wiedergabe**: HTML5 Audio API
- **Keine Backend-Abhängigkeiten**: Funktioniert komplett clientseitig
- **Responsive Design**: Funktioniert auf Desktop und mobilen Geräten

## Browser-Kompatibilität

- Chrome/Edge (empfohlen)
- Firefox
- Safari
- Mobile Browser mit Kamera-Zugriff

## Hinweise

- Die Kamera-Berechtigung wird beim Starten des Scanners benötigt
- Audio-Dateien müssen über HTTP/HTTPS erreichbar sein (CORS-konform)
- Für lokale Dateien kann ein lokaler Server erforderlich sein

