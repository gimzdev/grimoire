/*! Grimoire tooltips for WoW Forever: https://wowgrimoire.app/tools/tooltips
 * One script tag: any link to a Grimoire item, quest or NPC shows its tooltip on hover or keyboard focus.
 * It reads /api/tip on the site it was loaded from, changes no link and stores nothing. */
(function () {
  if (window.__grimoireTips) return;
  window.__grimoireTips = 1;
  var me = document.currentScript, origin = 'https://wowgrimoire.app';
  try { if (me && me.src) origin = new URL(me.src).origin; } catch (e) {}
  var hosts = { 'wowgrimoire.app': 1, 'www.wowgrimoire.app': 1 };
  hosts[new URL(origin).host] = 1;
  var KINDS = { items: 'item', quests: 'quest', npcs: 'npc' };
  var cache = {}, tip = null, current = null, timer = 0;

  function keyOf(a) {
    if (!a || !a.href) return null;
    var u;
    try { u = new URL(a.href, location.href); } catch (e) { return null; }
    if (!hosts[u.host]) return null;
    var m = /^\/(items|quests|npcs)\/(\d+)\/?$/.exec(u.pathname);
    return m ? KINDS[m[1]] + ':' + m[2] : null;
  }
  function load(key) {
    if (!cache[key]) cache[key] = fetch(origin + '/api/tip?f=html&k=' + encodeURIComponent(key)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    return cache[key];
  }
  function box() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.setAttribute('role', 'tooltip');
    tip.style.cssText = 'position:fixed;z-index:2147483000;max-width:340px;pointer-events:none;background:linear-gradient(180deg,rgba(10,14,32,.97),rgba(5,8,20,.97));border:1px solid #6b7489;border-radius:6px;box-shadow:0 0 0 1px rgba(0,0,0,.85),0 18px 40px rgba(0,0,0,.65);color:#fff;font:420 14px/1.32 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:9px 11px 8px;text-align:left;display:none';
    document.body.appendChild(tip);
    return tip;
  }
  function place(x, y) {
    var t = box(), w = t.offsetWidth, h = t.offsetHeight, vw = innerWidth, vh = innerHeight;
    var left = x + 16, top = y + 18;
    if (left + w > vw - 8) left = Math.max(8, x - w - 12);
    if (top + h > vh - 8) top = Math.max(8, y - h - 12);
    t.style.left = left + 'px';
    t.style.top = top + 'px';
  }
  function show(a, key, x, y) {
    current = a;
    load(key).then(function (d) {
      if (current !== a || !d || !d.html) return;
      var t = box();
      t.innerHTML = d.html + '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,.08);color:#9d9d9d;font-size:12px">Grimoire · wowgrimoire.app</div>';
      t.style.display = 'block';
      place(x, y);
    });
  }
  function hide() {
    current = null;
    clearTimeout(timer);
    if (tip) tip.style.display = 'none';
  }
  var hover = !window.matchMedia || matchMedia('(hover: hover)').matches;
  if (hover) {
    document.addEventListener('mouseover', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a === current) return;
      var key = keyOf(a);
      if (!key) return;
      clearTimeout(timer);
      timer = setTimeout(function () { show(a, key, e.clientX, e.clientY); }, 60);
    });
    document.addEventListener('mousemove', function (e) { if (current && tip && tip.style.display === 'block') place(e.clientX, e.clientY); }, { passive: true });
    document.addEventListener('mouseout', function (e) {
      if (current && (!e.relatedTarget || !current.contains(e.relatedTarget))) hide();
    });
  }
  document.addEventListener('focusin', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'), key = a && keyOf(a);
    if (!key) return;
    var r = a.getBoundingClientRect();
    show(a, key, r.left, r.bottom);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  addEventListener('scroll', hide, { passive: true });
})();
