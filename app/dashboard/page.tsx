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

function renderStitching(){ var list=stitchingAll.slice(); var start=stitchPage*PAGE_SIZE; var items=list.slice(start,start+PAGE_SIZE); $('stitchingList').innerHTML=''; if(!items||items.length===0){$('stitchingList').innerHTML='<div class="small-muted p-2">None</div>';}else{items.forEach(function(o){$('stitchingList').innerHTML+=buildItemHtml(o);});} $('stitchPrev').disabled=(stitchPage===0); $('stitchNext').disabled=(start+PAGE_SIZE>=list.length); $('stitchPageInfo').innerText='Page '+(stitchPage+1); }
function renderReady(){ var list=readyAll.slice(); var start=readyPage*PAGE_SIZE; var items=list.slice(start,start+PAGE_SIZE); $('readyList').innerHTML=''; if(!items||items.length===0){$('readyList').innerHTML='<div class="small-muted p-2">None</div>';}else{items.forEach(function(o){$('readyList').innerHTML+=buildItemHtml(o);});} $('readyPrev').disabled=(readyPage===0); $('readyNext').disabled=(start+PAGE_SIZE>=list.length); $('readyPageInfo').innerText='Page '+(readyPage+1); }
function renderDelayed(){ var list=delayedAll.slice(); $('delayedList').innerHTML=''; if(!list||list.length===0){$('delayedList').innerHTML='<div class="small-muted p-2">None</div>';}else{list.forEach(function(o){$('delayedList').innerHTML+=buildItemHtml(o);});} }

function buildItemHtml(o){
  var id=o.id; var bill=o.bill_order_no?escapeHtml(o.bill_order_no):'#'+String(id).slice(0,8); var garment=escapeHtml(o.garment_type||'Unknown'); var customer=escapeHtml(o.customer_name||''); var status=(o.status||'stitching').toLowerCase(); var ddiff=daysDiff(o.delivery_date); var late=(ddiff!==null&&ddiff<0)?Math.abs(ddiff)+'d late':''; var actions='';
  if(status==='stitching') actions='<button class="btn btn-sm btn-primary me-2" onclick="markReady(\\''+id+'\\')">Mark Ready</button>';
  else if(status==='ready') actions='<button class="btn btn-sm btn-success me-2" onclick="markDelivered(\\''+id+'\\')">Delivered</button>';
  else actions='<button class="btn btn-sm btn-primary me-2" onclick="markReady(\\''+id+'\\')">Mark Ready</button>';
  var lateHtml=late?'<span class="badge badge-delayed ms-2">'+late+'</span>':'';
  var itemClasses='item';
  if(activeDueFilter!==null&&ddiff!==null&&ddiff>=0&&ddiff<=activeDueFilter){if(ddiff===0)itemClasses+=' due-today';else itemClasses+=' urgent-gold';}
  var deliveryDate=o.delivery_date?new Date(o.delivery_date).toLocaleDateString():'';
  return '<div class="'+itemClasses+'"><div class="d-flex justify-content-between align-items-start"><div><div class="order-id">'+bill+'</div><div class="garment-type small-muted">'+garment+'</div><div class="customer-name small-muted mt-1">'+customer+'</div></div><div style="text-align:right;">'+lateHtml+'<div class="small-muted" style="margin-top:8px">'+deliveryDate+'</div></div></div><div class="mt-3">'+actions+'<button class="btn btn-sm btn-outline-light" onclick="openDetails(\\''+id+'\\')">View</button></div></div>';
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
  try { var res=await supa.from('orders').select('*').eq('id',id).single(); if(res.error||!res.data){showModal('Could not fetch order');return;} var d=res.data; showModal('Bill: '+d.bill_order_no+'\\nName: '+d.customer_name+'\\nGarment: '+d.garment_type+'\\nDelivery: '+d.delivery_date+'\\nStatus: '+(d.status||'stitching')); } catch(e){ showModal('Failed to fetch order'); }
}
window.openDetails = openDetails;
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

        <div className="mb-2">
          <button id="clearFilterBtn" className="btn btn-sm btn-outline-light" style={{ display: 'none' }} onClick={() => (window as any).clearDueFilter()}>Clear Filter</button>
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
