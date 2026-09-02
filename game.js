const $=s=>document.querySelector(s);
const video=$('#video'), captureCanvas=$('#captureCanvas'), gameCanvas=$('#gameCanvas'), ctx=gameCanvas.getContext('2d');
let stream=null, portrait=null, audioOn=true, audioCtx=null;
const COLS=21,ROWS=19,TILE=34, W=COLS*TILE,H=ROWS*TILE;
gameCanvas.width=W; gameCanvas.height=H;
// # wall, . pea, o super pea, spaces are safe corridors
const MAP=[
"#####################",
"#o........#........o#",
"#.###.###.#.###.###.#",
"#.....#.......#.....#",
"###.#.#.#####.#.#.###",
"#...#.....#.....#...#",
"#.#####.#.#.#.#####.#",
"#.......#...#.......#",
"#.###.###   ###.###.#",
"#.....#       #.....#",
"#.###.# ## ## #.###.#",
"#...#.#       #.#...#",
"###.#.### # ###.#.###",
"#.....#...#...#.....#",
"#.#####.#####.#####.#",
"#o..#...........#..o#",
"###.#.#.#####.#.#.###",
"#.....#.......#.....#",
"#####################"];
let grid,player,spirits,score,lives,state,last,touchStart;
const dirs={left:{x:-1,y:0,a:Math.PI},right:{x:1,y:0,a:0},up:{x:0,y:-1,a:-Math.PI/2},down:{x:0,y:1,a:Math.PI/2}};

function beep(freq=400,d=.06,type='square'){if(!audioOn)return;audioCtx??=new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.035,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+d);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+d)}
async function enableCamera(){
  if(stream){snap();return}
  try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});video.srcObject=stream;$('#cameraFallback').hidden=true;$('#cameraBtn').textContent='SNAP MY CHOMPER';$('#cameraStatus').textContent='Camera ready — line up your face and snap!'}
  catch(e){$('#cameraStatus').textContent='Camera unavailable. You can still play with the house chomper.'}
}
function snap(){const c=captureCanvas,x=c.getContext('2d');c.width=320;c.height=320;const sw=Math.min(video.videoWidth,video.videoHeight),sx=(video.videoWidth-sw)/2,sy=(video.videoHeight-sw)/2;x.save();x.translate(320,0);x.scale(-1,1);x.drawImage(video,sx,sy,sw,sw,0,0,320,320);x.restore();portrait=new Image();portrait.onload=startGame;portrait.src=c.toDataURL('image/jpeg',.9);stream?.getTracks().forEach(t=>t.stop());stream=null}
function startGame(){
  $('#intro').hidden=true;$('#gamePanel').hidden=false;window.scrollTo({top:0,behavior:'smooth'});
  grid=MAP.map(r=>r.split(''));score=0;lives=3;state='playing';last=performance.now();
  player={x:10,y:15,px:10*TILE+TILE/2,py:15*TILE+TILE/2,dir:dirs.left,next:dirs.left,death:0};
  const colors=['#ff6d9e','#58dde2','#f6a63b'];spirits=[[9,9],[10,9],[11,9]].map((p,i)=>({x:p[0],y:p[1],px:p[0]*TILE+17,py:p[1]*TILE+17,dir:i===0?dirs.left:dirs.right,color:colors[i],mood:i}));
  $('#gameOverlay').hidden=true;updateHud();requestAnimationFrame(loop)
}
function open(x,y){return y>=0&&y<ROWS&&x>=0&&x<COLS&&grid[y][x]!=='#'}
function centered(o){return Math.abs(o.px-(o.x*TILE+17))<2&&Math.abs(o.py-(o.y*TILE+17))<2}
function moveEntity(o,speed,isPlayer=false){
  if(centered(o)){o.px=o.x*TILE+17;o.py=o.y*TILE+17;if(isPlayer&&open(o.x+o.next.x,o.y+o.next.y))o.dir=o.next;if(!open(o.x+o.dir.x,o.y+o.dir.y))return;o.x+=o.dir.x;o.y+=o.dir.y}
  o.px+=o.dir.x*speed;o.py+=o.dir.y*speed;
}
function spiritThink(s){
  if(!centered(s))return;const opts=Object.values(dirs).filter(d=>open(s.x+d.x,s.y+d.y)&&!(d.x===-s.dir.x&&d.y===-s.dir.y));if(!opts.length){s.dir={x:-s.dir.x,y:-s.dir.y,a:0};return}
  opts.sort((a,b)=>{const da=Math.hypot(player.x-(s.x+a.x),player.y-(s.y+a.y));const db=Math.hypot(player.x-(s.x+b.x),player.y-(s.y+b.y));return da-db+(Math.random()-.5)*3});s.dir=opts[0]
}
function update(dt){if(state!=='playing')return;moveEntity(player,Math.min(3.1,dt*.19),true);if(centered(player)){const cell=grid[player.y][player.x];if(cell==='.'||cell==='o'){grid[player.y][player.x]=' ';score+=cell==='o'?50:10;beep(cell==='o'?650:470);updateHud();if(!grid.some(r=>r.includes('.')||r.includes('o')))finish(true)}}spirits.forEach(s=>{spiritThink(s);moveEntity(s,Math.min(2.15,dt*.13));if(Math.hypot(s.px-player.px,s.py-player.py)<22)die()})}
function die(){if(state!=='playing')return;state='dying';player.death=performance.now();beep(110,.5,'sawtooth');setTimeout(()=>{lives--;updateHud();if(lives<=0)finish(false);else{player.x=10;player.y=15;player.px=357;player.py=527;player.dir=dirs.left;player.next=dirs.left;spirits.forEach((s,i)=>{s.x=9+i;s.y=9;s.px=s.x*TILE+17;s.py=323});state='playing'}},1100)}
function finish(win){state='done';$('#overlayKicker').textContent=win?'HARVEST COMPLETE':'THE SPIRITS GOT YOU';$('#overlayTitle').textContent=win?'PEA-RFECT!':'OH, SNAP!';$('#overlayScore').textContent=`FINAL SCORE  ${String(score).padStart(4,'0')}`;$('#gameOverlay').hidden=false}
function updateHud(){$('#score').textContent=String(score).padStart(4,'0');$('#lives').textContent='●'.repeat(lives)}
function draw(){ctx.fillStyle='#100d2c';ctx.fillRect(0,0,W,H);for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const c=grid[y][x],px=x*TILE,py=y*TILE;if(c==='#'){ctx.fillStyle=(x+y)%3===0?'#7657ef':'#6243d3';roundRect(px+3,py+3,TILE-6,TILE-6,7);ctx.fill();ctx.strokeStyle='#a99afa';ctx.lineWidth=1;ctx.stroke()}else if(c==='.'||c==='o'){ctx.fillStyle='#bce93f';ctx.beginPath();ctx.arc(px+17,py+17,c==='o'?7:3.5,0,Math.PI*2);ctx.fill();if(c==='o'){ctx.strokeStyle='#fff7dc';ctx.stroke();ctx.fillStyle='#65b947';ctx.fillRect(px+17,py+7,2,4)}}}spirits.forEach(drawSpirit);drawPlayer();if(state==='paused'){ctx.fillStyle='#100d2ccc';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff7dc';ctx.textAlign='center';ctx.font='48px Shrikhand';ctx.fillText('SNACK BREAK',W/2,H/2)}}
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function drawSpirit(s){ctx.save();ctx.translate(s.px,s.py);const bob=Math.sin(performance.now()/160+s.mood)*2;ctx.translate(0,bob);ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(0,-4,14,Math.PI,0);ctx.lineTo(14,12);ctx.lineTo(7,8);ctx.lineTo(0,13);ctx.lineTo(-7,8);ctx.lineTo(-14,12);ctx.closePath();ctx.fill();ctx.strokeStyle='#100d2c';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='white';ctx.beginPath();ctx.arc(-5,-5,4,0,7);ctx.arc(5,-5,4,0,7);ctx.fill();ctx.fillStyle='#100d2c';ctx.beginPath();ctx.arc(-4+s.dir.x*2,-4+s.dir.y*2,1.7,0,7);ctx.arc(6+s.dir.x*2,-4+s.dir.y*2,1.7,0,7);ctx.fill();ctx.restore()}
function drawPlayer(){let angle=player.dir.a,scale=1,rot=0;if(state==='dying'){const t=(performance.now()-player.death)/1000;rot=Math.sin(t*42)*.28;scale=Math.max(.1,1-t*.65)}ctx.save();ctx.translate(player.px,player.py);ctx.rotate(angle+rot);ctx.scale(scale,scale);ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.clip();if(portrait){ctx.rotate(-angle);ctx.drawImage(portrait,-18,-19,36,36)}else{ctx.fillStyle='#c8f13c';ctx.fillRect(-18,-18,36,36);ctx.fillStyle='#100d2c';ctx.font='bold 14px DM Mono';ctx.textAlign='center';ctx.fillText(':D',0,5)}ctx.restore();ctx.save();ctx.translate(player.px,player.py);ctx.rotate(angle+rot);ctx.scale(scale,scale);ctx.strokeStyle='#c8f13c';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,17,.35,Math.PI*2-.35);ctx.stroke();ctx.fillStyle='#100d2c';ctx.beginPath();ctx.moveTo(5,-7);ctx.lineTo(20,0);ctx.lineTo(5,7);ctx.closePath();ctx.fill();ctx.restore()}
function loop(now){const dt=Math.min(30,now-last);last=now;update(dt);draw();if(state!=='done')requestAnimationFrame(loop)}
function setDir(name){if(player&&state==='playing')player.next=dirs[name]}
document.addEventListener('keydown',e=>{const keys={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'up',w:'up',ArrowDown:'down',s:'down'};if(keys[e.key]){e.preventDefault();setDir(keys[e.key])}if(e.key===' ')togglePause()});
gameCanvas.addEventListener('touchstart',e=>touchStart=[e.touches[0].clientX,e.touches[0].clientY],{passive:true});gameCanvas.addEventListener('touchend',e=>{if(!touchStart)return;const dx=e.changedTouches[0].clientX-touchStart[0],dy=e.changedTouches[0].clientY-touchStart[1];setDir(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'))},{passive:true});
function togglePause(){if(state==='playing'){state='paused';$('#pauseBtn').textContent='RESUME'}else if(state==='paused'){state='playing';last=performance.now();$('#pauseBtn').textContent='PAUSE'}}
$('#cameraBtn').onclick=enableCamera;$('#playDefaultBtn').onclick=startGame;$('#againBtn').onclick=startGame;$('#newFaceBtn').onclick=()=>{state='done';$('#gamePanel').hidden=true;$('#intro').hidden=false;window.scrollTo(0,0)};$('#pauseBtn').onclick=togglePause;$('#soundBtn').onclick=()=>{audioOn=!audioOn;$('#soundBtn').textContent=audioOn?'♪':'×'};
