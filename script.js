/* 最新バージョンの情報を GitHub Releases から取得して、ダウンロードボタンに設定します。
   新しいバージョンを GitHub Releases に公開すると、このページは自動で最新版を案内します（このファイルの編集は不要）。 */
(function () {
  'use strict';

  /* ---- 判定・整形（画面に依存しない部分。tests で確認できます） ---- */
  function detectRepo(cfg, loc) {
    cfg = cfg || {}; loc = loc || {};
    if (cfg.owner && cfg.repo) return { owner: cfg.owner, repo: cfg.repo };
    var host = String(loc.hostname || '').toLowerCase();
    if (/\.github\.io$/.test(host)) {
      var owner = host.replace(/\.github\.io$/, '');
      var seg = String(loc.pathname || '/').split('/').filter(Boolean)[0];
      var repo = cfg.repo || (seg && !/\.html?$/i.test(seg) ? seg : owner + '.github.io');
      return { owner: cfg.owner || owner, repo: repo };
    }
    return null;
  }
  function pickAssets(release) {
    var assets = (release && release.assets) || [];
    var find = function (re) { return assets.filter(function (a) { return re.test(a.name || ''); })[0] || null; };
    return { setup: find(/setup.*\.exe$/i), portable: find(/portable.*\.exe$/i) };
  }
  function formatSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    return (bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1) + ' MB';
  }
  function formatDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function shortHash(digest) {
    var m = /^sha256:([0-9a-f]{64})$/i.exec(digest || '');
    return m ? m[1] : '';
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { detectRepo: detectRepo, pickAssets: pickAssets, formatSize: formatSize, formatDate: formatDate, shortHash: shortHash };
  }
  if (typeof document === 'undefined') return;

  /* ---- 画面の更新 ---- */
  var $ = function (id) { return document.getElementById(id); };
  var elSetup = $('dl-setup'), elPortable = $('dl-portable'), elStatus = $('dl-status'), elMeta = $('dl-meta');

  function setLink(el, href, enabled) {
    el.setAttribute('href', href);
    el.classList.toggle('is-disabled', !enabled);
    el.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  }
  function status(text, kind) { elStatus.textContent = text; elStatus.className = 'status' + (kind ? ' ' + kind : ''); }
  [elSetup, elPortable].forEach(function (el) {
    el.addEventListener('click', function (e) { if (el.classList.contains('is-disabled')) e.preventDefault(); });
  });

  var found = detectRepo(window.SITE_CONFIG, window.location);
  if (!found) {
    setLink(elSetup, '#', false); setLink(elPortable, '#', false);
    status('このページはまだ公開の設定が済んでいません。config.js に GitHub のユーザー名とリポジトリ名を書いてください（GitHub Pages で公開した場合は不要です）。', 'warn');
    return;
  }
  var repoUrl = 'https://github.com/' + found.owner + '/' + found.repo;
  var latestPage = repoUrl + '/releases/latest';
  var issues = $('link-issues'); if (issues) { issues.href = repoUrl + '/issues'; issues.hidden = false; }
  var all = $('link-releases'); if (all) { all.href = repoUrl + '/releases'; all.hidden = false; }

  setLink(elSetup, latestPage, true); setLink(elPortable, latestPage, true);   // 取得できなかった場合の予備（配布ページを開く）
  status('最新版を確認しています…');

  fetch('https://api.github.com/repos/' + found.owner + '/' + found.repo + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (res) {
      if (res.status === 404) return { none: true };
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (rel) {
      if (rel.none) {
        setLink(elSetup, '#', false); setLink(elPortable, '#', false);
        status('ダウンロードの準備中です。もうしばらくお待ちください。', 'warn');
        return;
      }
      var a = pickAssets(rel);
      if (!a.setup && !a.portable) throw new Error('no assets');
      var date = formatDate(rel.published_at);
      if (a.setup) {
        setLink(elSetup, a.setup.browser_download_url, true);
        $('dl-setup-sub').textContent = 'インストーラー版（おすすめ）・' + formatSize(a.setup.size);
      } else { setLink(elSetup, '#', false); $('dl-setup-sub').textContent = '準備中'; }
      if (a.portable) {
        setLink(elPortable, a.portable.browser_download_url, true);
        $('dl-portable-sub').textContent = formatSize(a.portable.size);
      } else { setLink(elPortable, '#', false); $('dl-portable-sub').textContent = '準備中'; }
      elMeta.textContent = '最新バージョン ' + (rel.tag_name || '') + (date ? '（' + date + ' 公開）' : '');
      status('');
      var rows = [['インストーラー版', a.setup], ['ポータブル版', a.portable]].filter(function (r) { return r[1] && shortHash(r[1].digest); });
      if (rows.length) {
        var list = $('hash-list'); list.textContent = '';
        rows.forEach(function (r) {
          var dt = document.createElement('dt'), dd = document.createElement('dd'), code = document.createElement('code');
          dt.textContent = r[0] + '（' + r[1].name + '）'; code.textContent = shortHash(r[1].digest);
          dd.appendChild(code); list.appendChild(dt); list.appendChild(dd);
        });
        $('hash-box').hidden = false;
      }
    })
    .catch(function () {
      status('最新版の情報を取得できませんでした。ボタンを押すと、配布ページが開きます。', 'warn');
    });
})();
