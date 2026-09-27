import os
import re
import time
import uuid
import shutil
import socket
import urllib.request
import subprocess
import threading
import tempfile
from urllib.parse import urlparse
from flask import Flask, render_template, request, jsonify, abort, Response
from flask_cors import CORS
import yt_dlp

app = Flask(__name__)
app.config['TEMPLATES_AUTO_RELOAD'] = True
CORS(app)

# Transient processing directory placed in OS Temp (NOT in source code / workspace)
TEMP_BASE = os.path.join(tempfile.gettempdir(), 'tubegrab_cache')
os.makedirs(TEMP_BASE, exist_ok=True)

# Detect FFmpeg location
FFMPEG_PATH = shutil.which('ffmpeg')
if not FFMPEG_PATH:
    winget_ffmpeg = r"C:\Users\rajpu\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe"
    if os.path.exists(winget_ffmpeg):
        FFMPEG_PATH = winget_ffmpeg

# Store download task states in-memory: task_id -> task_data
tasks = {}
tasks_lock = threading.Lock()

def get_local_ip():
    """Retrieve host local IP address for phone QR code sharing."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

LOCAL_IP = get_local_ip()

def sanitize_filename(name):
    """Sanitize string to be safe for filenames."""
    clean = re.sub(r'[\\/*?:"<>|]', '', name)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean[:120] if clean else "media_download"

def format_duration(seconds):
    """Format seconds into HH:MM:SS or MM:SS."""
    if not seconds:
        return "Unknown"
    try:
        seconds = int(seconds)
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        return f"{minutes:02d}:{secs:02d}"
    except Exception:
        return "00:00"

def parse_time_to_seconds(time_str):
    """Convert mm:ss or hh:mm:ss or raw seconds to float seconds."""
    if not time_str:
        return None
    try:
        time_str = str(time_str).strip()
        parts = time_str.split(':')
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        return float(time_str)
    except Exception:
        return None

def format_number(num):
    """Format view counts into readable K/M/B notation."""
    if not num:
        return "0"
    try:
        num = int(num)
        if num >= 1_000_000_000:
            return f"{num / 1_000_000_000:.1f}B"
        if num >= 1_000_000:
            return f"{num / 1_000_000:.1f}M"
        if num >= 1_000:
            return f"{num / 1_000:.1f}K"
        return str(num)
    except Exception:
        return str(num)

def format_size(bytes_num):
    """Format byte sizes into readable MB/GB string."""
    if not bytes_num:
        return None
    try:
        bytes_num = float(bytes_num)
        if bytes_num >= 1024 * 1024 * 1024:
            return f"{bytes_num / (1024 * 1024 * 1024):.1f} GB"
        if bytes_num >= 1024 * 1024:
            return f"{bytes_num / (1024 * 1024):.1f} MB"
        if bytes_num >= 1024:
            return f"{bytes_num / 1024:.1f} KB"
        return f"{int(bytes_num)} B"
    except Exception:
        return None

def detect_platform(url):
    """Detect platform name, icon, and brand color from URL."""
    domain = urlparse(url).netloc.lower()
    
    if 'youtube.com' in domain or 'youtu.be' in domain:
        return {
            'id': 'youtube',
            'name': 'YouTube',
            'icon': 'fa-brands fa-youtube',
            'color': '#ff0033',
            'badge': 'YouTube'
        }
    if 'instagram.com' in domain:
        return {
            'id': 'instagram',
            'name': 'Instagram',
            'icon': 'fa-brands fa-instagram',
            'color': '#e1306c',
            'badge': 'Instagram Reel'
        }
    if 'tiktok.com' in domain:
        return {
            'id': 'tiktok',
            'name': 'TikTok',
            'icon': 'fa-brands fa-tiktok',
            'color': '#00f2fe',
            'badge': 'TikTok No-Watermark'
        }
    if 'twitter.com' in domain or 'x.com' in domain:
        return {
            'id': 'twitter',
            'name': 'Twitter / X',
            'icon': 'fa-brands fa-x-twitter',
            'color': '#1da1f2',
            'badge': 'Twitter / X Media'
        }
    if 'facebook.com' in domain or 'fb.watch' in domain:
        return {
            'id': 'facebook',
            'name': 'Facebook',
            'icon': 'fa-brands fa-facebook',
            'color': '#1877f2',
            'badge': 'Facebook Video'
        }
    if 'reddit.com' in domain or 'v.redd.it' in domain:
        return {
            'id': 'reddit',
            'name': 'Reddit',
            'icon': 'fa-brands fa-reddit',
            'color': '#ff4500',
            'badge': 'Reddit Video'
        }
    if 'pinterest.com' in domain or 'pin.it' in domain:
        return {
            'id': 'pinterest',
            'name': 'Pinterest',
            'icon': 'fa-brands fa-pinterest',
            'color': '#e60023',
            'badge': 'Pinterest Pin'
        }
    if 'vimeo.com' in domain:
        return {
            'id': 'vimeo',
            'name': 'Vimeo',
            'icon': 'fa-brands fa-vimeo-v',
            'color': '#1ab7ea',
            'badge': 'Vimeo HD'
        }
    if 'soundcloud.com' in domain:
        return {
            'id': 'soundcloud',
            'name': 'SoundCloud',
            'icon': 'fa-brands fa-soundcloud',
            'color': '#ff5500',
            'badge': 'SoundCloud Track'
        }
    if 'twitch.tv' in domain:
        return {
            'id': 'twitch',
            'name': 'Twitch',
            'icon': 'fa-brands fa-twitch',
            'color': '#9146ff',
            'badge': 'Twitch Clip'
        }
    
    return {
        'id': 'generic',
        'name': domain.replace('www.', '').capitalize() or 'Web Media',
        'icon': 'fa-solid fa-globe',
        'color': '#38bdf8',
        'badge': 'Online Video'
    }

def is_valid_url(url):
    """Validate any public web video URL."""
    if not url or not isinstance(url, str):
        return False
    url = url.strip()
    return bool(re.match(r'^https?:\/\/[^\s/$.?#].[^\s]*$', url, re.IGNORECASE))

def cleanup_transient_files():
    """Background worker that removes temporary files older than 5 minutes."""
    while True:
        try:
            time.sleep(60) # Run every minute
            now = time.time()
            cutoff = now - 300 # 5 minutes max life

            with tasks_lock:
                for task_id, info in list(tasks.items()):
                    created_at = info.get('created_at', now)
                    if created_at < cutoff:
                        file_path = info.get('file_path')
                        if file_path and os.path.exists(file_path):
                            try:
                                os.remove(file_path)
                                parent = os.path.dirname(file_path)
                                if os.path.exists(parent) and parent != TEMP_BASE:
                                    shutil.rmtree(parent, ignore_errors=True)
                            except Exception:
                                pass
                        del tasks[task_id]

            # Clean any untracked folders in TEMP_BASE older than 5 mins
            if os.path.exists(TEMP_BASE):
                for item in os.listdir(TEMP_BASE):
                    item_path = os.path.join(TEMP_BASE, item)
                    try:
                        if os.path.isdir(item_path):
                            mtime = os.path.getmtime(item_path)
                            if mtime < cutoff:
                                shutil.rmtree(item_path, ignore_errors=True)
                    except Exception:
                        pass
        except Exception:
            pass

cleanup_thread = threading.Thread(target=cleanup_transient_files, daemon=True)
cleanup_thread.start()

def keep_alive_self_pinger():
    """Background worker that pings this service periodically to prevent Render free-tier sleep."""
    time.sleep(120)
    while True:
        try:
            target = os.environ.get('RENDER_EXTERNAL_URL') or os.environ.get('SELF_PING_URL') or 'https://astradev.tech'
            if target and target.startswith('http'):
                ping_url = f"{target.rstrip('/')}/api/ping"
                req = urllib.request.Request(
                    ping_url,
                    headers={'User-Agent': 'TubeGrab-KeepAlive-Worker/1.0'}
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    pass
        except Exception:
            pass
        time.sleep(600)  # Ping every 10 minutes (Render sleeps after 15 minutes)

pinger_thread = threading.Thread(target=keep_alive_self_pinger, daemon=True)
pinger_thread.start()

@app.route('/api/ping')
def ping():
    """Lightweight heartbeat endpoint for uptime monitors and keep-alive."""
    return jsonify({
        'status': 'ok',
        'alive': True,
        'timestamp': time.time(),
        'service': 'TubeGrab Universal'
    }), 200

@app.route('/')
def index():
    return render_template('index.html', local_ip=LOCAL_IP)

@app.route('/api/storage-status')
def storage_status():
    """Return disk storage footprint in project directory vs OS temp."""
    temp_bytes = 0
    if os.path.exists(TEMP_BASE):
        for root, _, files in os.walk(TEMP_BASE):
            for f in files:
                try:
                    temp_bytes += os.path.getsize(os.path.join(root, f))
                except Exception:
                    pass
    return jsonify({
        'project_storage': '0 MB (Zero footprint in source code)',
        'temp_storage': format_size(temp_bytes) or '0 KB',
        'status': 'Auto-cleaned immediately after download'
    })

@app.route('/api/purge-cache', methods=['POST'])
def purge_cache():
    """Immediately wipe all temporary processing files from OS temp."""
    try:
        with tasks_lock:
            tasks.clear()
        if os.path.exists(TEMP_BASE):
            shutil.rmtree(TEMP_BASE, ignore_errors=True)
            os.makedirs(TEMP_BASE, exist_ok=True)
        return jsonify({'success': True, 'message': 'Temporary cache wiped. 0 MB used.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/info', methods=['POST'])
def get_video_info():
    data = request.get_json() or {}
    url = data.get('url', '').strip()

    if not url:
        return jsonify({'error': 'Please paste a video or audio link.'}), 400

    if not is_valid_url(url):
        return jsonify({'error': 'Please enter a valid URL (starting with http:// or https://)'}), 400

    platform = detect_platform(url)

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'extract_flat': False,
        'ffmpeg_location': FFMPEG_PATH,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                return jsonify({'error': 'Failed to retrieve media information from this link.'}), 404

            if 'entries' in info and info['entries']:
                info = info['entries'][0]

            formats = info.get('formats', [])
            available_heights = set()
            duration = info.get('duration', 0)
            
            for f in formats:
                h = f.get('height')
                vcodec = f.get('vcodec')
                if h and vcodec and vcodec != 'none':
                    available_heights.add(h)

            target_resolutions = [
                {'height': 2160, 'label': '4K Ultra HD', 'badge': '4K', 'desc': '2160p • Master Quality'},
                {'height': 1440, 'label': '2K Quad HD', 'badge': '2K', 'desc': '1440p • Ultra Crisp'},
                {'height': 1080, 'label': '1080p Full HD', 'badge': '1080p', 'desc': 'Full High Definition'},
                {'height': 720, 'label': '720p HD', 'badge': '720p', 'desc': 'Standard High Definition'},
                {'height': 480, 'label': '480p Standard', 'badge': '480p', 'desc': 'Medium Quality'},
                {'height': 360, 'label': '360p Mobile', 'badge': '360p', 'desc': 'Fast & Lightweight'},
            ]

            video_options = []
            max_avail = max(available_heights) if available_heights else 720

            for res in target_resolutions:
                if any(h >= res['height'] for h in available_heights) or (res['height'] <= max_avail and available_heights):
                    est_bitrate_map = {2160: 15_000_000, 1440: 8_000_000, 1080: 3_500_000, 720: 1_800_000, 480: 900_000, 360: 500_000}
                    est_bytes = (est_bitrate_map.get(res['height'], 1_500_000) / 8) * duration if duration else 0
                    
                    video_options.append({
                        'quality': str(res['height']),
                        'label': res['label'],
                        'badge': res['badge'],
                        'description': res['desc'],
                        'format': 'MP4',
                        'size': format_size(est_bytes) if est_bytes > 0 else 'Variable',
                    })

            video_options.insert(0, {
                'quality': 'best',
                'label': 'Original Best Quality',
                'badge': 'Original',
                'description': 'Direct source stream with sound',
                'format': 'MP4',
                'size': 'Original',
            })

            audio_options = [
                {
                    'quality': '320',
                    'label': 'MP3 (320 kbps Studio)',
                    'badge': 'HQ Audio',
                    'description': 'Studio Master Sound • Best Fidelity',
                    'format': 'MP3',
                    'size': format_size((320 * 1000 / 8) * duration) if duration else 'Variable'
                },
                {
                    'quality': '192',
                    'label': 'MP3 (192 kbps High Quality)',
                    'badge': 'MP3',
                    'description': 'High Fidelity • Balanced File Size',
                    'format': 'MP3',
                    'size': format_size((192 * 1000 / 8) * duration) if duration else 'Variable'
                },
                {
                    'quality': '128',
                    'label': 'MP3 (128 kbps Standard)',
                    'badge': 'MP3',
                    'description': 'Standard Quality • Fast Download',
                    'format': 'MP3',
                    'size': format_size((128 * 1000 / 8) * duration) if duration else 'Variable'
                },
                {
                    'quality': 'm4a',
                    'label': 'M4A Audio (Apple AAC)',
                    'badge': 'M4A',
                    'description': 'Original Audio Track • Fast Conversion',
                    'format': 'M4A',
                    'size': format_size((128 * 1000 / 8) * duration) if duration else 'Variable'
                },
                {
                    'quality': 'wav',
                    'label': 'WAV Audio (Lossless PCM)',
                    'badge': 'WAV',
                    'description': 'Uncompressed Studio Waveform',
                    'format': 'WAV',
                    'size': format_size((1411 * 1000 / 8) * duration) if duration else 'Variable'
                },
                {
                    'quality': 'flac',
                    'label': 'FLAC Audio (Lossless Hi-Fi)',
                    'badge': 'FLAC',
                    'description': 'Audiophile Lossless Compression',
                    'format': 'FLAC',
                    'size': format_size((900 * 1000 / 8) * duration) if duration else 'Variable'
                }
            ]

            thumbnail = info.get('thumbnail')
            thumbnails = info.get('thumbnails', [])
            if thumbnails:
                best_thumb = max(thumbnails, key=lambda t: t.get('width', 0) if isinstance(t.get('width'), int) else 0)
                if best_thumb.get('url'):
                    thumbnail = best_thumb['url']

            return jsonify({
                'title': info.get('title', 'Video Media'),
                'uploader': info.get('uploader') or info.get('channel') or platform['name'],
                'uploader_url': info.get('uploader_url') or info.get('channel_url'),
                'duration': duration,
                'duration_formatted': format_duration(duration),
                'views': info.get('view_count', 0),
                'views_formatted': format_number(info.get('view_count')),
                'thumbnail': thumbnail,
                'platform': platform,
                'video_options': video_options,
                'audio_options': audio_options,
                'webpage_url': info.get('webpage_url', url)
            })

    except yt_dlp.utils.DownloadError as e:
        msg = str(e)
        if 'Private' in msg:
            return jsonify({'error': 'This media is private and requires authentication.'}), 400
        if 'not found' in msg.lower() or 'unavailable' in msg.lower():
            return jsonify({'error': 'Media was not found or has been removed.'}), 400
        return jsonify({'error': f'Download notice: {msg}'}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to process link: {str(e)}'}), 500


def download_worker(task_id, url, download_type, quality, title, trim_start=None, trim_end=None):
    """Background worker that downloads into OS Temp directory and prepares for streaming."""
    # Place in OS Temp directory (completely outside project/source code)
    task_dir = os.path.join(TEMP_BASE, task_id)
    os.makedirs(task_dir, exist_ok=True)
    
    clean_title = sanitize_filename(title)
    
    with tasks_lock:
        tasks[task_id]['status'] = 'downloading'
        tasks[task_id]['message'] = 'Connecting to high-speed stream servers...'
        tasks[task_id]['percent'] = 8

    def progress_hook(d):
        with tasks_lock:
            if task_id not in tasks:
                return

            if d['status'] == 'downloading':
                total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                downloaded = d.get('downloaded_bytes') or 0
                
                pct = 10
                if total > 0:
                    pct = int((downloaded / total) * 80)
                    pct = max(10, min(80, pct))
                
                speed = d.get('_speed_str', '')
                eta = d.get('_eta_str', '')
                
                tasks[task_id]['percent'] = pct
                tasks[task_id]['speed'] = speed
                tasks[task_id]['eta'] = eta
                tasks[task_id]['message'] = f"Streaming packets... {speed} (ETA: {eta})"
            
            elif d['status'] == 'finished':
                tasks[task_id]['percent'] = 85
                tasks[task_id]['message'] = "Muxing and processing audio/video streams with FFmpeg..."

    def postprocessor_hook(d):
        with tasks_lock:
            if task_id not in tasks:
                return
            if d['status'] == 'started':
                tasks[task_id]['percent'] = 88
                tasks[task_id]['message'] = "Encoding final high quality format..."
            elif d['status'] == 'finished':
                tasks[task_id]['percent'] = 94
                tasks[task_id]['message'] = "Finalizing file container..."

    try:
        raw_tmpl = os.path.join(task_dir, f"raw_{clean_title}.%(ext)s")
        
        ydl_opts = {
            'outtmpl': raw_tmpl,
            'progress_hooks': [progress_hook],
            'postprocessor_hooks': [postprocessor_hook],
            'quiet': True,
            'no_warnings': True,
            'ffmpeg_location': FFMPEG_PATH,
        }

        final_ext = 'mp4'

        if download_type == 'audio':
            if quality == 'm4a':
                ydl_opts['format'] = 'bestaudio[ext=m4a]/bestaudio/best'
                ydl_opts['postprocessors'] = [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'm4a',
                }]
                final_ext = 'm4a'
            elif quality == 'wav':
                ydl_opts['format'] = 'bestaudio/best'
                ydl_opts['postprocessors'] = [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'wav',
                }]
                final_ext = 'wav'
            elif quality == 'flac':
                ydl_opts['format'] = 'bestaudio/best'
                ydl_opts['postprocessors'] = [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'flac',
                }]
                final_ext = 'flac'
            else: # MP3
                bitrate = quality if quality in ['320', '192', '128'] else '320'
                ydl_opts['format'] = 'bestaudio/best'
                ydl_opts['postprocessors'] = [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': bitrate,
                }]
                final_ext = 'mp3'
        else: # video
            if quality == 'best':
                ydl_opts['format'] = 'bestvideo+bestaudio/best'
            else:
                h = int(quality) if quality.isdigit() else 720
                ydl_opts['format'] = f"bestvideo[height<={h}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<={h}]+bestaudio/best[height<={h}]/best"
            
            ydl_opts['merge_output_format'] = 'mp4'
            final_ext = 'mp4'

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Find produced file
        files = [f for f in os.listdir(task_dir) if not f.endswith('.part') and not f.endswith('.ytdl')]
        if not files:
            raise Exception("No media file was output by the download engine.")
        
        file_path = os.path.join(task_dir, files[0])

        # Optional Trimming Step with FFmpeg
        sec_start = parse_time_to_seconds(trim_start)
        sec_end = parse_time_to_seconds(trim_end)

        if (sec_start is not None and sec_start > 0) or (sec_end is not None and sec_end > 0):
            with tasks_lock:
                tasks[task_id]['percent'] = 96
                tasks[task_id]['message'] = f"Trimming clip from {trim_start or '00:00'} to {trim_end or 'End'}..."
            
            trimmed_filename = f"{clean_title}_trimmed.{final_ext}"
            trimmed_path = os.path.join(task_dir, trimmed_filename)

            cmd = [FFMPEG_PATH, '-y']
            if sec_start is not None and sec_start > 0:
                cmd.extend(['-ss', str(sec_start)])
            cmd.extend(['-i', file_path])
            if sec_end is not None and sec_end > 0:
                duration_to_cut = sec_end - (sec_start or 0)
                if duration_to_cut > 0:
                    cmd.extend(['-t', str(duration_to_cut)])
            
            if download_type == 'audio':
                cmd.extend(['-c:a', 'copy', trimmed_path])
            else:
                cmd.extend(['-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac', trimmed_path])
            
            trim_proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if trim_proc.returncode == 0 and os.path.exists(trimmed_path) and os.path.getsize(trimmed_path) > 1000:
                try:
                    os.remove(file_path)
                except Exception:
                    pass
                file_path = trimmed_path
                display_name = trimmed_filename
            else:
                display_name = f"{clean_title}.{final_ext}"
        else:
            display_name = f"{clean_title}.{final_ext}"

        with tasks_lock:
            tasks[task_id]['status'] = 'ready'
            tasks[task_id]['percent'] = 100
            tasks[task_id]['message'] = 'Ready! Click below to save your file.'
            tasks[task_id]['file_path'] = file_path
            tasks[task_id]['file_name'] = display_name
            tasks[task_id]['file_size'] = format_size(os.path.getsize(file_path))

    except Exception as e:
        with tasks_lock:
            tasks[task_id]['status'] = 'failed'
            tasks[task_id]['error'] = str(e)
            tasks[task_id]['message'] = f"Download error: {str(e)}"


@app.route('/api/download/start', methods=['POST'])
def start_download():
    data = request.get_json() or {}
    url = data.get('url', '').strip()
    download_type = data.get('type', 'video')
    quality = str(data.get('quality', '720'))
    title = data.get('title', 'Media Download')
    trim_start = data.get('trim_start')
    trim_end = data.get('trim_end')

    if not url or not is_valid_url(url):
        return jsonify({'error': 'Valid media URL required.'}), 400

    task_id = str(uuid.uuid4())
    
    with tasks_lock:
        tasks[task_id] = {
            'id': task_id,
            'status': 'starting',
            'percent': 0,
            'speed': '',
            'eta': '',
            'message': 'Starting download job...',
            'file_path': None,
            'file_name': None,
            'file_size': None,
            'error': None,
            'created_at': time.time()
        }

    worker = threading.Thread(
        target=download_worker,
        args=(task_id, url, download_type, quality, title, trim_start, trim_end),
        daemon=True
    )
    worker.start()

    return jsonify({'task_id': task_id})


@app.route('/api/download/status/<task_id>', methods=['GET'])
def get_download_status(task_id):
    with tasks_lock:
        task = tasks.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found or expired.'}), 404
        return jsonify({
            'status': task['status'],
            'percent': task['percent'],
            'speed': task.get('speed', ''),
            'eta': task.get('eta', ''),
            'message': task.get('message', ''),
            'file_name': task.get('file_name'),
            'file_size': task.get('file_size'),
            'error': task.get('error'),
            'download_url': f"http://{LOCAL_IP}:5000/api/download/file/{task_id}"
        })


@app.route('/api/download/file/<task_id>', methods=['GET'])
def serve_download_file(task_id):
    """
    Stream file directly to the user's browser Downloads folder.
    As soon as the last chunk is streamed, the temp file in OS Temp is INSTANTLY deleted!
    ZERO BYTES stored on your system!
    """
    with tasks_lock:
        task = tasks.get(task_id)
        if not task:
            abort(404, description="Download session expired or not found.")
        file_path = task.get('file_path')
        file_name = task.get('file_name', 'media_download.mp4')

    if not file_path or not os.path.exists(file_path):
        abort(404, description="Downloaded file not found or already purged.")

    file_size = os.path.getsize(file_path)

    def generate_and_purge():
        try:
            with open(file_path, 'rb') as f:
                while True:
                    chunk = f.read(65536) # 64KB chunks
                    if not chunk:
                        break
                    yield chunk
        finally:
            # Instant Auto-Delete after delivery!
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                parent_dir = os.path.dirname(file_path)
                if os.path.exists(parent_dir) and parent_dir != TEMP_BASE:
                    shutil.rmtree(parent_dir, ignore_errors=True)
                with tasks_lock:
                    if task_id in tasks:
                        del tasks[task_id]
                print(f"[AUTO-PURGED] Instantly deleted temp file for task {task_id}: 0 bytes remain on disk.")
            except Exception as e:
                print(f"[PURGE ERROR] {e}")

    # Set content disposition to save directly to user's computer Downloads
    headers = {
        'Content-Disposition': f'attachment; filename="{file_name}"',
        'Content-Length': str(file_size),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
    }

    return Response(
        generate_and_purge(),
        mimetype='application/octet-stream',
        headers=headers
    )


@app.route('/api/download/thumbnail', methods=['GET'])
def download_thumbnail():
    thumb_url = request.args.get('url', '').strip()
    title = request.args.get('title', 'thumbnail').strip()
    if not thumb_url:
        abort(400, description="Thumbnail URL required")

    clean_title = sanitize_filename(title)
    try:
        req = urllib.request.Request(
            thumb_url,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
            ext = 'jpg'
            content_type = resp.headers.get('Content-Type', 'image/jpeg')
            if 'png' in content_type:
                ext = 'png'
            elif 'webp' in content_type:
                ext = 'webp'
            
            return Response(
                data,
                mimetype=content_type,
                headers={
                    'Content-Disposition': f'attachment; filename="{clean_title}_cover.{ext}"'
                }
            )
    except Exception as e:
        abort(500, description=f"Failed to fetch thumbnail: {str(e)}")


if __name__ == '__main__':
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass
    print("==================================================================")
    print(" [TUBEGRAB ZERO-STORAGE] Server Running at: http://127.0.0.1:5000")
    print(f" [TEMP LOCATION] {TEMP_BASE} (Outside source code)")
    print(" [STORAGE POLICY] Zero storage in project. Instant auto-purge on download.")
    port = int(os.environ.get('PORT', 5000))
    print(f" [TUBEGRAB] Listening on 0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
