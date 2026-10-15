/* Offline status display only; the original React layout remains unchanged. */
(function () {
  'use strict';
  var bar = document.getElementById('xhs-cloud-hint');
  var dismiss = document.getElementById('xhs-hint-dismiss');
  if (!bar || !dismiss) return;
  function show() { bar.hidden = false; }
  dismiss.addEventListener('click', function () { bar.hidden = true; });
  // Only warn when someone tries to use the public photo wall's online storage.
  // Private Instax creation and the session-only tin preview remain available.
  // Offline account forms must not submit credentials.
  document.addEventListener('submit', function (event) {
    if (event.target && event.target.closest && event.target.closest('.pawcream-signin-drop')) {
      event.preventDefault();
      event.stopPropagation();
      bar.hidden = true;
    }
  }, true);
  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest && event.target.closest('button');
    if (!button) return;
    var txt = (button.textContent || '').trim();
    if (button.closest('[aria-label*="公共照片墙"], [aria-label*="公共返图墙"]') ||
        /^(发布到公共|上传到公共|保存到公共|公开发布)/.test(txt)) show();
  }, true);
  // Prevent the embedded login form from accepting private passwords.
  var observer = new MutationObserver(function () {
    var dialog = document.querySelector('.pawcream-signin-drop');
    if (!dialog) return;
    var inputs = dialog.querySelectorAll('input[type="password"]');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].readOnly = true;
      inputs[i].setAttribute('aria-label', '离线演示，不接受密码');
    }
  });
  observer.observe(document.getElementById('root'), {childList:true,subtree:true});
}());
