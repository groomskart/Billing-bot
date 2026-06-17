'use client';

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      require('bootstrap/dist/js/bootstrap.bundle.min.js');
    }
  }, []);

  const appScript = `
(function(){
const OPERATOR_PIN = "${process.env.NEXT_PUBLIC_OPERATOR_PIN || '3265'}";
const SUPABASE_URL = "${process.env.NEXT_PUBLIC_SUPABASE_URL}";
const SUPABASE_ANON_KEY = "${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}";
const STORAGE_BUCKET = "${process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'groomskart_fabrics'}";
const APP_TOKEN = "GROOMSKART_INTERNAL_V1";
const PAGE_SIZE = 20;
window.appUnlocked = false;

var s = document.createElement('script');
s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
s.onload = function() {
  window.supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabaseClient = window.supa;
};
document.head.appendChild(s);

// ── TAB SWITCHING ──────────────────────────────────────────
var dashboardLoaded = false;
function switchTab(tab) {
  document.getElementById('view-order').style.display = tab === 'order' ? '' : 'none';
  document.getElementById('view-dashboard').style.display = tab === 'dashboard' ? '' : 'none';
  document.querySelectorAll('.bottom-nav-tab').forEach(function(el){
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  if (tab === 'dashboard' && !dashboardLoaded) { dashboardLoaded = true; loadDashboard(); }
  if (tab === 'dashboard' && dashboardLoaded) { loadDashboard(); }
}
window.switchTab = switchTab;

// ── PIN LOCK ───────────────────────────────────────────────
function unlockApp() {
  var inputEl = document.getElementById('pinInput');
  var input = inputEl ? String(inputEl.value || '') : '';
  var error = document.getElementById('pinError');
  if (input === OPERATOR_PIN) {
    window.appUnlocked = true;
    var lock = document.getElementById('pinLock');
    if (lock) lock.style.display = 'none';
    if (error) { error.style.display = 'none'; error.innerText = ''; }
    setTimeout(function(){ var el = document.getElementById('billNo'); if (el) el.focus(); }, 50);
    return true;
  } else {
    if (error) { error.style.display = 'block'; error.innerText = 'Incorrect PIN — try again'; }
    var shakeEl = document.getElementById('pinInput');
    if (shakeEl) { shakeEl.classList.remove('shake'); void shakeEl.offsetWidth; shakeEl.classList.add('shake'); setTimeout(function(){ shakeEl.classList.remove('shake'); }, 450); shakeEl.select(); }
    return false;
  }
}
window.unlockApp = unlockApp;

// ── AUTOSAVE ──────────────────────────────────────────────
var isDirty = false;
var AUTOSAVE_KEY = 'groomskart_autosave';
var autosaveTimer = null;
var AUTOSAVE_DELAY = 2000;
function scheduleAutosave() { if (autosaveTimer) clearTimeout(autosaveTimer); autosaveTimer = setTimeout(performAutosave, AUTOSAVE_DELAY); }
function performAutosave() { try { var data = getFormObject(); localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ time: new Date().toISOString(), data: data })); } catch(e){} }
function tryRestoreSnapshot() { try { var raw = localStorage.getItem(AUTOSAVE_KEY); if(!raw) return; var snap = JSON.parse(raw); if(!snap||!snap.data) { localStorage.removeItem(AUTOSAVE_KEY); return; } if (confirm('Unsaved order found (saved ' + new Date(snap.time).toLocaleString() + '). Restore it?')) restoreSnapshot(snap.data); else localStorage.removeItem(AUTOSAVE_KEY); } catch(e){} }
function restoreSnapshot(data){ if(!data) return; try { ['billNo','delDate'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=data[id]||''; }); document.getElementById('cName').value=data.name||''; document.getElementById('cWearer').value=data.wearer||''; if(data.garment) document.getElementById('gType').value=data.garment; document.getElementById('fabricUpperName').value=data.fabUpperName||''; document.getElementById('fabricUpperColor').value=data.fabUpperColor||''; document.getElementById('fabricLowerName').value=data.fabLowerName||''; document.getElementById('fabricLowerColor').value=data.fabLowerColor||''; document.getElementById('notesUpper').value=data.notesUpper||''; document.getElementById('notesLower').value=data.notesLower||''; document.getElementById('val_loosing').value=data.loosing||''; if(data.style){if(data.style.suit)document.getElementById('suitStyle').value=data.style.suit;} if(data.upper){['len','chest','stom','hip','shld','slv','neck','xb','bic','cuff','mohri'].forEach(function(k){var el=document.getElementById('u_'+k);if(el&&data.upper[k]!==undefined)el.value=data.upper[k];});} if(data.lower){['len','waist','thigh','asan','hip','mohri'].forEach(function(k){var el=document.getElementById('l_'+k);if(el&&data.lower[k]!==undefined)el.value=data.lower[k];});} if(data.posture){['back','stom','shld','neck'].forEach(function(name,i){var pName=['p_back','p_stom','p_shld','p_neck'][i];var val=[data.posture.back,data.posture.stomach,data.posture.shoulder,data.posture.neck][i];if(val){var el=document.querySelector('input[name="'+pName+'"][value="'+val+'"]');if(el)el.checked=true;}});} uiLogic(); isDirty=true; } catch(e){ console.warn('restoreSnapshot error',e); } }
function clearSnapshot(){ localStorage.removeItem(AUTOSAVE_KEY); }

// ── MODALS ────────────────────────────────────────────────
function showModal(msg) { var body=document.getElementById('statusModalBody'); if(body) body.innerText=msg; var modal=document.getElementById('statusModal'); if(modal&&window.bootstrap) new window.bootstrap.Modal(modal).show(); }
window.showModal = showModal;
function closeAllModals() { document.querySelectorAll('.modal').forEach(function(m){ var i=window.bootstrap&&window.bootstrap.Modal.getInstance(m); if(i) i.hide(); }); document.body.classList.remove('modal-open'); document.querySelectorAll('.modal-backdrop').forEach(function(b){ b.remove(); }); }
window.closeAllModals = closeAllModals;

// ── ORDER FORM LOGIC ──────────────────────────────────────
function sanitizePhone(p){ return String(p||'').replace(/\\D/g,''); }

async function searchPhoneHistory(phone){
  try { var clean=sanitizePhone(phone); if(!clean) return {status:'NEW',name:'',history:[]}; var supa=window.supa; if(!supa) return {status:'NEW',name:'',history:[]}; var res=await supa.from('orders').select('id,bill_order_no,phone,customer_name,wearer,delivery_date,garment_type,style,posture,measurements_upper,measurements_lower,waistcoat_details,fabric_upper_name,fabric_upper_color,fabric_lower_name,fabric_lower_color,notes_upper,notes_lower,pant_style,loosing_val').order('id',{ascending:false}).limit(5000); if(res.error) return {status:'NEW',name:'',history:[]}; var matches=[]; var name=''; for(var row of (res.data||[])){var p=sanitizePhone(row.phone||'');if(p!==clean)continue;var full=String(row.customer_name||'').trim();if(!name)name=full.split(' (')[0];matches.push({billRef:row.bill_order_no||'',rowIndex:row.id,wearer:row.wearer||(full.includes('(')?full.split('(')[1].replace(')',''):'Client'),garment:row.garment_type||'',date:row.delivery_date||'',phone:row.phone||'',data:{style:row.style||{},posture:row.posture||{},upper:row.measurements_upper||{},lower:row.measurements_lower||{},wc:row.waistcoat_details||{},fabName:row.fabric_upper_name||'',fabColor:row.fabric_upper_color||'',fabLowerName:row.fabric_lower_name||'',fabLowerColor:row.fabric_lower_color||'',notesUpper:row.notes_upper||'',notesLower:row.notes_lower||'',pantStyle:row.pant_style||'',loosing:row.loosing_val||''}});} return matches.length?{status:'FOUND',name:name,history:matches}:{status:'NEW',name:'',history:[]}; } catch(e){ return {status:'NEW',name:'',history:[]}; }
}
async function searchByName(query){
  try { if(!query) return []; var supa=window.supa; if(!supa) return []; var res=await supa.from('orders').select('id,bill_order_no,phone,customer_name,wearer,delivery_date,garment_type').ilike('customer_name','%'+String(query).toLowerCase().trim()+'%').order('id',{ascending:false}).limit(30); if(res.error) return []; return res.data.map(function(r){var rn=String(r.customer_name||'').trim();return{name:rn.split(' (')[0],wearer:r.wearer||(rn.includes('(')?rn.split('(')[1].replace(')',''):'Client'),phone:r.phone||'',date:r.delivery_date||'',rowIndex:r.id,garment:r.garment_type||''};});} catch(e){ return []; }
}
async function getOrderData(rowIndex){
  try { if(!rowIndex) return {status:'NOT_FOUND'}; var supa=window.supa; if(!supa) return {status:'NOT_FOUND'}; var res=await supa.from('orders').select('*').eq('id',rowIndex).single(); if(res.error||!res.data) return {status:'NOT_FOUND'}; var row=res.data; var full=String(row.customer_name||'').trim(); return {status:'FOUND',billNo:row.bill_order_no||'',date:row.delivery_date||'',name:full.split(' (')[0],wearer:row.wearer||(full.includes('(')?full.split('(')[1].replace(')',''):'Client'),phone:row.phone||'',garment:row.garment_type||'',style:row.style||{},posture:row.posture||{},upper:row.measurements_upper||{},lower:row.measurements_lower||{},wc:row.waistcoat_details||{},loosing:row.loosing_val||'',pantStyle:row.pant_style||'',fabUpperName:row.fabric_upper_name||'',fabUpperColor:row.fabric_upper_color||'',fabLowerName:row.fabric_lower_name||'',fabLowerColor:row.fabric_lower_color||'',notesUpper:row.notes_upper||'',notesLower:row.notes_lower||'',fabName:row.fabric_upper_name||'',fabColor:row.fabric_upper_color||'',version:String(row.version||''),is_delivered:row.is_delivered||false};} catch(e){return {status:'NOT_FOUND'};}
}
function base64ToBlob(b,m){var bc=atob(b);var bn=new Array(bc.length);for(var i=0;i<bc.length;i++)bn[i]=bc.charCodeAt(i);return new Blob([new Uint8Array(bn)],{type:m||'image/jpeg'});}
async function supaSaveOrder(form,fileObj){
  if(!window.appUnlocked) return {status:'ERROR',msg:'App is locked. Enter PIN first.'};
  var supa=window.supa; if(!supa) return {status:'ERROR',msg:'Database not connected.'};
  try {
    var photoUrl=null;
    if(fileObj&&fileObj.data){try{var fn=Date.now()+'_'+(fileObj.name||'fabric').replace(/\\s+/g,'_').replace(/[^\\w\\-.]/g,'');var up=await supa.storage.from(STORAGE_BUCKET).upload(fn,base64ToBlob(fileObj.data,fileObj.mime),{upsert:false});if(!up.error){var pub=supa.storage.from(STORAGE_BUCKET).getPublicUrl(fn);photoUrl=(pub&&pub.data&&pub.data.publicUrl)||null;}}catch(e){}}
    var row={bill_order_no:form.billNo||null,delivery_date:form.delDate||null,customer_name:form.name||'',wearer:form.wearer||'',phone:form.custPhone||'',garment_type:form.garment||'',style:form.style||{},posture:form.posture||{},measurements_upper:form.upper||{},measurements_lower:form.lower||{},waistcoat_details:form.wc||{},fabric_upper_name:form.fabUpperName||'',fabric_upper_color:form.fabUpperColor||'',fabric_lower_name:form.fabLowerName||'',fabric_lower_color:form.fabLowerColor||'',notes_upper:form.notesUpper||'',notes_lower:form.notesLower||'',pant_style:form.pantStyle||'',loosing_val:form.loosing||'',app_token:'GROOMSKART_INTERNAL_V1'};
    var ins=await supa.from('orders').insert([row]).select().single();
    if(ins.error){if(ins.error.code==='23505'||String(ins.error.message||'').includes('uniq_active_order_per_garment'))return{status:'ERROR',msg:'This garment is already saved for this bill.'};return{status:'ERROR',msg:'Insert failed: '+(ins.error.message||ins.error)};}
    return {status:'SUCCESS',msg:'Order Saved',billNo:ins.data.bill_order_no||form.billNo};
  }catch(e){return{status:'ERROR',msg:String(e&&e.message?e.message:e)};}
}

function getFormObject(){
  var g=document.getElementById('gType')?document.getElementById('gType').value:''; var gl=g.toLowerCase();
  var style={};
  if(gl.includes('suit')||gl.includes('blazer')||gl.includes('tuxedo')){style={suit:(document.getElementById('suitStyle')||{}).value||'',lapel:(document.getElementById('suitLapel')||{}).value||'',btns:(document.getElementById('suitButtons')||{}).value||'',vent:(document.getElementById('suitVent')||{}).value||''};}
  else if(gl.includes('indo')){style={indo:(document.getElementById('indoStyle')||{}).value||'',indoInnerLen:(document.getElementById('indo_inner_len')||{}).value||''};}
  var getR=function(name){var el=document.querySelector('input[name="'+name+'"]:checked');return el?el.value:'';};
  var upper={len:(document.getElementById('u_len')||{}).value||'',chest:(document.getElementById('u_chest')||{}).value||'',stom:(document.getElementById('u_stom')||{}).value||'',hip:(document.getElementById('u_hip')||{}).value||'',shld:(document.getElementById('u_shld')||{}).value||'',slv:(document.getElementById('u_slv')||{}).value||'',neck:(document.getElementById('u_neck')||{}).value||'',xb:(document.getElementById('u_xb')||{}).value||'',bic:(document.getElementById('u_bic')||{}).value||'',ah:(document.getElementById('u_ah')||{}).value||'',fc:(document.getElementById('u_fc')||{}).value||'',bc:(document.getElementById('u_bc')||{}).value||'',cuff:(document.getElementById('u_cuff')||{}).value||'',mohri:(document.getElementById('u_mohri')||{}).value||''};
  var lower={len:(document.getElementById('l_len')||{}).value||'',waist:(document.getElementById('l_waist')||{}).value||'',thigh:(document.getElementById('l_thigh')||{}).value||'',asan:(document.getElementById('l_asan')||{}).value||'',hip:(document.getElementById('l_hip')||{}).value||'',mohri:(document.getElementById('l_mohri')||{}).value||''};
  var halfEl=document.getElementById('halfElastic');
  var wcLen=(document.getElementById('wc_len')||{}).value||''; var wcNeck=(document.getElementById('wc_neck')||{}).value||''; var wc=wcLen?{len:wcLen,neck:wcNeck}:{};
  return{billNo:(document.getElementById('billNo')||{}).value||'',delDate:(document.getElementById('delDate')||{}).value||'',name:(document.getElementById('cName')||{}).value||'',wearer:(document.getElementById('cWearer')||{}).value||'',custPhone:(document.getElementById('cPhone')||{}).value||'',garment:g,style:style,posture:{back:getR('p_back'),stomach:getR('p_stom'),shoulder:getR('p_shld'),neck:getR('p_neck')},upper:upper,lower:lower,wc:wc,loosing:(document.getElementById('val_loosing')||{}).value||'',pantStyle:halfEl&&halfEl.checked?'Half Elastic':'',fabUpperName:(document.getElementById('fabricUpperName')||{}).value||'',fabUpperColor:(document.getElementById('fabricUpperColor')||{}).value||'',fabLowerName:(document.getElementById('fabricLowerName')||{}).value||'',fabLowerColor:(document.getElementById('fabricLowerColor')||{}).value||'',notesUpper:(document.getElementById('notesUpper')||{}).value||'',notesLower:(document.getElementById('notesLower')||{}).value||'',currentVersion:(document.getElementById('currentVer')||{}).value||''};
}

function uiLogic(){
  var g=(document.getElementById('gType')||{}).value||'Suit'; var gl=g.toLowerCase();
  var isSuit=gl==='suit'||gl.includes('tuxedo'); var isIndo=gl==='indowestern'; var isKurta=gl==='kurta'; var isBlazer=gl==='blazer'; var isSherwani=gl==='sherwani'; var isPant=gl==='pant'; var isPyjama=gl==='pyjama'; var isPatiala=gl==='patiala'; var isChuri=gl==='churidar'; var isAligarh=gl==='aligarh';
  var hasLower=isSuit||isIndo||isSherwani||isPant||isPyjama||isPatiala||isChuri||isAligarh;
  var hasUpper=!isPant&&!isPyjama&&!isPatiala&&!isChuri&&!isAligarh;
  var tog=function(id,hide){var el=document.getElementById(id);if(el)el.classList.toggle('hidden',hide);};
  tog('opt_suit',!(isSuit||isBlazer)); tog('opt_indo',!isIndo); tog('opt_kurta',!isKurta);
  tog('fabricLowerBlock',!hasLower); tog('mod_upper',!hasUpper); tog('mod_lower',!hasLower); tog('notesLowerBlock',!hasLower);
  var isSuitStyle=document.getElementById('suitStyle')?document.getElementById('suitStyle').value:'';
  tog('wc_block',isSuitStyle!=='3-Piece');
  var isIndoOpen=document.getElementById('indoStyle')?document.getElementById('indoStyle').value==='Open Indowestern':false;
  tog('indo_inner',!isIndoOpen);
  var kSleeve=document.querySelector('input[name="k_sleeve"]:checked'); var ks=kSleeve?kSleeve.value:'Cuff';
  tog('div_cuff',ks!=='Cuff'||!isKurta); tog('div_mohri_u',ks!=='Mohri'||!isKurta);
  var isDB=isSuitStyle==='Double Breasted'; tog('div_lapel_box',isDB);
}
window.uiLogic = uiLogic;

function fillAllGhosts(data){
  if(!data) return; var u=data.upper||{}; var l=data.lower||{};
  function sg(id,val){var el=document.getElementById(id);if(el&&val)el.innerText='↑ '+val;}
  sg('g_u_len',u.len);sg('g_u_chest',u.chest);sg('g_u_stom',u.stom);sg('g_u_hip',u.hip);sg('g_u_shld',u.shld);sg('g_u_slv',u.slv);sg('g_u_neck',u.neck);sg('g_u_xb',u.xb);sg('g_u_bic',u.bic);sg('g_u_cuff',u.cuff);sg('g_u_mohri',u.mohri);
  sg('g_l_len',l.len);sg('g_l_waist',l.waist);sg('g_l_thigh',l.thigh);sg('g_l_asan',l.asan);sg('g_l_hip',l.hip);sg('g_l_mohri',l.mohri);
}
window.fillAllGhosts = fillAllGhosts;

var historyData=[]; var reprintData=null;

function decideSearch(){
  var q=document.getElementById('searchAny')?document.getElementById('searchAny').value.trim():'';
  if(!q) return showModal('Enter Phone or Name!');
  resetSearchState();
  if(q.match(/^\\d+$/)){document.getElementById('cPhone').value=q;doPhoneSearch(q);}
  else{var sm=document.getElementById('searchMsg');if(sm)sm.innerText='Searching...';searchByName(q).then(showNameResults).catch(function(){showNameResults([]);});}
}
window.decideSearch = decideSearch;

function resetSearchState(){var hb=document.getElementById('historyBlock');if(hb)hb.classList.add('hidden');historyData=[];var sel=document.getElementById('wearerHistorySelect');if(sel)sel.innerHTML='<option value="">-- Select History Item --</option>';}
function showNameResults(matches){
  var list=document.getElementById('nameSearchResults');if(!list)return;list.innerHTML='';var sm=document.getElementById('searchMsg');if(sm)sm.innerText='';
  if(!matches||matches.length===0)return list.innerHTML='No matches found.';
  matches.forEach(function(m){var btn=document.createElement('button');btn.className='btn btn-outline-dark w-100 mb-2 text-start p-2';btn.innerHTML='<strong>'+m.name+' ('+m.wearer+')</strong><br>📱 '+m.phone+' <br><small>Last: '+m.date+'</small>';btn.onclick=function(){closeAllModals();document.getElementById('cPhone').value=m.phone;document.getElementById('cName').value=m.name;doPhoneSearch(m.phone);};list.appendChild(btn);});
  if(window.bootstrap)new window.bootstrap.Modal(document.getElementById('nameSearchModal')).show();
}
async function doPhoneSearch(p){
  if(!p||p.length<6)return showModal('Phone too short');
  try{var res=await searchPhoneHistory(p);if(res&&res.status==='FOUND'){var sm=document.getElementById('searchMsg');if(sm)sm.innerHTML="<span class='text-success'>History Found!</span>";var cNameEl=document.getElementById('cName');if(cNameEl)cNameEl.value=res.name;var hb=document.getElementById('historyBlock');if(hb)hb.classList.remove('hidden');historyData=res.history||[];var sel=document.getElementById('wearerHistorySelect');if(sel&&historyData.length){sel.innerHTML='<option value="">-- Select History Item --</option>';historyData.forEach(function(item,index){var opt=document.createElement('option');opt.value=index;opt.innerText=(item.wearer||'Client')+' | '+(item.garment||'Unknown')+' | Bill #'+(item.billRef||'');sel.appendChild(opt);});}}else{var sm2=document.getElementById('searchMsg');if(sm2)sm2.innerHTML="<span class='text-warning'>New Customer</span>";var hb2=document.getElementById('historyBlock');if(hb2)hb2.classList.add('hidden');}}catch(e){showModal('Server search error');}
}
function loadSelectedWearer(){var idx=document.getElementById('wearerHistorySelect').value;if(idx===''||!historyData[idx])return;var d=historyData[idx];document.getElementById('cWearer').value=d.wearer;fillAllGhosts(d.data);if(d.data&&d.data.fabName)document.getElementById('fabricUpperName').value=d.data.fabName;showModal('Loaded History for Bill #'+d.billRef);isDirty=true;}
window.loadSelectedWearer = loadSelectedWearer;
async function triggerReprintLogic(){var idx=document.getElementById('wearerHistorySelect').value;if(idx===''||!historyData[idx])return showModal('Select a history item first!');var rowIdx=historyData[idx].rowIndex;showModal('Fetching...');try{var data=await getOrderData(rowIdx);if(!data||data.status!=='FOUND')return showModal('Could not fetch order data.');reprintData=data;closeAllModals();showPrintModal(true);}catch(e){showModal('Error fetching order');}}
window.triggerReprintLogic = triggerReprintLogic;
function showPrintModal(isReprint){if(!isReprint)reprintData=null;if(window.bootstrap)new window.bootstrap.Modal(document.getElementById('printModal')).show();}
window.showPrintModal = showPrintModal;
function nextPerson(){document.getElementById('cName').value='';document.getElementById('cWearer').value='';document.getElementById('cPhone').value='';document.getElementById('searchAny').value='';resetSearchState();clearMeasurements();clearSnapshot();isDirty=false;var btn=document.getElementById('btnSave');if(btn)btn.innerText='SAVE ORDER';var bp=document.getElementById('btnPrint');if(bp)bp.disabled=true;}
window.nextPerson = nextPerson;
function fullReset(){if(isDirty&&!confirm('Unsaved changes will be lost. Continue?'))return;document.querySelectorAll('#orderForm input, #orderForm select, #orderForm textarea').forEach(function(el){if(el.type==='checkbox'||el.type==='radio')el.checked=el.defaultChecked;else el.value=el.defaultValue||'';});document.getElementById('billNo').value='';document.getElementById('delDate').value='';document.getElementById('cName').value='';document.getElementById('cWearer').value='';document.getElementById('cPhone').value='';document.getElementById('searchAny').value='';resetSearchState();document.querySelectorAll('.ghost').forEach(function(g){g.innerText='';});clearSnapshot();isDirty=false;uiLogic();var btn=document.getElementById('btnSave');if(btn)btn.innerText='SAVE ORDER';var bp=document.getElementById('btnPrint');if(bp)bp.disabled=true;}
window.fullReset = fullReset;
function clearMeasurements(){['u_len','u_chest','u_stom','u_hip','u_shld','u_slv','u_neck','u_xb','u_bic','u_ah','u_fc','u_bc','u_cuff','u_mohri','l_len','l_waist','l_thigh','l_asan','l_hip','l_mohri','val_loosing','wc_len','notesUpper','notesLower'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});document.querySelectorAll('.ghost').forEach(function(g){g.innerText='';}); }

function getDeliveryStatus(ds){if(!ds)return{text:'N/A',urgent:false};var parts=ds.split('-');var d;if(parts[0].length===4)d=new Date(parts[0],parts[1]-1,parts[2]);else d=new Date(parts[2],parts[1]-1,parts[0]);var today=new Date();today.setHours(0,0,0,0);d.setHours(0,0,0,0);var diff=Math.ceil((d-today)/(1000*60*60*24));if(diff<0)return{text:'REPRINT',urgent:true};if(diff<=5)return{text:ds,urgent:true};return{text:ds,urgent:false};}

function populateThermalReceipt(d){if(!d)return;d.upper=d.upper||{};d.lower=d.lower||{};d.style=d.style||{};d.wc=d.wc||{};var g=(d.garment||'').toLowerCase();document.getElementById('th_item').innerText=(d.garment||'ITEM').toUpperCase();document.getElementById('th_bill').innerText=d.billNo||'';document.getElementById('th_name').innerText=(d.name||'')+(d.wearer?' ('+d.wearer+')':'');var st=getDeliveryStatus(d.delDate||d.date);document.getElementById('th_del_date').innerText=st.urgent?'⚠️ '+st.text:st.text;var tU='';var aU=function(l,v){if(v!==undefined&&v!==null&&v!=='')tU+='<tr><th>'+l+'</th><td>'+v+'</td></tr>';};aU('Length',d.upper.len);aU('Chest',d.upper.chest);aU('Pet',d.upper.stom);aU('Hip',d.upper.hip);aU('Shoulder',d.upper.shld);aU('Hand',d.upper.slv);aU('Neck',d.upper.neck);aU('Cuff',d.upper.cuff);aU('Mohri',d.upper.mohri);document.getElementById('th_tbody_up').innerHTML=tU;var tL='';var aL=function(l,v){if(v!==undefined&&v!==null&&v!=='')tL+='<tr><th>'+l+'</th><td>'+v+'</td></tr>';};aL('Pant W',d.lower.waist);aL('Pant L',d.lower.len);aL('Thigh',d.lower.thigh);aL('Mohri',d.lower.mohri);document.getElementById('th_tbody_low').innerHTML=tL;var uOnly=['kurta','shirt','blazer','nehru jacket','waistcoat'];document.getElementById('th_lower_section').classList.toggle('hidden',uOnly.some(function(x){return g.includes(x);})||tL==='');var dt=g.includes('suit')||g.includes('blazer')?(d.style.suit||'')+' | '+(d.style.btns||''):'Standard';document.getElementById('th_design_block').innerText=dt;var fU=d.fabUpperName?(d.fabUpperName+' '+(d.fabUpperColor||'')).trim():'';var fL=d.fabLowerName?(d.fabLowerName+' '+(d.fabLowerColor||'')).trim():'';document.getElementById('th_fab_upper').innerText=fU||(d.fabName||'-');if(fL){document.getElementById('th_fab_lower').innerText=fL;document.getElementById('th_fab_lower_row').classList.remove('hidden');}else{document.getElementById('th_fab_lower_row').classList.add('hidden');}document.getElementById('th_loose').innerText=d.loosing?d.loosing+'"':'-';if(g.includes('suit')&&d.style.suit==='3-Piece'){document.getElementById('th_wc_row').classList.remove('hidden');document.getElementById('th_wc_len').innerText=d.wc.len||'';}else{document.getElementById('th_wc_row').classList.add('hidden');}document.getElementById('th_fab_col').innerText=d.fabUpperColor||d.fabColor||'-';}

function populateStandardCard(d){if(!d)return;d.upper=d.upper||{};d.lower=d.lower||{};d.style=d.style||{};d.wc=d.wc||{};d.posture=d.posture||{};var g=(d.garment||'').toLowerCase();var uOnly=['shirt','kurta','nehru jacket','waistcoat','blazer'];var lOnly=['pant','pyjama','patiala','churidar','aligarh'];var hL=uOnly.some(function(x){return g.includes(x);});var hU=lOnly.some(function(x){return g.includes(x);});var lc=document.getElementById('print_left_col');var rc=document.getElementById('print_right_col');if(hU){lc.style.display='none';rc.style.display='flex';}else if(hL){rc.style.display='none';lc.style.display='flex';}else{lc.style.display='flex';rc.style.display='flex';lc.style.borderRight='2px dashed #000';}var st=getDeliveryStatus(d.delDate||d.date);['L','R'].forEach(function(s){var el=function(id){return document.getElementById(id);};el('pj_bill_'+s)&&(el('pj_bill_'+s).innerText=d.billNo||'');var dn=d.name||'';if(d.wearer&&d.wearer!=='Self'&&d.wearer!=='Client')dn+=' ('+d.wearer+')';el('pj_name_'+s)&&(el('pj_name_'+s).innerText=dn);el('pj_del_'+s)&&(el('pj_del_'+s).innerText=st.text);if(el('pj_urgent_'+s)){if(st.urgent)el('pj_urgent_'+s).classList.remove('hidden');else el('pj_urgent_'+s).classList.add('hidden');}if(s==='L'&&!hU){if(el('pj_bp_back_L'))el('pj_bp_back_L').innerText=d.posture.back||'';if(el('pj_bp_stom_L'))el('pj_bp_stom_L').innerText=d.posture.stomach||'';if(el('pj_bp_shld_L'))el('pj_bp_shld_L').innerText=d.posture.shoulder||'';if(el('pj_bp_neck_L'))el('pj_bp_neck_L').innerText=d.posture.neck||'';var tU='';var aU=function(l,v){if(v!==undefined&&v!==null&&v!=='')tU+='<tr><th>'+l+'</th><td>'+v+'</td></tr>';};aU('Length',d.upper.len);aU('Chest',d.upper.chest);aU('Pet',d.upper.stom);aU('Hip',d.upper.hip);aU('Shoulder',d.upper.shld);aU('Hand',d.upper.slv);aU('Neck',d.upper.neck);aU('Cuff',d.upper.cuff);aU('Mohri',d.upper.mohri);el('pj_tbl_upper').innerHTML=tU;var dv=(g.includes('suit')||g.includes('blazer'))?(d.style.suit||'')+(d.style.btns?' | '+d.style.btns:''):'';if(el('pj_design_row_L')&&el('pj_design_L')){if(dv){el('pj_design_row_L').style.display='';el('pj_design_L').innerText=dv;}else{el('pj_design_row_L').style.display='none';}}if(el('pj_fab_L'))el('pj_fab_L').innerText=(d.fabUpperName||d.fabName||'')+(d.fabUpperColor?' ('+d.fabUpperColor+')':'');if(el('pj_loose_L'))el('pj_loose_L').innerText=d.loosing?d.loosing+'"':'';if(el('pj_notes_L'))el('pj_notes_L').innerText=d.notesUpper||'';}if(s==='R'&&!hL){var tL='';var aL=function(l,v){if(v!==undefined&&v!==null&&v!=='')tL+='<tr><th>'+l+'</th><td>'+v+'</td></tr>';};aL('Length',d.lower.len);aL('Waist',d.lower.waist);aL('Thigh',d.lower.thigh);aL('Asan',d.lower.asan);aL('Hip',d.lower.hip);aL('Mohri',d.lower.mohri);el('pj_tbl_lower').innerHTML=tL;if(el('pj_waist_type_R'))el('pj_waist_type_R').innerText=d.pantStyle||'Normal';if(el('pj_fab_R'))el('pj_fab_R').innerText=d.fabLowerName||(d.fabUpperName||'');if(el('pj_notes_R'))el('pj_notes_R').innerText=d.notesLower||'';}});}

async function openSummaryBeforeSave(){
  if(!window.appUnlocked)return showModal('Please unlock the app first (enter PIN).');
  var form=getFormObject();
  if(!form.billNo)return showModal('Bill / Order No is required.');
  if(!form.delDate)return showModal('Delivery Date is required.');
  if(!form.name)return showModal('Customer Name is required.');
  var gl=form.garment.toLowerCase();var nU=!['pant','pyjama','patiala','churidar','aligarh'].some(function(x){return gl.includes(x);});var nL=['suit','indowestern','sherwani','pant','pyjama','patiala','churidar','aligarh'].some(function(x){return gl.includes(x);});
  var lines=['Bill: '+form.billNo,'Delivery: '+form.delDate,'Customer: '+form.name+(form.wearer?' ('+form.wearer+')':''),'Phone: '+(form.custPhone||'—'),'Garment: '+form.garment];
  if(nU){var u=form.upper;lines.push('--- Upper ---','Length: '+(u.len||'—')+' | Chest: '+(u.chest||'—')+' | Stomach: '+(u.stom||'—'),'Hip: '+(u.hip||'—')+' | Shoulder: '+(u.shld||'—')+' | Hand: '+(u.slv||'—'),'Neck: '+(u.neck||'—')+' | Loosing: '+(form.loosing||'—'));}
  if(nL){var l=form.lower;lines.push('--- Lower ---','Length: '+(l.len||'—')+' | Waist: '+(l.waist||'—')+' | Thigh: '+(l.thigh||'—'),'Asan: '+(l.asan||'—')+' | Hip: '+(l.hip||'—')+' | Mohri: '+(l.mohri||'—'));}
  lines.push('--- Body Profile ---','Back: '+(form.posture.back||'—')+' | Stomach: '+(form.posture.stomach||'—'),'Shoulder: '+(form.posture.shoulder||'—')+' | Neck: '+(form.posture.neck||'—'));
  if(form.fabUpperName)lines.push('Fabric: '+form.fabUpperName+(form.fabUpperColor?' ('+form.fabUpperColor+')':''));
  if(form.notesUpper)lines.push('Notes: '+form.notesUpper);
  var body=document.getElementById('summaryBody');if(body)body.innerText=lines.join('\\n');
  var warn=document.getElementById('summaryWarnings');var warnings=[];if(nU&&(!form.upper.len||!form.upper.chest))warnings.push('⚠️ Some upper measurements missing');if(nL&&(!form.lower.len||!form.lower.waist))warnings.push('⚠️ Some lower measurements missing');if(warn)warn.innerHTML=warnings.map(function(w){return'<div class="alert alert-warning py-1">'+w+'</div>';}).join('');
  window._pendingSaveForm=form;
  if(window.bootstrap)new window.bootstrap.Modal(document.getElementById('summaryModal')).show();
}
window.openSummaryBeforeSave = openSummaryBeforeSave;

async function confirmSaveFromSummary(){
  closeAllModals();var form=window._pendingSaveForm;if(!form)return showModal('No pending form data.');
  var fileInput=document.getElementById('fabricPhoto');var fileObj=null;
  if(fileInput&&fileInput.files&&fileInput.files[0]){var f=fileInput.files[0];await new Promise(function(resolve){var reader=new FileReader();reader.onload=function(e){fileObj={data:e.target.result.split(',')[1],name:f.name,mime:f.type};resolve();};reader.readAsDataURL(f);});}
  showModal('Saving order...');
  var result=await supaSaveOrder(form,fileObj);clearSnapshot();
  if(result.status==='SUCCESS'){var btn=document.getElementById('btnSave');if(btn)btn.innerText='SAVE ORDER';var bp=document.getElementById('btnPrint');if(bp)bp.disabled=false;isDirty=false;window._lastSavedData=Object.assign({},form,{billNo:result.billNo});showModal('✅ Order saved! Bill: '+result.billNo);}
  else{showModal('❌ '+result.msg);}
}
window.confirmSaveFromSummary = confirmSaveFromSummary;

function doPrint(mode){var d=reprintData||window._lastSavedData;if(!d)return showModal('No order data. Save an order first.');closeAllModals();if(mode==='standard'){document.body.className='mode-standard';populateStandardCard(d);}else{document.body.className='mode-thermal';populateThermalReceipt(d);}setTimeout(function(){window.print();setTimeout(function(){document.body.className='';},500);},300);}
window.doPrint = doPrint;

// ── DASHBOARD LOGIC ───────────────────────────────────────
var activeDueFilter = null;
var stitchPage = 0;
var readyPage = 0;
var allPending = [];
var stitchingAll = [];
var readyAll = [];
var delayedAll = [];
var next3All = [];
var next7All = [];

function escapeHtml(s){ return String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function daysDiff(d){ if(!d) return null; var today=new Date(); today.setHours(0,0,0,0); var dt=new Date(d); dt.setHours(0,0,0,0); return Math.floor((dt-today)/86400000); }

function applyVisualFilterState(){
  if(activeDueFilter===3){document.getElementById('next3Box').classList.add('filter-active');document.getElementById('next7Box').classList.remove('filter-active');document.getElementById('clearFilterBtn').style.display='inline-block';}
  else if(activeDueFilter===7){document.getElementById('next7Box').classList.add('filter-active');document.getElementById('next3Box').classList.remove('filter-active');document.getElementById('clearFilterBtn').style.display='inline-block';}
  else{document.getElementById('next3Box').classList.remove('filter-active');document.getElementById('next7Box').classList.remove('filter-active');document.getElementById('clearFilterBtn').style.display='none';}
}
function applyDueFilter(days){ if(activeDueFilter===days)activeDueFilter=null; else activeDueFilter=days; stitchPage=0;readyPage=0; applyVisualFilterState(); renderStitching(); renderReady(); }
window.applyDueFilter = applyDueFilter;
function clearDueFilter(){ activeDueFilter=null; stitchPage=0;readyPage=0; applyVisualFilterState(); renderStitching(); renderReady(); }
window.clearDueFilter = clearDueFilter;

async function loadDashboard(){
  var supa = window.supa;
  if(!supa){ setTimeout(loadDashboard, 500); return; }
  try {
    var res = await supa.from('orders').select('*').eq('is_delivered',false).order('delivery_date',{ascending:true}).limit(5000);
    if(res.error){ return; }
    allPending = res.data || [];
    stitchingAll = allPending.filter(function(o){ return (o.status||'stitching').toLowerCase()==='stitching'; });
    readyAll = allPending.filter(function(o){ return (o.status||'').toLowerCase()==='ready'; });
    delayedAll = stitchingAll.filter(function(o){ if(!o.delivery_date)return false; var dd=daysDiff(o.delivery_date); return dd!==null&&dd<0; });
    next3All = allPending.filter(function(o){ var dd=daysDiff(o.delivery_date); return dd!==null&&dd>=0&&dd<=3; });
    next7All = allPending.filter(function(o){ var dd=daysDiff(o.delivery_date); return dd!==null&&dd>=0&&dd<=7; });
    renderOverviewCounts(); stitchPage=0; readyPage=0; renderStitching(); renderReady(); renderDelayed();
  } catch(e){}
}
window.loadDashboard = loadDashboard;

function renderOverviewCounts(){
  document.getElementById('totalPending').innerText = allPending.length;
  document.getElementById('next3Count').innerText = next3All.length;
  document.getElementById('next7Count').innerText = next7All.length;
  var byGarment = {};
  allPending.forEach(function(o){ var g=(o.garment_type||'Unknown').trim(); byGarment[g]=(byGarment[g]||0)+1; });
  var keys = Object.keys(byGarment).sort();
  var el=document.getElementById('byGarment');
  if(keys.length===0) el.innerHTML='<tr><td class="small-muted">None</td><td class="text-end small-muted">0</td></tr>';
  else { el.innerHTML=''; keys.forEach(function(k){ el.innerHTML+='<tr><td>'+escapeHtml(k)+'</td><td class="text-end">'+byGarment[k]+'</td></tr>'; }); }
  document.getElementById('stitchingCount').innerText = stitchingAll.length;
  document.getElementById('readyCount').innerText = readyAll.length;
  document.getElementById('delayedCount').innerText = delayedAll.length;
}

var searchQuery = '';
function getSearchQuery(){ var el=document.getElementById('dashSearch'); return el?(el.value||'').toLowerCase().trim():''; }
function matchesSearch(o){ if(!searchQuery) return true; return (o.customer_name||'').toLowerCase().includes(searchQuery)||(o.bill_order_no||'').toLowerCase().includes(searchQuery)||(o.garment_type||'').toLowerCase().includes(searchQuery); }
function applySearch(){ searchQuery=getSearchQuery(); stitchPage=0; readyPage=0; renderStitching(); renderReady(); renderDelayed(); }
window.applySearch = applySearch;

function renderStitching(){ var list=stitchingAll.filter(matchesSearch); if(activeDueFilter!==null)list=list.filter(function(o){var d=daysDiff(o.delivery_date);return d!==null&&d>=0&&d<=activeDueFilter;}); var start=stitchPage*PAGE_SIZE; var items=list.slice(start,start+PAGE_SIZE); var el=document.getElementById('stitchingList'); el.innerHTML=''; if(!items||items.length===0){el.innerHTML='<div class="small-muted p-2">None</div>';}else{items.forEach(function(o){el.innerHTML+=buildItemHtml(o);});} document.getElementById('stitchPrev').disabled=(stitchPage===0); document.getElementById('stitchNext').disabled=(start+PAGE_SIZE>=list.length); document.getElementById('stitchPageInfo').innerText='Page '+(stitchPage+1); }
function renderReady(){ var list=readyAll.filter(matchesSearch); var start=readyPage*PAGE_SIZE; var items=list.slice(start,start+PAGE_SIZE); var el=document.getElementById('readyList'); el.innerHTML=''; if(!items||items.length===0){el.innerHTML='<div class="small-muted p-2">None</div>';}else{items.forEach(function(o){el.innerHTML+=buildItemHtml(o);});} document.getElementById('readyPrev').disabled=(readyPage===0); document.getElementById('readyNext').disabled=(start+PAGE_SIZE>=list.length); document.getElementById('readyPageInfo').innerText='Page '+(readyPage+1); }
function renderDelayed(){ var list=delayedAll.filter(matchesSearch); var el=document.getElementById('delayedList'); el.innerHTML=''; if(!list||list.length===0){el.innerHTML='<div class="small-muted p-2">None</div>';}else{list.forEach(function(o){el.innerHTML+=buildItemHtml(o);});} }

function buildItemHtml(o){
  var id=o.id; var bill=o.bill_order_no?escapeHtml(o.bill_order_no):'#'+String(id).slice(0,8); var garment=escapeHtml(o.garment_type||'Unknown'); var customer=escapeHtml(o.customer_name||''); var status=(o.status||'stitching').toLowerCase(); var ddiff=daysDiff(o.delivery_date); var late=(ddiff!==null&&ddiff<0)?Math.abs(ddiff)+'d late':''; var actions='';
  if(status==='stitching') actions='<button class="btn btn-sm btn-primary me-2" onclick="markReady(\''+id+'\')">Mark Ready</button>';
  else if(status==='ready') actions='<button class="btn btn-sm btn-success me-2" onclick="markDelivered(\''+id+'\')">Delivered</button>';
  else actions='<button class="btn btn-sm btn-primary me-2" onclick="markReady(\''+id+'\')">Mark Ready</button>';
  var lateHtml=late?'<span class="badge badge-delayed ms-2">'+late+'</span>':'';
  var statusBadge=status==='ready'?'<span class="badge-ready-tag ms-1">Ready</span>':'<span class="badge-stitching ms-1">Stitching</span>';
  var itemClasses='item';
  if(activeDueFilter!==null&&ddiff!==null&&ddiff>=0&&ddiff<=activeDueFilter){if(ddiff===0)itemClasses+=' due-today';else itemClasses+=' urgent-gold';}
  var deliveryDate=o.delivery_date?new Date(o.delivery_date).toLocaleDateString():'';
  return '<div class="'+itemClasses+'"><div class="d-flex justify-content-between align-items-start"><div><div class="order-id">'+bill+statusBadge+'</div><div class="garment-type small-muted mt-1">'+garment+'</div><div class="customer-name small-muted">'+customer+'</div></div><div style="text-align:right;">'+lateHtml+'<div class="small-muted" style="margin-top:8px">'+deliveryDate+'</div></div></div><div class="mt-3">'+actions+'<button class="btn btn-sm btn-outline-light" onclick="openDetails(\''+id+'\')">View</button></div></div>';
}

async function markReady(id){
  if(!confirm('Mark this order as READY for delivery?')) return;
  var supa=window.supa; if(!supa) return;
  try { var res=await supa.from('orders').update({status:'ready',app_token:APP_TOKEN}).eq('id',id); if(!res.error) await loadDashboard(); } catch(e){}
}
window.markReady = markReady;

async function markDelivered(id){
  if(!confirm('Mark this order as DELIVERED? This is final.')) return;
  var supa=window.supa; if(!supa) return;
  try { var res=await supa.from('orders').update({is_delivered:true,delivered_at:new Date().toISOString(),delivered_by:'dashboard',app_token:APP_TOKEN}).eq('id',id); if(!res.error) await loadDashboard(); } catch(e){}
}
window.markDelivered = markDelivered;

async function openDetails(id){
  var supa=window.supa; if(!supa) return;
  try {
    var res=await supa.from('orders').select('*').eq('id',id).single();
    if(res.error||!res.data) return;
    var d=res.data; var status=(d.status||'stitching'); var ddiff=daysDiff(d.delivery_date);
    var urgency=ddiff!==null&&ddiff<0?'<span style="color:#ff4d4d;font-weight:700;">'+Math.abs(ddiff)+' days overdue</span>':ddiff===0?'<span style="color:#f5c542;font-weight:700;">Due Today</span>':'<span style="color:#4ade80;">'+ddiff+' days left</span>';
    var u=(d.measurements_upper||{}); var l=(d.measurements_lower||{});
    var upperRows='';
    if(u.chest)upperRows+='<div class="detail-row"><span class="detail-label">Chest</span><span class="detail-value">'+escapeHtml(u.chest)+'"</span></div>';
    if(u.len)upperRows+='<div class="detail-row"><span class="detail-label">Length</span><span class="detail-value">'+escapeHtml(u.len)+'"</span></div>';
    if(u.shld)upperRows+='<div class="detail-row"><span class="detail-label">Shoulder</span><span class="detail-value">'+escapeHtml(u.shld)+'"</span></div>';
    if(u.slv)upperRows+='<div class="detail-row"><span class="detail-label">Hand</span><span class="detail-value">'+escapeHtml(u.slv)+'"</span></div>';
    var lowerRows='';
    if(l.waist)lowerRows+='<div class="detail-row"><span class="detail-label">Waist</span><span class="detail-value">'+escapeHtml(l.waist)+'"</span></div>';
    if(l.len)lowerRows+='<div class="detail-row"><span class="detail-label">Length</span><span class="detail-value">'+escapeHtml(l.len)+'"</span></div>';
    if(l.mohri)lowerRows+='<div class="detail-row"><span class="detail-label">Mohri</span><span class="detail-value">'+escapeHtml(l.mohri)+'"</span></div>';
    var html='<div class="detail-overlay" id="detailOverlay" onclick="if(event.target===this)closeDetailModal()">'
      +'<div class="detail-box">'
      +'<div class="detail-header"><h5>'+escapeHtml(d.bill_order_no||('#'+id))+'</h5><button class="detail-close" onclick="closeDetailModal()">×</button></div>'
      +'<div class="detail-body">'
      +'<div class="detail-row"><span class="detail-label">Customer</span><span class="detail-value">'+escapeHtml(d.customer_name||'')+(d.wearer?' <span style="color:#777">('+escapeHtml(d.wearer)+')</span>':'')+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Garment</span><span class="detail-value">'+escapeHtml(d.garment_type||'')+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">'+(status==='ready'?'<span class="badge-ready-tag">Ready</span>':'<span class="badge-stitching">Stitching</span>')+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Delivery</span><span class="detail-value">'+escapeHtml(d.delivery_date||'—')+' &nbsp;'+urgency+'</span></div>'
      +(d.phone?'<div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">'+escapeHtml(d.phone)+'</span></div>':'')
      +(d.fabric_upper_name?'<div class="detail-row"><span class="detail-label">Fabric (Upper)</span><span class="detail-value">'+escapeHtml(d.fabric_upper_name)+(d.fabric_upper_color?' — '+escapeHtml(d.fabric_upper_color):'')+'</span></div>':'')
      +(d.fabric_lower_name?'<div class="detail-row"><span class="detail-label">Fabric (Lower)</span><span class="detail-value">'+escapeHtml(d.fabric_lower_name)+'</span></div>':'')
      +(upperRows?'<div style="color:#f5c542;font-size:0.8rem;font-weight:700;padding:10px 0 4px;letter-spacing:1px;">UPPER</div>'+upperRows:'')
      +(lowerRows?'<div style="color:#f5c542;font-size:0.8rem;font-weight:700;padding:10px 0 4px;letter-spacing:1px;">LOWER</div>'+lowerRows:'')
      +(d.notes_upper?'<div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value">'+escapeHtml(d.notes_upper)+'</span></div>':'')
      +'</div>'
      +'<div class="detail-footer">'
      +(status==='stitching'?'<button class="btn btn-sm btn-primary" onclick="closeDetailModal();markReady(\''+id+'\')">Mark Ready</button>':'')
      +(status==='ready'?'<button class="btn btn-sm btn-success" onclick="closeDetailModal();markDelivered(\''+id+'\')">Mark Delivered</button>':'')
      +(d.phone?'<a class="btn btn-sm btn-outline-success ms-auto" href="https://wa.me/91'+d.phone.replace(/\\D/g,'')+'?text='+encodeURIComponent('Hello! Your order (Bill: '+(d.bill_order_no||'')+(status==='ready'?' is READY for delivery.':' is in progress. Delivery: '+(d.delivery_date||'')+'.'))+'\" target="_blank">WhatsApp</a>':'')
      +'</div></div></div>';
    var existing=document.getElementById('detailOverlay'); if(existing)existing.remove();
    var div=document.createElement('div'); div.innerHTML=html; document.body.appendChild(div.firstChild);
  } catch(e){}
}
window.openDetails = openDetails;
function closeDetailModal(){ var el=document.getElementById('detailOverlay'); if(el)el.remove(); }
window.closeDetailModal = closeDetailModal;

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',function(){
  // PIN lock
  var pinBtn=document.getElementById('pinUnlockBtn');
  if(pinBtn)pinBtn.addEventListener('click',function(){var ok=unlockApp();if(!ok){var inp=document.getElementById('pinInput');if(inp)inp.focus();}});
  var pinInput=document.getElementById('pinInput');
  if(pinInput){pinInput.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();var ok=unlockApp();if(!ok)pinInput.select();}});setTimeout(function(){if(!window.appUnlocked&&pinInput)pinInput.focus();},50);}

  // Show/hide password toggle
  var showBtn=document.getElementById('pinShowBtn');
  if(showBtn)showBtn.addEventListener('click',function(){var inp=document.getElementById('pinInput');if(inp)inp.type=inp.type==='password'?'text':'password';});

  // Order form
  document.querySelectorAll('input, select, textarea').forEach(function(el){el.addEventListener('input',function(){isDirty=true;var btn=document.getElementById('btnSave');if(btn&&btn.innerText==='SAVE ORDER')btn.innerText='SAVE ORDER *';scheduleAutosave();});});
  var today=new Date().toISOString().split('T')[0];var delEl=document.getElementById('delDate');if(delEl)delEl.setAttribute('min',today);
  tryRestoreSnapshot();
  uiLogic();

  // Dashboard pagination
  document.getElementById('stitchPrev').addEventListener('click', function(){ if(stitchPage>0){stitchPage--;renderStitching();} });
  document.getElementById('stitchNext').addEventListener('click', function(){ stitchPage++;renderStitching(); });
  document.getElementById('readyPrev').addEventListener('click', function(){ if(readyPage>0){readyPage--;renderReady();} });
  document.getElementById('readyNext').addEventListener('click', function(){ readyPage++;renderReady(); });
  var dashSearch=document.getElementById('dashSearch');
  if(dashSearch)dashSearch.addEventListener('input',function(){applySearch();});
});
})();
  `;

  return (
    <>
      {/* PIN LOCK */}
      <div id="pinLock" style={{
        position: 'fixed', inset: 0, background: '#0a0a0a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999
      }}>
        <div style={{ background: '#141416', border: '1px solid #222', padding: '36px 32px 28px', borderRadius: '14px', width: '300px', textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,0.9)' }}>
          <div className="pin-logo">GROOMSKART<span className="pin-pro-badge">PRO</span></div>
          <p className="pin-subtitle">Operator Access</p>
          <hr className="pin-divider" />
          <div className="pin-input-wrap">
            <input id="pinInput" type="password" placeholder="Enter PIN" className="form-control" style={{ fontSize: '1.2rem', textAlign: 'center', letterSpacing: '6px', background: '#1e1e1e', border: '1px solid #333', color: '#fff' }} />
            <button id="pinShowBtn" className="pin-show-btn" type="button">👁</button>
          </div>
          <button id="pinUnlockBtn" className="btn btn-gold w-100 py-2" style={{ fontSize: '1rem', letterSpacing: '1px' }}>UNLOCK</button>
          <p id="pinError" style={{ color: '#ff4d4d', marginTop: '12px', display: 'none', fontSize: '0.9rem' }}>Incorrect PIN — try again</p>
        </div>
      </div>

      {/* BOTTOM NAV */}
      <nav className="bottom-nav">
        {[
          { tab: 'order', icon: '✂️', label: 'New Order' },
          { tab: 'dashboard', icon: '📊', label: 'Dashboard' },
        ].map(({ tab, icon, label }) => (
          <button key={tab} data-tab={tab} className={'bottom-nav-tab' + (tab === 'order' ? ' active' : '')} onClick={() => (window as any).switchTab(tab)}>
            <span className="bottom-nav-icon">{icon}</span>
            <span className="bottom-nav-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* ── ORDER VIEW ── */}
      <div id="view-order">
        <div id="mainAppContainer" className="container mt-3">
          <h4 className="text-center" style={{ color: '#c5a059' }}>GROOMSKART <span className="small text-white">PRO</span></h4>

          <div className="card p-3">
            <div className="row g-3">
              <div className="col-6"><label className="small text-warning">Bill / Order No *</label><input type="text" id="billNo" className="form-control" /></div>
              <div className="col-6"><label className="small text-warning">Delivery Date *</label><input type="date" id="delDate" className="form-control" /></div>
              <div className="col-12">
                <label className="text-warning">Customer Search (Phone or Name)</label>
                <div className="input-group mb-2">
                  <input type="text" id="searchAny" className="form-control" placeholder="Type Phone or Name..." />
                  <button className="btn btn-gold" type="button" onClick={() => (window as any).decideSearch()}>SEARCH</button>
                </div>
                <input type="hidden" id="cPhone" />
                <div id="searchMsg" className="small fw-bold text-warning text-center"></div>
              </div>
              <div className="col-6"><label>Billing Name</label><input type="text" id="cName" className="form-control" placeholder="Name" /></div>
              <div className="col-6"><label className="text-info">Wearer</label><input type="text" id="cWearer" className="form-control" placeholder="e.g. Groom" /></div>
              <div id="historyBlock" className="col-12 hidden">
                <div className="p-2 border border-warning rounded">
                  <label style={{ color: '#c5a059' }}>History Found:</label>
                  <div className="input-group">
                    <select id="wearerHistorySelect" className="form-select border-warning" onChange={() => (window as any).loadSelectedWearer()}>
                      <option value="">-- Select History Item --</option>
                    </select>
                    <button className="btn btn-outline-light" type="button" onClick={() => (window as any).triggerReprintLogic()}>🖨️ REPRINT</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="row mt-3 g-2">
              <div className="col-6"><button type="button" className="btn btn-outline-info w-100" onClick={() => (window as any).nextPerson()}>Next Person</button></div>
              <div className="col-6"><button type="button" className="btn btn-outline-danger w-100" onClick={() => (window as any).fullReset()}>New Bill</button></div>
            </div>
          </div>

          <form id="orderForm" onSubmit={e => e.preventDefault()}>
            <input type="hidden" id="currentVer" defaultValue="0" />
            <div className="card">
              <div className="card-header">👗 Garment &amp; Style</div>
              <div className="card-body">
                <select id="gType" className="form-select mb-3" onChange={() => (window as any).uiLogic()}>
                  {['Suit/Tuxedo','Blazer','Shirt','Pant','Kurta','Indowestern','Sherwani','Nehru Jacket','Waistcoat','Patiala','Pyjama','Churidar','Aligarh'].map(g => {
                    const v = g === 'Suit/Tuxedo' ? 'Suit' : g;
                    return <option key={v} value={v}>{g}</option>;
                  })}
                </select>
                <div className="row g-2 mb-3 p-2 border border-secondary rounded">
                  <div className="col-12"><label className="small text-muted">Fabric Details</label></div>
                  <div id="fabricUpperBlock" className="col-12 row g-2">
                    <div className="col-8"><input type="text" id="fabricUpperName" className="form-control" placeholder="Fabric Name (Upper)" /></div>
                    <div className="col-4"><input type="text" id="fabricUpperColor" className="form-control" placeholder="Color (Upper)" /></div>
                  </div>
                  <div id="fabricLowerBlock" className="col-12 row g-2 hidden mt-2">
                    <div className="col-8"><input type="text" id="fabricLowerName" className="form-control" placeholder="Fabric Name (Lower)" /></div>
                    <div className="col-4"><input type="text" id="fabricLowerColor" className="form-control" placeholder="Color (Lower)" /></div>
                  </div>
                </div>
                <div id="opt_suit" className="hidden p-2 border border-secondary rounded mb-2">
                  <label className="small text-warning">Style Type</label>
                  <select id="suitStyle" className="form-select mb-2" onChange={() => (window as any).uiLogic()}>
                    <option>2-Piece</option><option>3-Piece</option><option>Double Breasted</option><option>Tuxedo</option><option>Jodhpuri / Prince Suit</option>
                  </select>
                  <div className="row g-2 mt-2">
                    <div className="col-4" id="div_lapel_box"><label className="small">Lapel</label><select id="suitLapel" className="form-select form-select-sm"><option value="Notched">Notched</option><option value="Peak">Peak</option><option value="Shawl">Shawl</option></select></div>
                    <div className="col-4"><label className="small">Buttons</label><select id="suitButtons" className="form-select form-select-sm"><option value="1 Button">1 Btn</option><option value="2 Buttons">2 Btn</option><option value="3 Buttons">3 Btn</option><option value="4 Buttons (DB)">4 Btn (DB)</option><option value="5 Buttons (Jodhpuri)">5 Btn</option><option value="6 Buttons (DB)">6 Btn (DB)</option></select></div>
                    <div className="col-4"><label className="small">Vents</label><select id="suitVent" className="form-select form-select-sm"><option value="Side Open">Side</option><option value="Back Single">Back</option><option value="No Open">None</option></select></div>
                  </div>
                  <div id="wc_block" className="hidden mt-2 p-2" style={{ borderLeft: '3px solid #c5a059', background: '#222' }}>
                    <div className="row g-2">
                      <div className="col-12"><strong className="text-warning" style={{ fontSize: '0.9em' }}>3-Piece Specs:</strong></div>
                      <div className="col-6"><label className="small">W.Coat Length</label><input type="number" id="wc_len" className="form-control" /></div>
                      <div className="col-6"><label className="small">W.Coat Neck</label><select id="wc_neck" className="form-select"><option>V-Neck</option><option>U-Neck</option><option>Round</option><option>Double Breasted</option></select></div>
                    </div>
                  </div>
                </div>
                <div id="opt_indo" className="hidden p-2 border border-secondary rounded mb-2">
                  <select id="indoStyle" className="form-select" onChange={() => (window as any).uiLogic()}><option>Indowestern with Kaaj</option><option>Open Indowestern</option></select>
                  <div id="indo_inner" className="hidden mt-2"><input type="number" id="indo_inner_len" className="form-control" placeholder="Inner Jacket Len" /></div>
                </div>
                <div id="opt_kurta" className="hidden p-2 border border-secondary rounded mb-2">
                  <div className="btn-group w-100">
                    <input type="radio" className="btn-check" name="k_sleeve" id="ks1" value="Cuff" defaultChecked onChange={() => (window as any).uiLogic()} /><label className="btn btn-outline-secondary" htmlFor="ks1">Cuff</label>
                    <input type="radio" className="btn-check" name="k_sleeve" id="ks2" value="Mohri" onChange={() => (window as any).uiLogic()} /><label className="btn btn-outline-secondary" htmlFor="ks2">Mohri</label>
                  </div>
                </div>
              </div>
            </div>

            <div id="mod_upper" className="card measurement-box">
              <div className="card-header">📐 Upper Measurements</div>
              <div className="card-body">
                <div className="row g-2">
                  {[['len','Length'],['chest','Chest'],['stom','Stomach'],['hip','Hip'],['shld','Shoulder'],['slv','Hand']].map(([k,l]) => (
                    <div key={k} className="col-4"><label>{l}</label><input type="number" id={'u_'+k} className="form-control req-upper" /><span id={'g_u_'+k} className="ghost"></span></div>
                  ))}
                  <div className="col-4" id="div_neck"><label>Neck</label><input type="number" id="u_neck" className="form-control" /><span id="g_u_neck" className="ghost"></span></div>
                  <div className="col-4 hidden" id="div_cuff"><label>Cuff</label><input type="number" id="u_cuff" className="form-control" /><span id="g_u_cuff" className="ghost"></span></div>
                  <div className="col-4 hidden" id="div_mohri_u"><label>Mohri</label><input type="number" id="u_mohri" className="form-control" /><span id="g_u_mohri" className="ghost"></span></div>
                </div>
                <button type="button" className="btn btn-sm btn-outline-secondary w-100 mt-3" onClick={() => document.getElementById('opt_meas')?.classList.toggle('hidden')}>Show Advanced</button>
                <div id="opt_meas" className="hidden row g-2 mt-2">
                  {[['xb','X-Back'],['bic','Bicep'],['ah','ArmH'],['fc','F.Ch'],['bc','B.Ch']].map(([k,l]) => (
                    <div key={k} className="col-3"><label>{l}</label><input type="number" id={'u_'+k} className="form-control" /><span id={'g_u_'+k} className="ghost"></span></div>
                  ))}
                </div>
                <div className="mt-2"><label style={{ color: '#c5a059' }}>Loosing (Inches):</label><input type="number" id="val_loosing" className="form-control d-inline w-25 req-upper" placeholder="4" /></div>
              </div>
            </div>

            <div id="mod_lower" className="card hidden measurement-box">
              <div className="card-header">📐 Lower Measurements</div>
              <div className="card-body">
                <div className="form-check form-switch mb-2"><input className="form-check-input" type="checkbox" id="halfElastic" /><label className="form-check-label text-warning">Half Elastic</label></div>
                <div className="row g-2">
                  {[['len','Length'],['waist','Waist'],['thigh','Thigh'],['asan','Asan/Rise'],['hip','Hip'],['mohri','Mohri']].map(([k,l]) => (
                    <div key={k} className="col-4"><label>{l}</label><input type="number" id={'l_'+k} className="form-control req-lower" /><span id={'g_l_'+k} className="ghost"></span></div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">🧍 Body Profile</div>
              <div className="card-body">
                {[['BACK','p_back',['Normal','Hunched','Erect'],['b1','b2','b3']],['STOMACH','p_stom',['Flat','Medium','Heavy'],['s1','s2','s3']],['SHOULDER','p_shld',['Regular','Sloping','Square'],['h1','h2','h3']],['NECK','p_neck',['Normal','Short','Long'],['n1','n2','n3']]].map(([label, name, opts, ids]: any) => (
                  <div key={name as string} className="mb-3">
                    <span className="bp-header">{label}</span>
                    <div className="btn-group w-100">
                      {(opts as string[]).map((v: string, i: number) => (
                        <span key={v}><input type="radio" className="btn-check" name={name as string} id={ids[i]} value={v} defaultChecked={i===0} /><label className="btn btn-outline-gold" htmlFor={ids[i]}>{v}</label></span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-3">
              <label className="bright-label">Notes (Upper)</label>
              <textarea id="notesUpper" className="form-control mb-2" rows={2} placeholder="Notes for Upper (e.g. padding, lapel, inner length)"></textarea>
              <label className="bright-label small text-warning mt-2">Fabric Photo</label>
              <input type="file" id="fabricPhoto" className="form-control mb-3" accept="image/*" />
              <div id="notesLowerBlock" className="hidden mt-2">
                <label className="bright-label">Notes (Lower)</label>
                <textarea id="notesLower" className="form-control mb-2" rows={2} placeholder="Notes for Lower"></textarea>
              </div>
              <button id="btnSave" type="button" className="btn btn-gold w-100 py-3 mb-2" onClick={() => (window as any).openSummaryBeforeSave()}>SAVE ORDER</button>
              <button id="btnPrint" type="button" className="btn btn-outline-light w-100" onClick={() => (window as any).showPrintModal()} disabled>PRINT OPTIONS</button>
            </div>
          </form>
        </div>
      </div>

      {/* ── DASHBOARD VIEW ── */}
      <div id="view-dashboard" style={{ display: 'none' }}>
        <div className="container" style={{ maxWidth: '1200px', margin: 'auto', paddingTop: '16px' }}>
          <h3 className="text-warning text-center mb-3" style={{ fontSize: '28px' }}>Dashboard</h3>

          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <div className="card p-3">
                <h6>Pending Summary</h6>
                <div id="totalPending" className="pending-count">–</div>
                <div className="pending-label">Total pending garments</div>
                <table className="pending-breakdown mt-2"><tbody id="byGarment"></tbody></table>
              </div>
            </div>
            <div className="col-md-4">
              <div id="next3Box" className="card p-3 filter-box" onClick={() => (window as any).applyDueFilter(3)}>
                <h6>Next 3 Days</h6>
                <div id="next3Count" className="section-count">0</div>
                <div className="small-muted">Due within 3 days</div>
              </div>
            </div>
            <div className="col-md-4">
              <div id="next7Box" className="card p-3 filter-box" onClick={() => (window as any).applyDueFilter(7)}>
                <h6>Next 7 Days</h6>
                <div id="next7Count" className="section-count">0</div>
                <div className="small-muted">Due within 7 days</div>
              </div>
            </div>
          </div>

          <div className="mb-3 d-flex gap-2 align-items-center">
            <input id="dashSearch" className="dashboard-search" placeholder="Search by name, bill no, or garment..." />
            <button id="clearFilterBtn" className="btn btn-sm btn-outline-light" style={{ display: 'none', whiteSpace: 'nowrap' }} onClick={() => (window as any).clearDueFilter()}>Clear Filter</button>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <div className="card p-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">In Stitching</h6>
                  <span id="stitchingCount" className="section-count">0</span>
                </div>
                <div id="stitchingList" className="list card-body"></div>
                <div className="pager">
                  <button id="stitchPrev" className="btn btn-sm btn-outline-light" disabled>◀ Previous</button>
                  <div id="stitchPageInfo" className="small-muted">Page 1</div>
                  <button id="stitchNext" className="btn btn-sm btn-outline-light" disabled>Next ▶</button>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card p-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Ready for Delivery</h6>
                  <span id="readyCount" className="section-count">0</span>
                </div>
                <div id="readyList" className="list card-body"></div>
                <div className="pager">
                  <button id="readyPrev" className="btn btn-sm btn-outline-light" disabled>◀ Previous</button>
                  <div id="readyPageInfo" className="small-muted">Page 1</div>
                  <button id="readyNext" className="btn btn-sm btn-outline-light" disabled>Next ▶</button>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12">
              <div className="card p-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Delayed</h6>
                  <span id="delayedCount" className="section-count">0</span>
                </div>
                <div id="delayedList" className="list card-body"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <div className="modal fade" id="nameSearchModal" data-bs-backdrop="static" data-bs-keyboard="false" tabIndex={-1}><div className="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div className="modal-content"><div className="modal-header"><h5 className="modal-title">Select Customer</h5><button type="button" className="btn-close" onClick={() => (window as any).closeAllModals()}></button></div><div className="modal-body" id="nameSearchResults"></div></div></div></div>
      <div className="modal fade" id="statusModal" data-bs-backdrop="static" data-bs-keyboard="false" tabIndex={-1}><div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-header"><h5 className="modal-title">System</h5><button type="button" className="btn-close" onClick={() => (window as any).closeAllModals()}></button></div><div className="modal-body" id="statusModalBody"></div><div className="modal-footer"><button type="button" className="btn btn-gold" onClick={() => (window as any).closeAllModals()}>OK</button></div></div></div></div>
      <div className="modal fade" id="printModal" data-bs-backdrop="static" data-bs-keyboard="false" tabIndex={-1}><div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-header"><h5 className="modal-title">Select Format</h5><button type="button" className="btn-close" onClick={() => (window as any).closeAllModals()}></button></div><div className="modal-body d-grid gap-3"><button className="btn btn-dark btn-lg py-3" onClick={() => (window as any).doPrint('standard')}>📄 Standard Job Card (A5)</button><button className="btn btn-warning btn-lg py-3 fw-bold" onClick={() => (window as any).doPrint('thermal')}>🧾 Thermal Receipt (3 Inch)</button></div></div></div></div>
      <div className="modal fade" id="summaryModal" data-bs-backdrop="static" data-bs-keyboard="false" tabIndex={-1}><div className="modal-dialog modal-dialog-scrollable modal-lg"><div className="modal-content"><div className="modal-header"><h5 className="modal-title">Order Summary</h5><button type="button" className="btn-close" onClick={() => (window as any).closeAllModals()}></button></div><div className="modal-body"><div id="summaryBody" style={{ fontWeight: 700, color: '#000', background: '#fff', padding: '12px', borderRadius: '6px' }}></div><div id="summaryWarnings" style={{ marginTop: '12px' }}></div></div><div className="modal-footer"><button className="btn btn-outline-dark" onClick={() => (window as any).closeAllModals()}>Back &amp; Edit</button><button className="btn btn-gold" onClick={() => (window as any).confirmSaveFromSummary()}>Confirm &amp; Save</button></div></div></div></div>

      {/* Print areas */}
      <div id="jobCardArea" className="hidden">
        <div className="ticket-half ticket-left" id="print_left_col">
          <div className="mini-header"><div><h2 className="mini-title">GROOMSKART</h2><div className="mini-meta">Bill: <span id="pj_bill_L"></span><br />Name: <span id="pj_name_L"></span></div></div><img id="pj_photo_L" className="mini-swatch" src="" alt="" /></div>
          <div id="pj_urgent_L" className="urgent-box hidden">⚠️ URGENT</div>
          <div className="prom-box"><span id="pj_item_L"></span></div>
          <div className="bp-grid-container"><div className="bp-box"><div className="bp-lbl">BACK</div><div className="bp-val" id="pj_bp_back_L"></div></div><div className="bp-box"><div className="bp-lbl">STOM</div><div className="bp-val" id="pj_bp_stom_L"></div></div><div className="bp-box"><div className="bp-lbl">SHLD</div><div className="bp-val" id="pj_bp_shld_L"></div></div><div className="bp-box"><div className="bp-lbl">NECK</div><div className="bp-val" id="pj_bp_neck_L"></div></div></div>
          <table className="mini-table"><tbody id="pj_tbl_upper"></tbody></table>
          <div className="mini-footer"><div className="footer-row" id="pj_design_row_L"><strong>DESIGN:</strong> <span id="pj_design_L"></span></div><div className="footer-row"><strong>FABRIC:</strong> <span id="pj_fab_L"></span></div><div className="footer-row"><strong>LOOSING:</strong> <span id="pj_loose_L"></span></div><div className="footer-row"><strong>NOTES:</strong> <span id="pj_notes_L"></span></div><div className="mt-2"><span className="d-date-box">DELIVERY: <span id="pj_del_L"></span></span></div></div>
        </div>
        <div className="ticket-half ticket-right" id="print_right_col">
          <div className="mini-header"><div><h2 className="mini-title">GROOMSKART</h2><div className="mini-meta">Bill: <span id="pj_bill_R"></span><br />Name: <span id="pj_name_R"></span></div></div><img id="pj_photo_R" className="mini-swatch" src="" alt="" /></div>
          <div id="pj_urgent_R" className="urgent-box hidden">⚠️ URGENT</div>
          <div className="prom-box"><span id="pj_item_R"></span></div>
          <table className="mini-table"><tbody id="pj_tbl_lower"></tbody></table>
          <div className="mini-footer"><div className="footer-row"><strong>WAIST TYPE:</strong> <span id="pj_waist_type_R"></span></div><div className="footer-row"><strong>FABRIC:</strong> <span id="pj_fab_R"></span></div><div className="footer-row"><strong>NOTES:</strong> <span id="pj_notes_R"></span></div><div className="mt-2"><span className="d-date-box">DELIVERY: <span id="pj_del_R"></span></span></div></div>
        </div>
      </div>

      <div id="thermalPrintArea" className="hidden">
        <div className="th-container">
          <div className="th-header"><span id="th_item" className="th-title"></span><div className="th-meta">Bill: <span id="th_bill"></span></div><div className="th-meta" id="th_name"></div></div>
          <table className="th-table"><tbody id="th_tbody_up"></tbody></table>
          <div id="th_design_block" className="th-block-inv"></div>
          <table className="th-table"><tbody><tr id="th_fab_upper_row"><th>Fabric (Upper)</th><td id="th_fab_upper"></td></tr><tr id="th_fab_lower_row" className="hidden"><th>Fabric (Lower)</th><td id="th_fab_lower"></td></tr><tr><th>Loose</th><td id="th_loose"></td></tr><tr id="th_wc_row" className="hidden"><th>Waist Coat</th><td id="th_wc_len"></td></tr><tr id="th_fab_col_row"><th>Color</th><td id="th_fab_col"></td></tr></tbody></table>
          <div id="th_lower_section" className="hidden"><div className="th-sep">PANT / LOWER</div><table className="th-table"><tbody id="th_tbody_low"></tbody></table></div>
          <div className="th-block-inv">D. Date: <span id="th_del_date"></span></div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: appScript }} />
    </>
  );
}
