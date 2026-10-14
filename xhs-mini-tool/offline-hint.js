/* Offline status display only; the original React layout remains unchanged. */
(function () {
  'use strict';
  var bar = document.getElementById('xhs-cloud-hint');
  var dismiss = document.getElementById('xhs-hint-dismiss');
  if (!bar || !dismiss) return;
  function show() { bar.hidden = false; }
  dismiss.addEventListener('click', function () { bar.hidden = true; });
  // Show the requested short note without changing the site's navigation UI.
  window.setTimeout(show, 1300);
  // Acknowledge account/cloud-only actions, never submit login credentials.
  document.addEventListener('submit', function (event) {
    if (event.target && event.target.closest && event.target.closest('.pawcream-signin-drop')) {
      event.preventDefault();
      event.stopPropagation();
      show();
    }
  }, true);
  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest && event.target.closest('button');
    if (!button) return;
    var txt = (button.textContent || '').trim();
    if (/^(登入|注册|Sign in|Register|写一张便签|提交留言)/.test(txt)) show();
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
