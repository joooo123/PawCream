/* PawCream offline Instax mini-tool. Chrome 61 / ES2017, no network calls. */
(function () {
  'use strict';

  var layouts = {
    portrait: { file: './assets/pink-portrait.webp', count: 1 },
    wide: { file: './assets/pink-wide.webp', count: 1 },
    four: { file: './assets/pink-four.webp', count: 4 }
  };
  var canvas = document.getElementById('preview');
  var ctx = canvas.getContext && canvas.getContext('2d');
  var picker = document.getElementById('photoPicker');
  var slotsEl = document.getElementById('slotButtons');
  var countEl = document.getElementById('count');
  var hintEl = document.getElementById('previewHint');
  var statusEl = document.getElementById('status');
  var zoom = document.getElementById('zoom');
  var zoomValue = document.getElementById('zoomValue');
  var saveButton = document.getElementById('saveButton');
  var shareButton = document.getElementById('shareButton');
  var layoutButtons = Array.prototype.slice.call(document.querySelectorAll('[data-layout]'));
  var state = {
    key: 'portrait', image: null, slots: [], photos: [], active: 0,
    width: 0, height: 0, dragging: null, loading: false
  };

  function status(message) { statusEl.textContent = message; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function bridge() { return window.xhs && window.xhs.miniTool; }
  function ready() {
    return !!(state.image && state.slots.length === layouts[state.key].count &&
      state.photos.length === state.slots.length &&
      state.photos.every(function (item) { return !!(item && item.image); }));
  }
  function updateActionState() {
    var ok = ready();
    saveButton.disabled = !ok;
    shareButton.disabled = !ok;
    countEl.textContent = '已选择 ' + state.photos.filter(function (p) { return !!p; }).length +
      ' / ' + layouts[state.key].count;
    var current = state.photos[state.active];
    zoom.value = current ? current.zoom : 100;
    zoom.disabled = !current;
    zoomValue.textContent = zoom.value + '%';
  }

  function overlapRatio(left, right, otherLeft, otherRight) {
    return Math.max(0, Math.min(right, otherRight) - Math.max(left, otherLeft)) /
      Math.max(1, Math.min(right - left, otherRight - otherLeft));
  }

  // Reuse the same transparency-driven slot-detection approach as the PawCream
  // web Atelier. Never guess coordinates for decorative frame cutouts.
  function detectSlots(frame, count) {
    var scale = Math.min(1, 600 / frame.naturalWidth);
    var w = Math.max(1, Math.round(frame.naturalWidth * scale));
    var h = Math.max(1, Math.round(frame.naturalHeight * scale));
    var sample = document.createElement('canvas');
    sample.width = w;
    sample.height = h;
    var context = sample.getContext('2d');
    if (!context) throw new Error('当前设备不支持相纸预览');
    context.drawImage(frame, 0, 0, w, h);
    var data = context.getImageData(0, 0, w, h).data;
    var minSegment = Math.max(10, Math.round(w * 0.08));
    var parts = [];

    for (var y = 0; y < h; y++) {
      var segments = [];
      var start = -1;
      for (var x = 0; x <= w; x++) {
        var transparent = x < w && data[(y * w + x) * 4 + 3] <= 8;
        if (transparent && start < 0) start = x;
        if ((!transparent || x === w) && start >= 0) {
          if (x - start >= minSegment) segments.push({ left: start, right: x });
          start = -1;
        }
      }
      segments.forEach(function (segment) {
        var winner = -1;
        var score = 0;
        parts.forEach(function (part, index) {
          if (part.last !== y - 1) return;
          var overlap = overlapRatio(segment.left, segment.right, part.left, part.right);
          if (overlap > 0.45 && overlap > score) { winner = index; score = overlap; }
        });
        if (winner >= 0) {
          var part = parts[winner];
          part.left = Math.min(part.left, segment.left);
          part.right = Math.max(part.right, segment.right);
          part.bottom = y + 1;
          part.last = y;
          part.rows++;
        } else {
          parts.push({ left: segment.left, right: segment.right,
            top: y, bottom: y + 1, last: y, rows: 1 });
        }
      });
    }
    var minArea = w * h * 0.004;
    var found = parts.filter(function (p) {
      return (p.right - p.left) * (p.bottom - p.top) >= minArea &&
        p.rows >= Math.max(8, h * 0.03);
    }).map(function (p) {
      return { left: p.left / w, top: p.top / h,
        width: (p.right - p.left) / w, height: (p.bottom - p.top) / h,
        area: (p.right - p.left) * (p.bottom - p.top) };
    }).sort(function (a, b) { return b.area - a.area; }).slice(0, count)
      .sort(function (a, b) { return Math.abs(a.top - b.top) > 0.02 ?
        a.top - b.top : a.left - b.left; });
    if (found.length !== count) throw new Error('没有识别到正确的相纸格数，请切换相纸重试');
    return found;
  }

  function resetPhotos() {
    state.photos.forEach(function (p) {
      if (p && p.url && window.URL && URL.revokeObjectURL) URL.revokeObjectURL(p.url);
    });
    state.photos = [];
    state.active = 0;
  }

  function renderSlotButtons() {
    while (slotsEl.firstChild) slotsEl.removeChild(slotsEl.firstChild);
    for (var i = 0; i < layouts[state.key].count; i++) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'slot-button' + (state.active === i ? ' active' : '') +
        (state.photos[i] ? ' filled' : '');
      button.textContent = '第 ' + (i + 1) + ' 格 · ' + (state.photos[i] ? '换照片' : '选照片');
      button.setAttribute('aria-label', button.textContent);
      button.setAttribute('data-slot', String(i));
      button.addEventListener('click', function (event) {
        state.active = Number(event.currentTarget.getAttribute('data-slot'));
        renderSlotButtons();
        updateActionState();
        picker.click();
      });
      slotsEl.appendChild(button);
    }
  }

  function draw() {
    if (!ctx || !state.image) return;
    ctx.clearRect(0, 0, state.width, state.height);
    state.slots.forEach(function (slot, i) {
      var x = slot.left * state.width;
      var y = slot.top * state.height;
      var w = slot.width * state.width;
      var h = slot.height * state.height;
      // The decorated window has wavy translucent edges. The paper itself is
      // white, so a slightly overscanned backing avoids theme-colored leakage.
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - w * 0.02, y - h * 0.04, w * 1.04, h * 1.08);
      var photo = state.photos[i];
      if (!photo || !photo.image) return;
      var iw = photo.image.naturalWidth;
      var ih = photo.image.naturalHeight;
      var base = Math.max(w / iw, h / ih);
      var scaled = base * photo.zoom / 100;
      var dw = iw * scaled;
      var dh = ih * scaled;
      var cx = x + w / 2 + w * photo.dx / 100;
      var cy = y + h / 2 + h * photo.dy / 100;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.drawImage(photo.image, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
    });
    ctx.drawImage(state.image, 0, 0, state.width, state.height);
  }

  function setLayout(key) {
    if (!layouts[key] || !ctx) return;
    resetPhotos();
    state.key = key;
    state.image = null;
    state.slots = [];
    state.loading = true;
    layoutButtons.forEach(function (button) {
      var active = button.getAttribute('data-layout') === key;
      button.className = 'choice' + (active ? ' active' : '');
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    renderSlotButtons();
    updateActionState();
    status('正在准备相纸…');
    var img = new Image();
    img.onload = function () {
      if (state.key !== key) return;
      try {
        state.slots = detectSlots(img, layouts[key].count);
        state.image = img;
        var scale = Math.min(1, 1100 / img.naturalWidth);
        state.width = Math.round(img.naturalWidth * scale);
        state.height = Math.round(img.naturalHeight * scale);
        canvas.width = state.width;
        canvas.height = state.height;
        state.loading = false;
        draw();
        updateActionState();
        hintEl.textContent = '点击照片格选图片，选好后可以拖动调整';
        status('照片仅在当前设备内处理，不会上传 PawCream 服务器。');
      } catch (error) {
        state.loading = false;
        status(error.message || '相纸加载失败');
      }
    };
    img.onerror = function () { state.loading = false; status('相纸素材加载失败，请重新选择'); };
    img.src = layouts[key].file;
  }

  function acceptPhoto(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { status('请选择图片文件'); return; }
    if (file.size > 15 * 1024 * 1024) { status('单张照片请不要超过 15MB'); return; }
    var slot = state.active;
    var image = new Image();
    var objectUrl = window.URL && URL.createObjectURL ? URL.createObjectURL(file) : null;
    var reader;
    image.onload = function () {
      if (state.photos[slot] && state.photos[slot].url && URL.revokeObjectURL) {
        URL.revokeObjectURL(state.photos[slot].url);
      }
      state.photos[slot] = { image: image, url: objectUrl, zoom: 100, dx: 0, dy: 0 };
      renderSlotButtons();
      draw();
      updateActionState();
      status('照片已经放好啦 ♡ 还可以拖动位置或调整缩放。');
    };
    image.onerror = function () {
      if (objectUrl && URL.revokeObjectURL) URL.revokeObjectURL(objectUrl);
      status('这张图片无法读取，请换一张试试');
    };
    if (objectUrl) image.src = objectUrl;
    else {
      reader = new FileReader();
      reader.onload = function () { image.src = String(reader.result); };
      reader.onerror = function () { status('读取照片失败'); };
      reader.readAsDataURL(file);
    }
  }

  function startDrag(event) {
    if (!state.image || !state.photos[state.active] || !state.slots[state.active]) return;
    var rectangle = canvas.getBoundingClientRect();
    var sx = (event.clientX - rectangle.left) / rectangle.width;
    var sy = (event.clientY - rectangle.top) / rectangle.height;
    var slot = state.slots[state.active];
    if (sx < slot.left || sx > slot.left + slot.width ||
        sy < slot.top || sy > slot.top + slot.height) return;
    var photo = state.photos[state.active];
    state.dragging = {
      x: event.clientX, y: event.clientY,
      dx: photo.dx, dy: photo.dy, index: state.active
    };
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  }
  function moveDrag(event) {
    var drag = state.dragging;
    if (!drag || !state.photos[drag.index]) return;
    event.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var slot = state.slots[drag.index];
    var photo = state.photos[drag.index];
    photo.dx = clamp(drag.dx + (event.clientX - drag.x) / (rect.width * slot.width) * 100, -40, 40);
    photo.dy = clamp(drag.dy + (event.clientY - drag.y) / (rect.height * slot.height) * 100, -40, 40);
    draw();
  }
  function stopDrag() { state.dragging = null; }

  async function localMediaPath(data) {
    var mini = bridge();
    if (!mini) throw new Error('请在小红书客户端内使用本功能');
    if (typeof mini.writeTempFile === 'function') {
      var result = await mini.writeTempFile({ data: data });
      if (result && result.filePath) return result.filePath;
    }
    return data;
  }
  async function save() {
    if (!ready()) return;
    saveButton.disabled = true;
    try {
      var data = canvas.toDataURL('image/png');
      var mini = bridge();
      if (mini && typeof mini.saveImageToPhotosAlbum === 'function') {
        var path = await localMediaPath(data);
        await mini.saveImageToPhotosAlbum({ filePath: path });
        status('已保存到系统相册 ♡');
      } else {
        // PC browser preview fallback, not claimed to work inside XHS WebView.
        var a = document.createElement('a');
        a.href = data;
        a.download = 'pawcream-instax.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        status('已尝试下载图片。正式保存请在小红书客户端中操作。');
      }
    } catch (error) {
      status('保存失败：' + (error && error.errMsg || error.message || '请检查相册权限'));
    } finally {
      updateActionState();
    }
  }
  async function share() {
    if (!ready()) return;
    shareButton.disabled = true;
    try {
      var mini = bridge();
      if (!mini || typeof mini.postNote !== 'function') {
        status('笔记发布需要在小红书客户端内打开工具。');
        return;
      }
      var path = await localMediaPath(canvas.toDataURL('image/png'));
      await mini.postNote({
        title: '我的 PawCream 小相纸',
        content: '把今天装进拍立得 ♡',
        pageType: 'photo_publish',
        mediaInfo: { image_resources: [{ url: path }] }
      });
      status('已打开笔记编辑页，请在小红书里确认发布。');
    } catch (error) {
      status('打开笔记编辑页失败：' + (error && error.errMsg || error.message || '请稍后重试'));
    } finally {
      updateActionState();
    }
  }

  if (!ctx) {
    status('当前设备不支持 Canvas，无法生成拍立得');
    saveButton.disabled = true;
    shareButton.disabled = true;
    return;
  }
  layoutButtons.forEach(function (button) {
    button.addEventListener('click', function () { setLayout(button.getAttribute('data-layout')); });
  });
  picker.addEventListener('change', function () {
    acceptPhoto(picker.files && picker.files[0]);
    picker.value = '';
  });
  zoom.addEventListener('input', function () {
    var current = state.photos[state.active];
    if (!current) return;
    current.zoom = Number(zoom.value);
    zoomValue.textContent = zoom.value + '%';
    draw();
  });
  canvas.addEventListener('pointerdown', startDrag);
  canvas.addEventListener('pointermove', moveDrag);
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);
  saveButton.addEventListener('click', save);
  shareButton.addEventListener('click', share);
  window.addEventListener('pagehide', function () { resetPhotos(); });
  setLayout('portrait');
}());
