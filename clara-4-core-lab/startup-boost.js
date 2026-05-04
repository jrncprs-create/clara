// Lightweight startup boost loaded after app.js.
// It asks Clara for a useful startup plan when the lab opens empty.
(function(){
  const KEY='clara_core_lab_startup_boost_v1';
  function hasAgendaContent(){
    const agenda=document.getElementById('agendaCol');
    if(!agenda)return true;
    const txt=(agenda.textContent||'').toLowerCase();
    return !txt.includes('analyseer input om de dagagenda te vullen') && !txt.includes('geen dagbrede blokken');
  }
  function trigger(){
    const input=document.getElementById('input');
    const btn=document.getElementById('analyzeBtn');
    if(!input||!btn||hasAgendaContent())return;
    try{
      const stamped=sessionStorage.getItem(KEY);
      const today=new Date().toISOString().slice(0,10);
      if(stamped===today)return;
      sessionStorage.setItem(KEY,today);
    }catch(_){}
    // Ask app.js to run silent startup overlay flow (no chat injection).
    if(typeof window.__claraRunStartupOverlay==='function'){
      window.__claraRunStartupOverlay();
      return;
    }
  }
  window.addEventListener('DOMContentLoaded',()=>setTimeout(trigger,1100));
})();
