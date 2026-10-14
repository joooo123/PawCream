/* PawCream offline studio navigation. No network or account data is used. */
(function () {
  'use strict';
  var views = ['make', 'account', 'tin', 'notes', 'gallery'];
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-view]'));
  var guide = document.getElementById('websiteGuide');
  var dismissGuide = document.getElementById('closeWebsiteGuide');
  var accountStage = document.getElementById('typewriterStage');
  var typewriterArt = document.getElementById('typewriterArt');
  var typewriterTitle = document.getElementById('typewriterTitle');
  var accountAction = document.getElementById('accountAction');
  var loginFields = document.getElementById('loginFields');
  var registerFields = document.getElementById('registerFields');
  var lastGuideTrigger = null;

  function showView(name) {
    if (views.indexOf(name) < 0) return;
    views.forEach(function (key) {
      var panel = document.getElementById(key + 'View');
      if (panel) panel.hidden = key !== name;
    });
    tabs.forEach(function (tab) {
      var active = tab.getAttribute('data-view') === name;
      tab.className = 'studio-tab' + (active ? ' active' : '');
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () { showView(tab.getAttribute('data-view')); });
  });

  Array.prototype.slice.call(document.querySelectorAll('[data-tab-target]')).forEach(function (button) {
    button.addEventListener('click', function () { showView(button.getAttribute('data-tab-target')); });
  });

  Array.prototype.slice.call(document.querySelectorAll('[data-account-mode]')).forEach(function (button) {
    button.addEventListener('click', function () {
      var register = button.getAttribute('data-account-mode') === 'register';
      accountStage.className = 'typewriter-stage ' + (register ? 'is-register' : 'is-login');
      typewriterArt.src = register ? './assets/register-typewriter.webp' : './assets/login-typewriter.webp';
      typewriterArt.alt = register ? 'PawCream 原站长纸注册打字机' : 'PawCream 原站淡蓝波点打字机';
      typewriterTitle.textContent = register ? '注册 PawCream ♡' : '欢迎回来 ♡';
      accountAction.textContent = register ? '前往工作室注册' : '前往工作室登录';
      registerFields.hidden = !register;
      loginFields.hidden = register;
      Array.prototype.slice.call(document.querySelectorAll('[data-account-mode]')).forEach(function (other) {
        var active = other === button;
        other.className = 'account-mode' + (active ? ' active' : '');
        other.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    });
  });

  Array.prototype.slice.call(document.querySelectorAll('[data-notes-scope]')).forEach(function (button) {
    button.addEventListener('click', function () {
      var mine = button.getAttribute('data-notes-scope') === 'mine';
      document.getElementById('notesSample').hidden = mine;
      document.getElementById('myNotesEmpty').hidden = !mine;
      Array.prototype.slice.call(document.querySelectorAll('[data-notes-scope]')).forEach(function (other) {
        var active = other === button;
        other.className = 'notes-tab' + (active ? ' active' : '');
        other.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    });
  });

  var hero = document.getElementById('galleryHero');
  var caption = document.getElementById('galleryCaption');
  var galleryTiles = Array.prototype.slice.call(document.querySelectorAll('[data-gallery-src]'));
  function previewTile(tile) {
    if (!tile) return;
    var file = tile.getAttribute('data-gallery-src');
    hero.src = file;
    hero.alt = tile.querySelector('img').alt + '示意';
    caption.textContent = tile.getAttribute('data-gallery-caption');
    galleryTiles.forEach(function (button) {
      var active = button === tile;
      button.className = 'gallery-tile' + (active ? ' active' : '');
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  galleryTiles.forEach(function (button) {
    button.addEventListener('click', function () { previewTile(button); });
    button.addEventListener('mouseenter', function () { previewTile(button); });
  });

  function openGuide(event) {
    lastGuideTrigger = event && event.currentTarget;
    guide.hidden = false;
    dismissGuide.focus();
  }
  function closeGuide() {
    guide.hidden = true;
    if (lastGuideTrigger && lastGuideTrigger.focus) lastGuideTrigger.focus();
  }
  Array.prototype.slice.call(document.querySelectorAll('[data-show-website]')).forEach(function (button) {
    button.addEventListener('click', openGuide);
  });
  dismissGuide.addEventListener('click', closeGuide);
  guide.addEventListener('click', function (event) {
    if (event.target === guide) closeGuide();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !guide.hidden) closeGuide();
  });
}());
