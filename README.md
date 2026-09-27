# 🚀 TubeGrab Universal - All-in-One Free Video & Audio Downloader

> Download videos and music for free in **4K, 1080p Full HD MP4** or extract **320kbps MP3 / Lossless WAV** audio across **1,000+ platforms** with zero ads and no registration.

---

## 🌟 Supported Platforms
- **YouTube**: Standard Videos, YouTube Shorts, Music, Live replays (4K, 1080p, 720p, 480p, 360p).
- **Instagram**: Instagram Reels, Feed Video Posts, Carousels in original HD.
- **TikTok**: Clean videos without watermark and high-fidelity sound tracks.
- **Twitter / X**: Video tweets and animated GIF clips.
- **Facebook**: Facebook Watch, Public Videos, and Reels.
- **Reddit**: Videos with audio automatically merged via FFmpeg.
- **Pinterest**: Video Pins and idea tutorials.
- **Vimeo**: High bitrate HD & 4K videos.
- **SoundCloud / Bandcamp**: Pure high-quality audio extraction.
- **Twitch**: Clips and stream highlights.
- **Any Direct Link**: Compatible with generic web video streams (MP4/M3U8).

---

## ✨ Features

1. **All-Platform Video & Audio Ingestion**
   - Automatically detects the platform and provides platform badges with tailored colors and icons.
2. **Built-in Video Trimmer / Clip Cutter**
   - Clip video segments by setting `Start Time` (e.g. `00:15`) and `End Time` (e.g. `01:30`) to avoid downloading entire hours-long videos.
3. **Studio Audio Conversion**
   - MP3 (320 kbps Studio Quality, 192 kbps, 128 kbps)
   - Apple AAC M4A
   - Uncompressed Lossless WAV
   - Lossless FLAC
4. **Instant Mobile QR Transfer**
   - Click **"Get on Phone"** to generate a QR code. Scan it with any iPhone or Android camera to save the video straight to your phone.
5. **HD Cover / Thumbnail Grabber**
   - 1-click button to download high-resolution video thumbnails and album artwork.
6. **Multi-Link Batch Mode**
   - Paste multiple URLs at once to process multiple videos in a queue.
7. **Dark / Light Mode**
   - One-click toggle in the navbar to switch between dark obsidian and clean light theme.
8. **Real-Time Live Progress & Stats**
   - Displays download speed (MB/s), estimated time remaining (ETA), percentage progress bar, and status phases.

---

## 🛠️ Quick Start

### 1. Launch with One Click (Windows)
Double-click `run.bat` in this folder. It will start the server and open `http://127.0.0.1:5000` in your default browser.

### 2. Manual Terminal Launch
```bash
# Activate virtual environment
.\.venv\Scripts\activate

# Start the Flask server
python app.py
```
Open **[http://127.0.0.1:5000](http://127.0.0.1:5000)** or access from any device on your Wi-Fi at **`http://<YOUR_IP>:5000`**.

---

## 📂 Project Architecture
```
yt do/
├── app.py                 # Flask server with yt-dlp backend, FFmpeg trimming & API routes
├── run.bat                # 1-click Windows runner
├── requirements.txt       # Dependencies (Flask, yt-dlp, flask-cors)
├── README.md              # Documentation
├── downloads/             # Temp directory (auto-cleaned every 30 minutes)
├── static/
│   ├── css/
│   │   └── style.css      # Dark/Light theme, glassmorphism, responsive styles
│   └── js/
│       └── app.js         # Client-side dynamic platform handler, trimmer, QR code
└── templates/
    └── index.html         # Responsive UI with platform pills, format tables & modals
```
