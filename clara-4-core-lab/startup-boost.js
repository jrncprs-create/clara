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
    input.value='Maak automatisch een rustige opstartplanning voor vandaag op basis van de beschikbare projectcontext. Kies 3 tot 5 concrete potloodblokken over de relevante projecten. Zet ook 1 tot 3 relevante open vragen klaar en meld kort welke projecten of onderwerpen al een tijdje geen aandacht hebben gehad. Maak geen harde afspraken zonder expliciete tijd, geen overlap, geen technische uitleg en geen brede producttour.';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    setTimeout(()=>btn.click(),450);
  }
  window.addEventListener('DOMContentLoaded',()=>setTimeout(trigger,1100));
})();
