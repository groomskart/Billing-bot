'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      require('bootstrap/dist/js/bootstrap.bundle.min.js');
    }
  }, []);

  const dashScript = `
(function(){
const PIN = "${process.env.NEXT_PUBLIC_DASHBOARD_PIN || '1998'}";
const SUPABASE_URL = "${process.env.NEXT_PUBLIC_SUPABASE_URL}";
const SUPABASE_ANON_KEY = "${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}";
const APP_TOKEN = "GROOMSKART_INTERNAL_V1";
const PAGE_SIZE = 20;

var s = document.createElement('script');
s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
s.onload = function() { window.supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); };
document.head.appendChild(s);

var activeDueFilter = null;
var stitchPage = 0;
var readyPage = 0;
var allPending = [];
var stitchingAll = [];
var readyAll = [];
var delayedAll = [];
var next3All = [];
var next7All = [];

function $(id){ return document.getElementById(id); }
function showModal(msg){ alert(msg); }
function escapeHtml(s){ return String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function daysDiff(d){ if(!d) return null; var today=new Date(); today.setHours(0,0,0,0); var dt=new Date(d); dt.setHours(0,0,0,0); return Math.floor((dt-today)/86400000); }

document.addEventListener('DOMContentLoaded', function(){
  var unlockBtn = document.getElementById('unlockBtn');
  if(unlockBtn) unlockBtn.addEventListener('click', function(){
    var pin = document.getElementById('pinInput');
    if(pin && pin.value === PIN){ $('pinLock').style.display='none'; applyVisualFilterState(); loadDashboard(); }
    else { var err=$('pinErr'); if(err) err.style.display='block'; }
  });
  var pinInput = document.getElementById('pinInput');
  if(pinInput) pinInput.addEventListener('keydown', function(e){ if(e.key==='Enter'){ document.getElementById('unlockBtn').click(); } });

  var dashSearch=$('dashSearch'); if(dashSearch) dashSearch.addEventListener('input', function(){ applySearch(); });
  $('stitchPrev').addEventListener('click', function(){ if(stitchPage>0){stitchPage--;renderStitching();} });
  $('stitchNext').addEventListener('click', function(){ stitchPage++;renderStitching(); });
  $('readyPrev').addEventListener('click', function(){ if(readyPage>0){readyPage--;renderReady();} });
  $('readyNext').addEventListener('click', function(){ readyPage++;renderReady(); });
});

function applyVisualFilterState(){
  if(activeDueFilter===3){$('next3Box').classList.add('filter-active');$('next7Box').classList.remove('filter-active');$('clearFilterBtn').style.display='inline-block';}
  else if(activeDueFilter===7){$('next7Box').classList.add('filter-active');$('next3Box').classList.remove('filter-active');$('clearFilterBtn').style.display='inline-block';}
  else{$('next3Box').classList.remove('filter-active');$('next7Box').classList.remove('filter-active');$('clearFilterBtn').style.display='none';}
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
    if(res.error){ showModal('Failed to load orders'); return; }
    allPending = res.data || [];
    var today = new Date(); today.setHours(0,0,0,0);
    stitchingAll = allPending.filter(function(o){ return (o.status||'stitching').toLowerCase()==='stitching'; });
    readyAll = allPending.filter(function(o){ return (o.status||'').toLowerCase()==='ready'; });
    delayedAll = stitchingAll.filter(function(o){ if(!o.delivery_date)return false; var dd=daysDiff(o.delivery_date); return dd!==null&&dd<0; });
    next3All = allPending.filter(function(o){ var dd=daysDiff(o.delivery_date); return dd!==null&&dd>=0&&dd<=3; });
    next7All = allPending.filter(function(o){ var dd=daysDiff(o.delivery_date); return dd!==null&&dd>=0&&dd<=7; });
    renderOverviewCounts(); stitchPage=0; readyPage=0; renderStitching(); renderReady(); renderDelayed();
  } catch(e){ showModal('Failed to load dashboard'); }
}

function renderOverviewCounts(){
  $('totalPending').innerText = allPending.length;
  $('next3Count').innerText = next3All.length;
  $('next7Count').innerText = next7All.length;
  var byGarment = {};
  allPending.forEach(function(o){ var g=(o.garment_type||'Unknown').trim(); byGarment[g]=(byGarment[g]||0)+1; });
  var keys = Object.keys(byGarment).sort();
  if(keys.length===0) $('byGarment').innerHTML='<tr><td class="small-muted">None</td><td class="text-end small-muted">0</td></tr>';
  else { $('byGarment').innerHTML=''; keys.forEach(function(k){ $('byGarment').innerHTML+='<tr><td>'+escapeHtml(k)+'</td><td class="text-end">'+byGarment[k]+'</td></tr>'; }); }
  $('stitchingCount').innerText = stitchingAll.length;
  $('readyCount').innerText = readyAll.length;
  $('delayedCount').innerText = delayedAll.length;
}

var searchQuery = '';
function getSearchQuery(){ var el=$('dashSearch'); return el?(el.value||'').toLowerCase().trim():''; }
function matchesSearch(o){ if(!searchQuery) return true; return (o.customer_name||'').toLowerCase().includes(searchQuery)||(o.bill_order_no||'').toLowerCase().includes(searchQuery)||(o.garment_type||'').toLowerCase().includes(searchQuery); }
function applySearch(){ searchQuery=getSearchQuery(); stitchPage=0; readyPage=0; renderStitching(); renderReady(); renderDelayed(); }
window.applySearch = applySearch;

function renderStitching(){ var list=stitchingAll.filter(matchesSearch); if(activeDueFilter!==null)list=list.filter(function(o){var d=daysDiff(o.delivery_date);return d!==null&&d>=0&&d<=activeDueFilter;}); var start=stitchPage*PAGE_SIZE; var items=list.slice(start,start+PAGE_SIZE); $('stitchingList').innerHTML=''; if(!items||items.length===0){$('stitchingList').innerHTML='<div class="small-muted p-2">None</div>';}else{items.forEach(function(o){$('stitchingList').innerHTML+=buildItemHtml(o);});} $('stitchPrev').disabled=(stitchPage===0); $('stitchNext').disabled=(start+PAGE_SIZE>=list.length); $('stitchPageInfo').innerText='Page '+(stitchPage+1); }
function renderReady(){ var list=readyAll.filter(matchesSearch); var start=readyPage*PAGE_SIZE; var items=list.slice(start,start+PAGE_SIZE); $('readyList').innerHTML=''; if(!items||items.length===0){$('readyList').innerHTML='<div class="small-muted p-2">None</div>';}else{items.forEach(function(o){$('readyList').innerHTML+=buildItemHtml(o);});} $('readyPrev').disabled=(readyPage===0); $('readyNext').disabled=(start+PAGE_SIZE>=list.length); $('readyPageInfo').innerText='Page '+(readyPage+1); }
function renderDelayed(){ var list=delayedAll.filter(matchesSearch); $('delayedList').innerHTML=''; if(!list||list.length===0){$('delayedList').innerHTML='<div class="small-muted p-2">None</div>';}else{list.forEach(function(o){$('delayedList').innerHTML+=buildItemHtml(o);});} }

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
  var supa=window.supa; if(!supa) return showModal('Not connected');
  try { var res=await supa.from('orders').update({status:'ready',app_token:APP_TOKEN}).eq('id',id); if(res.error){showModal('Failed to mark ready');return;} await loadDashboard(); } catch(e){ showModal('Failed to mark ready'); }
}
window.markReady = markReady;

async function markDelivered(id){
  if(!confirm('Mark this order as DELIVERED? This is final.')) return;
  var supa=window.supa; if(!supa) return showModal('Not connected');
  try { var res=await supa.from('orders').update({is_delivered:true,delivered_at:new Date().toISOString(),delivered_by:'dashboard',app_token:APP_TOKEN}).eq('id',id); if(res.error){showModal('Failed to mark delivered');return;} await loadDashboard(); } catch(e){ showModal('Failed to mark delivered'); }
}
window.markDelivered = markDelivered;

async function openDetails(id){
  var supa=window.supa; if(!supa) return showModal('Not connected');
  try {
    var res=await supa.from('orders').select('*').eq('id',id).single();
    if(res.error||!res.data){showModal('Could not fetch order');return;}
    var d=res.data;
    var status=(d.status||'stitching');
    var ddiff=daysDiff(d.delivery_date);
    var urgency=ddiff!==null&&ddiff<0?'<span style="color:#ff4d4d;font-weight:700;">'+Math.abs(ddiff)+' days overdue</span>':ddiff===0?'<span style="color:#f5c542;font-weight:700;">Due Today</span>':'<span style="color:#4ade80;">'+ddiff+' days left</span>';
    var u=(d.measurements_upper||{}); var l=(d.measurements_lower||{});
    var upperRows=''; if(u.chest)upperRows+='<div class="detail-row"><span class="detail-label">Chest</span><span class="detail-value">'+escapeHtml(u.chest)+'"</span></div>';
    if(u.len)upperRows+='<div class="detail-row"><span class="detail-label">Length</span><span class="detail-value">'+escapeHtml(u.len)+'"</span></div>';
    if(u.shld)upperRows+='<div class="detail-row"><span class="detail-label">Shoulder</span><span class="detail-value">'+escapeHtml(u.shld)+'"</span></div>';
    if(u.slv)upperRows+='<div class="detail-row"><span class="detail-label">Hand</span><span class="detail-value">'+escapeHtml(u.slv)+'"</span></div>';
    var lowerRows=''; if(l.waist)lowerRows+='<div class="detail-row"><span class="detail-label">Waist</span><span class="detail-value">'+escapeHtml(l.waist)+'"</span></div>';
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
      +(d.phone?'<a class="btn btn-sm btn-outline-success ms-auto" href="https://wa.me/91'+encodeURIComponent(d.phone.replace(/\\D/g,\\'\\'))+'?text='+encodeURIComponent('Hello! Your order (Bill: '+(d.bill_order_no||'')+(status==='ready'?' is READY for delivery.':' is in progress. Delivery: '+(d.delivery_date||'')+'.'))+'\" target="_blank">WhatsApp</a>':'')
      +'</div>'
      +'</div></div>';
    var existing=document.getElementById('detailOverlay'); if(existing)existing.remove();
    var div=document.createElement('div'); div.innerHTML=html; document.body.appendChild(div.firstChild);
  } catch(e){ showModal('Failed to fetch order'); }
}
window.openDetails = openDetails;

function closeDetailModal(){ var el=document.getElementById('detailOverlay'); if(el)el.remove(); }
window.closeDetailModal = closeDetailModal;
})();
  `;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
        <Link href="/" style={{ color: '#f5c542', textDecoration: 'none' }}>← Back to Home</Link>
      </div>

      {/* PIN LOCK */}
      <div id="pinLock">
        <div className="card p-4 text-center gk-pin-card" style={{ width: '420px' }}>
          <h4>Dashboard Access</h4>
          <input id="pinInput" type="password" className="form-control my-3 text-center" placeholder="PIN" />
          <button id="unlockBtn" className="btn btn-success w-100">Unlock</button>
          <div id="pinErr" className="text-danger mt-2" style={{ display: 'none' }}>Wrong PIN</div>
        </div>
      </div>

      <div className="container" style={{ maxWidth: '1200px', margin: 'auto' }}>
        <h3 className="text-warning text-center mb-3" style={{ fontSize: '34px' }}>GROOMSKART DASHBOARD</h3>

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
          <input id="dashSearch" className="dashboard-search" placeholder="Search by name, bill no, or garment..." onInput={() => (window as any).applySearch()} />
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
                <h6 className="mb-0">Delayed (Exception View)</h6>
                <span id="delayedCount" className="section-count">0</span>
              </div>
              <div id="delayedList" className="list card-body"></div>
            </div>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: dashScript }} />
    </>
  );
}
