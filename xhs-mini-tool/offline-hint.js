/* Offline status display only; the original React layout remains unchanged. */
(function () {
  'use strict';
  // The bottom "more functions on website" banner was intentionally removed.
  // Keep this script for XHS offline form safety, without creating any toast.
  // Only warn when someone tries to use the public photo wall's online storage.
  // Private Instax creation and the session-only tin preview remain available.
  // Offline account forms must not submit credentials.
  document.addEventListener('submit', function (event) {
    if (event.target && event.target.closest && event.target.closest('.pawcream-signin-drop')) {
      event.preventDefault();
      event.stopPropagation();

    }
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
