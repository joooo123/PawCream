/* PawCream XHS audio-capability probe: only procedural Web Audio, no media files. */
(function () {
  'use strict';
  var AudioClass = window.AudioContext || window.webkitAudioContext;
  var ctx = null;
  var active = [];
  var log = document.getElementById('log');
  var latest = '尚未点击';
  function state() {
    return 'AudioContext: ' + (AudioClass ? '已提供' : '不可用') +
      '\\n状态: ' + (ctx ? ctx.state : '尚未创建') +
      '\\n最近操作: ' + latest +
      '\\n浏览器: ' + navigator.userAgent;
  }
  function show(message) {
    if (message) latest = message;
    log.textContent = state();
  }
  function stop() {
    while (active.length) {
      var node = active.pop();
      try { node.stop(); } catch (e) { /* already ended */ }
      try { node.disconnect(); } catch (e2) { /* already disconnected */ }
    }
  }
  function prepare(label) {
    if (!AudioClass) { show(label + '：不支持 AudioContext'); return null; }
    try {
      if (!ctx || ctx.state === 'closed') {
        ctx = new AudioClass();
        ctx.onstatechange = function () { show(); };
      }
      stop();
      // Called from a real click: unlocking audio may require this user gesture.
      var resumed = ctx.resume();
      if (resumed && typeof resumed.catch === 'function') {
        resumed.catch(function (err) { show(label + '：resume 拒绝：' + err.message); });
      }
      return ctx;
    } catch (err) {
      show(label + '：创建失败：' + err.message);
      return null;
    }
  }
  function chimeOscillator() {
    var c = prepare('A');
    if (!c) return;
    try {
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(660, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(880, c.currentTime + 0.45);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + 1.05);
      active.push(o);
      show('A 已提交播放请求（请确认耳朵实际听到声音）');
    } catch (err) { show('A 失败：' + err.message); }
  }
  function chimeBuffer() {
    var c = prepare('B');
    if (!c) return;
    try {
      var rate = c.sampleRate;
      var duration = 1.8;
      var frames = Math.ceil(rate * duration);
      var buffer = c.createBuffer(1, frames, rate);
      var data = buffer.getChannelData(0);
      var frequencies = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < frames; i++) {
        var t = i / rate;
        var index = Math.min(3, Math.floor(t / 0.45));
        var local = t - index * 0.45;
        var envelope = Math.min(1, local / 0.018) * Math.exp(-9 * local);
        data[i] = 0.15 * envelope * Math.sin(2 * Math.PI * frequencies[index] * t);
      }
      var source = c.createBufferSource();
      source.buffer = buffer;
      source.connect(c.destination);
      source.start();
      active.push(source);
      show('B 已提交播放请求（请确认四个音符是否可听见）');
    } catch (err) { show('B 失败：' + err.message); }
  }
  document.getElementById('osc').addEventListener('click', chimeOscillator);
  document.getElementById('buffer').addEventListener('click', chimeBuffer);
  document.getElementById('stop').addEventListener('click', function () { stop(); show('已停止'); });
  show();
}());
