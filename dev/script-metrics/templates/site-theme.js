// Same saved preference as the main site; no selection means system theme.
(()=>{
  const root=document.documentElement,system=matchMedia('(prefers-color-scheme: dark)');let preference;
  try{const saved=localStorage.getItem('theme');if(saved==='light'||saved==='dark')preference=saved;}catch{}
  function paint(){if(preference)root.dataset.t=preference;else delete root.dataset.t;const dark=preference?preference==='dark':system.matches;root.dataset.theme=dark?'dark':'light';root.classList.toggle('dark',dark);const button=document.getElementById('tt')||document.getElementById('themeToggle');if(button){button.setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');button.dataset.tip=dark?'Light theme':'Dark theme';}window.dispatchEvent(new Event('site-theme-change'));}
  function setup(){const button=document.getElementById('tt')||document.getElementById('themeToggle');if(button)button.addEventListener('click',()=>{preference=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('theme',preference);}catch{}paint();});paint();}
  paint();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();system.addEventListener('change',paint);
  window.addEventListener('storage',event=>{if(event.key==='theme'){preference=['light','dark'].includes(event.newValue)?event.newValue:undefined;paint();}});
})();
