// ===== INTRO =====
let introIdx=0;
const introKeys=Object.keys(INTRO_IMGS).sort();
function buildIntro(){
  const wrap=document.getElementById('introWrap'),dots=document.getElementById('introDots');
  introKeys.forEach((k,i)=>{
    const img=document.createElement('img');
    img.src=INTRO_IMGS[k];img.className='intro-img'+(i===0?' active':'');img.style.width='100%';
    wrap.appendChild(img);
    const d=document.createElement('div');d.className='intro-dot'+(i===0?' active':'');dots.appendChild(d);
  });
}
function nextIntro(){
  const imgs=document.querySelectorAll('.intro-img'),dots=document.querySelectorAll('.intro-dot');
  if(introIdx<introKeys.length-1){
    imgs[introIdx].classList.remove('active');dots[introIdx].classList.remove('active');
    introIdx++;imgs[introIdx].classList.add('active');dots[introIdx].classList.add('active');
    if(introIdx===introKeys.length-1)document.getElementById('introBtn').textContent='ເລີ່ມເລີຍ ✦';
  }else closeIntro();
}
function closeIntro(){document.getElementById('intro').style.display='none';}

// ===== NAV =====
function goScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('screen-'+id).classList.add('active');
  document.getElementById('tab-'+id).classList.add('active');
  if(id==='summary')buildSummary();
}

// ===== SOUND + RIPPLE =====
function playTick(){
  try{const ctx=new(window.AudioContext||window.webkitAudioContext)();
  const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);
  o.frequency.value=700+Math.random()*300;o.type='sine';
  g.gain.setValueAtTime(0.12,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15);
  o.start();o.stop(ctx.currentTime+0.15);}catch(e){}
}
document.addEventListener('click',e=>{
  playTick();
  const r=document.createElement('div');r.className='ripple';r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';
  document.body.appendChild(r);setTimeout(()=>r.remove(),400);
});

// ===== HOME =====
function buildHome(){
  const grid=document.getElementById('catGrid');
  CHARM_DATA.forEach(c=>{
    const minP=Math.min(...c.subs.map(s=>s.price));
    const card=document.createElement('div');card.className='cat-card';
    card.innerHTML=`<img class="cat-img" src="${c.subs[0].imgs[0]}" loading="lazy">
      <div class="cat-info"><div class="cat-name">${c.cat}</div><div class="cat-price">ເລີ່ມ ${(minP/1000).toFixed(0)}K</div></div>`;
    card.onclick=()=>{activeCat=c.cat;goScreen('designer');renderPickerCats();renderCharmGrid();};
    grid.appendChild(card);
  });
}

// ===== IMAGE CACHE =====
const IMG={}; // src -> loaded HTMLImageElement
function loadImg(src){
  return new Promise(res=>{
    if(IMG[src]){res(IMG[src]);return;}
    const el=new Image();
    el.onload=()=>{IMG[src]=el;res(el);};
    el.onerror=()=>{res(null);};
    el.src=src;
  });
}


// ===== BG REMOVAL =====
const BG={}; // src -> processed src
function removeBG(src){
  if(BG[src]) return Promise.resolve(BG[src]);
  // PNG = already transparent (user removed BG) — skip
  if(src.startsWith('data:image/png')){BG[src]=src;return Promise.resolve(src);}
  // JPEG — flood-fill white BG from edges
  return loadImg(src).then(el=>{
    if(!el){BG[src]=src;return src;}
    try{
      const oc=document.createElement('canvas');
      oc.width=el.naturalWidth;oc.height=el.naturalHeight;
      const ox=oc.getContext('2d');ox.drawImage(el,0,0);
      const id=ox.getImageData(0,0,oc.width,oc.height);
      const d=id.data,W=oc.width,H=oc.height;
      function bg(p){
        const r=d[p],g=d[p+1],b=d[p+2];
        return (r+g+b)/3>215 && Math.max(r,g,b)-Math.min(r,g,b)<30;
      }
      const vis=new Uint8Array(W*H),q=[];
      for(let x=0;x<W;x++){q.push(x,0);q.push(x,H-1);}
      for(let y=1;y<H-1;y++){q.push(0,y);q.push(W-1,y);}
      for(let i=0;i<q.length;i+=2){
        const x=q[i],y=q[i+1];
        if(x<0||x>=W||y<0||y>=H)continue;
        const pos=y*W+x;if(vis[pos])continue;vis[pos]=1;
        const p=pos*4;if(!bg(p))continue;
        d[p+3]=0;
        q.push(x-1,y);q.push(x+1,y);q.push(x,y-1);q.push(x,y+1);
      }
      ox.putImageData(id,0,0);
      const res=oc.toDataURL('image/png');
      BG[src]=res;
      return loadImg(res).then(()=>res);
    }catch(e){BG[src]=src;return src;}
  });
}

// ===== DESIGNER STATE =====
let charms=[],selId=null,activeCat=CHARM_DATA[0]?.cat||'',uid=0;
let drag=null,dox=0,doy=0,pinch=false,pd0=0,ps0=0;

// ===== CANVAS SETUP =====
function cv(){return document.getElementById('freeCanvas');}
function initCanvas(){
  const c=cv();
  c.addEventListener('mousedown',md);c.addEventListener('mousemove',mm);
  window.addEventListener('mouseup',()=>{drag=null;});
  c.addEventListener('touchstart',ts,{passive:false});
  c.addEventListener('touchmove',tm,{passive:false});
  c.addEventListener('touchend',te);
  resizeCv();window.addEventListener('resize',()=>{resizeCv();draw();});
}
function resizeCv(){const c=cv();c.width=c.offsetWidth;c.height=c.offsetHeight;}
function rp(e,el){const r=el.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function hitTest(px,py){
  for(let i=charms.length-1;i>=0;i--){
    const c=charms[i],h=c.sz/2;
    if(px>=c.x-h&&px<=c.x+h&&py>=c.y-h&&py<=c.y+h)return c;
  }return null;
}
function md(e){const p=rp(e,cv()),h=hitTest(p.x,p.y);if(h){drag=h;selId=h.id;dox=p.x-h.x;doy=p.y-h.y;renderLayers();draw();}}
function mm(e){if(!drag)return;const p=rp(e,cv());drag.x=p.x-dox;drag.y=p.y-doy;draw();}
function ts(e){
  if(e.touches.length===1){const t=e.touches[0],p=rp(t,cv()),h=hitTest(p.x,p.y);if(h){drag=h;selId=h.id;dox=p.x-h.x;doy=p.y-h.y;renderLayers();draw();}}
  else if(e.touches.length===2){pinch=true;drag=null;pd0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);const c=charms.find(c=>c.id===selId);ps0=c?c.sz:65;}
  e.preventDefault();
}
function tm(e){
  if(e.touches.length===1&&drag&&!pinch){const p=rp(e.touches[0],cv());drag.x=p.x-dox;drag.y=p.y-doy;draw();}
  else if(e.touches.length===2&&pinch){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);const c=charms.find(c=>c.id===selId);if(c){c.sz=Math.max(20,Math.min(180,ps0*(d/pd0)));draw();}}
  e.preventDefault();
}
function te(e){if(e.touches.length<2)pinch=false;if(e.touches.length===0)drag=null;}

// ===== DRAW =====
function draw(){
  const c=cv();
  if(!c.width)resizeCv();
  const ctx=c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);

  // subtle chain line
  const cy2=c.height/2;
  ctx.save();
  ctx.strokeStyle='rgba(200,169,110,0.3)';
  ctx.lineWidth=1.5;
  ctx.setLineDash([5,5]);
  ctx.beginPath();ctx.moveTo(0,cy2);ctx.lineTo(c.width,cy2);ctx.stroke();
  ctx.restore();

  // Draw charms
  charms.forEach(ch=>{
    const el=IMG[ch.imgSrc||ch.src];
    if(!el)return;
    const h=ch.sz/2;
    ctx.save();
    ctx.drawImage(el,ch.x-h,ch.y-h,ch.sz,ch.sz);
    if(ch.id===selId){
      const sz=ch.sz,x=ch.x-h,y=ch.y-h,t=9;
      ctx.strokeStyle='#c8a96e';ctx.lineWidth=2.5;ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(x,y+t);ctx.lineTo(x,y);ctx.lineTo(x+t,y);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x+sz-t,y);ctx.lineTo(x+sz,y);ctx.lineTo(x+sz,y+t);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x,y+sz-t);ctx.lineTo(x,y+sz);ctx.lineTo(x+t,y+sz);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x+sz-t,y+sz);ctx.lineTo(x+sz,y+sz);ctx.lineTo(x+sz,y+sz-t);ctx.stroke();
    }
    ctx.restore();
  });
}

// ===== ADD CHARM =====
async function addCharm(name,price,src){
  // Load original first so charm appears immediately
  await loadImg(src);
  const c=cv();
  const existingOnLine=charms.length;
  const spacing=Math.min(70,(c.width-80)/(Math.max(existingOnLine,1)+1));
  const x=Math.min(40+spacing+existingOnLine*spacing, c.width-40);
  const y=c.height/2;
  const ch={id:'c'+(++uid),name,price,src,imgSrc:src,x,y,sz:60};
  charms.push(ch);selId=ch.id;
  draw();renderLayers();updateSumbar();
  document.getElementById('baHint').style.display='none';
  // Remove BG in background, then redraw
  removeBG(src).then(processed=>{
    ch.imgSrc=processed;
    if(processed!==src) loadImg(processed).then(()=>draw());
  });
}

// ===== LAYERS =====
function renderLayers(){
  const el=document.getElementById('layerList');
  if(!charms.length){el.innerHTML='<div class="lp-empty">ຍັງບໍ່ມີ</div>';return;}
  el.innerHTML='';
  [...charms].reverse().forEach((c,ri)=>{
    const i=charms.length-1-ri;
    const d=document.createElement('div');d.className='lp-item'+(c.id===selId?' sel':'');
    d.innerHTML=`<span class="lp-num">${i+1}</span>
      <img src="${c.src}" style="width:18px;height:18px;object-fit:contain;border-radius:3px;flex-shrink:0;background:var(--cream)">
      <span style="font-size:9px;max-width:36px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</span>
      <button class="lp-del" onclick="event.stopPropagation();delCharm('${c.id}')">✕</button>`;
    d.onclick=()=>{selId=c.id;renderLayers();draw();};
    el.appendChild(d);
  });
}
function delCharm(id){
  charms=charms.filter(c=>c.id!==id);
  if(selId===id)selId=charms.length?charms[charms.length-1].id:null;
  draw();renderLayers();updateSumbar();
  if(!charms.length)document.getElementById('baHint').style.display='';
}

// Controls
function mCharm(dx,dy){const c=charms.find(c=>c.id===selId);if(!c)return;c.x+=dx*8;c.y+=dy*8;draw();}
function cCenter(){const c=charms.find(c=>c.id===selId),v=cv();if(!c)return;c.x=v.width/2;c.y=v.height/2;draw();}
function rSize(d){const c=charms.find(c=>c.id===selId);if(!c)return;c.sz=Math.max(20,Math.min(180,c.sz+d));draw();}
function lFwd(){const i=charms.findIndex(c=>c.id===selId);if(i<charms.length-1){[charms[i],charms[i+1]]=[charms[i+1],charms[i]];draw();renderLayers();}}
function lBack(){const i=charms.findIndex(c=>c.id===selId);if(i>0){[charms[i],charms[i-1]]=[charms[i-1],charms[i]];draw();renderLayers();}}
function updateSumbar(){
  const n=charms.length,t=charms.reduce((s,c)=>s+c.price,0);
  document.getElementById('sumCount').textContent=n+' ຊິ້ນ';
  document.getElementById('sumPrice').textContent=t.toLocaleString()+' ກີບ';
  document.getElementById('saveBtn').disabled=n===0;
}

// ===== PICKER =====
function renderPickerCats(){
  const el=document.getElementById('pickerCats');el.innerHTML='';
  CHARM_DATA.forEach(c=>{
    const btn=document.createElement('button');btn.className='pcat'+(c.cat===activeCat?' active':'');
    btn.textContent=c.cat;
    btn.onclick=()=>{activeCat=c.cat;document.querySelectorAll('.pcat').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderCharmGrid();};
    el.appendChild(btn);
  });
}
function renderCharmGrid(){
  const wrap=document.getElementById('charmGridWrap');wrap.innerHTML='';
  const inner=document.createElement('div');inner.className='charm-grid-inner';
  const cat=CHARM_DATA.find(c=>c.cat===activeCat);
  if(!cat){wrap.appendChild(inner);return;}
  cat.subs.forEach(sub=>{
    sub.imgs.forEach(src=>{
      const item=document.createElement('div');item.className='charm-item';
      item.innerHTML=`<div class="charm-img-wrap"><img src="${src}" loading="lazy"></div>
        <div class="charm-iname">${cat.cat}</div><div class="charm-iprice">${(sub.price/1000).toFixed(0)}K</div>`;
      item.onclick=()=>addCharm(cat.cat,sub.price,src);
      inner.appendChild(item);
    });
  });
  wrap.appendChild(inner);wrap.scrollTop=0;
}

// ===== SUMMARY =====
const WA='85620 99809749',IG='https://www.instagram.com/maliluv_bb';
function buildSummary(){
  const list=document.getElementById('orderList'),tot=document.getElementById('orderTotal');
  list.innerHTML='';
  // Draw preview from canvas
  const src=cv();const prev=document.getElementById('previewCanvas');
  prev.width=src.width;prev.height=src.height;
  prev.getContext('2d').drawImage(src,0,0);

  if(!charms.length){tot.textContent='0 ກີບ';return;}
  const counts={};
  charms.forEach(c=>{const k=c.name+c.price;if(!counts[k])counts[k]={...c,qty:0};counts[k].qty++;});
  let total=0;
  Object.values(counts).forEach(it=>{
    total+=it.price*it.qty;
    list.innerHTML+=`<div class="order-item">
      <div class="oi-left"><img class="oi-img" src="${it.src}">
        <div><div class="oi-name">${it.name}</div><div class="oi-qty">x${it.qty} · ${(it.price/1000).toFixed(0)}K/ຊິ້ນ</div></div></div>
      <div class="oi-price">${(it.price*it.qty).toLocaleString()} ກີບ</div></div>`;
  });
  tot.textContent=total.toLocaleString()+' ກີບ';
}
function getTxt(){
  const counts={};charms.forEach(c=>{if(!counts[c.name+c.price])counts[c.name+c.price]={...c,qty:0};counts[c.name+c.price].qty++;});
  const t=charms.reduce((s,c)=>s+c.price,0);
  let m='🪬 ສັ່ງຊາຍແຂນ Bai Boua\n\n';
  Object.values(counts).forEach(i=>{m+=`• ${i.name} x${i.qty} = ${(i.price*i.qty).toLocaleString()} ກີບ\n`;});
  return m+`\n💰 ລາຄາລວມ: ${t.toLocaleString()} ກີບ`;
}
function sendWA(){if(!charms.length){alert('ກະລຸນາເລືອກຊາມກ່ອນ!');return;}window.open(`https://wa.me/${WA.replace(/\s/g,'')}?text=${encodeURIComponent(getTxt())}`,'_blank');}
function openIG(){window.open(IG,'_blank');}
function dlImg(){const a=document.createElement('a');a.href=cv().toDataURL('image/png');a.download='bai_boua_design.png';a.click();}

// ===== INIT =====
buildIntro();buildHome();renderPickerCats();renderCharmGrid();
window.addEventListener('load',()=>{initCanvas();draw();});
