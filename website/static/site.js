/* site.js: what every main page shares: the header that hides on scroll, the phone menu and the VEX AI SOC menu.
   Loaded deferred by the pages with the shared header (site-build/shared.py adds the tag). Edit here, once. */
(function(){
  // hide-on-scroll header: hides on the way down, comes back on the way up and near the top.
  // It also keeps --top-h (the header's height) current for pages with a sticky jump menu (API, detections).
  var root = document.documentElement;
  var top = document.querySelector('.site-top');
  var classbar = document.getElementById('topstack') || document.querySelector('.classbar');
  if(!top){ return; }
  function measure(){ root.style.setProperty('--top-h', top.offsetHeight + 'px'); }
  measure();
  window.addEventListener('resize', measure);
  var lastY = window.scrollY;
  var ticking = false;
  function update(){
    ticking = false;
    var y = window.scrollY;
    var showZone = top.offsetHeight + (classbar ? classbar.offsetHeight : 0);   // always show near the top
    // hold still while a menu is open, during a click-scroll, while a story is pinned or the page just changed height
    if(root.classList.contains('nav-open') || root.classList.contains('jump-open') || root.hasAttribute('data-auto-scroll') ||
       root.hasAttribute('data-story-pinned') || root.hasAttribute('data-relayout')){ lastY = y; return; }
    if(y <= showZone){ root.classList.remove('header-hidden'); lastY = y; return; }
    if(Math.abs(y - lastY) < 6){ return; }   // ignore tiny scroll jitters
    root.classList.toggle('header-hidden', y > lastY);
    lastY = y;
  }
  window.addEventListener('scroll', function(){
    if(!ticking){ ticking = true; requestAnimationFrame(update); }
  }, { passive:true });
  top.addEventListener('focusin', function(){ root.classList.remove('header-hidden'); });
})();

(function(){
  // phone menu (same as the other pages)
  var openBtn = document.querySelector('.menu-btn[aria-controls="site-nav"]');
  var panel = document.getElementById('site-nav');
  if(!openBtn || !panel){ return; }
  var closeBtn = panel.querySelector('.menu-close');
  function openNav(){
    panel.classList.add('is-open');
    document.documentElement.classList.add('nav-open');
    openBtn.setAttribute('aria-expanded','true');
    closeBtn.focus({ preventScroll:true });
  }
  function closeNav(returnFocus){
    panel.classList.remove('is-open');
    document.documentElement.classList.remove('nav-open');
    openBtn.setAttribute('aria-expanded','false');
    if(returnFocus){ openBtn.focus({ preventScroll:true }); }
  }
  openBtn.addEventListener('click', openNav);
  closeBtn.addEventListener('click', function(){ closeNav(true); });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && panel.classList.contains('is-open')){ closeNav(true); }
  });
  panel.addEventListener('click', function(e){
    if(e.target.closest('a')){ closeNav(false); }
  });
  var wide = window.matchMedia('(min-width:701px)');
  function onWide(){ if(wide.matches && panel.classList.contains('is-open')){ closeNav(false); } }
  if(wide.addEventListener){ wide.addEventListener('change', onWide); } else { wide.addListener(onWide); }
})();
  
(function(){
  // VEX AI SOC menu: opens on click; closes on a click outside, Escape, leaving it with Tab, or the header hiding
  var drop = document.querySelector('.nav-drop'); if(!drop){ return; }
  var btn = drop.querySelector('.nav-drop-btn'), menu = drop.querySelector('.nav-drop-menu');
  function set(open, focusBtn){
    btn.setAttribute('aria-expanded', String(open)); menu.hidden = !open;
    if(!open && focusBtn){ btn.focus({ preventScroll:true }); }
  }
  btn.addEventListener('click', function(){ set(menu.hidden); });
  document.addEventListener('click', function(e){ if(!menu.hidden && !drop.contains(e.target)){ set(false); } });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && !menu.hidden){ set(false, true); } });
  drop.addEventListener('focusout', function(e){ if(!menu.hidden && e.relatedTarget && !drop.contains(e.relatedTarget)){ set(false); } });
  window.addEventListener('scroll', function(){ if(!menu.hidden && document.documentElement.classList.contains('header-hidden')){ set(false); } }, { passive:true });
  // closed again when you come back: close on following a link, and when the browser restores the page from its
  // back/forward cache (which keeps the menu as it was)
  menu.addEventListener('click', function(e){ if(e.target.closest('a')){ set(false); } });
  window.addEventListener('pageshow', function(e){ if(e.persisted){ set(false); } });
})();
