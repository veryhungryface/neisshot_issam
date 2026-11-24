// shared by the 연습용 popup windows: 전자서명 modal (password) — automation must stop here.
window.esignPrompt = function (title) {
  return new Promise(function (resolve) {
    var shade = document.createElement('div'); shade.className = 'shade';
    var box = document.createElement('div'); box.className = 'esign'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '전자서명');
    box.innerHTML = '<h4>전자서명</h4><p>' + title + '을(를) 진행하려면 인증서 비밀번호를 입력하세요.<br><small>(연습용 비밀번호: 0000 — 실제 비밀번호를 넣지 마세요)</small></p>' +
      '<label for="certPw">인증서 비밀번호</label> <input type="password" id="certPw" title="인증서 비밀번호" autocomplete="off">' +
      '<div class="row"><a href="#" class="Lbtn" id="esOk">확인</a><a href="#" class="Lbtn" id="esCancel">취소</a></div>';
    document.body.appendChild(shade); document.body.appendChild(box);
    var done = function (v) { shade.remove(); box.remove(); resolve(v); };
    box.querySelector('#esOk').onclick = function (e) { e.preventDefault(); done(box.querySelector('#certPw').value); };
    box.querySelector('#esCancel').onclick = function (e) { e.preventDefault(); done(null); };
    box.querySelector('#certPw').focus();
  });
};
window.post = function (name, body) {
  return fetch('/edufine/api/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
};
