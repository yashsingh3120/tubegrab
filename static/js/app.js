/**
 * TubeGrab Universal - All-in-One Client-side Application
 * Supports Multi-platform detection, Video Trimming, QR Code Mobile Transfer,
 * Batch Downloads, HD Cover/Thumbnail Grabber, and Audio extraction (MP3, WAV, FLAC).
 */

// State Management
let currentVideoData = null;
let activePollInterval = null;
let activeTaskId = null;
let activePlatformFilter = 'all';
let qrCodeInstance = null;

// Platform Preset Samples & Placeholders
const PLATFORM_PRESETS = {
    all: {
        placeholder: "Paste any video or audio link (YouTube, Instagram, TikTok, Twitter/X, Reddit, etc.)",
        icon: "fa-solid fa-link",
        color: "#ff0033",
        samples: [
            { title: "YouTube Classic", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", icon: "fa-brands fa-youtube", color: "#ff0033" },
            { title: "First YouTube Video", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw", icon: "fa-brands fa-youtube", color: "#ff0033" }
        ]
    },
    youtube: {
        placeholder: "Paste YouTube Video or Shorts link (e.g. https://www.youtube.com/watch?v=...)",
        icon: "fa-brands fa-youtube",
        color: "#ff0033",
        samples: [
            { title: "Rick Astley - Never Gonna Give You Up", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", icon: "fa-brands fa-youtube", color: "#ff0033" },
            { title: "Me at the zoo", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw", icon: "fa-brands fa-youtube", color: "#ff0033" }
        ]
    },
    instagram: {
        placeholder: "Paste Instagram Reel or Post link (e.g. https://www.instagram.com/reel/...)",
        icon: "fa-brands fa-instagram",
        color: "#e1306c",
        samples: [
            { title: "Instagram Reel", url: "https://www.instagram.com/reel/C3_sample/", icon: "fa-brands fa-instagram", color: "#e1306c" }
        ]
    },
    tiktok: {
        placeholder: "Paste TikTok video link (e.g. https://www.tiktok.com/@user/video/...)",
        icon: "fa-brands fa-tiktok",
        color: "#00f2fe",
        samples: [
            { title: "TikTok Video", url: "https://www.tiktok.com/@tiktok/video/7106594312292453678", icon: "fa-brands fa-tiktok", color: "#00f2fe" }
        ]
    },
    twitter: {
        placeholder: "Paste Twitter / X video link (e.g. https://x.com/username/status/...)",
        icon: "fa-brands fa-x-twitter",
        color: "#1da1f2",
        samples: [
            { title: "X / Twitter Post", url: "https://x.com/Twitter/status/123456789", icon: "fa-brands fa-x-twitter", color: "#1da1f2" }
        ]
    },
    facebook: {
        placeholder: "Paste Facebook video or Reel link (e.g. https://www.facebook.com/watch/...)",
        icon: "fa-brands fa-facebook",
        color: "#1877f2",
        samples: [
            { title: "Facebook Watch", url: "https://www.facebook.com/watch/?v=10153231379946729", icon: "fa-brands fa-facebook", color: "#1877f2" }
        ]
    },
    reddit: {
        placeholder: "Paste Reddit post link (e.g. https://www.reddit.com/r/.../comments/...)",
        icon: "fa-brands fa-reddit",
        color: "#ff4500",
        samples: [
            { title: "Reddit Video", url: "https://www.reddit.com/r/NatureIsFuckingLit/comments/sample", icon: "fa-brands fa-reddit", color: "#ff4500" }
        ]
    },
    pinterest: {
        placeholder: "Paste Pinterest video pin link (e.g. https://pin.it/... or pinterest.com/pin/...)",
        icon: "fa-brands fa-pinterest",
        color: "#e60023",
        samples: [
            { title: "Pinterest Pin", url: "https://www.pinterest.com/pin/123456789/", icon: "fa-brands fa-pinterest", color: "#e60023" }
        ]
    },
    soundcloud: {
        placeholder: "Paste SoundCloud track link (e.g. https://soundcloud.com/artist/track)",
        icon: "fa-brands fa-soundcloud",
        color: "#ff5500",
        samples: [
            { title: "SoundCloud Music", url: "https://soundcloud.com/sample/track", icon: "fa-brands fa-soundcloud", color: "#ff5500" }
        ]
    }
};

// DOM Elements
const urlInput = document.getElementById('youtube-url-input');
const btnClear = document.getElementById('btn-clear');
const btnFetch = document.getElementById('btn-fetch');
const errorAlert = document.getElementById('error-alert');
const errorMessage = document.getElementById('error-message');
const skeletonLoader = document.getElementById('skeleton-loader');
const resultCard = document.getElementById('result-card');
const downloadProgressCard = document.getElementById('download-progress-card');
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');
const inputPlatformIcon = document.getElementById('input-platform-icon');
const quickSamplesBox = document.getElementById('quick-samples-box');

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initInputListeners();
    renderHistory();
    updateStorageStatus();
    initAdBlockDetector();
});

let isAdblockActive = false;

/**
 * Multi-layer AdBlock Detector
 */
async function initAdBlockDetector() {
    // Quick check
    setTimeout(async () => {
        if (await detectAdblock()) {
            showAdblockWall();
        }
    }, 400);

    // Follow-up verification check
    setTimeout(async () => {
        if (await detectAdblock()) {
            showAdblockWall();
        }
    }, 1200);
}

/**
 * Probe all common adblocking vectors (including external ad requests)
 */
async function detectAdblock() {
    // Check 1: Real external ad network probe (Adsterra)
    // Adblockers ALWAYS intercept and kill this request (ERR_BLOCKED_BY_CLIENT) even on localhost!
    try {
        const adUrl = 'https://www.highrevenueformat.com/b563263394476eceb4cc91b9ed72a5db/invoke.js?_=' + Date.now();
        await fetch(adUrl, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
    } catch (err) {
        return true;
    }

    // Check 2: Universal ad network probe (Google Syndication)
    try {
        const googleAdUrl = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?_=' + Date.now();
        await fetch(googleAdUrl, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
    } catch (err) {
        return true;
    }

    // Check 3: Invisible honeypot element
    const honeypot = document.getElementById('ad-honeypot');
    if (honeypot) {
        const style = window.getComputedStyle(honeypot);
        if (style.display === 'none' || style.visibility === 'hidden' || honeypot.offsetParent === null) {
            return true;
        }
    }

    // Check 4: Local bait script check
    if (typeof window.canRunAds === 'undefined' || window.canRunAds !== true) {
        return true;
    }

    return false;
}

/**
 * Display AdBlocker notice modal
 */
function showAdblockWall() {
    isAdblockActive = true;
    const modal = document.getElementById('adblock-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

/**
 * Re-check if user whitelisted the site
 */
async function recheckAdblock() {
    const btn = document.querySelector('.btn-adblock-refresh');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Verifying Whitelist...</span>';
    }

    // Probe again
    const stillBlocked = await detectAdblock();

    if (!stillBlocked) {
        isAdblockActive = false;
        const modal = document.getElementById('adblock-modal');
        if (modal) modal.style.display = 'none';
        showError("🎉 Thank you! AdBlock disabled. All Ultra HD download features unlocked.");
    } else {
        setTimeout(() => {
            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> <span>AdBlock Still Active • Click to Retry</span>';
            }
            showError("AdBlock is still active. Please pause your adblocker on astradev.tech and click retry.");
        }, 600);
    }
}

/**
 * Check and display storage status
 */
async function updateStorageStatus() {
    try {
        const res = await fetch('/api/storage-status');
        const data = await res.json();
        const badge = document.getElementById('cache-status-text');
        if (badge) {
            badge.textContent = `${data.temp_storage} Temp (0 MB in Code)`;
        }
    } catch (e) {
        // silent
    }
}

/**
 * Handle manual purge of temporary files
 */
async function handlePurgeCache() {
    try {
        const res = await fetch('/api/purge-cache', { method: 'POST' });
        const data = await res.json();
        const badge = document.getElementById('cache-status-text');
        if (badge) {
            badge.textContent = '0 MB Stored';
        }
        showError("🧹 Cache clean: All transient temporary files purged. 0 MB storage used.");
    } catch (e) {
        showError("Unable to purge cache.");
    }
}

/**
 * Theme Toggle (Light / Dark)
 */
function initTheme() {
    const savedTheme = localStorage.getItem('tubegrab_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('tubegrab_theme', nextTheme);
    updateThemeIcon(nextTheme);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    if (theme === 'light') {
        icon.className = 'fa-solid fa-moon';
    } else {
        icon.className = 'fa-solid fa-sun';
    }
}

/**
 * Setup input listeners for dynamic UI changes
 */
function initInputListeners() {
    urlInput.addEventListener('input', () => {
        const val = urlInput.value.trim();
        if (val.length > 0) {
            btnClear.classList.remove('btn-clear-hidden');
            detectAndStyleInputIcon(val);
        } else {
            btnClear.classList.add('btn-clear-hidden');
            resetInputIcon();
        }
    });

    urlInput.addEventListener('paste', () => {
        setTimeout(() => {
            const val = urlInput.value.trim();
            if (val.length > 0) {
                btnClear.classList.remove('btn-clear-hidden');
                detectAndStyleInputIcon(val);
            }
        }, 10);
    });
}

/**
 * Dynamically adjust icon on typing/pasting
 */
function detectAndStyleInputIcon(url) {
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
        inputPlatformIcon.innerHTML = '<i class="fa-brands fa-youtube" style="color:#ff0033;"></i>';
    } else if (lower.includes('instagram.com')) {
        inputPlatformIcon.innerHTML = '<i class="fa-brands fa-instagram" style="color:#e1306c;"></i>';
    } else if (lower.includes('tiktok.com')) {
        inputPlatformIcon.innerHTML = '<i class="fa-brands fa-tiktok" style="color:#00f2fe;"></i>';
    } else if (lower.includes('twitter.com') || lower.includes('x.com')) {
        inputPlatformIcon.innerHTML = '<i class="fa-brands fa-x-twitter" style="color:#1da1f2;"></i>';
    } else if (lower.includes('facebook.com') || lower.includes('fb.watch')) {
        inputPlatformIcon.innerHTML = '<i class="fa-brands fa-facebook" style="color:#1877f2;"></i>';
    } else if (lower.includes('reddit.com') || lower.includes('v.redd.it')) {
        inputPlatformIcon.innerHTML = '<i class="fa-brands fa-reddit" style="color:#ff4500;"></i>';
    } else if (lower.includes('pinterest.com') || lower.includes('pin.it')) {
        inputPlatformIcon.innerHTML = '<i class="fa-brands fa-pinterest" style="color:#e60023;"></i>';
    } else if (lower.includes('soundcloud.com')) {
        inputPlatformIcon.innerHTML = '<i class="fa-brands fa-soundcloud" style="color:#ff5500;"></i>';
    } else {
        inputPlatformIcon.innerHTML = '<i class="fa-solid fa-link"></i>';
    }
}

function resetInputIcon() {
    const preset = PLATFORM_PRESETS[activePlatformFilter] || PLATFORM_PRESETS.all;
    inputPlatformIcon.innerHTML = `<i class="${preset.icon}" style="color:${preset.color};"></i>`;
}

/**
 * Handle platform filter pill selection
 */
function selectPlatform(platformId, buttonElement) {
    activePlatformFilter = platformId;

    // Update active pill styling
    document.querySelectorAll('.platform-filter-pill').forEach(btn => btn.classList.remove('active'));
    if (buttonElement) {
        buttonElement.classList.add('active');
    }

    const preset = PLATFORM_PRESETS[platformId] || PLATFORM_PRESETS.all;
    urlInput.placeholder = preset.placeholder;
    resetInputIcon();

    // Update samples box
    renderQuickSamples(preset.samples);
    urlInput.focus();
}

function renderQuickSamples(samples) {
    if (!samples || samples.length === 0) return;
    quickSamplesBox.innerHTML = '<span class="samples-label"><i class="fa-solid fa-wand-magic-sparkles"></i> Try sample links:</span>';
    samples.forEach(s => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sample-tag';
        btn.innerHTML = `<i class="${s.icon}" style="color:${s.color};"></i> ${s.title}`;
        btn.onclick = () => loadSample(s.url);
        quickSamplesBox.appendChild(btn);
    });
}

/**
 * Switch between Single Video and Batch Mode
 */
function switchInputMode(mode) {
    const btnSingle = document.getElementById('btn-mode-single');
    const btnBatch = document.getElementById('btn-mode-batch');
    const singleForm = document.getElementById('fetch-form');
    const batchForm = document.getElementById('batch-form-wrapper');

    if (mode === 'single') {
        btnSingle.classList.add('active');
        btnBatch.classList.remove('active');
        singleForm.style.display = 'flex';
        batchForm.style.display = 'none';
        quickSamplesBox.style.display = 'flex';
    } else {
        btnBatch.classList.add('active');
        btnSingle.classList.remove('active');
        singleForm.style.display = 'none';
        batchForm.style.display = 'flex';
        quickSamplesBox.style.display = 'none';
    }
}

/**
 * Handle Paste from Clipboard
 */
async function handlePasteClipboard() {
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            if (text) {
                urlInput.value = text.trim();
                btnClear.classList.remove('btn-clear-hidden');
                detectAndStyleInputIcon(text);
                if (text.startsWith('http')) {
                    handleFetchVideo();
                }
            }
        } else {
            urlInput.focus();
            showError("Clipboard access blocked by browser. Please use Ctrl+V / Cmd+V.");
        }
    } catch (err) {
        urlInput.focus();
        showError("Please paste your link directly into the search field (Ctrl+V).");
    }
}

function handleClearInput() {
    urlInput.value = '';
    btnClear.classList.add('btn-clear-hidden');
    resetInputIcon();
    urlInput.focus();
}

function loadSample(url) {
    urlInput.value = url;
    btnClear.classList.remove('btn-clear-hidden');
    detectAndStyleInputIcon(url);
    handleFetchVideo();
}

function showError(msg) {
    errorMessage.textContent = msg || 'An unknown error occurred. Please check your link.';
    errorAlert.style.display = 'flex';
    errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function dismissError() {
    errorAlert.style.display = 'none';
}

function setFetchLoading(isLoading) {
    const btnText = btnFetch.querySelector('.btn-text');
    const btnSpinner = btnFetch.querySelector('.btn-spinner');
    
    if (isLoading) {
        btnFetch.disabled = true;
        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-flex';
        skeletonLoader.style.display = 'flex';
        resultCard.style.display = 'none';
        dismissError();
    } else {
        btnFetch.disabled = false;
        btnText.style.display = 'inline-flex';
        btnSpinner.style.display = 'none';
        skeletonLoader.style.display = 'none';
    }
}

/**
 * Fetch video details
 */
async function handleFetchVideo() {
    // Enforce AdBlock detection
    const blocked = await detectAdblock();
    if (blocked) {
        showAdblockWall();
        return;
    }

    const url = urlInput.value.trim();
    if (!url) {
        showError('Please paste a video or audio link first.');
        urlInput.focus();
        return;
    }

    setFetchLoading(true);

    try {
        const response = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to retrieve media information.');
        }

        currentVideoData = data;
        displayVideoInfo(data);

    } catch (err) {
        console.error('Fetch error:', err);
        showError(err.message || 'Unable to connect to the media server. Please verify the URL.');
    } finally {
        setFetchLoading(false);
    }
}

/**
 * Display video details & formats
 */
function displayVideoInfo(data) {
    document.getElementById('res-thumbnail').src = data.thumbnail || 'https://via.placeholder.com/640x360?text=No+Thumbnail';
    document.getElementById('res-duration').textContent = data.duration_formatted || '00:00';
    document.getElementById('res-title').textContent = data.title || 'Media Video';
    document.getElementById('res-uploader').textContent = data.uploader || 'Creator';
    
    const viewsWrap = document.getElementById('res-views-wrapper');
    if (data.views > 0) {
        document.getElementById('res-views').textContent = `${data.views_formatted} views`;
        viewsWrap.style.display = 'inline-flex';
    } else {
        viewsWrap.style.display = 'none';
    }
    
    const watchLink = document.getElementById('res-watch-link');
    watchLink.href = data.webpage_url || urlInput.value.trim();

    // Platform Badge
    const platformBadge = document.getElementById('res-platform-badge');
    const p = data.platform || { name: 'Web Media', icon: 'fa-solid fa-globe', color: '#ff0033' };
    platformBadge.innerHTML = `<i class="${p.icon}"></i> <span>${p.badge || p.name}</span>`;
    platformBadge.style.color = p.color;
    platformBadge.style.borderColor = p.color + '55';
    platformBadge.style.background = p.color + '1f';

    // Reset and initialize trimmer
    const trimStart = document.getElementById('trim-start');
    const trimEnd = document.getElementById('trim-end');
    trimStart.value = '00:00';
    trimEnd.value = data.duration_formatted && data.duration_formatted !== 'Unknown' ? data.duration_formatted : '01:00';
    validateTrim();

    // Render Video formats
    const videoList = document.getElementById('video-options-list');
    videoList.innerHTML = '';
    
    const videoOpts = data.video_options || [];
    document.getElementById('video-count').textContent = videoOpts.length;

    videoOpts.forEach(opt => {
        const row = document.createElement('div');
        row.className = 'format-row';

        let badgeClass = 'badge-standard';
        if (opt.quality === '2160') badgeClass = 'badge-4k';
        else if (opt.quality === '1080') badgeClass = 'badge-1080p';
        else if (opt.quality === '720') badgeClass = 'badge-720p';
        else if (opt.quality === 'best') badgeClass = 'badge-4k';

        row.innerHTML = `
            <div class="quality-col">
                <span class="quality-badge ${badgeClass}">${opt.badge || opt.quality + 'p'}</span>
                <div class="quality-info">
                    <span class="quality-title">${opt.label}</span>
                    <span class="quality-desc">${opt.description}</span>
                </div>
            </div>
            <div class="format-ext">${opt.format}</div>
            <div class="size-col">${opt.size || 'Estimate'}</div>
            <div class="action-col">
                <button type="button" class="btn-download-action" onclick="startDownloadProcess('video', '${opt.quality}', '${escapeHtml(data.title)}')">
                    <i class="fa-solid fa-arrow-down-to-line"></i>
                    <span>Download</span>
                </button>
            </div>
        `;
        videoList.appendChild(row);
    });

    // Render Audio formats
    const audioList = document.getElementById('audio-options-list');
    audioList.innerHTML = '';

    const audioOpts = data.audio_options || [];
    document.getElementById('audio-count').textContent = audioOpts.length;

    audioOpts.forEach(opt => {
        const row = document.createElement('div');
        row.className = 'format-row';

        row.innerHTML = `
            <div class="quality-col">
                <span class="quality-badge badge-audio">${opt.badge}</span>
                <div class="quality-info">
                    <span class="quality-title">${opt.label}</span>
                    <span class="quality-desc">${opt.description}</span>
                </div>
            </div>
            <div class="format-ext">${opt.format}</div>
            <div class="size-col">${opt.size || 'Estimate'}</div>
            <div class="action-col">
                <button type="button" class="btn-download-action" onclick="startDownloadProcess('audio', '${opt.quality}', '${escapeHtml(data.title)}')">
                    <i class="fa-solid fa-music"></i>
                    <span>Download</span>
                </button>
            </div>
        `;
        audioList.appendChild(row);
    });

    resultCard.style.display = 'block';
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Switch tabs between Video and Audio
 */
function switchFormatTab(tabName) {
    const tabVideo = document.getElementById('tab-video');
    const tabAudio = document.getElementById('tab-audio');
    const panelVideo = document.getElementById('panel-video');
    const panelAudio = document.getElementById('panel-audio');

    if (tabName === 'video') {
        tabVideo.classList.add('active');
        tabAudio.classList.remove('active');
        panelVideo.style.display = 'block';
        panelAudio.style.display = 'none';
    } else {
        tabAudio.classList.add('active');
        tabVideo.classList.remove('active');
        panelAudio.style.display = 'block';
        panelVideo.style.display = 'none';
    }
}

/**
 * Toggle Video Trimmer panel
 */
function toggleTrimmer() {
    const panel = document.getElementById('trimmer-panel');
    const label = document.getElementById('trimmer-toggle-label');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        label.textContent = 'Hide Trimmer';
    } else {
        panel.style.display = 'none';
        label.textContent = 'Trim / Cut Clip';
    }
}

function validateTrim() {
    const startVal = document.getElementById('trim-start').value.trim();
    const endVal = document.getElementById('trim-end').value.trim();
    const badge = document.getElementById('trim-summary-badge');
    badge.textContent = `Clip: ${startVal || '00:00'} to ${endVal || 'End'}`;
}

/**
 * Download High-Res Cover/Thumbnail
 */
function downloadCoverImage() {
    if (!currentVideoData || !currentVideoData.thumbnail) {
        showError("No thumbnail available for this link.");
        return;
    }
    const downloadUrl = `/api/download/thumbnail?url=${encodeURIComponent(currentVideoData.thumbnail)}&title=${encodeURIComponent(currentVideoData.title || 'thumbnail')}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${currentVideoData.title || 'thumbnail'}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Start asynchronous download job
 */
async function startDownloadProcess(downloadType, quality, title) {
    if (!currentVideoData) return;

    // Enforce AdBlock detection before downloading
    const blocked = await detectAdblock();
    if (blocked) {
        showAdblockWall();
        return;
    }

    if (activePollInterval) {
        clearInterval(activePollInterval);
        activePollInterval = null;
    }

    const headline = document.getElementById('progress-headline');
    const submessage = document.getElementById('progress-submessage');
    const number = document.getElementById('progress-number');
    const fill = document.getElementById('progress-bar-fill');
    const speed = document.getElementById('stat-speed');
    const eta = document.getElementById('stat-eta');
    const format = document.getElementById('stat-format');
    const readyBox = document.getElementById('download-ready-box');
    const iconBox = document.getElementById('progress-icon-box');

    // Check if trimmer is active
    let trimStart = null;
    let trimEnd = null;
    const trimmerPanel = document.getElementById('trimmer-panel');
    if (trimmerPanel && trimmerPanel.style.display !== 'none') {
        trimStart = document.getElementById('trim-start').value.trim();
        trimEnd = document.getElementById('trim-end').value.trim();
    }

    headline.textContent = downloadType === 'audio' ? 'Converting High Quality Audio...' : 'Preparing Video Download...';
    submessage.textContent = 'Connecting to media servers & analyzing streams...';
    number.textContent = '0';
    fill.style.width = '8%';
    speed.textContent = 'Connecting...';
    eta.textContent = 'Calculating...';
    format.textContent = downloadType === 'audio' ? quality.toUpperCase() : 'MP4';
    readyBox.style.display = 'none';
    iconBox.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin status-icon-spin"></i>';

    downloadProgressCard.style.display = 'block';
    downloadProgressCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
        const response = await fetch('/api/download/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: currentVideoData.webpage_url || urlInput.value.trim(),
                type: downloadType,
                quality: quality,
                title: currentVideoData.title,
                trim_start: trimStart,
                trim_end: trimEnd
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to initialize download task.');
        }

        activeTaskId = data.task_id;
        pollDownloadStatus(activeTaskId, downloadType, quality);

    } catch (err) {
        console.error('Download start error:', err);
        headline.textContent = 'Download Failed';
        submessage.textContent = err.message || 'Error occurred starting download.';
        fill.style.backgroundColor = '#ef4444';
        iconBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444"></i>';
    }
}

/**
 * Poll task status
 */
function pollDownloadStatus(taskId, downloadType, quality) {
    const headline = document.getElementById('progress-headline');
    const submessage = document.getElementById('progress-submessage');
    const number = document.getElementById('progress-number');
    const fill = document.getElementById('progress-bar-fill');
    const speed = document.getElementById('stat-speed');
    const eta = document.getElementById('stat-eta');
    const readyBox = document.getElementById('download-ready-box');
    const btnSave = document.getElementById('btn-save-file');
    const iconBox = document.getElementById('progress-icon-box');

    activePollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/download/status/${taskId}`);
            const data = await res.json();

            if (!res.ok) {
                clearInterval(activePollInterval);
                throw new Error(data.error || 'Task polling failed.');
            }

            const pct = data.percent || 0;
            number.textContent = pct;
            fill.style.width = `${Math.max(8, pct)}%`;
            
            if (data.speed) speed.textContent = data.speed;
            if (data.eta) eta.textContent = data.eta;
            if (data.message) submessage.textContent = data.message;

            if (data.status === 'ready') {
                clearInterval(activePollInterval);
                activePollInterval = null;

                number.textContent = '100';
                fill.style.width = '100%';
                headline.textContent = 'Download Ready!';
                submessage.textContent = `Your file (${data.file_size || 'Ready'}) is saved and ready.`;
                speed.textContent = 'Finished';
                eta.textContent = '00:00';
                
                iconBox.innerHTML = '<i class="fa-solid fa-circle-check" style="color: #34d399;"></i>';
                
                btnSave.href = `/api/download/file/${taskId}`;
                btnSave.setAttribute('download', data.file_name || 'download');
                readyBox.style.display = 'block';

                // Automatically trigger download
                btnSave.click();

                // Save to history
                saveToHistory({
                    title: currentVideoData.title,
                    thumbnail: currentVideoData.thumbnail,
                    format: downloadType === 'audio' ? `Audio ${quality.toUpperCase()}` : `${quality}p MP4`,
                    size: data.file_size || 'Ready',
                    date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });

            } else if (data.status === 'failed') {
                clearInterval(activePollInterval);
                activePollInterval = null;
                headline.textContent = 'Download Failed';
                submessage.textContent = data.error || 'The download could not be completed.';
                fill.style.backgroundColor = '#ef4444';
                iconBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444"></i>';
            }

        } catch (err) {
            console.error('Polling error:', err);
            clearInterval(activePollInterval);
            activePollInterval = null;
            headline.textContent = 'Connection Interrupted';
            submessage.textContent = 'Failed to poll download progress.';
        }
    }, 800);
}

/**
 * QR Code Mobile Transfer Modal
 */
function showQrModal() {
    if (!activeTaskId) return;

    const modal = document.getElementById('qr-modal');
    const qrBox = document.getElementById('qr-code-box');
    const urlDisplay = document.getElementById('qr-url-display');

    // Build URL using host IP so phones on the same network can access
    const hostIp = window.LOCAL_HOST_IP || window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const phoneDownloadUrl = `http://${hostIp}${port}/api/download/file/${activeTaskId}`;

    urlDisplay.value = phoneDownloadUrl;
    qrBox.innerHTML = '';

    try {
        if (typeof QRCode !== 'undefined') {
            qrCodeInstance = new QRCode(qrBox, {
                text: phoneDownloadUrl,
                width: 180,
                height: 180,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        } else {
            qrBox.innerHTML = `<a href="${phoneDownloadUrl}" target="_blank" style="color:#ff0033; font-weight:700;">Open Direct Link</a>`;
        }
    } catch (e) {
        qrBox.innerHTML = `<a href="${phoneDownloadUrl}" target="_blank" style="color:#ff0033; font-weight:700;">Open Direct Link</a>`;
    }

    modal.style.display = 'flex';
}

function closeQrModal(event) {
    if (event && event.target && event.target.closest('.modal-card') && !event.target.classList.contains('modal-close')) {
        return;
    }
    const modal = document.getElementById('qr-modal');
    modal.style.display = 'none';
}

function copyDownloadUrl() {
    const input = document.getElementById('qr-url-display');
    input.select();
    navigator.clipboard.writeText(input.value);
    const btn = document.querySelector('.btn-copy-url');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
}

/**
 * Handle Batch Download Mode
 */
async function handleBatchDownload() {
    const batchInput = document.getElementById('batch-urls-input');
    const lines = batchInput.value.split('\n').map(l => l.trim()).filter(l => l.length > 5);

    if (lines.length === 0) {
        showError("Please enter at least one URL to process.");
        return;
    }

    // Process the first URL directly in the main view
    switchInputMode('single');
    urlInput.value = lines[0];
    handleFetchVideo();

    showError(`Processing item 1 of ${lines.length}. You can queue the remaining links once finished.`);
}

/**
 * Reset view for new download
 */
function resetToNewDownload() {
    downloadProgressCard.style.display = 'none';
    resultCard.style.display = 'none';
    urlInput.value = '';
    btnClear.classList.add('btn-clear-hidden');
    resetInputIcon();
    urlInput.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * FAQ Accordion toggle
 */
function toggleFaq(button) {
    const item = button.closest('.faq-item');
    const isActive = item.classList.contains('active');
    document.querySelectorAll('.faq-item').forEach(el => el.classList.remove('active'));
    if (!isActive) item.classList.add('active');
}

/**
 * History Storage
 */
function saveToHistory(item) {
    try {
        let history = JSON.parse(localStorage.getItem('tubegrab_history') || '[]');
        history.unshift(item);
        history = history.slice(0, 5);
        localStorage.setItem('tubegrab_history', JSON.stringify(history));
        renderHistory();
    } catch (e) {
        console.warn('History storage unavailable:', e);
    }
}

function renderHistory() {
    try {
        const history = JSON.parse(localStorage.getItem('tubegrab_history') || '[]');
        if (!history || history.length === 0) {
            historySection.style.display = 'none';
            return;
        }

        historyList.innerHTML = '';
        history.forEach(item => {
            const el = document.createElement('div');
            el.className = 'history-item';
            el.innerHTML = `
                <div class="history-meta-left">
                    <img src="${item.thumbnail || ''}" alt="Thumbnail" class="history-thumb-mini">
                    <div>
                        <div class="history-item-title">${escapeHtml(item.title)}</div>
                        <div class="history-item-format">${item.format} • ${item.size} • ${item.date}</div>
                    </div>
                </div>
                <span class="badge-free" style="border:none; background:rgba(16,185,129,0.15); color:#34d399;">Downloaded</span>
            `;
            historyList.appendChild(el);
        });

        historySection.style.display = 'block';
    } catch (e) {
        historySection.style.display = 'none';
    }
}

function clearHistory() {
    localStorage.removeItem('tubegrab_history');
    renderHistory();
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/* ==========================================================================
   Interactive Tools Strip & Footer Links Controllers
   ========================================================================== */

/**
 * Scroll to tools toolbar
 */
function scrollToTools() {
    const el = document.getElementById('tools-toolbar');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Scroll to FAQ and expand first question
 */
function scrollToFaq() {
    const faq = document.getElementById('faq');
    if (faq) {
        faq.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const first = document.querySelector('.faq-item');
        if (first) first.classList.add('active');
    }
}

/**
 * Activate a platform from footer or pill
 */
function activatePlatform(platformId) {
    const downloader = document.getElementById('downloader');
    if (downloader) downloader.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Find matching pill button
    const pills = document.querySelectorAll('.platform-filter-pill');
    let matchedBtn = null;
    pills.forEach(p => {
        if (p.textContent.toLowerCase().includes(platformId.toLowerCase())) {
            matchedBtn = p;
        }
    });

    selectPlatform(platformId, matchedBtn);
}

/**
 * Activate specific tool from toolbar or footer
 */
function activateTool(toolName, btnElement) {
    // Update toolbar button states if provided
    if (btnElement) {
        document.querySelectorAll('.tool-quick-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    } else {
        const matchingBtn = document.getElementById(`tool-btn-${toolName}`);
        if (matchingBtn) {
            document.querySelectorAll('.tool-quick-btn').forEach(b => b.classList.remove('active'));
            matchingBtn.classList.add('active');
        }
    }

    const downloader = document.getElementById('downloader');

    switch (toolName) {
        case 'video':
            switchInputMode('single');
            if (downloader) downloader.scrollIntoView({ behavior: 'smooth', block: 'start' });
            urlInput.placeholder = "Paste video link here (YouTube, Instagram, TikTok, Twitter/X, Reddit, etc.)";
            urlInput.focus();
            if (currentVideoData) switchFormatTab('video');
            break;

        case 'mp3':
            switchInputMode('single');
            if (downloader) downloader.scrollIntoView({ behavior: 'smooth', block: 'start' });
            urlInput.placeholder = "Paste YouTube or audio link to convert to 320kbps MP3 Audio...";
            urlInput.focus();
            if (currentVideoData) switchFormatTab('audio');
            break;

        case 'trimmer':
            switchInputMode('single');
            if (downloader) downloader.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const trimmerPanel = document.getElementById('trimmer-panel');
            if (trimmerPanel) {
                trimmerPanel.style.display = 'block';
                const label = document.getElementById('trimmer-toggle-label');
                if (label) label.textContent = 'Hide Trimmer';
            }
            if (!currentVideoData) {
                urlInput.placeholder = "Paste video link, then trim any clip duration...";
                urlInput.focus();
            } else {
                trimmerPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            break;

        case 'thumbnail':
            switchInputMode('single');
            if (downloader) downloader.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (currentVideoData && currentVideoData.thumbnail) {
                downloadCoverImage();
            } else {
                urlInput.placeholder = "Paste video URL to fetch & download HD Cover / Thumbnail image...";
                urlInput.focus();
            }
            break;

        case 'batch':
            switchInputMode('batch');
            if (downloader) downloader.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const batchInput = document.getElementById('batch-urls-input');
            if (batchInput) batchInput.focus();
            break;

        case 'qr':
            if (activeTaskId) {
                showQrModal();
            } else {
                showQrInfoDemo();
            }
            break;
    }
}

/**
 * Show QR info demo modal when no active download exists
 */
function showQrInfoDemo() {
    const modal = document.getElementById('qr-modal');
    const qrBox = document.getElementById('qr-code-box');
    const urlDisplay = document.getElementById('qr-url-display');

    const hostIp = window.LOCAL_HOST_IP || window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const demoUrl = `http://${hostIp}${port}/#downloader`;

    urlDisplay.value = demoUrl;
    qrBox.innerHTML = '';

    try {
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrBox, {
                text: demoUrl,
                width: 180,
                height: 180,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    } catch (e) {
        qrBox.innerHTML = `<a href="${demoUrl}" target="_blank" style="color:#ff0033; font-weight:700;">Open on Mobile</a>`;
    }

    modal.style.display = 'flex';
}

/**
 * Privacy Policy Modal Controller
 */
function openPrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    if (modal) modal.style.display = 'flex';
}

function closePrivacyModal(event) {
    if (event && event.target && event.target.closest('.modal-card') && !event.target.classList.contains('modal-close')) {
        return;
    }
    const modal = document.getElementById('privacy-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Terms of Service Modal Controller
 */
function openTermsModal() {
    const modal = document.getElementById('terms-modal');
    if (modal) modal.style.display = 'flex';
}

function closeTermsModal(event) {
    if (event && event.target && event.target.closest('.modal-card') && !event.target.classList.contains('modal-close')) {
        return;
    }
    const modal = document.getElementById('terms-modal');
    if (modal) modal.style.display = 'none';
}
