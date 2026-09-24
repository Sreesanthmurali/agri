/**
 * MIT BG REMOVER - Client Application Engine
 * Mahaguru Institute of Technology
 * In-Browser Client-Side AI Matting & Biometric ID Card Studio
 */

import { createIcons, icons } from 'lucide';
import JSZip from 'jszip';
import { removeBackgroundClient, initMattingEngine } from './mattingEngine.js';
import { autoDetectBiometricCrop } from './biometricCrop.js';
import './style.css';

// Application State
let stagedFiles = [];
let processedItems = new Map(); // filename -> item state
let currentBgMode = 'transparent';
let customHex = '#0052cc';
let activeFilter = 'all';
let cardsMap = new Map();
let activePreset = 'passport_size';
let isProcessing = false;
let isCancelled = false;

// Recropper Interactive State
let recropFilename = null;
let recropAspectLock = 35 / 45;
let recropNormalizedBox = [0.10, 0.05, 0.80, 0.90]; // [x, y, w, h] normalized 0..1

// DOM Elements
const uploadSection = document.getElementById('uploadSection');
const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const btnBrowseFiles = document.getElementById('btnBrowseFiles');
const btnBrowseFolder = document.getElementById('btnBrowseFolder');

const configSection = document.getElementById('configSection');
const stagedCountBadge = document.getElementById('stagedCountBadge');
const btnClearStaged = document.getElementById('btnClearStaged');
const btnStartBatch = document.getElementById('btnStartBatch');
const btnStartBatchText = document.getElementById('btnStartBatchText');
const readySummaryText = document.getElementById('readySummaryText');

// Tabs
const tabMattingBtn = document.getElementById('tabMattingBtn');
const tabCropperBtn = document.getElementById('tabCropperBtn');
const tabMattingContent = document.getElementById('tabMattingContent');
const tabCropperContent = document.getElementById('tabCropperContent');

// Model & Controls
const modelSelect = document.getElementById('modelSelect');
const modelStatusBadge = document.getElementById('modelStatusBadge');
const modelDescText = document.getElementById('modelDescText');
const namingRuleSelect = document.getElementById('namingRuleSelect');
const formatSelect = document.getElementById('formatSelect');
const customColorPicker = document.getElementById('customColorPicker');

// Dimension Controls
const cropEnableToggle = document.getElementById('cropEnableToggle');
const inputCropW = document.getElementById('inputCropW');
const inputCropH = document.getElementById('inputCropH');
const selectCropUnit = document.getElementById('selectCropUnit');
const selectCropDpi = document.getElementById('selectCropDpi');
const specOutputPx = document.getElementById('specOutputPx');
const specAspect = document.getElementById('specAspect');
const specDpi = document.getElementById('specDpi');

// Live Progress and Bulk Downloads
const progressSection = document.getElementById('progressSection');
const statusBadge = document.getElementById('statusBadge');
const currentFileText = document.getElementById('currentFileText');
const progressBar = document.getElementById('progressBar');
const progressPercentLabel = document.getElementById('progressPercentLabel');
const progressCountLabel = document.getElementById('progressCountLabel');
const statCompleted = document.getElementById('statCompleted');
const statSpeed = document.getElementById('statSpeed');
const statEta = document.getElementById('statEta');
const statFailed = document.getElementById('statFailed');
const btnDownloadZip = document.getElementById('btnDownloadZip');
const btnDownloadPhotos = document.getElementById('btnDownloadPhotos');
const btnCancelBatch = document.getElementById('btnCancelBatch');

// Gallery
const gallerySection = document.getElementById('gallerySection');
const galleryGrid = document.getElementById('galleryGrid');
const searchFilter = document.getElementById('searchFilter');
const filterAll = document.getElementById('filterAll');
const filterDone = document.getElementById('filterDone');
const filterFailed = document.getElementById('filterFailed');
const countFilterAll = document.getElementById('countFilterAll');
const countFilterDone = document.getElementById('countFilterDone');
const countFilterFailed = document.getElementById('countFilterFailed');

// Explicit Recrop Modal Elements
const recropModal = document.getElementById('recropModal');
const recropModalFileName = document.getElementById('recropModalFileName');
const recropCloseBtn = document.getElementById('recropCloseBtn');
const recropStageContainer = document.getElementById('recropStageContainer');
const recropImg = document.getElementById('recropImg');
const recropOverlayBox = document.getElementById('recropOverlayBox');
const recropCaliperLabel = document.getElementById('recropCaliperLabel');
const btnRecropAspectPassport = document.getElementById('btnRecropAspectPassport');
const btnRecropAspectSquare = document.getElementById('btnRecropAspectSquare');
const btnRecropAspectFree = document.getElementById('btnRecropAspectFree');
const btnRecropAutoCenter = document.getElementById('btnRecropAutoCenter');
const btnRecropCancel = document.getElementById('btnRecropCancel');
const btnRecropSave = document.getElementById('btnRecropSave');
const btnRecropSaveText = document.getElementById('btnRecropSaveText');
const recropBgGrid = document.getElementById('recropBgGrid');
const recropBgWhite = document.getElementById('recropBgWhite');
const recropBgBlue = document.getElementById('recropBgBlue');

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
  createIcons({ icons });
  setupEventListeners();
  setupDragAndDrop();
  setupInteractiveRecropper();
  recalculateDimensions();

  // Pre-warm matting engine in background
  initMattingEngine((p) => {
    if (p.status === 'progress' && p.total) {
      const pct = Math.round((p.loaded / p.total) * 100);
      modelStatusBadge.textContent = `Loading ${pct}%`;
    } else if (p.status === 'done') {
      modelStatusBadge.textContent = 'Ready ✅';
      modelStatusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200';
    }
  }).then(() => {
    modelStatusBadge.textContent = 'Ready ✅';
    modelStatusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200';
  }).catch((err) => {
    console.warn('Engine background init notice:', err);
  });
});

function setupEventListeners() {
  btnBrowseFiles.addEventListener('click', () => fileInput.click());
  btnBrowseFolder.addEventListener('click', () => folderInput.click());

  fileInput.addEventListener('change', (e) => handleFileSelection(Array.from(e.target.files)));
  folderInput.addEventListener('change', (e) => handleFileSelection(Array.from(e.target.files)));

  btnClearStaged.addEventListener('click', resetApp);
  btnCancelBatch.addEventListener('click', cancelBatch);

  // Bulk Downloads
  btnDownloadZip.addEventListener('click', downloadAllZip);
  btnDownloadPhotos.addEventListener('click', downloadAllIndividualPhotos);

  // Tab Switchers
  tabMattingBtn.addEventListener('click', () => switchTab('matting'));
  tabCropperBtn.addEventListener('click', () => switchTab('cropper'));

  // Background Options
  document.querySelectorAll('.bg-opt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bg-opt-btn').forEach((b) => {
        b.classList.remove('active', 'border-terracotta-600', 'bg-terracotta-50', 'text-terracotta-700', 'font-semibold');
        b.classList.add('border-slate-200', 'bg-white', 'text-slate-700');
      });
      btn.classList.add('active', 'border-terracotta-600', 'bg-terracotta-50', 'text-terracotta-700', 'font-semibold');
      btn.classList.remove('border-slate-200', 'bg-white', 'text-slate-700');
      currentBgMode = btn.dataset.bg;
      if (currentBgMode === 'custom') customColorPicker.click();
    });
  });

  customColorPicker.addEventListener('input', (e) => {
    customHex = e.target.value;
  });

  // Simplified Presets (Passport & Custom)
  document.querySelectorAll('#presetGrid .preset-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('#presetGrid .preset-card').forEach((c) => {
        c.classList.remove('active');
      });
      card.classList.add('active');
      activePreset = card.dataset.preset;

      if (activePreset === 'passport_size') {
        inputCropW.value = '35';
        inputCropH.value = '45';
        selectCropUnit.value = 'mm';
        selectCropDpi.value = '300';
      }
      recalculateDimensions();
    });
  });

  // Dimension Inputs
  inputCropW.addEventListener('input', () => {
    markCustomPreset();
    recalculateDimensions();
  });
  inputCropH.addEventListener('input', () => {
    markCustomPreset();
    recalculateDimensions();
  });
  selectCropUnit.addEventListener('change', recalculateDimensions);
  selectCropDpi.addEventListener('change', recalculateDimensions);

  // Batch Execution
  btnStartBatch.addEventListener('click', startBatchProcessing);

  // Search & Filtering
  searchFilter.addEventListener('input', applyFilter);
  filterAll.addEventListener('click', () => setFilter('all'));
  filterDone.addEventListener('click', () => setFilter('done'));
  filterFailed.addEventListener('click', () => setFilter('error'));

  // Recropper Modal Controls
  recropCloseBtn.addEventListener('click', closeRecropModal);
  btnRecropCancel.addEventListener('click', closeRecropModal);
  btnRecropSave.addEventListener('click', saveRecrop);
  btnRecropAutoCenter.addEventListener('click', recropAutoCenterFace);

  btnRecropAspectPassport.addEventListener('click', () => setRecropAspect(35 / 45, 'passport'));
  btnRecropAspectSquare.addEventListener('click', () => setRecropAspect(1.0, 'square'));
  btnRecropAspectFree.addEventListener('click', () => setRecropAspect(null, 'free'));

  // Recropper Background switchers
  recropBgGrid.addEventListener('click', () => setRecropStageBg('grid'));
  recropBgWhite.addEventListener('click', () => setRecropStageBg('white'));
  recropBgBlue.addEventListener('click', () => setRecropStageBg('blue'));
}

function switchTab(tab) {
  if (tab === 'matting') {
    tabMattingBtn.classList.add('active', 'bg-terracotta-600', 'text-white');
    tabMattingBtn.classList.remove('text-slate-600');
    tabCropperBtn.classList.remove('active', 'bg-terracotta-600', 'text-white');
    tabCropperBtn.classList.add('text-slate-600');

    tabMattingContent.classList.remove('hidden');
    tabCropperContent.classList.add('hidden');
  } else {
    tabCropperBtn.classList.add('active', 'bg-terracotta-600', 'text-white');
    tabCropperBtn.classList.remove('text-slate-600');
    tabMattingBtn.classList.remove('active', 'bg-terracotta-600', 'text-white');
    tabMattingBtn.classList.add('text-slate-600');

    tabCropperContent.classList.remove('hidden');
    tabMattingContent.classList.add('hidden');
  }
}

function markCustomPreset() {
  document.querySelectorAll('#presetGrid .preset-card').forEach((c) => {
    if (c.dataset.preset === 'custom') {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });
  activePreset = 'custom';
}

function recalculateDimensions() {
  const w = parseFloat(inputCropW.value) || 35;
  const h = parseFloat(inputCropH.value) || 45;
  const unit = selectCropUnit.value;
  const dpi = parseInt(selectCropDpi.value) || 300;

  let pxW = 0;
  let pxH = 0;

  if (unit === 'mm') {
    pxW = Math.round((w / 25.4) * dpi);
    pxH = Math.round((h / 25.4) * dpi);
  } else if (unit === 'in') {
    pxW = Math.round(w * dpi);
    pxH = Math.round(h * dpi);
  } else {
    pxW = Math.round(w);
    pxH = Math.round(h);
  }

  specOutputPx.textContent = `${pxW} × ${pxH} px`;
  specAspect.textContent = `${w} : ${h} (${(w / h).toFixed(2)})`;
  specDpi.textContent = `${dpi} DPI`;

  updateSummary();
}

function updateSummary() {
  const count = stagedFiles.length;
  const cropText = cropEnableToggle.checked ? `${inputCropW.value}×${inputCropH.value}${selectCropUnit.value} ID Crop` : 'Full Bounds';
  readySummaryText.textContent = `${count} Photos • BRIA RMBG-1.4 (In-Browser AI) • ${cropText}`;
}

// --- Drag & Drop ---

function setupDragAndDrop() {
  ['dragenter', 'dragover'].forEach((ev) => {
    uploadSection.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadSection.classList.add('dropzone-active');
    });
  });

  ['dragleave', 'drop'].forEach((ev) => {
    uploadSection.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadSection.classList.remove('dropzone-active');
    });
  });

  uploadSection.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      handleFileSelection(Array.from(dt.files));
    }
  });
}

// --- File Selection ---

function handleFileSelection(files) {
  const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
  const validFiles = files.filter((f) => {
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    return validExts.includes(ext);
  });

  if (validFiles.length === 0) {
    alert('Please select valid student image files (JPG, PNG, WEBP).');
    return;
  }

  stagedFiles = validFiles;
  stagedCountBadge.textContent = `${stagedFiles.length} photos ready`;
  configSection.classList.remove('hidden');
  updateSummary();
}

// --- Batch Execution ---

async function startBatchProcessing() {
  if (stagedFiles.length === 0) {
    alert('Please stage at least one image first.');
    return;
  }

  isProcessing = true;
  isCancelled = false;
  btnStartBatch.disabled = true;
  btnStartBatchText.textContent = 'Initializing In-Browser AI...';

  const w = parseFloat(inputCropW.value) || 35;
  const h = parseFloat(inputCropH.value) || 45;
  const unit = selectCropUnit.value;
  const dpi = parseInt(selectCropDpi.value) || 300;

  let targetW = 413;
  let targetH = 531;
  if (unit === 'mm') {
    targetW = Math.round((w / 25.4) * dpi);
    targetH = Math.round((h / 25.4) * dpi);
  } else if (unit === 'in') {
    targetW = Math.round(w * dpi);
    targetH = Math.round(h * dpi);
  } else {
    targetW = Math.round(w);
    targetH = Math.round(h);
  }

  const isCropEnabled = cropEnableToggle.checked;
  const isSuffix = namingRuleSelect.value === 'suffix_nobg';
  const outFormat = formatSelect.value; // 'png' or 'jpg'

  // Show progress and gallery
  configSection.classList.add('hidden');
  progressSection.classList.remove('hidden');
  gallerySection.classList.remove('hidden');

  cardsMap.clear();
  processedItems.clear();
  galleryGrid.innerHTML = '';

  stagedFiles.forEach((file) => createOrUpdateCard(file.name, { status: 'queued' }));

  const total = stagedFiles.length;
  let completed = 0;
  let failed = 0;
  const startTime = Date.now();

  btnDownloadZip.disabled = true;
  btnDownloadPhotos.disabled = true;

  for (let i = 0; i < total; i++) {
    if (isCancelled) break;

    const file = stagedFiles[i];
    currentFileText.textContent = `Processing (${i + 1}/${total}): ${file.name}`;
    createOrUpdateCard(file.name, { status: 'processing' });

    const itemStart = Date.now();
    try {
      // 1. Remove background via client AI model
      const cutoutCanvas = await removeBackgroundClient(file);

      // 2. Apply biometric face crop
      let finalCanvas;
      let finalCropBox = [0, 0, 1, 1];

      if (isCropEnabled) {
        const crop = autoDetectBiometricCrop(cutoutCanvas, targetW / targetH, 0.10);
        finalCropBox = crop.normalized;

        finalCanvas = document.createElement('canvas');
        finalCanvas.width = targetW;
        finalCanvas.height = targetH;
        const ctx = finalCanvas.getContext('2d');

        if (currentBgMode !== 'transparent') {
          ctx.fillStyle = currentBgMode === 'white' ? '#FFFFFF' : (currentBgMode === 'passport_blue' ? '#0052cc' : customHex);
          ctx.fillRect(0, 0, targetW, targetH);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(cutoutCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, targetW, targetH);
      } else {
        finalCanvas = cutoutCanvas;
      }

      // 3. Generate Blob & data URL
      const mime = outFormat === 'jpg' && currentBgMode !== 'transparent' ? 'image/jpeg' : 'image/png';
      const ext = mime === 'image/jpeg' ? '.jpg' : '.png';
      const stem = cleanStem(file.name);
      const outName = `${stem}${isSuffix ? '_nobg' : ''}${ext}`;

      const blob = await new Promise((resolve) => finalCanvas.toBlob(resolve, mime, 0.95));
      const blobUrl = URL.createObjectURL(blob);
      const duration = ((Date.now() - itemStart) / 1000).toFixed(2);
      const sizeKb = Math.round(blob.size / 1024);

      const itemData = {
        file,
        originalCanvas: cutoutCanvas,
        finalCanvas,
        blob,
        blobUrl,
        outputFilename: outName,
        dimensions: `${finalCanvas.width}×${finalCanvas.height}`,
        duration,
        sizeKb,
        status: 'done',
        cropBox: finalCropBox,
        targetW,
        targetH,
        dpi,
      };

      processedItems.set(file.name, itemData);
      completed++;
      createOrUpdateCard(file.name, itemData);
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err);
      failed++;
      createOrUpdateCard(file.name, { status: 'error', error: err.message });
    }

    // Update progress indicators
    const percent = Math.round(((completed + failed) / total) * 100);
    progressBar.style.width = `${percent}%`;
    progressPercentLabel.textContent = `${percent}%`;
    progressCountLabel.textContent = `${completed + failed} / ${total} images`;
    statCompleted.textContent = completed;
    statFailed.textContent = failed;

    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > 0) {
      const speed = (completed + failed) / elapsed;
      statSpeed.innerHTML = `${speed.toFixed(1)} <span class="text-xs font-normal text-slate-500">img/s</span>`;
      const rem = total - (completed + failed);
      statEta.textContent = speed > 0 ? `${Math.round(rem / speed)}s` : '--';
    }
  }

  isProcessing = false;
  if (!isCancelled) {
    statusBadge.textContent = 'Batch Completed ✅';
    statusBadge.className = 'px-3 py-1 text-xs font-mono font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
    btnDownloadZip.disabled = false;
    btnDownloadPhotos.disabled = false;
  }
}

function cancelBatch() {
  isCancelled = true;
  statusBadge.textContent = 'Stopped ⛔';
  statusBadge.className = 'px-3 py-1 text-xs font-mono font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-300';
}

function cleanStem(filename) {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(0, lastDot) : filename;
}

// --- Dynamic Student Cards ---

function createOrUpdateCard(filename, item) {
  let card = cardsMap.get(filename);
  const isDone = item.status === 'done';
  const isError = item.status === 'error';
  const isProc = item.status === 'processing';

  if (!card) {
    card = document.createElement('div');
    card.className = 'student-card bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between';
    card.dataset.filename = filename;
    card.dataset.status = item.status || 'queued';

    card.innerHTML = `
      <div class="relative aspect-[35/45] bg-transparency-grid overflow-hidden flex items-center justify-center border-b border-slate-100">
        <img class="card-img w-full h-full object-contain block hidden" src="" alt="${filename}" />
        <div class="card-spinner absolute inset-0 bg-white/80 flex items-center justify-center">
          <div class="w-5 h-5 border-2 border-terracotta-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
      <div class="p-3 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold font-mono text-slate-900 truncate max-w-[130px]" title="${filename}">
            ${filename}
          </span>
          <span class="card-status-pill text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            Queued
          </span>
        </div>
        <div class="card-meta flex justify-between text-[10px] text-slate-500 font-mono">
          <span>--</span>
          <span>--</span>
        </div>
        <div class="flex items-center space-x-1.5 pt-1">
          <button class="btn-card-recrop flex-1 px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition flex items-center justify-center space-x-1">
            <i data-lucide="crop" class="w-3.5 h-3.5"></i>
            <span>Recrop</span>
          </button>
          <a class="btn-card-dl px-2.5 py-1.5 rounded-lg bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 border border-terracotta-200 text-[11px] font-semibold transition flex items-center justify-center" href="#" download title="Download Photo">
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
          </a>
        </div>
      </div>
    `;

    galleryGrid.appendChild(card);
    cardsMap.set(filename, card);
    createIcons({ root: card, icons });

    // Recrop click
    card.querySelector('.btn-card-recrop').addEventListener('click', () => {
      openRecropModal(filename);
    });
  }

  const imgEl = card.querySelector('.card-img');
  const spinnerEl = card.querySelector('.card-spinner');
  const pillEl = card.querySelector('.card-status-pill');
  const metaEl = card.querySelector('.card-meta');
  const dlBtn = card.querySelector('.btn-card-dl');

  card.dataset.status = item.status || 'queued';

  if (isDone) {
    spinnerEl.classList.add('hidden');
    imgEl.classList.remove('hidden');
    imgEl.src = item.blobUrl;
    pillEl.textContent = 'DONE';
    pillEl.className = 'card-status-pill text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200';
    metaEl.innerHTML = `<span>${item.dimensions}</span><span>${item.duration}s</span>`;
    dlBtn.href = item.blobUrl;
    dlBtn.download = item.outputFilename;
  } else if (isError) {
    spinnerEl.classList.add('hidden');
    pillEl.textContent = 'ERR';
    pillEl.className = 'card-status-pill text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200';
    metaEl.innerHTML = `<span class="text-rose-600 truncate" title="${item.error}">Error</span>`;
  } else if (isProc) {
    spinnerEl.classList.remove('hidden');
    pillEl.textContent = 'ACTIVE';
    pillEl.className = 'card-status-pill text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200';
  }

  applyFilter();
  updateFilterCounts();
}

function updateFilterCounts() {
  let done = 0;
  let failed = 0;
  cardsMap.forEach((card) => {
    if (card.dataset.status === 'done') done++;
    if (card.dataset.status === 'error') failed++;
  });
  countFilterAll.textContent = cardsMap.size;
  countFilterDone.textContent = done;
  countFilterFailed.textContent = failed;
}

function setFilter(f) {
  activeFilter = f;
  [filterAll, filterDone, filterFailed].forEach((btn) => {
    btn.classList.remove('active', 'bg-terracotta-600', 'text-white', 'font-semibold');
    btn.classList.add('text-slate-600');
  });
  if (f === 'all') filterAll.classList.add('active', 'bg-terracotta-600', 'text-white', 'font-semibold');
  if (f === 'done') filterDone.classList.add('active', 'bg-terracotta-600', 'text-white', 'font-semibold');
  if (f === 'error') filterFailed.classList.add('active', 'bg-terracotta-600', 'text-white', 'font-semibold');
  applyFilter();
}

function applyFilter() {
  const query = searchFilter.value.toLowerCase().trim();
  cardsMap.forEach((card, filename) => {
    const status = card.dataset.status;
    const matchesSearch = filename.toLowerCase().includes(query);
    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'done' && status === 'done') ||
      (activeFilter === 'error' && status === 'error');

    if (matchesSearch && matchesFilter) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
}

// --- Bulk Downloads ---

async function downloadAllZip() {
  if (processedItems.size === 0) return;
  btnDownloadZip.disabled = true;
  const oldText = btnDownloadZip.innerHTML;
  btnDownloadZip.innerHTML = 'Creating ZIP...';

  try {
    const zip = new JSZip();
    processedItems.forEach((item) => {
      if (item.blob && item.outputFilename) {
        zip.file(item.outputFilename, item.blob);
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `student_photos_mit_${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    alert(`Could not create zip: ${err.message}`);
  } finally {
    btnDownloadZip.disabled = false;
    btnDownloadZip.innerHTML = oldText;
  }
}

async function downloadAllIndividualPhotos() {
  if (processedItems.size === 0) return;
  btnDownloadPhotos.disabled = true;
  const oldText = btnDownloadPhotos.innerHTML;
  btnDownloadPhotos.innerHTML = 'Downloading...';

  const items = Array.from(processedItems.values());
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.blobUrl && item.outputFilename) {
      const link = document.createElement('a');
      link.href = item.blobUrl;
      link.download = item.outputFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  btnDownloadPhotos.disabled = false;
  btnDownloadPhotos.innerHTML = oldText;
}

// --- Interactive Recropper Logic ---

function setupInteractiveRecropper() {
  let isDragging = false;
  let isResizing = false;
  let activeHandle = null;
  let startX = 0;
  let startY = 0;
  let startBox = [0, 0, 0, 0];

  recropOverlayBox.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('crop-resize-handle')) return;
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startBox = getPixelBox();
  });

  recropOverlayBox.querySelectorAll('.crop-resize-handle').forEach((handle) => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      activeHandle = handle.dataset.handle;
      startX = e.clientX;
      startY = e.clientY;
      startBox = getPixelBox();
    });
  });

  window.addEventListener('mousemove', (e) => {
    if (!recropModal.classList.contains('hidden')) {
      if (isDragging) {
        handleBoxDrag(e.clientX - startX, e.clientY - startY, startBox);
      } else if (isResizing) {
        handleBoxResize(e.clientX - startX, e.clientY - startY, startBox, activeHandle);
      }
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDragging || isResizing) {
      isDragging = false;
      isResizing = false;
      activeHandle = null;
      updateNormalizedBoxFromPixels();
    }
  });
}

function getPixelBox() {
  const containerRect = recropStageContainer.getBoundingClientRect();
  const boxRect = recropOverlayBox.getBoundingClientRect();
  return [
    boxRect.left - containerRect.left,
    boxRect.top - containerRect.top,
    boxRect.width,
    boxRect.height,
  ];
}

function handleBoxDrag(dx, dy, initialBox) {
  const [ix, iy, iw, ih] = initialBox;
  const cw = recropStageContainer.clientWidth;
  const ch = recropStageContainer.clientHeight;

  let nx = Math.max(0, Math.min(cw - iw, ix + dx));
  let ny = Math.max(0, Math.min(ch - ih, iy + dy));

  setPixelBox(nx, ny, iw, ih);
}

function handleBoxResize(dx, dy, initialBox, handle) {
  const [ix, iy, iw, ih] = initialBox;
  const cw = recropStageContainer.clientWidth;
  const ch = recropStageContainer.clientHeight;

  let newX = ix;
  let newY = iy;
  let newW = iw;
  let newH = ih;

  if (handle === 'se') {
    newW = Math.max(40, Math.min(cw - ix, iw + dx));
    if (recropAspectLock) {
      newH = newW / recropAspectLock;
      if (iy + newH > ch) {
        newH = ch - iy;
        newW = newH * recropAspectLock;
      }
    } else {
      newH = Math.max(40, Math.min(ch - iy, ih + dy));
    }
  } else if (handle === 'sw') {
    const right = ix + iw;
    newW = Math.max(40, Math.min(right, iw - dx));
    newX = right - newW;
    if (recropAspectLock) {
      newH = newW / recropAspectLock;
      if (iy + newH > ch) {
        newH = ch - iy;
        newW = newH * recropAspectLock;
        newX = right - newW;
      }
    } else {
      newH = Math.max(40, Math.min(ch - iy, ih + dy));
    }
  } else if (handle === 'ne') {
    const bottom = iy + ih;
    newW = Math.max(40, Math.min(cw - ix, iw + dx));
    if (recropAspectLock) {
      newH = newW / recropAspectLock;
      newY = bottom - newH;
      if (newY < 0) {
        newY = 0;
        newH = bottom;
        newW = newH * recropAspectLock;
      }
    } else {
      newH = Math.max(40, Math.min(bottom, ih - dy));
      newY = bottom - newH;
    }
  } else if (handle === 'nw') {
    const right = ix + iw;
    const bottom = iy + ih;
    newW = Math.max(40, Math.min(right, iw - dx));
    newX = right - newW;
    if (recropAspectLock) {
      newH = newW / recropAspectLock;
      newY = bottom - newH;
      if (newY < 0) {
        newY = 0;
        newH = bottom;
        newW = newH * recropAspectLock;
        newX = right - newW;
      }
    } else {
      newH = Math.max(40, Math.min(bottom, ih - dy));
      newY = bottom - newH;
    }
  }

  setPixelBox(newX, newY, newW, newH);
}

function setPixelBox(x, y, w, h) {
  recropOverlayBox.style.left = `${x}px`;
  recropOverlayBox.style.top = `${y}px`;
  recropOverlayBox.style.width = `${w}px`;
  recropOverlayBox.style.height = `${h}px`;

  updateCaliperLabel(w, h);
}

function updateCaliperLabel(pixelW, pixelH) {
  const cw = recropStageContainer.clientWidth;
  const nw = recropImg.naturalWidth || 1;
  const scale = nw / cw;
  const actualPxW = Math.round(pixelW * scale);
  const actualPxH = Math.round(pixelH * scale);

  const mmW = Math.round((actualPxW / 300) * 25.4);
  const mmH = Math.round((actualPxH / 300) * 25.4);

  recropCaliperLabel.textContent = `${mmW}×${mmH} mm (${actualPxW}×${actualPxH} px)`;
}

function updateNormalizedBoxFromPixels() {
  const cw = recropStageContainer.clientWidth;
  const ch = recropStageContainer.clientHeight;
  const [x, y, w, h] = getPixelBox();

  recropNormalizedBox = [
    Math.max(0, x / cw),
    Math.max(0, y / ch),
    Math.min(1, w / cw),
    Math.min(1, h / ch),
  ];
}

function openRecropModal(filename) {
  const item = processedItems.get(filename);
  if (!item || !item.originalCanvas) {
    alert('Source cutout not ready for this image.');
    return;
  }

  recropFilename = filename;
  recropModalFileName.textContent = filename;

  // Convert canvas to data URL to display in recropImg
  recropImg.onload = () => {
    const cw = recropStageContainer.clientWidth;
    const ch = recropStageContainer.clientHeight;

    const boxW = cw * 0.72;
    const boxH = boxW / (35 / 45);
    const boxX = (cw - boxW) / 2;
    const boxY = Math.max(10, (ch - boxH) * 0.12);

    setPixelBox(boxX, boxY, boxW, Math.min(ch - boxY, boxH));
    updateNormalizedBoxFromPixels();
  };

  recropImg.src = item.originalCanvas.toDataURL('image/png');
  recropModal.classList.remove('hidden');
}

function closeRecropModal() {
  recropModal.classList.add('hidden');
}

function setRecropAspect(ratio, presetName) {
  recropAspectLock = ratio;
  [btnRecropAspectPassport, btnRecropAspectSquare, btnRecropAspectFree].forEach((b) => {
    b.className = 'px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium hover:bg-slate-200';
  });

  if (presetName === 'passport') {
    btnRecropAspectPassport.className = 'px-2.5 py-1 rounded-md bg-terracotta-50 text-terracotta-700 border border-terracotta-300 font-semibold';
  } else if (presetName === 'square') {
    btnRecropAspectSquare.className = 'px-2.5 py-1 rounded-md bg-terracotta-50 text-terracotta-700 border border-terracotta-300 font-semibold';
  } else {
    btnRecropAspectFree.className = 'px-2.5 py-1 rounded-md bg-terracotta-50 text-terracotta-700 border border-terracotta-300 font-semibold';
  }

  if (ratio) {
    const [x, y, w] = getPixelBox();
    const ch = recropStageContainer.clientHeight;
    const newH = w / ratio;
    setPixelBox(x, y, w, Math.min(ch - y, newH));
    updateNormalizedBoxFromPixels();
  }
}

function recropAutoCenterFace() {
  const cw = recropStageContainer.clientWidth;
  const ch = recropStageContainer.clientHeight;
  const ratio = recropAspectLock || (35 / 45);

  const boxW = cw * 0.72;
  const boxH = boxW / ratio;
  const boxX = (cw - boxW) / 2;
  const boxY = Math.max(10, ch * 0.08);

  setPixelBox(boxX, boxY, boxW, Math.min(ch - boxY, boxH));
  updateNormalizedBoxFromPixels();
}

function setRecropStageBg(bg) {
  recropStageContainer.classList.remove('bg-transparency-grid', 'bg-white', 'bg-blue-600');
  if (bg === 'white') {
    recropStageContainer.classList.add('bg-white');
  } else if (bg === 'blue') {
    recropStageContainer.classList.add('bg-blue-600');
  } else {
    recropStageContainer.classList.add('bg-transparency-grid');
  }
}

async function saveRecrop() {
  const item = processedItems.get(recropFilename);
  if (!item || !item.originalCanvas) return;

  btnRecropSave.disabled = true;
  btnRecropSaveText.textContent = 'Recropping...';

  const [bx, by, bw, bh] = recropNormalizedBox;
  const src = item.originalCanvas;
  const sx = Math.max(0, Math.round(bx * src.width));
  const sy = Math.max(0, Math.round(by * src.height));
  const sw = Math.min(src.width - sx, Math.round(bw * src.width));
  const sh = Math.min(src.height - sy, Math.round(bh * src.height));

  const targetW = item.targetW || 413;
  const targetH = item.targetH || 531;

  const cropped = document.createElement('canvas');
  cropped.width = targetW;
  cropped.height = targetH;
  const ctx = cropped.getContext('2d');

  if (currentBgMode !== 'transparent') {
    ctx.fillStyle = currentBgMode === 'white' ? '#FFFFFF' : (currentBgMode === 'passport_blue' ? '#0052cc' : customHex);
    ctx.fillRect(0, 0, targetW, targetH);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, targetW, targetH);

  const mime = formatSelect.value === 'jpg' && currentBgMode !== 'transparent' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise((resolve) => cropped.toBlob(resolve, mime, 0.95));
  const blobUrl = URL.createObjectURL(blob);

  item.finalCanvas = cropped;
  item.blob = blob;
  item.blobUrl = blobUrl;
  item.dimensions = `${targetW}×${targetH}`;
  item.cropBox = recropNormalizedBox;

  // Refresh card
  createOrUpdateCard(recropFilename, item);

  closeRecropModal();
  btnRecropSave.disabled = false;
  btnRecropSaveText.textContent = 'Save Crop & Update Card';
}

function resetApp() {
  stagedFiles = [];
  processedItems.clear();
  cardsMap.clear();
  galleryGrid.innerHTML = '';
  configSection.classList.add('hidden');
  progressSection.classList.add('hidden');
  gallerySection.classList.add('hidden');
  fileInput.value = '';
  folderInput.value = '';
}
