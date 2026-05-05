const LAB_VERSION='0.14.35';
const input=document.getElementById('input'),btn=document.getElementById('analyzeBtn'),statusEl=document.getElementById('status'),chatLog=document.getElementById('chatLog'),agendaCol=document.getElementById('agendaCol'),agendaHeadTabs=document.getElementById('agendaHeadTabs'),agendaDateHeader=document.getElementById('agendaDateHeader'),agendaSection=document.querySelector('section.col.agenda'),attentionCol=document.getElementById('attentionCol'),regieCol=document.getElementById('regieCol'),endPromptHost=document.getElementById('endPromptHost'),clockHour=document.getElementById('clockHour'),clockMinute=document.getElementById('clockMinute'),clockWeekday=document.getElementById('clockWeekday'),clockDate=document.getElementById('clockDate'),clockYear=document.getElementById('clockYear'),agendaPrevBtn=document.getElementById('agendaPrevBtn'),agendaNextBtn=document.getElementById('agendaNextBtn'),refreshGuidanceBtn=document.getElementById('refreshGuidanceBtn');
const STORAGE_KEY='clara_core_lab_state_v1',SESSION_STARTUP_KEY='clara_core_lab_auto_startup_done_v1',LAB_TEST_STORAGE_KEYS=[STORAGE_KEY,'clara_last_greeting_ix'];
const DISMISSED_KEY='clara_core_lab_dismissed_guidance_v1';
const LEGACY_NOISE_KEY='clara_core_lab_legacy_noise_v1';
const startupOverlay=document.getElementById('startupOverlay'),startupOverlayIntro=document.getElementById('startupOverlayIntro'),startupOverlayList=document.getElementById('startupOverlayList'),startupOverlayAcceptAllBtn=document.getElementById('startupOverlayAcceptAll'),projectPlanOverlay=document.getElementById('projectPlanOverlay'),projectPlanOverlayBody=document.getElementById('projectPlanOverlayBody'),weatherStrip=document.getElementById('weatherStrip');
const STARTUP_INTERNAL_PROMPT='Maak een rustige conceptplanning voor vandaag op basis van de beschikbare projectcontext. Kies maximaal één eerstvolgende logische actie per actief project. Zet uitvoerbare acties als potloodblokken in de agenda. Geef hooguit één noodzakelijke vraag, een korte route vooruit en concrete open items. Maak geen ruwe contextdump, verzin geen harde afspraken, plan geen overlap, en zet wat niet eerlijk past apart als needs_time.';
const STARTUP_DONE_MSG='Ik heb alvast een rustige conceptstart klaargezet. Alles staat als potloodvoorstel.';
let labState={agenda:[],attention:[],tasks:[],open_threads:[],project_plans:[],day_regie:{items_to_check:[],rollover_candidates:[],review_prompt:'',suggested_time:null,now_first_move:''},updated_at:null},activeAgendaTab='day',activeAgendaDate=null,currentController=null,isAnalyzing=false,dragState=null,thinkingId=0,startupAnalysisScheduled=false,activeAgendaEndPromptItemId=null,dismissedGuidanceIds=new Set(),hiddenOpenEndIds=new Set(),guidanceRefreshHint='',refreshGuidanceHintTimer=null,lastOpenItemRef=null,lastUserInputForSanitize='',lastPlanningMessage='',legacyNoiseSig=new Set(),overlayEditId=null,overlayEditDraft='',projectPlanOverlayOpenId=null;

function loadLegacyNoise(){try{const raw=localStorage.getItem(LEGACY_NOISE_KEY);if(!raw)return;const a=JSON.parse(raw);if(!Array.isArray(a))return;legacyNoiseSig=new Set(a.map(String))}catch(_){}}
function persistLegacyNoise(){try{localStorage.setItem(LEGACY_NOISE_KEY,JSON.stringify([...legacyNoiseSig].slice(0,1800)))}catch(_){}}
function legacyAgendaSig(i){const date=itemAgendaDate(i);const t=guidanceText(i?.title||'',140).toLowerCase();const p=getProjectVisual(i?.project).key||'none';return`${date}|${p}|${t}`}
function sanitizeAgendaPreviewLine(i){const title=String(i?.title||'').trim();if(!title)return null;let t=title.replace(/^\s*Past niet in (?:compacte|korte)\s+dagplanning:\s*/i,'').trim();t=t.replace(/\b(?:compacte|korte)\s+dagplanning\b/gi,'').replace(/\bfallback\b/gi,'').trim();const out=filterUserFacingLine(t);return out?guidanceText(out,170):null}
function loadDismissedGuidanceIds(){try{const raw=localStorage.getItem(DISMISSED_KEY);if(!raw)return;const a=JSON.parse(raw);if(!Array.isArray(a))return;dismissedGuidanceIds=new Set(a.map(String))}catch(_){}}
function persistDismissedGuidanceIds(){try{localStorage.setItem(DISMISSED_KEY,JSON.stringify([...dismissedGuidanceIds].slice(0,1200)))}catch(_){}}
function looksLikeLegacyNoiseAgendaItem(i){if(!i||typeof i!=='object')return true;const title=String(i.title||'').trim();const clean=sanitizeAgendaPreviewLine({title,project:i.project,date:itemAgendaDate(i)});if(!clean)return true;const proj=i.project||inferProjectFromTitle(clean);const dur=Number(i.estimated_duration_minutes||0)||45;if(legacyNoiseSig.has(legacyAgendaSig({title:clean,project:proj,date:itemAgendaDate(i)})))return true;return !isConcreteAgendaItem({title:clean,project:proj,estimated_duration_minutes:dur})}

function overlayCanAcceptSuggestion(s){const text=filterUserFacingLine(s?.text);if(!text)return false;const proj=s.project||inferProjectFromTitle(text);return isConcreteAgendaItem({title:text,project:proj,estimated_duration_minutes:45})}
function overlaySuggestionTitle(s){return guidanceText(filterUserFacingLine(s?.text)||s?.text||'',160)}
function renderOverlaySuggestionCard(s){const id=String(s?.id||'');const proj=projectLabelFor(s.project);const src=sourceLabelFor(s.source);const reason=s.reason?guidanceText(s.reason,90):'';const meta=[proj,src,reason].filter(Boolean).join(' · ');const isEdit=overlayEditId===id;const title=isEdit?guidanceText(overlayEditDraft||overlaySuggestionTitle(s),160):overlaySuggestionTitle(s);const titleEl=isEdit?`<input class="startup-overlay__edit" value="${esc(title)}" data-overlay-edit-input data-id="${esc(id)}" />`:`<p class="startup-overlay__item-title">${esc(title)}</p>`;const btns=`<button type="button" class="plain" data-overlay-proposal-action="accept" data-id="${esc(id)}" aria-label="Accepteren">✓</button><button type="button" class="plain" data-overlay-proposal-action="edit" data-id="${esc(id)}" aria-label="Aanpassen">✎</button><button type="button" class="plain" data-overlay-proposal-action="dismiss" data-id="${esc(id)}" aria-label="Weg">×</button>`;return`<div class="startup-overlay__item" data-overlay-kind="suggestion" data-id="${esc(id)}">${titleEl}<p class="startup-overlay__item-sub">${esc(meta)}</p><div class="startup-overlay__item-actions startup-overlay__item-actions--icons">${btns}</div></div>`}
function normalizeProjectPlan(raw,idx=0){
  if(!raw||typeof raw!=='object')return null;
  const id=String(raw.id||'pp-'+Date.now()+'-'+idx+'-'+((Math.random()*1e6)|0));
  const project=String(raw.project||raw.project_key||'').trim()||inferProjectFromTitle(raw.title||raw.goal||'')||null;
  const title=guidanceText(raw.title||raw.plan_title||projectLabelFor(project)||'Projectplan',120);
  const goal=guidanceText(raw.goal||raw.doel||'',260);
  const deadline=raw.deadline?String(raw.deadline).slice(0,10):'';
  const status=String(raw.status||'active');
  const context=guidanceText(raw.context||raw.reason||'',420);
  const stepsRaw=Array.isArray(raw.steps)?raw.steps:[];
  const steps=stepsRaw.map((s,i)=>{
    if(!s||typeof s!=='object')return null;
    const sid=String(s.id||id+'-st-'+i+'-'+((Math.random()*1e6)|0));
    const stTitle=guidanceText(s.title||'',140);
    const stStatus=String(s.status||'todo');
    const est=Number(s.estimated_duration_minutes||s.duration_minutes||0);
    const estimated_duration_minutes=Number.isFinite(est)&&est>0?Math.max(10,Math.round(est/5)*5):60;
    const dependency_type=String(s.dependency_type||'none');
    const depends_on_step_id=s.depends_on_step_id?String(s.depends_on_step_id):'';
    const stDeadline=s.deadline?String(s.deadline).slice(0,10):'';
    const tasksRaw=Array.isArray(s.tasks)?s.tasks:[];
    const tasks=tasksRaw.map((t,j)=>{
      if(!t||typeof t!=='object')return null;
      const tid=String(t.id||sid+'-ta-'+j+'-'+((Math.random()*1e6)|0));
      const tt=guidanceText(t.title||'',160);
      const ts=String(t.status||'todo');
      const te=Number(t.estimated_duration_minutes||t.duration_minutes||0);
      const ted=Number.isFinite(te)&&te>0?Math.max(10,Math.round(te/5)*5):25;
      const tdl=t.deadline?String(t.deadline).slice(0,10):'';
      const source_reason=guidanceText(t.source_reason||t.reason||'',140);
      return {id:tid,title:tt,status:ts,estimated_duration_minutes:ted,deadline:tdl,source_reason};
    }).filter(Boolean);
    return {id:sid,title:stTitle,status:stStatus,estimated_duration_minutes,dependency_type,depends_on_step_id,deadline:stDeadline,tasks};
  }).filter(Boolean);
  const created_at=raw.created_at||new Date().toISOString();
  const updated_at=raw.updated_at||raw.updatedAt||created_at;
  const source=String(raw.source||'local');
  return {id,project,title,goal,deadline,status,context,steps,created_at,updated_at,source};
}

function loadLabStateFromStorage(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;const o=JSON.parse(raw);if(!o||typeof o!=='object')return;labState.agenda=Array.isArray(o.agenda)?o.agenda:[];labState.attention=Array.isArray(o.attention)?o.attention:[];labState.tasks=Array.isArray(o.tasks)?o.tasks:[];labState.open_threads=Array.isArray(o.open_threads)?o.open_threads:[];labState.project_plans=Array.isArray(o.project_plans)?o.project_plans.map((p,i)=>normalizeProjectPlan(p,i)).filter(Boolean):[];const dr=o.day_regie||{};labState.day_regie={items_to_check:dr.items_to_check||[],rollover_candidates:dr.rollover_candidates||[],review_prompt:dr.review_prompt||'',suggested_time:dr.suggested_time??null,now_first_move:dr.now_first_move||''};labState.updated_at=o.updated_at||null}catch(_){}}
function saveLabStateToStorage(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({agenda:labState.agenda,attention:labState.attention,tasks:labState.tasks,open_threads:labState.open_threads,project_plans:labState.project_plans,day_regie:labState.day_regie,updated_at:labState.updated_at}))}catch(_){}}
function clearStartupDoneIfEmpty(){if(dayRegieIsEmpty(labState)){try{sessionStorage.removeItem(SESSION_STARTUP_KEY)}catch(_){}}}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function todayIso(){let d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function addDaysIso(iso,days){let d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function dateLabel(iso){let t=todayIso();if(iso===t)return'Vandaag';if(iso===addDaysIso(t,1))return'Morgen';if(iso===addDaysIso(t,2))return'Overmorgen';let d=new Date(`${iso}T12:00:00`);return d.toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'})}
function timeToMin(t){if(!t||!/^[0-2]?\d:[0-5]\d$/.test(t))return null;let[a,b]=t.split(':').map(Number);return a*60+b}
function timeToMinutes(t){return timeToMin(t)}
function getNowMinutes(){let n=new Date();return n.getHours()*60+n.getMinutes()}
function minToTime(m){if(m>=1440)return'24:00';m=Math.max(0,m);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function dayOfWeekFromIso(iso){return new Date(`${iso}T12:00:00`).getDay()}
function inputAllowsTechnical(s){return/\b(technisch|debug|api|json|endpoint|frontend|backend|lab\s*state|labstate|prompt|schema)\b/i.test(String(s||''))}
function rememberUserInputForSanitize(s){lastUserInputForSanitize=String(s||'').slice(0,800);try{sessionStorage.setItem('clara_last_user_in',lastUserInputForSanitize)}catch(_){}}
function allowTechnicalFromContext(){return inputAllowsTechnical(lastUserInputForSanitize)||inputAllowsTechnical((()=>{try{return sessionStorage.getItem('clara_last_user_in')||''}catch(_){return''}})())}
const FORBIDDEN_USER_SUBSTR=[/\blab\s*state\b/i,/\blabstate\b/i,/localstorage/i,/\bstorage\b/i,/\bapi\b/i,/\bfallback\b/i,/\brender\b/i,/projectbrain[-\s]?dump/i,/\bprojectbrain\b/i,/\braw\b/i,/\bschema\b/i,/\bendpoint\b/i,/\bfrontend\b/i,/\bbackend\b/i,/\bjson\b/i,/promptregel/i,/\bdebug\b/i,/state-mutatie/i,/reconstrueren/i,/actuele\s+.*\s+staat/i,/projectbrain\s+raw/i,/oorzaak.*opslag/i];
function containsForbiddenUserText(t){if(!t)return true;const s=String(t);if(allowTechnicalFromContext())return false;return FORBIDDEN_USER_SUBSTR.some(re=>re.test(s))}
function sanitizeUserFacingText(raw,kind){const s0=String(raw||'').replace(/\s+/g,' ').trim();if(!s0)return null;if(allowTechnicalFromContext())return s0;if(containsForbiddenUserText(s0))return null;let s=s0.replace(/\bLab State\b/gi,'wat Clara onthoudt').replace(/\blab state\b/gi,'wat Clara onthoudt').replace(/\bProjectbrain\b/gi,'projectcontext');if(containsForbiddenUserText(s))return null;if(kind==='chat'&&s.length>520)return s.slice(0,519)+'…';return s}
function filterUserFacingLine(raw){const s=sanitizeUserFacingText(raw,'panel');return s}
function normalizePlanningDateIso(dateIso,message){const d=dayOfWeekFromIso(dateIso);const allow=/(weekend|zaterdag|zondag|urgent|deadline)/i.test(String(message||''));if((d===0||d===6)&&!allow){let iso=dateIso;for(let k=0;k<14&&(dayOfWeekFromIso(iso)===0||dayOfWeekFromIso(iso)===6);k++)iso=addDaysIso(iso,1);return iso}return dateIso}
function compactDayWorkWindow(dateIso){const d=dayOfWeekFromIso(dateIso);if(d===1)return{start:11*60,end:18*60};if(d>=2&&d<=5)return{start:10*60,end:18*60};return{start:10*60,end:18*60}}
function isWeekendIso(iso){const d=dayOfWeekFromIso(iso);return d===0||d===6}
function nextWorkdaysFrom(dateIso,count=5){const out=[];let cur=dateIso;for(let k=0;k<28&&out.length<count;k++){if(!isWeekendIso(cur))out.push(cur);cur=addDaysIso(cur,1)}return out}
function findFreeSlotWorkday(dateIso,duration){const win=compactDayWorkWindow(dateIso);let s0=win.start;const tIso=todayIso();if(dateIso===tIso){const nowM=round15(getNowMinutes());s0=Math.max(win.start,nowM)}for(let s=s0;s+duration<=win.end;s+=15){if(!hasAgendaOverlap(dateIso,s,s+duration,null))return{start:s,end:s+duration}}return null}
function isAgendaItemDone(i){if(!i)return false;return!!i.completed_at||i.status==='done'||i.status==='completed'}
function itemAgendaDate(i){return i.date||todayIso()}
function normalizeAgendaItem(raw){if(!raw||typeof raw!=='object')return null;const title=guidanceText(raw.title||raw.text||'').trim();if(!title)return null;const date=String(raw.date||todayIso());const start=raw.start_time||null,end=raw.end_time||null;const s=timeToMin(start),e=timeToMin(end);const duration=raw.estimated_duration_minutes||((s!=null&&e!=null)?Math.max(15,e-s):null)||null;const status=raw.status||'pencil';const project=raw.project||null;const confirmation_required=raw.confirmation_required===true||status==='pencil';return{...raw,id:String(raw.id||''),title,date,start_time:start,end_time:end,estimated_duration_minutes:duration,status,confirmation_required,project}}
function agendaSignature(i){const n=guidanceText(i.title,120).toLowerCase();const date=itemAgendaDate(i);const s=timeToMin(i.start_time),e=timeToMin(i.end_time)??(s!=null?(s+(i.estimated_duration_minutes||30)):null);const proj=getProjectVisual(i.project).key;return`${date}|${proj}|${n}|${s==null?'na':s}|${e==null?'na':e}`}
function overlapsOrSimilar(a,b){if(itemAgendaDate(a)!==itemAgendaDate(b))return false;const ap=getProjectVisual(a.project).key,bp=getProjectVisual(b.project).key;if(ap&&bp&&ap!==bp)return false;const at=guidanceText(a.title,120).toLowerCase(),bt=guidanceText(b.title,120).toLowerCase();const sA=timeToMin(a.start_time),eA=timeToMin(a.end_time)??(sA!=null?(sA+(a.estimated_duration_minutes||30)):null);const sB=timeToMin(b.start_time),eB=timeToMin(b.end_time)??(sB!=null?(sB+(b.estimated_duration_minutes||30)):null);if(sA!=null&&eA!=null&&sB!=null&&eB!=null){if(sA<eB&&sB<eA)return true}if(at&&bt&&(at===bt||at.includes(bt)||bt.includes(at)))return true;return false}
function isGenericAgendaTitle(title){const t=String(title||'').trim().toLowerCase();if(!t)return true;const banned=['korte voorbereiding','iets kleins afronden','tweede prioriteit vastzetten','verder uitwerken','checken','oppakken','voorbereiden','afronden','algemeen blok','kleine taak'];return banned.some(b=>t===b||t.startsWith(b+' ')||t.includes(b))}
function titleHasConcreteVerb(title){return/\b(nalopen|controleren|testen|bouwen|maken|monteren|bestellen|schrijven|ordenen|uitwerken|opstellen|mailen|bellen|afstemmen|voorbereiden)\b/i.test(String(title||''))}
function isConcreteAgendaItem(i){if(!i)return false;const title=String(i.title||'').trim();if(!title||isGenericAgendaTitle(title))return false;const pv=getProjectVisual(i.project||inferProjectFromTitle(title));if(!pv||pv.key==='none')return false;const dur=Number(i.estimated_duration_minutes||0);if(!Number.isFinite(dur)||dur<10)return false;return titleHasConcreteVerb(title)&&/[:—-]/.test(title)||titleHasConcreteVerb(title)}
function mergeAgendaTruth(existingAgenda,incomingAgenda){const ex=(existingAgenda||[]).map(normalizeAgendaItem).filter(Boolean);const inc=(incomingAgenda||[]).map(normalizeAgendaItem).filter(Boolean);const out=[...ex];const sig=new Set(ex.map(agendaSignature));for(const it of inc){if(!it)continue;const proj=it.project||inferProjectFromTitle(it.title);const candidate={...it,project:proj,estimated_duration_minutes:it.estimated_duration_minutes||45};if(!isConcreteAgendaItem(candidate))continue;const itSig=agendaSignature(candidate);if(sig.has(itSig))continue;let dup=false;for(const cur of out){if(overlapsOrSimilar(cur,candidate)){dup=true;break}}if(dup)continue;const id=candidate.id&&String(candidate.id).trim()?String(candidate.id):('ag-ai-'+Date.now()+'-'+simpleHash(candidate.title+candidate.date));out.push({id,title:guidanceText(candidate.title,120),kind:candidate.kind||'planned_task',date:itemAgendaDate(candidate),start_time:candidate.start_time||null,end_time:candidate.end_time||null,estimated_duration_minutes:candidate.estimated_duration_minutes||45,status:'pencil',confirmation_required:true,source:candidate.source||'ai',project:proj});sig.add(itSig)}return markOverlaps(out)}
function mergeLabStateFromAnalysis(prev,data){const p=prev||labState;const next={...p};const incomingAgenda=Array.isArray(data?.clara_agenda)?data.clara_agenda:[];next.agenda=mergeAgendaTruth(p.agenda||[],incomingAgenda);const dash=data?.dashboard_output||{};const rawAtt=[];for(const t of next.agenda.filter(x=>x._frontend_conflict).map(x=>x.title))if(t)rawAtt.push({title:t,kind:'risico'});for(const x of dash.attention||[]){if(typeof x==='string'&&x.trim())rawAtt.push({title:x.trim(),kind:'check'});else if(x&&x.text)rawAtt.push({title:String(x.text).trim(),kind:ATT_KINDS.has(x.kind)?x.kind:'check',project:x.project||null})}for(const pItem of data?.proposed_items||[])if(pItem.type==='attention')rawAtt.push({title:pItem.title,kind:'check',project:pItem.project||null});const rawFiltered=rawAtt.filter(r=>r&&r.title&&!isGenericAttentionMeta(r.title)&&!attentionTitleMatchesAgenda(r.title,next.agenda));let attention=normalizeAttentionItems(rawFiltered.map((r,i)=>({id:r.id||'at-'+Date.now()+'-'+i+'-'+((Math.random()*1e6)|0),...r,done:false})));if(attention.length<3){const ex=enrichAttentionFromLabState(next.agenda,(data?.proposed_items||[]).filter(i=>['task','reminder'].includes(i.type)),attention);attention=normalizeAttentionItems([...attention,...ex.map((r,i)=>({id:r.id||'at-'+Date.now()+'-x-'+i,...r}))])}if(attention.length>5)attention=attention.slice(0,5);next.attention=normalizeAttentionItems([...(p.attention||[]).filter(i=>!i.done),...attention]).slice(0,7);const incomingTasks=(data?.proposed_items||[]).filter(i=>['task','reminder'].includes(i.type)).map((i,idx)=>({id:i.id||('ta-'+Date.now()+'-'+idx),title:i.title,done:false,project:i.project||null}));const taskSeen=new Set((p.tasks||[]).map(t=>guidanceText(t.title,120).toLowerCase()));for(const t of incomingTasks){const k=guidanceText(t.title,120).toLowerCase();if(!k||taskSeen.has(k))continue;(next.tasks=next.tasks||[]).push({...t,title:guidanceText(t.title,160)});taskSeen.add(k)}next.tasks=(next.tasks||[]).filter(t=>t&&t.title).slice(0,40);const ot=Array.isArray(data?.open_threads)?data.open_threads:[];next.open_threads=Array.isArray(p.open_threads)&&p.open_threads.length?p.open_threads:ot;const dr=data?.day_review||{};next.day_regie={...p.day_regie,items_to_check:dr.items_to_check||p.day_regie?.items_to_check||[],rollover_candidates:dr.rollover_candidates||p.day_regie?.rollover_candidates||[],review_prompt:dr.review_prompt||p.day_regie?.review_prompt||'',suggested_time:dr.suggested_time??p.day_regie?.suggested_time??null,now_first_move:dr.now_first_move||p.day_regie?.now_first_move||''};next.updated_at=new Date().toISOString();return next}
function getItemBlockEndMinutes(i){let e=timeToMin(i.end_time),s=timeToMin(i.start_time);if(e==null&&s!=null)e=s+(i.estimated_duration_minutes||30);return e!=null&&s!=null?e:null}
function isoAtLocalDateMinutes(dateIso,totalMin){let[y,mo,d]=dateIso.split('-').map(Number),dt=new Date(y,mo-1,d,0,0,0,0),H=Math.floor(totalMin/60),M=totalMin%60;dt.setHours(H,M,0,0);return dt.toISOString()}
function shouldPromptAgendaEnd(item,now,activeAgendaDate){let tIso=todayIso(),id=itemAgendaDate(item);if(id!==tIso)return false;let endM=getItemBlockEndMinutes(item);if(endM==null)return false;if(classifyAllDay(item))return false;let st=String(item.status||'');if(isAgendaItemDone(item))return false;if(st==='needs_time'||st==='external_busy')return false;if(item.kind==='external_busy')return false;let sm=timeToMin(item.start_time);if(sm==null)return false;if(item._end_prompt_snoozed_until){let sn=Date.parse(item._end_prompt_snoozed_until);if(!isNaN(sn)&&now.getTime()<sn)return false}let nowFrac=now.getHours()*60+now.getMinutes()+now.getSeconds()/60;if(nowFrac<endM||nowFrac>endM+30)return false;return true}
function findAgendaEndPromptCandidate(now){let c=labState.agenda.filter(i=>shouldPromptAgendaEnd(i,now,activeAgendaDate));if(!c.length)return null;c.sort((a,b)=>(getItemBlockEndMinutes(a)||0)-(getItemBlockEndMinutes(b)||0));return c[0]}
function clearAgendaEndPromptUI(){activeAgendaEndPromptItemId=null;if(endPromptHost)endPromptHost.innerHTML=''}
function clearLocalTestState(){LAB_TEST_STORAGE_KEYS.forEach(k=>{try{localStorage.removeItem(k)}catch(_){}});try{sessionStorage.removeItem(SESSION_STARTUP_KEY)}catch(_){}try{localStorage.removeItem('clara_core_lab_current_context')}catch(_){}stopThinkingStatusFlow();if(isAnalyzing&&currentController){try{currentController.abort()}catch(_){}}setAnalyzing(false);dragState=null;startupAnalysisScheduled=false;dismissedGuidanceIds.clear();hiddenOpenEndIds.clear();labState={agenda:[],attention:[],tasks:[],open_threads:[],project_plans:[],day_regie:{items_to_check:[],rollover_candidates:[],review_prompt:'',suggested_time:null,now_first_move:''},updated_at:new Date().toISOString()};activeAgendaTab='day';activeAgendaDate=null;clearAgendaEndPromptUI();try{document.querySelectorAll('#chatLog .msg .options').forEach(n=>n.remove())}catch(_){}saveLabStateToStorage();clearStartupDoneIfEmpty();renderFromState();setStatus('Lokale teststaat gewist.');applyStartupGreeting()}
function labClearTestControls(){return'<p class="lab-test-row"><button type="button" class="lab-clear-test" data-action="clear-test-state">Wis lokale teststaat</button></p>'}
function showAgendaEndPrompt(item){if(!endPromptHost||!item)return;activeAgendaEndPromptItemId=item.id;let t=esc(String(item.title||'').trim()||'Blok');endPromptHost.innerHTML=`<div class="end-prompt-card" role="dialog" aria-labelledby="end-prompt-h"><div id="end-prompt-h" class="end-prompt-head">Blok afgelopen</div><div class="end-prompt-body">Dit blok liep net af: ${t}. Is dit afgerond?</div><div class="end-prompt-actions"><button type="button" class="end-prompt-btn primary" data-agenda-end-action="done" data-item-id="${esc(item.id)}">Voltooid</button><button type="button" class="end-prompt-btn" data-agenda-end-action="extend15" data-item-id="${esc(item.id)}">15 min erbij</button><button type="button" class="end-prompt-btn" data-agenda-end-action="rollover" data-item-id="${esc(item.id)}">Doorschuiven</button><button type="button" class="end-prompt-btn muted" data-agenda-end-action="later" data-item-id="${esc(item.id)}">Later</button></div></div>`}
function checkAgendaEndPrompts(){let now=new Date();if(activeAgendaEndPromptItemId){let cur=labState.agenda.find(i=>i.id===activeAgendaEndPromptItemId);if(cur&&shouldPromptAgendaEnd(cur,now,activeAgendaDate))return;clearAgendaEndPromptUI()}let next=findAgendaEndPromptCandidate(now);if(next)showAgendaEndPrompt(next)}
function handleAgendaEndPromptAction(itemId,action){let item=labState.agenda.find(i=>i.id===itemId);if(!item){clearAgendaEndPromptUI();return}let d=itemAgendaDate(item);if(action==='done'){item.status='done';item.completed_at=new Date().toISOString();delete item._end_prompt_snoozed_until}else if(action==='extend15'){let endM=getItemBlockEndMinutes(item);if(endM==null){clearAgendaEndPromptUI();touchState();renderFromState();return}endM=Math.min(24*60-1,endM+15);item.end_time=minToTime(endM);let sm=timeToMin(item.start_time);if(sm!=null)item.estimated_duration_minutes=Math.max(15,endM-sm);item._end_prompt_snoozed_until=isoAtLocalDateMinutes(d,endM);labState.agenda=markOverlaps(labState.agenda)}else if(action==='rollover'){let rawTitle=String(item.title||'').trim();item.status='needs_time';item.start_time=null;item.end_time=null;delete item._end_prompt_snoozed_until;let rc=labState.day_regie.rollover_candidates||[];if(rawTitle)labState.day_regie.rollover_candidates=[...rc,rawTitle];labState.attention.push({id:'at-end-'+Date.now()+'-'+((Math.random()*1e6)|0),title:('[Doorschuiven] '+rawTitle).slice(0,220),kind:'check',done:false,project:item.project||null})}else if(action==='later'){item._end_prompt_snoozed_until=new Date(Date.now()+15*60*1000).toISOString()}activeAgendaEndPromptItemId=null;if(endPromptHost)endPromptHost.innerHTML='';touchState();renderFromState()}
function round15(m){return Math.round(m/15)*15}
function setStatus(t){if(statusEl)statusEl.textContent=t||''}
function touchState(){labState.updated_at=new Date().toISOString();saveLabStateToStorage();clearStartupDoneIfEmpty();setStatus('Opgeslagen · gaat mee naar Clara')}
function resizeInput(){input.style.height='32px';input.style.height=Math.min(input.scrollHeight,190)+'px'}
function scrollBottom(){chatLog.scrollTop=chatLog.scrollHeight}
function setAnalyzing(on){isAnalyzing=on;btn.classList.toggle('stop',on);btn.textContent=on?'■':'↑'}
function addUserMessage(t){chatLog.insertAdjacentHTML('beforeend',`<div class="msg user"><div class="msg-body">${esc(t)}</div></div>`);scrollBottom()}
function addThinking(){thinkingId++;let id='thinking-'+thinkingId;chatLog.insertAdjacentHTML('beforeend',`<div class="msg assistant thinking" id="${id}"><div class="msg-body"><div class="typing-indicator" aria-hidden="true"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div><div class="thinking-status" id="${id}-status" role="status" aria-live="polite"></div></div></div>`);scrollBottom();return id}
function removeThinking(id){document.getElementById(id)?.remove()}
function setThinkingStatus(thinkingId,t){let el=document.getElementById(thinkingId+'-status');if(el)el.textContent=t==null?'':String(t)}
function clearThinkingStatus(thinkingId){setThinkingStatus(thinkingId,'')}
const THINKING_STATUS_STEPS=['Input lezen','Lokale planning ophalen','Broninhoud lezen','Projectcontext wegen','Agenda voorstel maken','Keuzes scheiden','Route opbouwen','Overlap controleren','Resultaat bijwerken'];
let thinkingFlowTimer=null,thinkingFlowToken=0,thinkingFlowThinkingId=null,thinkingFlowStepIdx=0;
function stopThinkingStatusFlow(){thinkingFlowToken++;if(thinkingFlowTimer){clearTimeout(thinkingFlowTimer);thinkingFlowTimer=null}thinkingFlowThinkingId=null}
function startThinkingStatusFlow(thinkingId){stopThinkingStatusFlow();thinkingFlowThinkingId=thinkingId;const my=thinkingFlowToken;thinkingFlowStepIdx=0;setThinkingStatus(thinkingId,THINKING_STATUS_STEPS[0]);function tick(){if(my!==thinkingFlowToken||thinkingFlowThinkingId!==thinkingId)return;const gap=700+Math.random()*500;thinkingFlowTimer=setTimeout(()=>{if(my!==thinkingFlowToken||thinkingFlowThinkingId!==thinkingId)return;if(thinkingFlowStepIdx<THINKING_STATUS_STEPS.length-1){thinkingFlowStepIdx++;setThinkingStatus(thinkingId,THINKING_STATUS_STEPS[thinkingFlowStepIdx]);tick()}else{function pulse(){if(my!==thinkingFlowToken||thinkingFlowThinkingId!==thinkingId)return;pulse.n=(pulse.n||0)+1;setThinkingStatus(thinkingId,pulse.n%2?THINKING_STATUS_STEPS[8]:THINKING_STATUS_STEPS[7]);thinkingFlowTimer=setTimeout(pulse,1100+Math.random()*400)}thinkingFlowTimer=setTimeout(pulse,gap)}},gap)}tick()}
function formatAgendaDateLine(d){const s=d.toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});return s? s.charAt(0).toUpperCase()+s.slice(1):'—'}
function renderWeatherMock(){if(!weatherStrip)return;const cols=[...weatherStrip.querySelectorAll('.wcol')];if(!cols.length)return;const now=new Date();const baseH=now.getHours();const temps=[29,29,28,28];cols.forEach((c,ix)=>{const tEl=c.querySelector('[data-wtemp]');if(tEl)tEl.textContent=temps[ix%temps.length]+'°';const timeEl=c.querySelector('[data-wtime]');if(timeEl&&ix>0){const h=(baseH+ix)%24;timeEl.textContent=String(h).padStart(2,'0')+':00'}const icon=c.querySelector('[data-wicon]');if(icon){icon.innerHTML='<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" aria-hidden=\"true\"><path d=\"M7 18h10a4 4 0 0 0 .7-7.94A5.5 5.5 0 0 0 6.2 9.9 3.6 3.6 0 0 0 7 18Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\".92\"/></svg>'}})}
function updateDate(){let n=new Date(),shown=activeAgendaDate?new Date(`${activeAgendaDate}T12:00:00`):n;clockHour.textContent=String(n.getHours()).padStart(2,'0');clockMinute.textContent=String(n.getMinutes()).padStart(2,'0');if(agendaDateHeader)agendaDateHeader.textContent=formatAgendaDateLine(shown);renderWeatherMock()}
function markOverlaps(items){let out=items.map(i=>({...i,_frontend_conflict:false}));let timed=out.map((i,idx)=>({i,idx,s:timeToMin(i.start_time),e:timeToMin(i.end_time)})).filter(x=>x.s!=null&&!isAgendaItemDone(x.i));timed.forEach(x=>{if(x.e==null)x.e=x.s+(x.i.estimated_duration_minutes||30)});for(let a=0;a<timed.length;a++)for(let b=a+1;b<timed.length;b++)if(timed[a].i.date===timed[b].i.date&&timed[a].s<timed[b].e&&timed[b].s<timed[a].e){out[timed[a].idx]._frontend_conflict=true;out[timed[b].idx]._frontend_conflict=true}out.forEach(i=>{if(i.status==='conflict'&&!i._frontend_conflict)i.status='pencil'});return out}
const NEUTRAL_START=['Begin klein: één helder blok is genoeg om de dag op gang te krijgen.','Kijk eerst wat vastligt, daarna pas wat erbij kan.','Maak ruimte voor het belangrijkste, niet voor het luidste.','Vandaag hoeft niet vol; het moet kloppen.','Eerst overzicht, daarna tempo.'];
const ATT_KINDS=new Set(['risico','keuze','check','wacht','past_niet','project']);
const ATT_LABEL_NL={risico:'Risico',keuze:'Keuze',check:'Check',wacht:'Wacht',past_niet:'Past niet',project:'Project'};
function simpleHash(str){let h=0;for(let i=0;i<str.length;i++)h=Math.imul(31,h)+str.charCodeAt(i)|0;return Math.abs(h)}
function rememberLastStartupGreeting(ix){try{localStorage.setItem('clara_last_greeting_ix',String(ix))}catch(_){}}
function formatAttentionLabel(kind){return ATT_LABEL_NL[kind]||'Check'}
function getAttentionType(item){return item&&ATT_KINDS.has(item.kind)?item.kind:'check'}
function coerceAttentionItem(raw,i){if(!raw)return null;if(typeof raw==='string'){const s=raw.trim();if(!s)return null;return{id:'at-'+Date.now()+'-'+i,title:s.slice(0,220),kind:'check',done:false}}const title=String(raw.title||raw.text||'').trim();if(!title)return null;const k=raw.kind&&ATT_KINDS.has(raw.kind)?raw.kind:'check';return{id:raw.id||'at-'+Date.now()+'-'+i,title:title.slice(0,220),kind:k,done:!!raw.done,project:raw.project||null}}
function normalizeAttentionItems(items){const arr=Array.isArray(items)?items:[];const out=[],seen=new Set();for(let i=0;i<arr.length;i++){const it=coerceAttentionItem(arr[i],i);if(!it)continue;const k=it.title.toLowerCase();if(seen.has(k))continue;seen.add(k);out.push(it)}return out}
function isGenericAttentionMeta(title){const t=String(title||'').toLowerCase().trim();if(t.length<10)return false;const bans=[/projectbrain.*(aandacht|bewaren|opnemen)/,/bewaar.*(keuzes|risico).*projectbrain/,/geen\s+overlap/,/plan\s+geen\s+overlap/,/voorkom.*overlap/,/verkorten\s+van\s+taken/,/taken\s+niet\s+verkorten/,/geen\s+projectbrain[-\s]?dump/,/geen\s+dump/,/maak\s+geen\s+dump/,/projectbrain\s+als\s+context/,/gebruik\s+projectbrain\s+als/,/^twijfel:\s*projectbrain\s+is\s+beperkt/,/potloodblokken\s+zijn\s+geen\s+harde/,/controleer\s+per\s+project\s+of\s+de\s+duur/i,/schuif\s+desnoods\s+in\s+de\s+ui/i,/bewaar\s+.*\s+in\s+de\s+aandacht/i];return bans.some(re=>re.test(t))}
function attentionTitleMatchesAgenda(title,agenda){const s=String(title||'').trim().toLowerCase();if(!s)return true;return(agenda||[]).some(i=>{const tt=String(i.title||'').trim().toLowerCase();return tt&&tt===s})}
function enrichAttentionFromLabState(agenda,tasks,existing){const out=[];const have=new Set((existing||[]).map(i=>i.title.toLowerCase()));function add(title,kind,project){const k=title.toLowerCase();if(!title||have.has(k))return;have.add(k);out.push({id:'at-h-'+Date.now()+'-'+out.length,title,kind,done:false,project})}const blob=[...(agenda||[]),...(tasks||[])].map(i=>`${i.title||''} ${i.project||''}`).join(' ').toLowerCase();if(/mobiel|responsive|marlon|push|vercel|core\s*lab|clara[-\s]?4[-\s]?core/i.test(blob))add('Mobiel goed krijgen vóór push of Marlon-review','check','clara-core-lab');if(/begeister|grens|rollen|gezamenlijk|autonoom|lalampe/.test(blob))add('Begeister-grens: gezamenlijk versus LaLampe versus autonoom bepalen','keuze','begeister');if(/\bafk\b|ecolog|maatschappij|aanvraag|landjuweel|amarte/.test(blob))add('AFK-aanvraag ecologisch houden, niet onbedoeld maatschappijkritisch','risico','afk-landjuweel-amarte');if(/lalampe|lampe|materiaal|lamp|workshop/.test(blob))add('LaLampe: materiaal, lampenkappen of workshopflow nog nalopen','check','lalampe');return out}
function pickContextLineForStartup(ls){const agenda=markOverlaps([...(ls.agenda||[])]);if(agenda.some(i=>i._frontend_conflict))return'Er staat overlap in je agenda; los één blok eerst op.';if(agenda.some(i=>i.status==='needs_time'))return'Er staat werk zonder vaste plek; kies waar het vandaag past.';const att=normalizeAttentionItems(ls.attention||[]);const open=att.filter(i=>!i.done);if(open.length)return`Er staan ${open.length} aandachtspunten open; pak het belangrijkste eerst.`;const tk=(ls.tasks||[]).filter(t=>!t.done);if(tk.length)return`${tk.length} taken wachten; begin met de kleinste afronding.`;if(agenda.some(i=>i.status==='pencil'))return'Er staan potloodblokken klaar om te bevestigen of te schuiven.';return null}
function pickStartupGreeting(ls){const ctx=pickContextLineForStartup(ls);const pool=ctx?[ctx,...NEUTRAL_START]:NEUTRAL_START.slice();const t=new Date();const salt=`${t.getFullYear()}-${t.getMonth()+1}-${t.getDate()}-${t.getHours()}-${simpleHash(JSON.stringify({a:ls.agenda,at:ls.attention,tk:ls.tasks,dr:ls.day_regie}))}`;let h=simpleHash(salt)%pool.length;let last=-1;try{last=parseInt(localStorage.getItem('clara_last_greeting_ix')||'-1',10)}catch(_){}if(h===last)h=(h+1)%pool.length;rememberLastStartupGreeting(h);return pool[h]}
function applyStartupGreeting(){const wrap=document.querySelector('#chatLog .msg.assistant:not(.thinking)');if(!wrap)return;const text=pickStartupGreeting(labState);wrap.innerHTML=`<div class="msg-body">${esc(text)}</div>`}
function ellip(s,max){s=String(s||'').trim();return s.length<=max?s:s.slice(0,max-1)+'…'}
function pickNowStep(ls){const dr=ls.day_regie||{};const nfm=String(dr.now_first_move||'').trim();if(nfm.length>16){const t=todayIso();const titles=(ls.agenda||[]).filter(i=>(i.date||t)===t).map(i=>String(i.title||'').trim().toLowerCase());const nml=nfm.toLowerCase();if(!titles.some(tt=>tt&&nml===tt))return ellip(nfm,160)}const agenda=markOverlaps([...(ls.agenda||[])]);const today=todayIso();const att=normalizeAttentionItems(ls.attention||[]);const risk=att.find(i=>!i.done&&(i.kind==='risico'||i.kind==='past_niet'));if(risk)return ellip(`${formatAttentionLabel(risk.kind)} — ${risk.title}`,72);const w=att.find(i=>!i.done&&i.kind==='wacht');if(w)return ellip(`${formatAttentionLabel(w.kind)} — ${w.title}`,72);const timed=agenda.filter(i=>(i.date||today)===today&&i.start_time&&timeToMin(i.start_time)!=null&&!classifyAllDay(i)&&i.status!=='needs_time'&&!isAgendaItemDone(i)).sort((a,b)=>(timeToMin(a.start_time)-timeToMin(b.start_time)));if(timed.length){const ti=timed[0],title=String(ti.title||'').trim(),blob=`${title} ${ti.project||''}`.toLowerCase();const why=/core|lab|mobiel|marlon|push|vercel/.test(blob)?'dat bepaalt of Marlon straks redelijk mee kan kijken.':'dat zet volgorde voor de rest van de dag.';return ellip(`Start met ${title}; ${why}`,78)}const nt=agenda.find(i=>(i.date||today)===today&&i.status==='needs_time');if(nt)return ellip(`Past niet — ${nt.title}`,72);const task=(ls.tasks||[]).find(x=>!x.done);if(task)return ellip(`Pak eerst "${task.title}" vast in de dag voordat je opschaling doet.`,72);const o=att.find(i=>!i.done);if(o)return ellip(`${formatAttentionLabel(o.kind)} — ${o.title}`,72);return'Kort orienteren: wat is het belangrijkste vaste punt vandaag?'}
function agendaTitlesToday(ls){const t=todayIso();return(ls.agenda||[]).filter(i=>(i.date||t)===t).map(i=>String(i.title||'').trim().toLowerCase()).filter(Boolean)}
function lineLooksLikeAgendaTitle(line,titles){const n=String(line||'').trim().toLowerCase();if(!n)return true;return titles.some(tt=>tt&&(tt===n||(Math.min(tt.length,n.length)>=10&&(tt.includes(n)||n.includes(tt)))))}
function pickLaterChecks(ls){const titles=agendaTitlesToday(ls);let raw=[];for(const t of ls.day_regie?.items_to_check||[]){const s=String(t||'').trim();if(s&&!lineLooksLikeAgendaTitle(s,titles)&&!isGenericAttentionMeta(s))raw.push(s)}for(const t of ls.day_regie?.rollover_candidates||[]){if(raw.length>=2)break;const s=String(t||'').trim();if(s&&!lineLooksLikeAgendaTitle(s,titles)&&!isGenericAttentionMeta(s))raw.push(`Door: ${s}`)}if(!raw.length&&titles.some(tt=>/mobiel|core|lab|marlon|push|vercel/.test(tt))){raw.push('Controleer lokaal en mobiel vóór je pusht of Marlon uitnodigt.');raw.push('Zet pas daarna de review-link klaar als alles nog klopt.')}else if(raw.length<2&&titles.length){raw.push('Controleer of wat op de agenda staat nog strookt met je eerdere keuzes.')}return raw.slice(0,2).map(s=>ellip(s,76))}
function pickEndOfDayPrompt(ls){const r=String(ls.day_regie?.review_prompt||'').trim();if(!r||r.length<16||/^wil je de potlood/i.test(r)||/^kloppen de/i.test(r))return'Wat is af genoeg om online te tonen, en wat schuift door?';return ellip(r,84)}
function dayRegieIsEmpty(ls){const d=ls.day_regie||{};const bare=!(d.items_to_check||[]).length&&!(d.rollover_candidates||[]).length&&!String(d.review_prompt||'').trim()&&!d.suggested_time&&!String(d.now_first_move||'').trim();return bare&&!(ls.agenda||[]).length&&!(ls.attention||[]).length&&!(ls.tasks||[]).length}
function guidanceText(v,max=120){return ellip(String(v||'').replace(/\s+/g,' ').trim(),max)}
function suggestionChip(label,action,id,text){return`<button type="button" class="guide-chip" data-suggestion-action="${esc(action)}" data-id="${esc(id)}" data-title="${esc(text||'')}">${esc(label)}</button>`}
function uniqueGuidanceLines(lines,max){const out=[],seen=new Set();for(const raw of lines){const pass=filterUserFacingLine(raw);if(!pass)continue;const s=guidanceText(pass,150);const k=s.toLowerCase();if(!s||s.length<5||seen.has(k)||isGenericAttentionMeta(s))continue;seen.add(k);out.push(s);if(out.length>=max)break}return out}
function isUrgentOpenEnd(text,source){const s=String(text||'').toLowerCase();return source==='question'||/\?|conflict|overlap|deadline|vandaag|straks|marlon|demo|risico|blokker|blocking|moet|keuze|onzeker|niet duidelijk|exacte tijd/.test(s)}
function agendaTitleNormSetForSuggestions(ls){const t=activeAgendaDate||todayIso();const set=new Set((ls.agenda||[]).filter(i=>(i.date||t)===t&&!isAgendaItemDone(i)).map(i=>guidanceText(i.title,200).toLowerCase()).filter(Boolean));return set}
function suggestionDuplicatesAgendaTitle(text,set){const n=guidanceText(text,200).toLowerCase();if(!n)return true;for(const ag of set){if(n===ag)return true;if(ag.length>=12&&n.length>=12&&(n.includes(ag)||ag.includes(n)))return true}return false}
function projectLabelFor(p){return getProjectVisual(p).label||'ALGEMEEN'}
function sourceLabelFor(source){if(source==='agenda')return'agenda';if(source==='task')return'los punt';if(source==='day_regie')return'regie';if(source==='suggestion')return'voorstel';if(source==='thread')return'open item';return String(source||'')||'voorstel'}
function buildReason(source){if(source==='agenda')return'Uit je bestaande planning.';if(source==='task')return'Uit losse punten (nog niet ingepland).';if(source==='day_regie')return'Past bij je eerstvolgende stap.';if(source==='suggestion')return'Logisch vervolg op wat er al speelt.';if(source==='thread')return'Er staat nog een open keuze.';return''}
function pickTopPerProject(items,maxTotal,maxPerProject){const by=new Map();for(const it of items){const k=getProjectVisual(it.project).key||'none';if(!by.has(k))by.set(k,[]);by.get(k).push(it)}const keys=[...by.keys()];const out=[];let round=0;while(out.length<maxTotal&&round<maxPerProject){for(const k of keys){const arr=by.get(k);if(!arr||arr.length<=round)continue;out.push(arr[round]);if(out.length>=maxTotal)break}round++}return out}
function deriveAgendaSuggestions(ls){const titleSet=agendaTitleNormSetForSuggestions(ls);const lines=[];for(const i of ls.agenda||[]){if(isAgendaItemDone(i)||i.status==='needs_time'||timeToMin(i.start_time)!=null)continue;const t=String(i.title||'').trim();const tf=filterUserFacingLine(t);if(tf&&!/dagbrede|geen/i.test(tf)&&!suggestionDuplicatesAgendaTitle(tf,titleSet))lines.push({id:i.id||'ag-'+simpleHash(t),source:'agenda',text:tf,project:i.project||null,reason:buildReason('agenda')})}for(const i of ls.tasks||[]){if(!i.done&&i.title){const tf=filterUserFacingLine(i.title);if(tf&&!suggestionDuplicatesAgendaTitle(tf,titleSet))lines.push({id:i.id||'ta-'+simpleHash(i.title),source:'task',text:tf,project:i.project||null,reason:buildReason('task')})}}const now=String(ls.day_regie?.now_first_move||'').trim();const nowF=filterUserFacingLine(now);if(nowF&&!suggestionDuplicatesAgendaTitle(nowF,titleSet))lines.unshift({id:'now-'+simpleHash(nowF),source:'day_regie',text:nowF,project:'clara-core-lab',reason:buildReason('day_regie')});if(!lines.length){const blob=[...(ls.attention||[]),...(ls.open_threads||[])].map(i=>`${i.title||''} ${i.question||''} ${i.project||''}`).join(' ').toLowerCase();if(/marlon|demo|core\s*lab|clara/i.test(blob))lines.push({id:'demo-check',source:'suggestion',text:'Clara Core Lab: inhoudelijk nalopen voor demo',project:'clara-core-lab',reason:buildReason('suggestion')});else lines.push({id:'first-step',source:'suggestion',text:'Algemeen: één concrete eerstvolgende stap kiezen',project:null,reason:buildReason('suggestion')})}const uniq=uniqueGuidanceLines(lines.map(x=>x.text),10).map((text,idx)=>{const g=guidanceText(text,150);const src=lines.find(x=>guidanceText(x.text,150)===g)||{};return{id:src.id||'sg-'+idx,source:src.source||'suggestion',project:src.project||null,reason:src.reason||'',text:g}}).filter(i=>!dismissedGuidanceIds.has(i.id));return pickTopPerProject(uniq,5,2)}
function deriveOpenEnds(ls){const lines=[];for(const i of ls.open_threads||[]){if(i&&i.status!=='closed'){const tx=filterUserFacingLine(i.question||i.title||i.context);if(tx)lines.push({id:i.id,source:'thread',text:tx,project:i.project||null,reason:buildReason('thread')})}}for(const q of ls.questions||[]){const tx=filterUserFacingLine(q);if(tx)lines.push({id:'q-'+simpleHash(tx),source:'question',text:tx,project:'clara-core-lab',reason:'Er is nog iets onduidelijk.'})}for(const i of normalizeAttentionItems(ls.attention||[])){if(!i.done){const tx=filterUserFacingLine(i.title);if(tx)lines.push({id:i.id,source:'attention',text:tx,project:i.project||null,reason:'Dit blijft relevant om scherp te krijgen.'})}}for(const i of ls.agenda||[]){if(i.status==='needs_time'){const tx=filterUserFacingLine(`${i.title||'Werk'} heeft nog geen vaste plek.`);if(tx)lines.push({id:i.id,source:'agenda',text:tx,project:i.project||null,reason:'Dit heeft nog een plek nodig.'})}if(i._frontend_conflict){const tx=filterUserFacingLine(`Overlap rond ${i.title||'een blok'}.`);if(tx)lines.push({id:i.id+'-c',source:'agenda',text:tx,project:i.project||null,reason:'Er is overlap die eerst opgelost moet worden.'})}}const uniq=uniqueGuidanceLines(lines.map(x=>x.text),12).map((text,idx)=>{const g=guidanceText(text,150);const src=lines.find(x=>guidanceText(x.text,150)===g)||{};return{id:src.id||'oe-'+idx,source:src.source||'note',project:src.project||null,reason:src.reason||'',text:g,urgent:isUrgentOpenEnd(g,src.source)}}).filter(i=>!hiddenOpenEndIds.has(`${i.source}:${i.id}`));const ordered=pickTopPerProject([...uniq.filter(i=>i.urgent),...uniq.filter(i=>!i.urgent)],3,1);lastOpenItemRef=ordered.length?{id:ordered[0].id,source:ordered[0].source}:null;return ordered}
function renderOpenEndsPanel(ls){const open=deriveOpenEnds(ls);if(!open.length)return'<div class="card guide-card guide-open"><p class="empty">Geen open items.</p>'+labClearTestControls()+'</div>';const rows=open.map(i=>`<div class="item guide-open-item ${i.urgent?'urgent':''}" data-open-source="${esc(i.source)}" data-id="${esc(i.id)}"><div class="guide-open-text">${esc(i.text)}<div class="sub">${esc(projectLabelFor(i.project))} · ${esc(sourceLabelFor(i.source))}${i.reason?` · ${esc(guidanceText(i.reason,80))}`:''}</div><div class="open-answer-row"><span class="open-answer-label">Antwoord</span><input class="open-answer-input" data-open-answer-input data-id="${esc(i.id)}" data-open-source="${esc(i.source)}" placeholder="Typ hier…"><button type="button" class="open-answer-save" data-open-answer-save data-id="${esc(i.id)}" data-open-source="${esc(i.source)}">Opslaan</button><button type="button" class="open-answer-close" data-open-action="close" data-id="${esc(i.id)}" data-open-source="${esc(i.source)}" aria-label="Verwijder open item">×</button></div></div></div>`).join('');return`<div class="card guide-card guide-open">${rows}`+labClearTestControls()+'</div>'}
function classifyAllDay(i){let s=timeToMin(i.start_time),e=timeToMin(i.end_time),d=i.estimated_duration_minutes||(s!=null&&e!=null?e-s:null);return s==null||i.status==='needs_time'||d>=300}
function isAgendaPencilLike(i){if(!i||i._frontend_conflict)return false;if(i.status==='confirmed')return false;if(i.status==='pencil')return true;if(i.confirmation_required===true)return true;if(String(i.source||'')==='projectbrain_startup')return true;if(String(i.kind||'')==='planned_task'&&!isAgendaItemDone(i))return true;return false}
function getProjectVisual(project){const raw=String(project||'').trim();const s=raw.toLowerCase();if(!s)return{key:'none',label:'ALGEMEEN',className:'project-none',hasProject:true};if(/\bafk\b|landjuweel|amarte|afk\s*\/\s*landjuweel|afk\s+landjuweel\s+amarte/.test(s))return{key:'afk',label:'AFK',className:'project-afk',hasProject:true};if(/lalampe|la\s*lampe/.test(s))return{key:'lalampe',label:'LALAMPE',className:'project-lalampe',hasProject:true};if(/begeister/.test(s))return{key:'begeister',label:'BEGEISTER',className:'project-begeister',hasProject:true};if(/clara-core|core\s*lab|clara\s*[-\s]?4|clara\s*lab|\bclara\b/.test(s))return{key:'clara',label:'CLARA',className:'project-clara',hasProject:true};return{key:'none',label:'ALGEMEEN',className:'project-none',hasProject:true}}
function renderAgendaLegend(){return'<div class="agenda-legend" aria-label="Projectkleuren"><span class="agenda-leg agenda-leg-clara"><i class="agenda-leg-dot" aria-hidden="true"></i>CLARA</span><span class="agenda-leg-sep">·</span><span class="agenda-leg agenda-leg-lalampe"><i class="agenda-leg-dot" aria-hidden="true"></i>LALAMPE</span><span class="agenda-leg-sep">·</span><span class="agenda-leg agenda-leg-begeister"><i class="agenda-leg-dot" aria-hidden="true"></i>BEGEISTER</span><span class="agenda-leg-sep">·</span><span class="agenda-leg agenda-leg-afk"><i class="agenda-leg-dot" aria-hidden="true"></i>AFK</span></div>'}
function syncFromAnalysis(data){labState=mergeLabStateFromAnalysis(labState,data);saveLabStateToStorage()}
function renderTimeline(items,startHour,endHour,label){let start=startHour*60,end=endHour*60,total=end-start,hours=[];for(let m=start;m<=end;m+=60)hours.push(m);let labels=hours.map(m=>`<div class="hour" style="top:${(m-start)/total*100}%">${minToTime(m)}</div><div class="tick" style="top:${(m-start)/total*100}%"></div>`).join('');let lines=hours.map(m=>`<div class="line" style="top:${(m-start)/total*100}%"></div>`).join('');let blocks=items.map(i=>{let s=timeToMin(i.start_time),e=timeToMin(i.end_time),dur=i.estimated_duration_minutes||(e!=null&&s!=null?e-s:30)||30,itemEnd=e??s+dur,visibleStart=Math.max(start,s),visibleEnd=Math.min(end,itemEnd),rawH=(visibleEnd-visibleStart)/total*100,h=Math.max(2.05,rawH-0.92),top=(visibleStart-start)/total*100+0.1,compact=(itemEnd-s)<=22||rawH<4.5,st=i._frontend_conflict?'conflict':i.status==='confirmed'?'confirmed':'pencil',stAg=st==='conflict'?'agenda-item--conflict':st==='confirmed'?'agenda-item--confirmed':'agenda-item--pencil',pv=getProjectVisual(i.project),sug=isAgendaPencilLike(i)&&st!=='conflict',t0=esc(i.start_time||''),t1=esc(i.end_time||minToTime(itemEnd)),tr=t0+'–'+t1,done=isAgendaItemDone(i),projEl=pv.hasProject?`<span class="agenda-item-project">${esc(pv.label)}</span>`:'',confirm=i.status==='pencil'?`<button type="button" class="plain" data-agenda-action="confirm" data-id="${esc(i.id)}">✓</button>`:'',meta=`<div class="agenda-item-meta">${projEl}<span class="agenda-item-time">${tr}</span><span class="agenda-item-actions">${confirm}<button type="button" class="plain" data-agenda-action="delete" data-id="${esc(i.id)}">×</button></span></div>`,sugCls=sug?' agenda-item--suggest':'',doneCls=done?' agenda-item--done':'';return `<div class="event ${st} ${stAg} ${compact?'compact':''} ${pv.className}${sugCls}${doneCls}" data-id="${esc(i.id)}" data-project="${esc(pv.key)}" style="top:${top}%;height:${h}%"><div class="handle top" data-resize="start" data-id="${esc(i.id)}"></div><div class="event-body agenda-item-inner"><span class="event-title agenda-item-title" contenteditable="true" data-agenda-field="title" data-id="${esc(i.id)}">${esc(i.title)}</span>${meta}</div><div class="handle bottom" data-resize="end" data-id="${esc(i.id)}"></div></div>`}).join('');return `<div class="timeline-card" data-start="${start}" data-end="${end}"><div class="section-head"><strong>${esc(label)}</strong><span>${minToTime(start)} – ${minToTime(end)}</span></div><div class="timeline"><div class="axis">${labels}</div><div class="events">${lines}${blocks}</div></div></div>`}
function renderAgenda(){if(agendaHeadTabs)agendaHeadTabs.innerHTML='';let allA=labState.agenda;if(!allA.length){agendaCol.innerHTML='<p class="empty">Geen agenda-items.</p>';updateDate();return}let dates=[...new Set(allA.map(i=>i.date).filter(Boolean))].sort();if(!activeAgendaDate)activeAgendaDate=dates[0]||todayIso();let dateItems=allA.filter(i=>(i.date||activeAgendaDate)===activeAgendaDate&&!isAgendaItemDone(i));let all=dateItems.filter(classifyAllDay),timed=dateItems.filter(i=>!classifyAllDay(i)&&timeToMin(i.start_time)!=null),day=timed.filter(i=>timeToMin(i.start_time)<1140),eve=timed.filter(i=>timeToMin(i.start_time)>=1140),shown=activeAgendaTab==='day'?day:eve,labelTab=activeAgendaTab==='day'?'Overdag':'Avond';if(agendaHeadTabs)agendaHeadTabs.innerHTML=`<button type="button" class="tab ${activeAgendaTab==='day'?'active':''}" data-agenda-tab="day">Overdag</button><button type="button" class="tab ${activeAgendaTab==='evening'?'active':''}" data-agenda-tab="evening">Avond</button>`;updateDate();agendaCol.innerHTML=`<div class="agenda-stack"><span class="pill pill-daybread">${all.length?all.map(i=>esc(i.title)).join(' · '):'Geen dagbrede blokken'}</span><div class="agenda-timeline-host">${renderTimeline(shown,activeAgendaTab==='day'?10:19,activeAgendaTab==='day'?19:24,`${dateLabel(activeAgendaDate)} · ${labelTab}`)}</div>${renderAgendaLegend()}</div>`}
function renderList(title,items,kind){return `<div class="card"><h3>${esc(title)}</h3>${items&&items.length?items.map(i=>`<div class="item"><button class="box ${i.done?'done':''}" data-list-kind="${kind}" data-list-action="toggle" data-id="${esc(i.id)}"></button><div style="flex:1"><div class="editable" contenteditable="true" data-list-kind="${kind}" data-list-field="title" data-id="${esc(i.id)}">${esc(i.title)}</div>${i.project?`<div class="sub">${esc(i.project)}</div>`:''}</div><button class="plain" data-list-kind="${kind}" data-list-action="delete" data-id="${esc(i.id)}">×</button></div>`).join(''):'<p class="empty">Geen.</p>'}</div>`}
function renderRegie(){regieCol.innerHTML=renderOpenEndsPanel(labState)}
function renderGuidance(){attentionCol.innerHTML=renderAgendaSuggestionsPanel(labState)}
function renderFromState(){labState.agenda=markOverlaps(labState.agenda);labState.attention=normalizeAttentionItems(labState.attention);labState.open_threads=Array.isArray(labState.open_threads)?labState.open_threads:[];renderAgenda();renderGuidance();renderRegie();checkAgendaEndPrompts()}
function overlayItemCard(){return''}

function renderProjectPlansEntry(){
  const count=(labState.project_plans||[]).length;
  const label=count?`Projectplannen (${count})`:'Projectplannen';
  return `<div class="pp-projectplans-entry"><button type="button" class="pp-btn" data-projectplans-action="open">${esc(label)}</button></div>`;
}

function projectPlanDependencyLabel(v){if(v==='after_prev')return'na vorige stap';if(v==='parallel')return'parallel';if(v==='external_wait')return'wacht op extern';return'geen'}
function projectPlanStatusLabel(v){if(v==='done')return'klaar';if(v==='paused')return'gepauzeerd';if(v==='archived')return'gearchiveerd';return'actief'}
function stepStatusLabel(v){if(v==='done')return'klaar';if(v==='doing')return'bezig';return'todo'}

function ensureProjectPlanExists(){if(!Array.isArray(labState.project_plans))labState.project_plans=[]}
function getProjectPlanById(id){ensureProjectPlanExists();return labState.project_plans.find(p=>String(p.id)===String(id))||null}
function upsertProjectPlan(plan){ensureProjectPlanExists();const ix=labState.project_plans.findIndex(p=>String(p.id)===String(plan.id));if(ix>=0)labState.project_plans[ix]=plan;else labState.project_plans.unshift(plan)}

function newProjectPlanFromSeed({project,title,goal,context,source}){
  const id='pp-'+Date.now()+'-'+((Math.random()*1e6)|0);
  const proj=project||inferProjectFromTitle(title||goal||'')||null;
  const now=new Date().toISOString();
  const plan=normalizeProjectPlan({id,project:proj,title:title||projectLabelFor(proj),goal:goal||'',deadline:'',status:'active',context:context||'',steps:[],created_at:now,updated_at:now,source:source||'local'});
  if(!plan.steps.length){
    plan.steps=[
      {id:id+'-s1',title:'Doel en randvoorwaarden scherpzetten',status:'todo',estimated_duration_minutes:60,dependency_type:'none',depends_on_step_id:'',deadline:'',tasks:[{id:id+'-s1-t1',title:'Kort doel en “af genoeg” vastleggen',status:'todo',estimated_duration_minutes:25,deadline:'',source_reason:'Start helder'}]},
      {id:id+'-s2',title:'Eerste werkende kernstap bouwen/testen',status:'todo',estimated_duration_minutes:90,dependency_type:'after_prev',depends_on_step_id:id+'-s1',deadline:'',tasks:[{id:id+'-s2-t1',title:'Kernflow of POC stap 1 doen',status:'todo',estimated_duration_minutes:45,deadline:'',source_reason:'Eerste tastbaar resultaat'}]},
      {id:id+'-s3',title:'Afronden en controleren',status:'todo',estimated_duration_minutes:60,dependency_type:'after_prev',depends_on_step_id:id+'-s2',deadline:'',tasks:[{id:id+'-s3-t1',title:'Laatste checklijstje afwerken',status:'todo',estimated_duration_minutes:25,deadline:'',source_reason:'Klaar maken'}]}
    ];
  }
  return normalizeProjectPlan(plan,0);
}

function openProjectPlanOverlay(id){
  if(!projectPlanOverlay||!projectPlanOverlayBody)return;
  ensureProjectPlanExists();
  if(!id){
    const plan=newProjectPlanFromSeed({project:null,title:'Projectplan',goal:'',context:'',source:'ui'});
    upsertProjectPlan(plan);
    id=plan.id;
    touchState();
  }
  projectPlanOverlayOpenId=String(id);
  renderProjectPlanOverlay();
  projectPlanOverlay.classList.remove('hidden');
}

function closeProjectPlanOverlay(save){
  if(save)touchState();
  projectPlanOverlayOpenId=null;
  projectPlanOverlay?.classList.add('hidden');
}

function renderProjectPlanOverlay(){
  if(!projectPlanOverlayBody)return;
  const plan=getProjectPlanById(projectPlanOverlayOpenId);
  if(!plan){projectPlanOverlayBody.innerHTML='<div class="pp-muted">Geen projectplan.</div>';return;}
  const pv=projectLabelFor(plan.project);
  const header=`<div class="pp-card"><div class="pp-row"><div class="pp-muted"><strong>${esc(pv)}</strong> · ${esc(projectPlanStatusLabel(plan.status))}${plan.deadline?` · deadline ${esc(plan.deadline)}`:''}</div><div class="pp-actions"><button type="button" class="pp-btn" data-pp-action="new-step">Stap toevoegen</button><button type="button" class="pp-btn" data-pp-action="new-task">Taak toevoegen</button><button type="button" class="pp-btn" data-pp-action="new-plan">Nieuw plan</button></div></div></div>`;
  const meta=`<div class="pp-card"><h4>Plan</h4><div class="pp-grid">
    <div class="pp-field" style="grid-column:span 6"><label>Project</label><select class="pp-select" data-pp-field="project">
      <option value="">Algemeen</option>
      <option value="clara-core-lab" ${plan.project==='clara-core-lab'||plan.project==='clara'?'selected':''}>Clara</option>
      <option value="lalampe" ${plan.project==='lalampe'?'selected':''}>LaLampe</option>
      <option value="begeister" ${plan.project==='begeister'?'selected':''}>Begeister</option>
      <option value="afk-landjuweel-amarte" ${plan.project==='afk-landjuweel-amarte'||plan.project==='afk'?'selected':''}>AFK</option>
    </select></div>
    <div class="pp-field" style="grid-column:span 6"><label>Status</label><select class="pp-select" data-pp-field="status">
      <option value="active" ${plan.status==='active'?'selected':''}>actief</option>
      <option value="paused" ${plan.status==='paused'?'selected':''}>gepauzeerd</option>
      <option value="archived" ${plan.status==='archived'?'selected':''}>gearchiveerd</option>
    </select></div>
    <div class="pp-field" style="grid-column:span 8"><label>Titel</label><input class="pp-input" value="${esc(plan.title||'')}" data-pp-field="title"></div>
    <div class="pp-field" style="grid-column:span 4"><label>Deadline</label><input class="pp-input" type="date" value="${esc(plan.deadline||'')}" data-pp-field="deadline"></div>
    <div class="pp-field" style="grid-column:span 12"><label>Doel</label><textarea class="pp-textarea" data-pp-field="goal">${esc(plan.goal||'')}</textarea></div>
    <div class="pp-field" style="grid-column:span 12"><label>Context / reden</label><textarea class="pp-textarea" data-pp-field="context">${esc(plan.context||'')}</textarea></div>
  </div></div>`;
  const steps=(plan.steps||[]).map((s,ix)=>{
    const tasks=(s.tasks||[]).map(t=>`<div class="pp-task" data-pp-task-id="${esc(t.id)}">
      <div class="pp-task-col">
        <div class="pp-field"><label>Taak</label><input class="pp-input" value="${esc(t.title||'')}" data-pp-task-field="title" data-pp-task-id="${esc(t.id)}"></div>
        <div class="pp-grid">
          <div class="pp-field" style="grid-column:span 4"><label>Duur (min)</label><input class="pp-input" inputmode="numeric" value="${esc(String(t.estimated_duration_minutes||25))}" data-pp-task-field="estimated_duration_minutes" data-pp-task-id="${esc(t.id)}"></div>
          <div class="pp-field" style="grid-column:span 4"><label>Status</label><select class="pp-select" data-pp-task-field="status" data-pp-task-id="${esc(t.id)}">
            <option value="todo" ${t.status==='todo'?'selected':''}>todo</option>
            <option value="doing" ${t.status==='doing'?'selected':''}>bezig</option>
            <option value="done" ${t.status==='done'?'selected':''}>klaar</option>
          </select></div>
          <div class="pp-field" style="grid-column:span 4"><label>Deadline</label><input class="pp-input" type="date" value="${esc(t.deadline||'')}" data-pp-task-field="deadline" data-pp-task-id="${esc(t.id)}"></div>
        </div>
      </div>
      <div class="pp-actions">
        <button type="button" class="pp-btn danger" data-pp-action="del-task" data-pp-step-id="${esc(s.id)}" data-pp-task-id="${esc(t.id)}">×</button>
      </div>
    </div>`).join('')||`<div class="pp-muted">Nog geen taken.</div>`;
    return `<div class="pp-step" data-pp-step-id="${esc(s.id)}">
      <div class="pp-step-head">
        <div class="pp-step-title">Stap ${ix+1}</div>
        <div class="pp-actions">
          <button type="button" class="pp-btn" data-pp-action="add-task" data-pp-step-id="${esc(s.id)}">Taak</button>
          <button type="button" class="pp-btn danger" data-pp-action="del-step" data-pp-step-id="${esc(s.id)}">Verwijder</button>
        </div>
      </div>
      <div class="pp-grid">
        <div class="pp-field" style="grid-column:span 7"><label>Titel</label><input class="pp-input" value="${esc(s.title||'')}" data-pp-step-field="title" data-pp-step-id="${esc(s.id)}"></div>
        <div class="pp-field" style="grid-column:span 2"><label>Duur (min)</label><input class="pp-input" inputmode="numeric" value="${esc(String(s.estimated_duration_minutes||60))}" data-pp-step-field="estimated_duration_minutes" data-pp-step-id="${esc(s.id)}"></div>
        <div class="pp-field" style="grid-column:span 3"><label>Status</label><select class="pp-select" data-pp-step-field="status" data-pp-step-id="${esc(s.id)}">
          <option value="todo" ${s.status==='todo'?'selected':''}>todo</option>
          <option value="doing" ${s.status==='doing'?'selected':''}>bezig</option>
          <option value="done" ${s.status==='done'?'selected':''}>klaar</option>
        </select></div>
        <div class="pp-field" style="grid-column:span 4"><label>Afhankelijkheid</label><select class="pp-select" data-pp-step-field="dependency_type" data-pp-step-id="${esc(s.id)}">
          <option value="none" ${s.dependency_type==='none'?'selected':''}>geen</option>
          <option value="after_prev" ${s.dependency_type==='after_prev'?'selected':''}>na vorige</option>
          <option value="parallel" ${s.dependency_type==='parallel'?'selected':''}>parallel</option>
          <option value="external_wait" ${s.dependency_type==='external_wait'?'selected':''}>extern</option>
        </select></div>
        <div class="pp-field" style="grid-column:span 4"><label>Wacht op stap-id</label><input class="pp-input" value="${esc(s.depends_on_step_id||'')}" data-pp-step-field="depends_on_step_id" data-pp-step-id="${esc(s.id)}"></div>
        <div class="pp-field" style="grid-column:span 4"><label>Deadline</label><input class="pp-input" type="date" value="${esc(s.deadline||'')}" data-pp-step-field="deadline" data-pp-step-id="${esc(s.id)}"></div>
      </div>
      <div class="pp-card" style="padding:10px"><h4>Checklist</h4>${tasks}</div>
    </div>`;
  }).join('');
  const stepsWrap=`<div class="pp-card"><h4>Stappen</h4>${steps||`<div class="pp-muted">Nog geen stappen. Gebruik “Stap toevoegen”.</div>`}</div>`;
  projectPlanOverlayBody.innerHTML=header+meta+stepsWrap;
}

function renderAgendaSuggestionsPanel(ls){
  const suggestions=deriveAgendaSuggestions(ls);
  const hint=guidanceRefreshHint?`<p class="guidance-refresh-hint" role="status">${esc(guidanceRefreshHint)}</p>`:'';
  const entry=renderProjectPlansEntry();
  if(!suggestions.length)return`<div class="card guide-card guide-route">${hint}${entry}<p class="empty">Geen agenda-suggesties.</p></div>`;
  const rows=suggestions.map(i=>`<div class="item guide-suggestion-item" data-id="${esc(i.id)}"><div class="guide-suggestion-text">${esc(i.text)}<div class="sub">${esc(projectLabelFor(i.project))} · ${esc(sourceLabelFor(i.source))}${i.reason?` · ${esc(guidanceText(i.reason,80))}`:''}</div><div class="guide-chips guide-row-chips">${suggestionChip('Plan','plan',i.id,i.text)}${suggestionChip('Weg','dismiss',i.id,i.text)}</div></div></div>`).join('');
  return`<div class="card guide-card guide-route">${hint}${entry}${rows}</div>`;
}
function formatAgendaLine(i){const title=sanitizeAgendaPreviewLine(i);if(!title)return null;const s=i.start_time&&i.end_time?`${i.start_time}–${i.end_time}`:(i.estimated_duration_minutes?`${i.estimated_duration_minutes} min`:null);const st=i.status==='confirmed'?'bevestigd':(i.status==='pencil'?'potlood':null);const bits=[s,st].filter(Boolean).join(' · ');return`${bits?bits+' — ':''}${title}`}
function pickTodayAgendaPreview(){const day=activeAgendaDate||todayIso();const items=(labState.agenda||[]).filter(i=>itemAgendaDate(i)===day&&!isAgendaItemDone(i));const picked=[];for(const it of items){if(looksLikeLegacyNoiseAgendaItem(it)){legacyNoiseSig.add(legacyAgendaSig({title:sanitizeAgendaPreviewLine(it)||String(it.title||''),project:it.project||inferProjectFromTitle(String(it.title||'')),date:day}));continue}const line=formatAgendaLine(it);if(line)picked.push(line);if(picked.length>=4)break}if(legacyNoiseSig.size)persistLegacyNoise();return picked}
function overlaySuggestionsForOverlay(){const raw=deriveAgendaSuggestions(labState);const out=[];for(const s of raw){if(!overlayCanAcceptSuggestion(s))continue;out.push(s)}return out.slice(0,6)}
function renderStartupOverlayBody(){const day=activeAgendaDate||todayIso();const todayLines=pickTodayAgendaPreview();const sug=overlaySuggestionsForOverlay();if(startupOverlayAcceptAllBtn)startupOverlayAcceptAllBtn.style.display=sug.length>=2?'':'none';const parts=[];parts.push(`<div class="startup-overlay__section"><div class="startup-overlay__section-title">${esc(dateLabel(day))}</div>${todayLines.length?`<div class="startup-overlay__bullets startup-overlay__bullets--today">${todayLines.map(l=>`<div class="startup-overlay__bullet">${esc(l)}</div>`).join('')}</div>`:`<div class="startup-overlay__muted">Nog geen blokken op deze dag.</div>`}</div>`);parts.push(`<div class="startup-overlay__section"><div class="startup-overlay__section-title">Voorstellen</div>${sug.length?sug.map(renderOverlaySuggestionCard).join(''):'<div class="startup-overlay__muted">Geen voorstellen.</div>'}</div>`);if(startupOverlayIntro){const msg=pickStartupGreeting(labState);startupOverlayIntro.textContent=sanitizeUserFacingText(msg,'chat')||msg}if(startupOverlayList)startupOverlayList.innerHTML=parts.join('');}
function showStartupOverlay(){if(!startupOverlay)return;renderStartupOverlayBody();startupOverlay.classList.remove('hidden')}
function hideStartupOverlay(markDone){startupOverlay?.classList.add('hidden');if(markDone){try{sessionStorage.setItem(SESSION_STARTUP_KEY,'1')}catch(_){}}}
function deriveSuggestions(){let conf=labState.agenda.filter(i=>i._frontend_conflict&&!isAgendaItemDone(i)),pencils=labState.agenda.filter(i=>i.status==='pencil'&&!isAgendaItemDone(i));if(conf.length)return[{type:'conflict',text:'Er is overlap in je agenda. Zal ik een oplossing voorstellen?'}];if(pencils.length)return[{type:'confirm_all',text:'Klopt deze planning zo? Dan bevestig ik alle potloodblokken.'}];return[]}
function addAssistantMessage(text,suggestions){const body=sanitizeUserFacingText(text,'chat')||'Ik heb iets bijgewerkt; kijk even rechts en in de agenda.';const sug0=suggestions&&suggestions[0]?sanitizeUserFacingText(suggestions[0].text,'chat'):null;const opt=sug0?`<div class="options"><div class="option-text">${esc(sug0)}</div><div class="option-actions"><button data-proposal-action="decline">Afslaan</button><button data-proposal-action="ok" data-kind="${esc(suggestions[0].type)}">Okay</button></div></div>`:'';chatLog.insertAdjacentHTML('beforeend',`<div class="msg assistant"><div class="msg-body">${esc(body)}</div>${opt}</div>`);scrollBottom()}
function contextPayload(message){return 'Actuele lokale Clara status (lokale waarheid, inclusief handmatige wijzigingen):\n'+JSON.stringify(labState,null,2)+'\n\nNieuw bericht:\n'+message}
function hasOpenThreads(ls){return(ls.open_threads||[]).some(i=>i&&i.status!=='closed')}
function hasDayRegieContent(ls){const d=ls.day_regie||{};return!!((d.items_to_check||[]).length||(d.rollover_candidates||[]).length||String(d.review_prompt||'').trim()||d.suggested_time||String(d.now_first_move||'').trim())}
function onlyOpenThreadRegie(ls){const d=ls.day_regie||{};return!d.suggested_time&&!(d.items_to_check||[]).length&&!(d.rollover_candidates||[]).length&&!String(d.review_prompt||'').trim()&&/^open gesprek:/i.test(String(d.now_first_move||'').trim())}
function startupResultMessage(ls){if((ls.agenda||[]).length)return STARTUP_DONE_MSG;if(hasOpenThreads(ls))return'Er hangen nog een paar open items. Ik kan ze met je langslopen.';return'Er staat nog niets gepland.'}
function startupFallbackMessage(){return'Ik ben gestart. Er staat nog niets gepland; stel me een vraag of vraag om een conceptdag.'}
function analysisFallbackMessage(){return'Ik liep vast op dit bericht. Wil je het korter maken, of wil je dat ik alleen één eerstvolgende stap voorstel?'}
function isDayPlanningIntent(v){return/(maak|vul|plan|concept).*\b(dagplanning|conceptdag|planning|dag)\b|\b(dagplanning|conceptdag)\b|planning.*\b(vandaag|morgen|demo|dag)\b|marlon\s*[-]?\s*demo|demo.*\b(planning|dag)\b|marlon.*demo.*\b(planning|dag)\b|planning.*marlon|dagplanning.*marlon/i.test(String(v||''))}
function targetDateForPlanning(v){const s=String(v||'').toLowerCase();if(/morgen/.test(s))return addDaysIso(todayIso(),1);if(/overmorgen/.test(s))return addDaysIso(todayIso(),2);if(/vandaag/.test(s))return todayIso();return activeAgendaDate||todayIso()}
function compactPlanSeeds(v){const msg=String(v||'');const demo=/marlon|demo/.test(msg.toLowerCase());const demoSeeds=[['Clara Core Lab: demo-scope en kernflow kiezen','clara-core-lab'],['Clara Core Lab: kort inhoudelijk testen','clara-core-lab'],['LaLampe: workshopflow simpeler uitschrijven','lalampe'],['Begeister: bespreekpunten met Marlon ordenen','begeister'],['AFK/Landjuweel: aanvraagtekst nalopen op toon','afk-landjuweel-amarte']];const genericSeeds=[['Clara Core Lab: v'+LAB_VERSION+' inhoudelijk testen','clara-core-lab'],['LaLampe: workshopflow simpeler maken','lalampe'],['Begeister: open bespreekpunten ordenen','begeister'],['AFK/Landjuweel: aanvraagtekst nalopen','afk-landjuweel-amarte']];const seeds=[...(demo?demoSeeds:genericSeeds)];for(const t of labState.tasks||[])if(!t.done&&t.title){const tf=filterUserFacingLine(t.title);if(tf)seeds.unshift([tf,t.project||null])}return seeds}
function compactSuggestionFillers(message){const demo=/marlon|demo/.test(String(message||'').toLowerCase());if(demo)return['Demo: drie bullets die je zeker wilt tonen','Demo: 2 minuten startflow droog oefenen','Demo: lijstje met vragen die Marlon waarschijnlijk stelt'];return[]}
function titleTakenEverywhere(title){const n=guidanceText(title,120).toLowerCase();if(!n)return true;return(labState.agenda||[]).some(i=>guidanceText(i.title,120).toLowerCase()===n)||(labState.tasks||[]).some(t=>!t.done&&guidanceText(t.title,120).toLowerCase()===n)}
function titleExistsOnDate(title,date){const n=guidanceText(title,90).toLowerCase();return(labState.agenda||[]).some(i=>itemAgendaDate(i)===date&&guidanceText(i.title,90).toLowerCase()===n)}
function addCompactPlanItem(title,project,date,duration=60){if(titleExistsOnDate(title,date))return false;const clean=guidanceText(title,120);const proj=project||inferProjectFromTitle(clean);if(!isConcreteAgendaItem({title:clean,project:proj,estimated_duration_minutes:duration}))return false;const win=activeAgendaTab==='evening'?activeAgendaWindow():compactDayWorkWindow(date);const slot=findFreeAgendaSlot(date,duration,null,win);if(!slot){const note=`Dit past op ${dateLabel(date).toLowerCase()} niet eerlijk meer: ${guidanceText(clean,110)}`;if(!labState.attention.some(i=>String(i.title||'')===note))labState.attention.push({id:'at-compact-'+Date.now()+'-'+simpleHash(note),title:note,kind:'past_niet',done:false,project:proj});return false}labState.agenda.push({id:'ag-fast-'+Date.now()+'-'+simpleHash(clean),title:clean,kind:'planned_task',date,start_time:minToTime(slot.start),end_time:minToTime(slot.end),estimated_duration_minutes:duration,status:'pencil',confirmation_required:true,source:'fast_day_fallback',project:proj});return true}
function applyCompactAttentionQuestion(message){const openTitle=/marlon|demo/i.test(String(message||''))?'Wat moet Marlon meteen snappen zonder technische uitleg?':'Wat moet vandaag echt af zijn, en wat mag blijven liggen?';if(!labState.attention.some(i=>String(i.title||'')===openTitle))labState.attention.push({id:'at-fast-'+Date.now(),title:openTitle,kind:'keuze',done:false,project:/marlon|demo/i.test(String(message||''))?'clara-core-lab':null})}
function ensureCompactDayPlan(message){lastPlanningMessage=String(message||'');dismissedGuidanceIds.clear();activeAgendaDate=normalizePlanningDateIso(targetDateForPlanning(message),message);activeAgendaTab=/avond/i.test(String(message||''))?'evening':'day';const seeds=compactPlanSeeds(message);let agendaAdded=0;const maxBlocks=5,minWant=3;for(const dur of[75,60,45]){if(agendaAdded>=maxBlocks)break;for(const[title,project]of seeds){if(agendaAdded>=maxBlocks)break;if(addCompactPlanItem(title,project,activeAgendaDate,dur))agendaAdded++}if(agendaAdded>=minWant)break}let taskBoost=0;for(const title of compactSuggestionFillers(message)){if(agendaAdded+taskBoost>=maxBlocks)break;if(agendaAdded+taskBoost>=minWant)break;const clean=guidanceText(title,120);if(!clean||titleTakenEverywhere(clean))continue;labState.tasks=[...(labState.tasks||[]),{id:'ta-fast-'+Date.now()+'-'+taskBoost,title:clean,done:false,project:/marlon|demo/i.test(String(message||'').toLowerCase())?'clara-core-lab':null}];taskBoost++}applyCompactAttentionQuestion(message);labState.agenda=markOverlaps(labState.agenda);touchState();renderFromState();return{agendaAdded,taskBoost}}
function compactDayPlanMessage(agendaAdded,taskBoost){const n=(agendaAdded||0)+(taskBoost||0);return n>0?'Ik heb een dagplanning klaargezet, zodat je direct verder kunt.':'Ik vond vandaag geen eerlijke plek meer; wil je dit later plannen of open laten?'}
function render(data){syncFromAnalysis(data);renderFromState();const raw=String(data.summary||startupResultMessage(labState)).slice(0,520);addAssistantMessage(sanitizeUserFacingText(raw,'chat')||'Ik heb de planning bijgewerkt; controleer de agenda en de suggesties rechts.',deriveSuggestions())}
function renderStartupResult(data){syncFromAnalysis(data);renderFromState();const wrap=document.querySelector('#chatLog .msg.assistant:not(.thinking) .msg-body');if(wrap)wrap.textContent=startupResultMessage(labState);try{sessionStorage.setItem(SESSION_STARTUP_KEY,'1')}catch(_){}setStatus('Concept klaar · v'+LAB_VERSION)}
async function runAutoStartupPlanning(){if(isAnalyzing)return;if(startupAnalysisScheduled)return;startupAnalysisScheduled=true;currentController=new AbortController();setAnalyzing(true);setStatus('Clara maakt startvoorstellen…');const to=setTimeout(()=>currentController.abort(),60000);try{const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:STARTUP_INTERNAL_PROMPT,source:'projectbrain_startup',lab_state:labState}),signal:currentController.signal}),data=await res.json();if(!res.ok)throw new Error(data.message||data.error||'Startvoorstellen mislukt');syncFromAnalysis(data);renderFromState();showStartupOverlay()}catch(e){renderFromState();showStartupOverlay();setStatus('Startvoorstellen klaar · v'+LAB_VERSION)}finally{clearTimeout(to);currentController=null;setAnalyzing(false);startupAnalysisScheduled=false;scrollBottom()}}
async function analyzeText(message,showUser=true){if(isAnalyzing&&currentController){currentController.abort();return}let value=String(message||'').trim();if(!value){setStatus('Voer eerst tekst in.');return}if(showUser){rememberUserInputForSanitize(value);addUserMessage(value)}input.value='';resizeInput();const words=value.split(/\s+/).filter(Boolean).length;if(lastOpenItemRef&&words&&words<=6&&value.length<=52&&!isDayPlanningIntent(value)&&!isProjectPlanIntent(value)&&!/^\s*(wat|hoe|waarom|leg\s+uit|vertel|kun\s+je|kan\s+je|waar|wie|wanneer)\b/i.test(value)){answerOpenEnd(lastOpenItemRef.id,lastOpenItemRef.source,value);setStatus('Antwoord opgenomen.');scrollBottom();return}if(isProjectPlanIntent(value)){const plan=createProjectPlanFromMessage(value);upsertProjectPlan(plan);touchState();renderFromState();openProjectPlanOverlay(plan.id);setStatus('Projectplan klaar om te bewerken.');scrollBottom();return}if(isDayPlanningIntent(value)){const r=ensureCompactDayPlan(value);addAssistantMessage(compactDayPlanMessage(r.agendaAdded,r.taskBoost),deriveSuggestions());setStatus('Dagplanning klaar · v'+LAB_VERSION);scrollBottom();return}currentController=new AbortController();setAnalyzing(true);setStatus('Clara denkt even mee…');let thinking=addThinking(),to=setTimeout(()=>currentController.abort(),60000);startThinkingStatusFlow(thinking);try{let res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:contextPayload(value),source:'message',lab_state:labState}),signal:currentController.signal}),data=await res.json();if(!res.ok)throw new Error(data.message||data.error||'Kon dit niet ophalen');stopThinkingStatusFlow();render(data);removeThinking(thinking);setStatus('Bijgewerkt · v'+LAB_VERSION)}catch(e){stopThinkingStatusFlow();removeThinking(thinking);try{renderFromState();addAssistantMessage(sanitizeUserFacingText(analysisFallbackMessage(),'chat')||analysisFallbackMessage(),[])}catch(_){addAssistantMessage(sanitizeUserFacingText(analysisFallbackMessage(),'chat')||analysisFallbackMessage(),[])}setStatus('Klaar · v'+LAB_VERSION)}finally{stopThinkingStatusFlow();clearTimeout(to);currentController=null;setAnalyzing(false);scrollBottom()}}
endPromptHost?.addEventListener('click',e=>{let b=e.target.closest('[data-agenda-end-action]');if(!b)return;handleAgendaEndPromptAction(b.dataset.itemId,b.dataset.agendaEndAction)});
chatLog.addEventListener('click',e=>{let b=e.target.closest('[data-proposal-action]');if(!b)return;if(b.dataset.proposalAction==='ok'&&b.dataset.kind==='confirm_all'){labState.agenda.forEach(i=>{if(i.status==='pencil')i.status='confirmed';i.confirmation_required=false});touchState();renderFromState()}b.closest('.options')?.remove()});
agendaSection?.addEventListener('click',e=>{let tab=e.target.closest('[data-agenda-tab]');if(tab){activeAgendaTab=tab.dataset.agendaTab;renderFromState();return}let a=e.target.closest('[data-agenda-action]');if(!a)return;let id=a.dataset.id,item=labState.agenda.find(i=>i.id===id);if(a.dataset.agendaAction==='confirm'&&item){item.status='confirmed';item.confirmation_required=false;touchState();renderFromState()}if(a.dataset.agendaAction==='delete'){labState.agenda=labState.agenda.filter(i=>i.id!==id);touchState();renderFromState()}});
agendaCol.addEventListener('pointerdown',e=>{let h=e.target.closest('[data-resize]'),eventEl=e.target.closest('.event');if(e.target.closest('button,[contenteditable="true"],input,textarea'))return;if(!h&&!eventEl)return;e.preventDefault();let section=(h||eventEl).closest('.timeline-card'),tl=(h||eventEl).closest('.timeline'),id=h?h.dataset.id:eventEl.dataset.id,item=labState.agenda.find(i=>i.id===id);if(!section||!tl||!item)return;let rect=tl.getBoundingClientRect(),s=timeToMin(item.start_time)||Number(section.dataset.start),en=timeToMin(item.end_time)||s+(item.estimated_duration_minutes||30);dragState={id:item.id,mode:h?'resize':'move',edge:h?.dataset.resize||null,start:Number(section.dataset.start),end:Number(section.dataset.end),rect,offset:eventEl?Math.max(0,e.clientY-eventEl.getBoundingClientRect().top):0,duration:Math.max(15,en-s)};(h||eventEl).setPointerCapture?.(e.pointerId)});
window.addEventListener('pointermove',e=>{if(!dragState)return;let item=labState.agenda.find(i=>i.id===dragState.id);if(!item)return;let y=Math.max(0,Math.min(dragState.rect.height,e.clientY-dragState.rect.top)),min=round15(dragState.start+(y/dragState.rect.height)*(dragState.end-dragState.start)),s=timeToMin(item.start_time)||dragState.start,en=timeToMin(item.end_time)||s+30;if(dragState.mode==='move'){let offMin=(dragState.offset/dragState.rect.height)*(dragState.end-dragState.start);s=round15(dragState.start+((e.clientY-dragState.rect.top)/dragState.rect.height)*(dragState.end-dragState.start)-offMin);s=Math.max(dragState.start,Math.min(s,dragState.end-dragState.duration));en=s+dragState.duration;if(hasAgendaOverlap(activeAgendaDate||itemAgendaDate(item),s,en,item.id))return;item.start_time=minToTime(s);item.end_time=minToTime(en);item.estimated_duration_minutes=dragState.duration}else if(dragState.edge==='start'){s=Math.min(min,en-15);if(hasAgendaOverlap(activeAgendaDate||itemAgendaDate(item),s,en,item.id))return;item.start_time=minToTime(s);item.estimated_duration_minutes=Math.max(15,en-s)}else{en=Math.max(min,s+15);if(hasAgendaOverlap(activeAgendaDate||itemAgendaDate(item),s,en,item.id))return;item.end_time=minToTime(en);item.estimated_duration_minutes=Math.max(15,en-s)}touchState();renderFromState()});
window.addEventListener('pointerup',()=>dragState=null);
agendaCol.addEventListener('blur',e=>{let f=e.target.dataset.agendaField,id=e.target.dataset.id;if(f==='title'&&id){let item=labState.agenda.find(i=>i.id===id);if(item){item.title=e.target.textContent.trim()||item.title;touchState();renderFromState()}}},true);
function findGuidanceSourceItem(id){return(labState.agenda||[]).find(i=>i.id===id)||(labState.tasks||[]).find(i=>i.id===id)||null}
function activeAgendaWindow(){return activeAgendaTab==='evening'?{start:19*60,end:24*60}:{start:10*60,end:19*60}}
function hasAgendaOverlap(date,s,en,ignoreId){return(labState.agenda||[]).some(i=>i.id!==ignoreId&&!isAgendaItemDone(i)&&itemAgendaDate(i)===date&&timeToMin(i.start_time)!=null&&(()=>{let a=timeToMin(i.start_time),b=timeToMin(i.end_time)??a+(i.estimated_duration_minutes||30);return a<en&&s<b})())}
function findFreeAgendaSlot(date,duration,ignoreId,customWin){const win=customWin||activeAgendaWindow();let s0=win.start;const tIso=todayIso();if(date===tIso){const nowM=round15(getNowMinutes());s0=Math.max(win.start,nowM)}for(let s=s0;s+duration<=win.end;s+=15)if(!hasAgendaOverlap(date,s,s+duration,ignoreId))return{start:s,end:s+duration};return null}
function inferProjectFromTitle(title){const pv=getProjectVisual(title);return pv.hasProject?pv.key:null}
function addLocalAgendaSuggestion(title,project){const clean=guidanceText(title,120)||'Agenda-suggestie';const date=activeAgendaDate||todayIso();const duration=45;const proj=project||inferProjectFromTitle(clean);if(!isConcreteAgendaItem({title:clean,project:proj,estimated_duration_minutes:duration}))return false;const slot=findFreeAgendaSlot(date,duration);if(!slot){const note=`Dit past op ${dateLabel(date).toLowerCase()} niet netjes meer: ${clean}`;if(!labState.attention.some(i=>String(i.title||'')===note))labState.attention.push({id:'at-fit-'+Date.now(),title:note,kind:'past_niet',done:false,project:proj});return false}labState.agenda.push({id:'ag-local-'+Date.now(),title:clean,kind:'planned_task',date,start_time:minToTime(slot.start),end_time:minToTime(slot.end),estimated_duration_minutes:duration,status:'pencil',confirmation_required:true,source:'guidance_rail',project:proj});labState.agenda=markOverlaps(labState.agenda);return true}

function isProjectPlanIntent(v){return/\bprojectplan\b|\bplan\s+voor\b.*\b(project|afk|lalampe|begeister|clara)\b|\bmaak\s+.*\bprojectplan\b|\bproject\s+plan\b/i.test(String(v||''))}
function inferProjectKeyFromMessage(v){const pv=getProjectVisual(String(v||''));if(pv&&pv.key&&pv.key!=='none'){if(pv.key==='afk')return'afk-landjuweel-amarte';if(pv.key==='clara')return'clara-core-lab';return pv.key}return null}
function createProjectPlanFromMessage(message){
  const msg=String(message||'').trim();
  const project=inferProjectKeyFromMessage(msg);
  const goal=guidanceText(msg,260);
  const title=project?`${projectLabelFor(project)} projectplan`:'Projectplan';
  const context=/deadline|voor\s+\w+\s+afhebben|afhebben|proof|poc|demo/i.test(msg)?'Let op: deadline of scope is genoemd; houd de stappen eerlijk.':'';
  return newProjectPlanFromSeed({project,title,goal,context,source:'chat'});
}

function planProjectPlanThisWeek(planId){
  const plan=getProjectPlanById(planId);
  if(!plan){setStatus('Geen projectplan om te plannen.');return}
  const today=todayIso();
  const days=nextWorkdaysFrom(today,5);
  const proj=plan.project||inferProjectFromTitle(plan.title||plan.goal||'');
  if(!proj||getProjectVisual(proj).key==='none'){setStatus('Kies eerst een project voor dit plan.');return}
  const candidates=[];
  for(const step of plan.steps||[]){
    if(!step||step.status==='done')continue;
    const stepTitle=guidanceText(step.title,140);
    if(stepTitle){
      candidates.push({kind:'step',step,task:null,title:stepTitle,dur:step.estimated_duration_minutes||60});
    }
    for(const task of step.tasks||[]){
      if(!task||task.status==='done')continue;
      const tt=guidanceText(task.title,160);
      if(tt)candidates.push({kind:'task',step,task,title:tt,dur:task.estimated_duration_minutes||25});
    }
  }
  let planned=0,notFit=0;
  for(const c of candidates){
    const dur=Math.max(15,Math.round((Number(c.dur)||45)/5)*5);
    const titleBase=`${projectLabelFor(proj)}: ${plan.title} — ${c.kind==='task'?'Taak: ':''}${c.title}`;
    const title=guidanceText(titleBase,160);
    if(!isConcreteAgendaItem({title,project:proj,estimated_duration_minutes:dur}))continue;
    let placed=false;
    for(const d of days){
      const slot=findFreeSlotWorkday(d,dur);
      if(!slot)continue;
      const id='ag-pp-'+Date.now()+'-'+simpleHash(plan.id+'|'+c.step.id+'|'+(c.task?.id||''));
      labState.agenda.push({id,title,kind:'planned_task',date:d,start_time:minToTime(slot.start),end_time:minToTime(slot.end),estimated_duration_minutes:dur,status:'pencil',confirmation_required:true,source:'project_plan',project:proj,project_plan_id:plan.id,step_id:c.step.id,task_id:c.task?c.task.id:null,reason:'Uit projectplan: plan deze week'});
      placed=true;planned++;break;
    }
    if(!placed){
      const note=guidanceText(`Projectplan past deze week niet: ${title}`,220);
      if(!labState.attention.some(i=>String(i.title||'')===note))labState.attention.push({id:'at-pp-'+Date.now()+'-'+simpleHash(note),title:note,kind:'past_niet',done:false,project:proj});
      notFit++;
    }
  }
  labState.agenda=markOverlaps(labState.agenda);
  touchState();
  renderFromState();
  setStatus(planned?`Projectplan gepland: ${planned} blok(ken).`:(notFit?`Geen eerlijke plek deze week (${notFit} items).`:'Geen concrete stappen om te plannen.'));
}
function handleSuggestionAction(id,action,title){const item=findGuidanceSourceItem(id),clean=guidanceText(title||item?.title||id,120);if(action==='plan'){addLocalAgendaSuggestion(clean,item?.project||null);if(item&&!labState.agenda.includes(item))item.done=true;dismissedGuidanceIds.add(id)}else if(action==='dismiss'){dismissedGuidanceIds.add(id);if(item&&!labState.agenda.includes(item))item.done=true}persistDismissedGuidanceIds();touchState();renderFromState()}
function closeGuidanceItem(id,source){hiddenOpenEndIds.add(`${source}:${id}`);if(source==='thread'){let item=(labState.open_threads||[]).find(i=>i.id===id);if(item)item.status='closed'}else if(source==='attention'){let item=(labState.attention||[]).find(i=>i.id===id);if(item)item.done=true}else if(source==='task'){let item=(labState.tasks||[]).find(i=>i.id===id);if(item)item.done=true}else if(source==='agenda'){let item=(labState.agenda||[]).find(i=>i.id===id);if(item)item.status='needs_time'}touchState();renderFromState()}
function answerOpenEnd(id,source,value){const v=guidanceText(value,180);if(!v)return;let item=null;if(source==='thread')item=(labState.open_threads||[]).find(i=>i.id===id);else if(source==='attention')item=(labState.attention||[]).find(i=>i.id===id);if(item){item.answer=v;item.status='closed';item.done=true}else hiddenOpenEndIds.add(`${source}:${id}`);closeGuidanceItem(id,source)}
function agendaSuggestionsTextKey(){return deriveAgendaSuggestions(labState).map(i=>i.text).join('\u0001')}
function refreshGuidancePanels(){const before=agendaSuggestionsTextKey();renderGuidance();renderRegie();const after=agendaSuggestionsTextKey();guidanceRefreshHint=before===after?'Suggesties opnieuw bekeken (lijst gelijk).':'Suggesties opnieuw opgebouwd.';renderGuidance();if(refreshGuidanceHintTimer)clearTimeout(refreshGuidanceHintTimer);refreshGuidanceHintTimer=setTimeout(()=>{guidanceRefreshHint='';refreshGuidanceHintTimer=null;renderGuidance()},4200);setStatus('Suggesties ververst.')}
attentionCol.addEventListener('click',e=>{let b=e.target.closest('[data-suggestion-action]');if(!b)return;handleSuggestionAction(b.dataset.id,b.dataset.suggestionAction,b.dataset.title)});
attentionCol.addEventListener('click',e=>{let p=e.target.closest('[data-projectplans-action]');if(!p)return;if(p.dataset.projectplansAction==='open'){openProjectPlanOverlay(labState.project_plans?.[0]?.id||null)}});
regieCol.addEventListener('click',e=>{let save=e.target.closest('[data-open-answer-save]');if(save){let row=save.closest('.open-answer-row'),inp=row?.querySelector('[data-open-answer-input]');answerOpenEnd(save.dataset.id,save.dataset.openSource,inp?.value||'');return}let b=e.target.closest('[data-open-action]');if(b){if(b.dataset.openAction==='close')closeGuidanceItem(b.dataset.id,b.dataset.openSource);return}let clear=e.target.closest('[data-action="clear-test-state"]');if(clear){e.preventDefault();clearLocalTestState()}});
startupOverlay?.addEventListener('click',e=>{let close=e.target.closest('[data-startup-overlay-close]');if(close){hideStartupOverlay(true);return}let act=e.target.closest('[data-startup-overlay-action]');if(act){if(act.dataset.startupOverlayAction==='start-empty'){hideStartupOverlay(true);return}if(act.dataset.startupOverlayAction==='accept-all'){const sug=overlaySuggestionsForOverlay();for(const s of sug){handleSuggestionAction(String(s.id),'plan',overlaySuggestionTitle(s))}hideStartupOverlay(true);return}}let editInp=e.target.closest('[data-overlay-edit-input]');if(editInp)return;let b=e.target.closest('[data-overlay-proposal-action]');if(!b)return;const id=b.dataset.id;const action=b.dataset.overlayProposalAction;const sug=(overlaySuggestionsForOverlay().find(x=>String(x.id)===String(id)))||null;const baseTitle=sug?overlaySuggestionTitle(sug):'';if(action==='dismiss'){dismissedGuidanceIds.add(id);persistDismissedGuidanceIds();overlayEditId=null;overlayEditDraft='';renderStartupOverlayBody();return}if(action==='edit'){if(overlayEditId===id){overlayEditId=null;overlayEditDraft=''}else{overlayEditId=id;overlayEditDraft=baseTitle||''}renderStartupOverlayBody();return}if(action==='accept'){const title=overlayEditId===id?(guidanceText(overlayEditDraft||baseTitle,160)):(baseTitle);handleSuggestionAction(id,'plan',title);overlayEditId=null;overlayEditDraft='';renderStartupOverlayBody();return}});
startupOverlay?.addEventListener('input',e=>{const inp=e.target.closest('[data-overlay-edit-input]');if(!inp)return;const id=inp.getAttribute('data-id');if(!id)return;if(overlayEditId!==id)return;overlayEditDraft=String(inp.value||'')});

projectPlanOverlay?.addEventListener('click',e=>{
  const close=e.target.closest('[data-projectplan-close]');
  if(close){closeProjectPlanOverlay(false);return}
  const act=e.target.closest('[data-projectplan-action]');
  if(act){
    const a=act.dataset.projectplanAction;
    if(a==='close'){closeProjectPlanOverlay(false);return}
    if(a==='save'){closeProjectPlanOverlay(true);return}
    if(a==='plan-week'){planProjectPlanThisWeek(projectPlanOverlayOpenId);return}
  }
  const b=e.target.closest('[data-pp-action]');
  if(b){
    const a=b.dataset.ppAction;
    const plan=getProjectPlanById(projectPlanOverlayOpenId);
    if(!plan)return;
    if(a==='new-plan'){openProjectPlanOverlay(null);return}
    if(a==='new-step'){
      const sid=plan.id+'-st-'+Date.now()+'-'+((Math.random()*1e6)|0);
      plan.steps=[...(plan.steps||[]),{id:sid,title:'Nieuwe stap',status:'todo',estimated_duration_minutes:60,dependency_type:'none',depends_on_step_id:'',deadline:'',tasks:[]}];
      plan.updated_at=new Date().toISOString();
      upsertProjectPlan(plan);touchState();renderProjectPlanOverlay();return
    }
    if(a==='new-task'){
      if(!(plan.steps||[]).length){const sid=plan.id+'-st-'+Date.now();plan.steps=[{id:sid,title:'Nieuwe stap',status:'todo',estimated_duration_minutes:60,dependency_type:'none',depends_on_step_id:'',deadline:'',tasks:[]}]}
      const s=plan.steps[0];
      const tid=s.id+'-ta-'+Date.now()+'-'+((Math.random()*1e6)|0);
      s.tasks=[...(s.tasks||[]),{id:tid,title:'Nieuwe taak',status:'todo',estimated_duration_minutes:25,deadline:'',source_reason:''}];
      plan.updated_at=new Date().toISOString();
      upsertProjectPlan(plan);touchState();renderProjectPlanOverlay();return
    }
    if(a==='add-task'){
      const sid=b.dataset.ppStepId;
      const s=(plan.steps||[]).find(x=>String(x.id)===String(sid));
      if(!s)return;
      const tid=s.id+'-ta-'+Date.now()+'-'+((Math.random()*1e6)|0);
      s.tasks=[...(s.tasks||[]),{id:tid,title:'Nieuwe taak',status:'todo',estimated_duration_minutes:25,deadline:'',source_reason:''}];
      plan.updated_at=new Date().toISOString();
      upsertProjectPlan(plan);touchState();renderProjectPlanOverlay();return
    }
    if(a==='del-step'){
      const sid=b.dataset.ppStepId;
      plan.steps=(plan.steps||[]).filter(x=>String(x.id)!==String(sid));
      plan.updated_at=new Date().toISOString();
      upsertProjectPlan(plan);touchState();renderProjectPlanOverlay();return
    }
    if(a==='del-task'){
      const sid=b.dataset.ppStepId,tid=b.dataset.ppTaskId;
      const s=(plan.steps||[]).find(x=>String(x.id)===String(sid));
      if(!s)return;
      s.tasks=(s.tasks||[]).filter(t=>String(t.id)!==String(tid));
      plan.updated_at=new Date().toISOString();
      upsertProjectPlan(plan);touchState();renderProjectPlanOverlay();return
    }
  }
});

projectPlanOverlay?.addEventListener('input',e=>{
  const plan=getProjectPlanById(projectPlanOverlayOpenId);
  if(!plan)return;
  const f=e.target.closest('[data-pp-field]');
  if(f){
    const key=f.dataset.ppField;
    const val=(f.type==='date')?String(f.value||''):(f.value!=null?String(f.value):String(f.textContent||''));
    if(key==='project')plan.project=val||null;
    if(key==='status')plan.status=val||'active';
    if(key==='title')plan.title=guidanceText(val,120);
    if(key==='deadline')plan.deadline=val||'';
    if(key==='goal')plan.goal=guidanceText(val,260);
    if(key==='context')plan.context=guidanceText(val,420);
    plan.updated_at=new Date().toISOString();
    upsertProjectPlan(plan);saveLabStateToStorage();return
  }
  const sf=e.target.closest('[data-pp-step-field]');
  if(sf){
    const sid=sf.dataset.ppStepId,key=sf.dataset.ppStepField;
    const s=(plan.steps||[]).find(x=>String(x.id)===String(sid));if(!s)return;
    const v=String(sf.value||'');
    if(key==='title')s.title=guidanceText(v,140);
    if(key==='status')s.status=v||'todo';
    if(key==='dependency_type')s.dependency_type=v||'none';
    if(key==='depends_on_step_id')s.depends_on_step_id=v||'';
    if(key==='deadline')s.deadline=v||'';
    if(key==='estimated_duration_minutes'){const n=parseInt(v,10);s.estimated_duration_minutes=Number.isFinite(n)&&n>0?Math.max(10,Math.round(n/5)*5):60}
    plan.updated_at=new Date().toISOString();
    upsertProjectPlan(plan);saveLabStateToStorage();return
  }
  const tf=e.target.closest('[data-pp-task-field]');
  if(tf){
    const tid=tf.dataset.ppTaskId,key=tf.dataset.ppTaskField;
    let task=null;
    for(const s of plan.steps||[]){task=(s.tasks||[]).find(t=>String(t.id)===String(tid));if(task)break}
    if(!task)return;
    const v=String(tf.value||'');
    if(key==='title')task.title=guidanceText(v,160);
    if(key==='status')task.status=v||'todo';
    if(key==='deadline')task.deadline=v||'';
    if(key==='estimated_duration_minutes'){const n=parseInt(v,10);task.estimated_duration_minutes=Number.isFinite(n)&&n>0?Math.max(10,Math.round(n/5)*5):25}
    plan.updated_at=new Date().toISOString();
    upsertProjectPlan(plan);saveLabStateToStorage();return
  }
});
window.__claraRunStartupOverlay=runAutoStartupPlanning;
refreshGuidanceBtn?.addEventListener('click',refreshGuidancePanels);
agendaPrevBtn?.addEventListener('click',()=>{activeAgendaDate=addDaysIso(activeAgendaDate||todayIso(),-1);renderFromState()});
agendaNextBtn?.addEventListener('click',()=>{activeAgendaDate=addDaysIso(activeAgendaDate||todayIso(),1);renderFromState()});
window.addEventListener('keydown',e=>{if(!e.altKey||!e.shiftKey||e.code!=='KeyR'||e.repeat)return;if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable))return;e.preventDefault();clearLocalTestState()});
btn.addEventListener('click',()=>analyzeText(input.value,true));input.addEventListener('input',resizeInput);input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();analyzeText(input.value,true)}});resizeInput();updateDate();setInterval(updateDate,1000);loadLabStateFromStorage();loadDismissedGuidanceIds();loadLegacyNoise();renderFromState();setInterval(checkAgendaEndPrompts,60000);(async function boot(){if(dayRegieIsEmpty(labState)&&!sessionStorage.getItem(SESSION_STARTUP_KEY)){await runAutoStartupPlanning()}else{applyStartupGreeting()}})();
