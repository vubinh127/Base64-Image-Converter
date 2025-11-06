$(function () {
  const $ta = $('#base64input');
  const $fileInput = $('#fileInput');
  const $convertBtn = $('#convertBtn');
  const $previewArea = $('#previewArea');
  const $controls = $('#controls');
  const $downloadLink = $('#downloadLink');
  const $openTab = $('#openTab');
  const $clearBtn = $('#clearBtn');
  const $filenameEl = $('#filename');
  const $errorEl = $('#error');
  const $forceMime = $('#forceMime');
  const $dropzone = $('#dropzone');

  function showError(msg){
    $errorEl.text(msg).removeClass('hidden');
  }
  function clearError(){
    $errorEl.text('').addClass('hidden');
  }

  function base64ToUint8Array(b64) {
    try {
      const binary = atob(b64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    } catch (e) { return null; }
  }

  function detectMime(u8arr) {
    if (!u8arr || u8arr.length < 12) return null;
    if (u8arr[0]===0x89 && u8arr[1]===0x50 && u8arr[2]===0x4E && u8arr[3]===0x47) return 'image/png';
    if (u8arr[0]===0xFF && u8arr[1]===0xD8 && u8arr[2]===0xFF) return 'image/jpeg';
    if (u8arr[0]===0x47 && u8arr[1]===0x49 && u8arr[2]===0x46) return 'image/gif';
    if (u8arr[0]===0x52 && u8arr[1]===0x49 && u8arr[2]===0x46 && u8arr[3]===0x46 &&
        u8arr[8]===0x57 && u8arr[9]===0x45 && u8arr[10]===0x42 && u8arr[11]===0x50) return 'image/webp';
    return null;
  }

  function normalizeInput(text){
    if (!text) return null;
    text = text.trim();
    const dataUrlMatch = text.match(/^data:([\w\/\-\+\.]+);base64,(.+)$/i);
    if (dataUrlMatch) return { mime: dataUrlMatch[1], b64: dataUrlMatch[2] };
    const maybe = text.replace(/\s+/g,'');
    return { mime: null, b64: maybe };
  }

  function buildImageFromBase64(text) {
    clearError();
    const norm = normalizeInput(text);
    if (!norm || !norm.b64) { showError('Base64 data not found'); return null; }

    const u8 = base64ToUint8Array(norm.b64);
    if (!u8) { showError('Base64 data is invalid or too large to process'); return null; }

    let mime = $forceMime.val() || norm.mime || detectMime(u8) || 'image/png';
    const blob = new Blob([u8], { type: mime });
    const url = URL.createObjectURL(blob);
    return { blob, url, mime, u8 };
  }

  function sanitizeFilename(name){
    if (!name) return '';
    return name.replace(/[^a-z0-9_\-\.]/ig,'_');
  }
  function defaultFilenameForMime(mime){
    if (mime==='image/png') return 'image.png';
    if (mime==='image/jpeg') return 'image.jpg';
    if (mime==='image/gif') return 'image.gif';
    if (mime==='image/webp') return 'image.webp';
    return 'image.bin';
  }
  function formatBytes(bytes){
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1)+' KB';
    return (bytes/(1024*1024)).toFixed(2)+' MB';
  }

  function showPreview(result) {
    $previewArea.html('');
    if (!result) {
      $previewArea.html('<div class="info">No image yet</div>');
      $controls.addClass('hidden');
      return;
    }
    const img = $('<img class="preview-img">').attr('src', result.url).on('load',()=>{
      URL.revokeObjectURL(result.url);
    });
    $previewArea.append(img);

    $('#meta').text(`MIME: ${result.mime} · Size: ${formatBytes(result.blob.size)}`);
    $downloadLink.attr('href', result.url);
    const fn = sanitizeFilename($filenameEl.val()) || defaultFilenameForMime(result.mime);
    $downloadLink.attr('download', fn);
    $openTab.off('click').on('click', ()=> window.open(result.url,'_blank'));

    $controls.removeClass('hidden');
  }

  $convertBtn.on('click', function(){
    clearError();
    const text = $ta.val().trim();
    if (!text) { showError('Please paste base64 or select a .txt file containing base64'); return; }
    const result = buildImageFromBase64(text);
    if (result) showPreview(result);
  });

  $fileInput.on('change', function(){
    clearError();
    const f = this.files && this.files[0];
    if (!f) return;

    if (f.type && f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f);
      $previewArea.html(`<img class="preview-img" src="${url}">`);
      $('#meta').text(`MIME: ${f.type} · Size: ${formatBytes(f.size)}`);
      $downloadLink.attr({ href:url, download:(sanitizeFilename($filenameEl.val()) || f.name) });
      $controls.removeClass('hidden');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const text = (e.target.result || '').trim();
      if (!text) { showError('File is empty or does not contain base64'); return; }
      $ta.val(text);
      const result = buildImageFromBase64(text);
      if (result) showPreview(result);
    };
    reader.onerror = ()=> showError('Cannot read file');
    reader.readAsText(f);
  });

  $dropzone.on('dragover', e=>{
    e.preventDefault();
    $dropzone.css('border-color','#0b74ff');
  }).on('dragleave',()=>{
    $dropzone.css('border-color','#d6dbe3');
  }).on('drop', e=>{
    e.preventDefault();
    $dropzone.css('border-color','#d6dbe3');
    const f = e.originalEvent.dataTransfer.files[0];
    if (!f) return showError('Không tìm thấy file');
    $fileInput[0].files = e.originalEvent.dataTransfer.files;
    $fileInput.trigger('change');
  });

  $clearBtn.on('click', function(){
    $ta.val('');
    $fileInput.val('');
    $previewArea.html('<div class="info">No image yet</div>');
    $controls.addClass('hidden');
    clearError();
  });

  $ta.on('paste', function(){
    setTimeout(()=> {
      const text = $ta.val().trim();
      if (!text) return;
      const result = buildImageFromBase64(text);
      if (result) showPreview(result);
    }, 50);
  });

  $previewArea.html('<div class="info">No image yet</div>');
});


$(document).ready(function () {
  function fileToBase64(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  async function handleImage(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const base64 = await fileToBase64(file);
    $('#previewImage2').attr('src', base64);
    $('#base64output').val(base64);
  }

  $('#imgInput').on('change', function(){
    handleImage(this.files[0]);
  });

  $('#copyBtn').on('click', function(){
    const $t = $('#base64output');
    if (!$t.val().trim()) return alert("No Base64 to copy!");
    $t.select();
    navigator.clipboard.writeText($t.val());
    alert("Copied ✅");
  });

  $('#downloadTxt').on('click', function(){
    const base64 = $('#base64output').val().trim();
    if (!base64) return alert("No data to download!");
    const blob = new Blob([base64], {type:"text/plain"});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "image_base64.txt";
    link.click();
  });

  $('#clearImg').on('click', function(){
    $('#previewImage2').attr('src','');
    $('#base64output').val('');
    $('#imgInput').val('');
  });

  $('#dropZone2')
    .on('dragenter dragover', e=>{
      e.preventDefault();
      $('#dropZone2').addClass('dragover');
    })
    .on('dragleave', ()=> $('#dropZone2').removeClass('dragover'))
    .on('drop', e=>{
      e.preventDefault();
      $('#dropZone2').removeClass('dragover');
      handleImage(e.originalEvent.dataTransfer.files[0]);
    });

  $(document).on("paste", function(e){
    const item = [...e.originalEvent.clipboardData.items].find(i => i.type.indexOf("image") !== -1);
    if (item) handleImage(item.getAsFile());
  });

  $('#themeToggle').click(function() {
    $('body').toggleClass('dark-theme');
    if ($('body').hasClass('dark-theme')) {
      $(this).text('☀️ Light Mode');
    } else {
      $(this).text('🌙 Dark Mode');
    }
  });
});


