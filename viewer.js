import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
const $=id=>document.getElementById(id);
const groups={1:['long-eaton'],2:['sawley','shardlow'],3:['twyford'],4:['stapenhill','winshill'],5:['clifton','ratcliffe'],6:['repton'],7:['chellaston-hill'],8:['castle-donington'],9:['horninglow'],11:['stanton-bridge'],12:['beeston']};
const names={'long-eaton':'Long Eaton',sawley:'Sawley',shardlow:'Shardlow',twyford:'Twyford',stapenhill:'Stapenhill',winshill:'Winshill',clifton:'Clifton',ratcliffe:'Ratcliffe-on-Soar',repton:'Repton','chellaston-hill':'Chellaston Hill','castle-donington':'Castle Donington',horninglow:'Horninglow',foremark:'Foremark','stanton-bridge':'Stanton by Bridge / Swarkestone',beeston:'Beeston','nottingham-crossings':'Wilford / West Bridgford'};
const boundaryData=fetch('data/admin-boundaries.json?v=20260925-alignment').then(r=>{if(!r.ok)throw Error('Boundary data unavailable');return r.json();});
const query=new URLSearchParams(location.search),group=groups[query.get('group')]||groups[1];
let data,terrain,root,palaeoGroup,waterGroup,boundaryGroup,boundaryLabel,referenceLabel,sectionGroup,currentProfile,customStart,drawMode=false,loadToken=0,active=false,visible=true;
const scene=new THREE.Scene();scene.background=new THREE.Color('#eaf0e8');
const camera=new THREE.PerspectiveCamera(38,1,1,30000);camera.position.set(2700,2600,3500);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});}catch(error){$('status').textContent='3D rendering is unavailable in this browser. Please try a browser with WebGL enabled.';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;$('scene').appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enabled=false;controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=150;controls.maxDistance=11000;controls.addEventListener('change',render);
scene.add(new THREE.HemisphereLight(0xffffff,0x657267,2.1));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(-2000,5000,-3000);scene.add(sun);
function render(){if(visible){
 if(boundaryLabel&&referenceLabel&&boundaryGroup.visible){
  camera.updateMatrixWorld();boundaryLabel.center.set(.5,0);
  const a=boundaryLabel.position.clone().project(camera),b=referenceLabel.position.clone().project(camera),factor=camera.projectionMatrix.elements[5];
  const height=boundaryLabel.scale.y*factor,width=(boundaryLabel.scale.x+referenceLabel.scale.x)*factor/2/camera.aspect;
  if(Math.abs(a.x-b.x)<width && Math.abs(a.y-b.y)<height+0.035){
   // Move only the area caption down when it would cover the precise landmark.
   boundaryLabel.center.y=1+(a.y-b.y+0.035)/height;
  }
 }
 renderer.render(scene,camera);
}}
new ResizeObserver(()=>{const b=$('scene').getBoundingClientRect();renderer.setSize(b.width,b.height);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();render();}).observe($('scene'));
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)render();}).observe($('scene'));
const ex=()=>Number($('exaggeration').value);
function elevation(x,y){const g=data.grid;const col=(x-g.west)/g.stepM,row=(g.north-y)/g.stepM;if(col<0||row<0||col>g.cols-1||row>g.rows-1)return NaN;const c=Math.min(g.cols-2,Math.floor(col)),r=Math.min(g.rows-2,Math.floor(row)),u=col-c,v=row-r;const z=(rr,cc)=>g.elevationCm[rr*g.cols+cc]/100;return (1-v)*((1-u)*z(r,c)+u*z(r,c+1))+v*((1-u)*z(r+1,c)+u*z(r+1,c+1));}
function world(x,y,raise=1.2){const b=data.bounds,z=elevation(x,y);return new THREE.Vector3(x-(b[0]+b[2])/2,(z-data.stats.minM)*ex()+raise,(b[1]+b[3])/2-y);}
function dispose(obj){obj.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of [].concat(o.material)){m.map?.dispose();m.dispose();}}});}
function label(text,color='#253f3d'){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#fafbf8e8';c.fillRect(0,0,512,96);c.fillStyle=color;c.font='32px sans-serif';c.textAlign='center';c.fillText(text,256,59);const texture=new THREE.CanvasTexture(canvas);const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));spr.scale.set(600,112,1);return spr;}
// Named landmarks remain readable while rotating or zooming, including in saved PNGs.
function landmarkLabel(text,color='#a13f63'){
 const canvas=document.createElement('canvas'),c=canvas.getContext('2d');
 c.font='28px sans-serif';canvas.width=Math.ceil(c.measureText(text).width)+36;canvas.height=60;
 c.fillStyle='#fafbf8f2';c.fillRect(0,0,canvas.width,canvas.height);
 c.fillStyle=color;c.font='28px sans-serif';c.textAlign='center';c.fillText(text,canvas.width/2,39);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,sizeAttenuation:false,toneMapped:false}));
 sprite.scale.set(.05*canvas.width/canvas.height,.05,1);sprite.center.set(.5,0);sprite.renderOrder=10;return sprite;
}
// Locate the landmark on the actual section geometry, including user-drawn sections.
function landmarkDistance(p, point=data.anchor){
 const path=p.path||[p.start,p.end];let travelled=0,best=null;
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(!length)continue;
  const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(length*length)));
  const offset=Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
  if(!best||offset<best.offset)best={offset,distance:travelled+t*length};travelled+=length;
 }
 return best&&best.offset<=10?best.distance:null;
}
function escapeXml(text){return text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function draped(lines,color,width=1){const group=new THREE.Group();for(const coords of lines){const points=[];for(let i=0;i<coords.length-1;i++){const a=coords[i],b=coords[i+1],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/10));for(let j=0;j<=steps;j++){const u=j/steps,x=a[0]+(b[0]-a[0])*u,y=a[1]+(b[1]-a[1])*u,p=world(x,y,2);if(Number.isFinite(p.y))points.push(p);}}if(points.length>1)group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,linewidth:width,depthTest:false,transparent:true,opacity:.95})));}return group;}
function buildBoundary(){
 boundaryLabel=null;boundaryGroup=new THREE.Group();root.add(boundaryGroup);const boundary=data.adminBoundary;if(!boundary)return;
 for(const coords of boundary.lines){
  const points=[];
  for(let i=1;i<coords.length;i++){
   const a=coords[i-1],b=coords[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/10));
   for(let j=0;j<=steps;j++){const u=j/steps,p=world(a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,5);if(Number.isFinite(p.y))points.push(p);}
  }
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:'#584285',dashSize:30,gapSize:20,depthTest:false}));line.computeLineDistances();boundaryGroup.add(line);
 }
 const title=landmarkLabel(boundary.name+' · civil parish (2025)','#584285');boundaryLabel=title;title.position.copy(world(...boundary.labelPoint,65));boundaryGroup.add(title);
 boundaryGroup.visible=$('boundary').checked;
}
function build(){
 if(root){scene.remove(root);dispose(root);}sectionGroup=null;root=new THREE.Group();scene.add(root);
 const g=data.grid,geo=new THREE.BufferGeometry(),pos=new Float32Array(g.rows*g.cols*3),colors=new Float32Array(pos.length),index=[];
 const low=new THREE.Color('#9cae94'),high=new THREE.Color('#e5d8b0'),range=data.stats.maxM-data.stats.minM;
 for(let r=0;r<g.rows;r++)for(let c=0;c<g.cols;c++){const i=r*g.cols+c,z=g.elevationCm[i]/100,p=world(g.west+c*10,g.north-r*10,0);pos.set(p.toArray(),i*3);const color=low.clone().lerp(high,(z-data.stats.minM)/range);colors.set([color.r,color.g,color.b],i*3);if(r<g.rows-1&&c<g.cols-1){const a=i,b=i+1,d=i+g.cols,e=d+1;index.push(a,d,b,b,d,e);}}
 geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.setIndex(index);geo.computeVertexNormals();
 terrain=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide,wireframe:$('wire').checked}));root.add(terrain);
 palaeoGroup=draped(data.palaeo.flatMap(f=>f.lines),'#c16925');palaeoGroup.visible=$('palaeo').checked;root.add(palaeoGroup);
 waterGroup=draped(data.modernWater.flatMap(f=>f.lines),'#187eab');waterGroup.visible=$('water').checked;root.add(waterGroup);
 const marker=new THREE.Mesh(new THREE.SphereGeometry(14,16,12),new THREE.MeshBasicMaterial({color:'#a13f63',depthTest:false}));marker.position.copy(world(...data.anchor,15));root.add(marker);
 const ring=Array.from({length:65},(_,i)=>[data.anchor[0]+50*Math.cos(i*Math.PI/32),data.anchor[1]+50*Math.sin(i*Math.PI/32)]);root.add(draped([ring],'#a13f63'));
 const stem=new THREE.Line(new THREE.BufferGeometry().setFromPoints([world(...data.anchor,15),world(...data.anchor,125)]),new THREE.LineBasicMaterial({color:'#a13f63',depthTest:false}));root.add(stem);
 const nameLabel=landmarkLabel(data.anchorName);referenceLabel=nameLabel;nameLabel.position.copy(world(...data.anchor,125));root.add(nameLabel);

 // Additional documented features keep the village reference point intact.
 for(const ref of data.referencePoints||[]){
  const pt=ref.coordinates,color='#a13f63';
  const dot=new THREE.Mesh(new THREE.SphereGeometry(12,16,12),new THREE.MeshBasicMaterial({color,depthTest:false}));dot.position.copy(world(...pt,15));root.add(dot);
  const leader=new THREE.Line(new THREE.BufferGeometry().setFromPoints([world(...pt,15),world(...pt,160)]),new THREE.LineBasicMaterial({color,depthTest:false}));root.add(leader);
  const title=landmarkLabel(ref.name,color);title.position.copy(world(...pt,160));root.add(title);
 }
 const grid=new THREE.GridHelper(3000,6,0x879b91,0xbac7bd);grid.position.y=-8;root.add(grid);
 const north=label('N ↑');north.position.set(0,40,-1710);north.scale.set(280,65,1);root.add(north);
 const scale=label('Grid: 500 m');scale.position.set(1120,40,1690);scale.scale.set(390,75,1);root.add(scale);
 buildBoundary();drawSection();render();
}
function reset(plan=false){camera.up.set(0,1,0);controls.target.set(0,(data.stats.maxM-data.stats.minM)*ex()/3,0);if(plan)camera.position.set(0,5100,.01);else camera.position.set(2700,2600,3500);controls.update();render();}
function drawSection(){if(sectionGroup){root.remove(sectionGroup);dispose(sectionGroup);}if(!currentProfile)return;sectionGroup=draped([currentProfile.path||[currentProfile.start,currentProfile.end]],'#a13f63');sectionGroup.visible=$('section').checked;for(const [txt,pt] of [['A',currentProfile.start],['B',currentProfile.end]]){const l=label(txt,'#a13f63');l.scale.set(100,55,1);l.position.copy(world(...pt,45));sectionGroup.add(l);}root.add(sectionGroup);}
function profileChart(p){currentProfile=p;const oldCustom=$('profile').querySelector('option[value="custom"]');if(p.custom){if(!oldCustom)$('profile').add(new Option('Custom A → B','custom'));$('profile').value='custom';}else{oldCustom?.remove();$('profile').value=String(data.profiles.indexOf(p));}const z=p.elevationM,ds=p.distanceM;const lo=Math.floor(Math.min(...z)/2)*2,hi=Math.max(lo+2,Math.ceil(Math.max(...z)/2)*2),len=ds.at(-1),x=d=>55+d/len*825,y=v=>125-(v-lo)/(hi-lo)*100;let svg='';for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4;svg+=`<line x1="55" x2="880" y1="${y(v)}" y2="${y(v)}" stroke="#e1e7e0"/><text x="48" y="${y(v)+4}" text-anchor="end">${v.toFixed(1)}</text>`;}
 const d=z.map((v,i)=>`${i?'L':'M'}${x(ds[i]).toFixed(1)},${y(v).toFixed(1)}`).join(' ');svg+=`<path d="${d} L880,125 L55,125 Z" fill="#b9cbb7" opacity=".35"/><path d="${d}" fill="none" stroke="#315f5b" stroke-width="2"/><text x="6" y="13">m OD</text><text x="55" y="146">A · 0 m</text><text x="880" y="146" text-anchor="end">B · ${len.toFixed(0)} m</text>`;
 const refDistance=landmarkDistance(p); if(refDistance!==null){const px=x(refDistance),right=px>460;svg+=`<line x1="${px}" x2="${px}" y1="20" y2="125" stroke="#a13f63" stroke-dasharray="3 3"/><text x="${right?px-5:px+5}" y="15" text-anchor="${right?'end':'start'}">${escapeXml(data.anchorName)}</text>`;}
 for(const ref of data.referencePoints||[]){const dist=landmarkDistance(p,ref.coordinates);if(dist!==null){const px=x(dist),right=px>460;svg+=`<line x1="${px}" x2="${px}" y1="20" y2="125" stroke="#a13f63" stroke-dasharray="3 3"/><text x="${right?px-5:px+5}" y="15" text-anchor="${right?'end':'start'}">${escapeXml(ref.name)}</text>`;}}
 $('chart').innerHTML=svg;$('profileMeta').textContent=`${p.label} · ${p.custom?'10 m display grid, bilinear interpolation':'Native 1 m raster sampled every 5 m'} · A ${p.start.map(v=>v.toFixed(0)).join(', ')} → B ${p.end.map(v=>v.toFixed(0)).join(', ')} (BNG). Plot axes rescale independently; chart angle is not terrain slope.`;drawSection();render();
}
const types={0:'Unclassified',1:'Standing water',2:'Depression',3:'Crop / soil / moisture mark',4:'Vegetation',5:'Field boundary / hedge line',6:'Parish boundary',7:'Ridge and swale'};
function record(){const f=data.palaeo[Number($('record').value)];if(!f){$('recordInfo').textContent='No ADS feature intersects this crop. This is not evidence that no former channels existed.';return;}const p=f.properties;$('recordInfo').textContent=Object.entries(p).filter(([k,v])=>v!==''&&v!==null).map(([k,v])=>`${k}: ${v}`).join('\n')+'\nBlank date fields do not assign a medieval date.';}
async function load(id){const token=++loadToken;$('status').hidden=false;$('status').textContent='Loading local terrain data…';try{const response=await fetch(`data/${id}.json?v=20260925-alignment`);if(!response.ok)throw Error(`HTTP ${response.status}`);const next=await response.json();next.adminBoundary=(await boundaryData)[id]||null;if(token!==loadToken)return;data=next;currentProfile=data.profiles[0];customStart=null;drawMode=false;$('custom').textContent='Draw a section: choose A, then B';for(const b of $('sites').children){b.classList.toggle('active',b.dataset.id===id);b.setAttribute('aria-pressed',String(b.dataset.id===id));}
 $('name').textContent=data.name;$('areaTitle').textContent='Terrain around '+data.name;$('element').textContent=data.element;$('range').textContent=`${data.stats.minM.toFixed(1)}–${data.stats.maxM.toFixed(1)}`;
 $('landmark').textContent=[data.anchorName,...(data.referencePoints||[]).map(r=>r.name)].join(' · ');
 $('boundaryControl').hidden=!data.adminBoundary;$('boundaryCaption').hidden=!data.adminBoundary;$('boundaryCredit').hidden=!data.adminBoundary;
 $('boundaryCaption').textContent=data.adminBoundary?(data.adminBoundary.lines.length===0?'Terrain window lies inside the modern parish; boundary is outside this view.':data.adminBoundary.clipped?'Modern civil parish; boundary continues beyond this terrain window.':'Modern civil parish boundary (December 2025).'):'';
 $('anchor').textContent=`Marker: ${data.anchorName}, E ${data.anchor[0]}, N ${data.anchor[1]}. ${data.anchorNote} The magenta ring is the 50 m sampling radius.`;
 const st=data.stats;$('metrics').textContent=`50 m disk median: ${st.anchorDiskMedianM['50'].toFixed(2)} m OD. 300–700 m surrounding-ring median: ${st.ring300to700MedianM.toFixed(2)} m OD. Difference: ${st.disk50MinusRingM.toFixed(2)} m. This ring includes all modern landforms; it is not a mapped floodplain or flood-water reference. ${st.adsFeatures} ADS records intersect this crop; ${st.datedAdsFeatures} have non-empty date fields.`;
 $('profile').replaceChildren(...data.profiles.map((p,i)=>new Option(p.label,i)));$('record').replaceChildren(...data.palaeo.map((f,i)=>new Option(`${f.properties.layer} · ${f.properties.UNIQUE_ID} · ${types[f.properties.TYPE]||f.properties.TYPE}`,i)));record();build();profileChart(currentProfile);reset();$('status').hidden=true;
 }catch(error){$('status').textContent=`Could not load terrain: ${error.message}. Serve this folder over HTTP (see README).`;}}
for(const id of group){const b=document.createElement('button');b.textContent=names[id];b.dataset.id=id;b.onclick=()=>load(id);$('sites').appendChild(b);}
$('explore').onclick=()=>{active=!active;controls.enabled=active;renderer.domElement.style.touchAction=active?'none':'pan-y';$('explore').setAttribute('aria-pressed',String(active));$('explore').textContent=active?'Pause rotation & zoom':'Enable rotation & zoom';};
$('top').onclick=()=>reset(true);$('reset').onclick=()=>reset();$('exaggeration').onchange=()=>{$('scaleBadge').textContent=`3 × 3 km · ${ex()===1?'true vertical scale':'height exaggerated '+ex()+'×'}`;build();};$('wire').onchange=()=>{terrain.material.wireframe=$('wire').checked;render();};
for(const [id,which] of [['water',()=>waterGroup],['palaeo',()=>palaeoGroup],['section',()=>sectionGroup]])$(id).onchange=()=>{which().visible=$(id).checked;render();};
$('boundary').onchange=()=>{if(boundaryGroup)boundaryGroup.visible=$('boundary').checked;render();};
$('profile').onchange=()=>{if($('profile').value==='custom')return;drawMode=false;customStart=null;$('custom').textContent='Draw a section: choose A, then B';profileChart(data.profiles[Number($('profile').value)]);};$('record').onchange=record;
$('custom').onclick=()=>{drawMode=!drawMode;customStart=null;$('custom').textContent=drawMode?'Click point A on the terrain':'Draw a section: choose A, then B';};
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();function hit(event){const b=renderer.domElement.getBoundingClientRect();mouse.set((event.clientX-b.left)/b.width*2-1,-(event.clientY-b.top)/b.height*2+1);ray.setFromCamera(mouse,camera);const p=ray.intersectObject(terrain)[0]?.point;if(!p)return null;return [p.x+(data.bounds[0]+data.bounds[2])/2,(data.bounds[1]+data.bounds[3])/2-p.z];}
renderer.domElement.addEventListener('pointermove',event=>{if(!data||!terrain)return;const p=hit(event);if(p)$('readout').textContent=`E ${p[0].toFixed(0)} · N ${p[1].toFixed(0)} · ${elevation(...p).toFixed(2)} m OD (display interpolation)`;});
renderer.domElement.addEventListener('click',event=>{if(!drawMode)return;const p=hit(event);if(!p)return;if(!customStart){customStart=p;$('custom').textContent='Now click point B';return;}const start=customStart,end=p,length=Math.hypot(end[0]-start[0],end[1]-start[1]);if(length<10)return;const count=Math.ceil(length/10),ds=[],z=[];for(let i=0;i<=count;i++){const u=i/count;ds.push(length*u);z.push(elevation(start[0]+u*(end[0]-start[0]),start[1]+u*(end[1]-start[1])));}profileChart({custom:true,label:'Custom A → B',start,end,distanceM:ds,elevationM:z});drawMode=false;customStart=null;$('custom').textContent='Draw a section: choose A, then B';});
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
$('image').onclick=()=>{render();const out=document.createElement('canvas');out.width=renderer.domElement.width;out.height=renderer.domElement.height+(data.adminBoundary?110:80);const c=out.getContext('2d');c.drawImage(renderer.domElement,0,0);const ratio=renderer.domElement.width/renderer.domElement.clientWidth;c.save();c.scale(ratio,ratio);c.font='600 14px sans-serif';const titleWidth=Math.min(c.measureText('Terrain around '+data.name).width+20,renderer.domElement.clientWidth-20);c.fillStyle='#fafbf8f2';c.fillRect(10,10,titleWidth,30);c.fillStyle='#253f3d';c.fillText('Terrain around '+data.name,20,30,titleWidth-20);c.restore();c.fillStyle='#fafbf8';c.fillRect(0,renderer.domElement.height,out.width,out.height-renderer.domElement.height);c.fillStyle='#203c3c';c.font='18px sans-serif';c.fillText(`${data.name} | EA 1 m DTM / 10 m display | vertical scale ${ex()}×`,15,out.height-48);c.font='12px sans-serif';c.fillText('Orange: undated ADS records © Steve Baker (2006). Blue: modern OSM watercourses. No historic water level modelled.',15,out.height-20);if(data.adminBoundary){c.font='11px sans-serif';c.fillText('Parish: ONS Dec 2025. OS & National Statistics data © Crown copyright and database right 2025.',15,out.height-85);}out.toBlob(blob=>download(blob,`${data.id}-terrain-${ex()}x.png`));};
load(group.includes(query.get('site'))?query.get('site'):group[0]);
new ResizeObserver(()=>{if(window.parent!==window)window.parent.postMessage({kind:'terrain-viewer-height',height:Math.ceil(document.querySelector('main').getBoundingClientRect().height)+3},location.origin);}).observe(document.querySelector('main'));
