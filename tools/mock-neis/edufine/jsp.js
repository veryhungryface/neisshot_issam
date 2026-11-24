// JSP-style list pages (연습용): search submits the form (GET reload), titles open a new window.
(function () {
  var f = document.forms.aform;
  window.doSearch = function () { f.submit(); };
  document.querySelectorAll('.LblockSearch input[type=text]').forEach(function (i) {
    i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
  });
  var all = document.getElementById('chkAll');
  if (all) all.addEventListener('change', function () {
    document.querySelectorAll('input.listChkBox').forEach(function (c) { c.checked = all.checked; });
  });
  window.openDoc = function (id) { window.open('/edufine/popup/doc.html?id=' + encodeURIComponent(id), 'docView', 'width=980,height=760'); };
  window.openDraft = function (id) { window.open('/edufine/popup/draft.html?format=' + encodeURIComponent(id), 'draftWrite', 'width=1000,height=800'); };
  function checked() { return Array.prototype.map.call(document.querySelectorAll('input.listChkBox:checked'), function (c) { return c.value; }); }
  document.querySelectorAll('.LblockButton .Lbtn').forEach(function (b) {
    b.addEventListener('click', function () {
      var act = b.getAttribute('data-action');
      if (/일괄결재|연속결재|일괄과제결재/.test(act)) {
        var ids = checked();
        if (!ids.length) { alert('문서를 선택하세요.'); return; }
        window.open('/edufine/popup/doc.html?id=' + encodeURIComponent(ids[0]) + '&batch=' + encodeURIComponent(ids.join(',')), 'docView', 'width=980,height=760');
        return;
      }
      alert(act + ': 연습장에서는 동작하지 않습니다.');
    });
  });
})();
