const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET','POST'] } });

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data', 'state.json');
const PUBLIC = path.join(ROOT, 'public');

const seedIncidents = [
  {id:'INC-10231',cat:'C1',type:'Cardiac Arrest',addr:'Victoria Road, Blackpool, FY1 6AP',patient:'1 adult',crew:'1',time:'15:18',lat:53.8141,lon:-3.0434,info:'Cardiac arrest, CPR in progress',status:'Assigned'},
  {id:'INC-10230',cat:'C1',type:'RTC - Serious',addr:'A583 Lytham Road, Blackpool, FY4 1PX',patient:'2 adults',crew:'2',time:'15:12',lat:53.7934,lon:-3.0378,info:'Road traffic collision',status:'New'},
  {id:'INC-10229',cat:'C2',type:'Chest Pain',addr:'Talbot Road, Blackpool, FY1 3AA',patient:'1 adult',crew:'1',time:'15:08',lat:53.8178,lon:-3.0501,info:'Chest pain, conscious and breathing',status:'New'},
  {id:'INC-10228',cat:'C3',type:'Fall',addr:'St Annes Road, Blackpool, FY8 1BU',patient:'1 adult',crew:'1',time:'15:03',lat:53.7797,lon:-3.0027,info:'Fall, no obvious major injury',status:'New'},
  {id:'INC-10227',cat:'C3',type:'Breathing Difficulty',addr:'Riversway, Blackpool, FY3 8HH',patient:'1 adult',crew:'1',time:'14:57',lat:53.8303,lon:-3.0181,info:'Breathing difficulty',status:'New'},
  {id:'INC-10226',cat:'C4',type:'Mental Health',addr:'North Drive, Blackpool, FY1 4QF',patient:'1 adult',crew:'0',time:'14:48',lat:53.8253,lon:-3.0519,info:'Welfare concern',status:'New'}
];
const jobTemplates = [
 ['C1','Cardiac Arrest','Victoria Hospital, Whinney Heys Road, Blackpool, FY3 8NR','1 adult — CPR in progress',53.8009,-3.0280],
 ['C1','Road Traffic Collision','Yeadon Way, Blackpool, FY1','Multiple casualties — collision reported',53.798,-3.045],
 ['C2','Chest Pain','Talbot Road, Blackpool, FY1 3AA','1 adult — chest pain, conscious',53.8178,-3.0501],
 ['C2','Breathing Difficulty','Whitegate Drive, Blackpool, FY3','1 adult — difficulty breathing',53.822,-3.020],
 ['C3','Fall','St Annes Road, Lytham St Annes, FY8','1 adult — fall at home',53.7797,-3.0027],
 ['C3','Unwell Person','Church Street, Blackpool, FY1','1 adult — generally unwell',53.816,-3.050],
 ['C4','Mental Health','North Shore, Blackpool, FY1','Welfare concern',53.824,-3.056],
 ['C2','Injury','Central Drive, Blackpool, FY1','1 adult — injury following fall',53.807,-3.028]
];

let state = loadState();
const units = new Map();

function loadState(){
  try { return JSON.parse(fs.readFileSync(DATA,'utf8')); }
  catch { return {incidents:seedIncidents, messages:[], history:[]}; }
}
function saveState(){
  fs.mkdirSync(path.dirname(DATA), {recursive:true});
  fs.writeFileSync(DATA, JSON.stringify(state,null,2));
}
function now(){ return new Date().toTimeString().slice(0,5); }
function id(){ return 'INC-' + Math.floor(10000 + Math.random()*89999); }
function broadcastIncident(item){ io.emit('incident:update', item); saveState(); }
function createJob(template, source='Automatic CAD'){ 
  const [cat,type,addr,info,lat,lon]=template;
  const item={id:id(),cat,type,addr,patient:info.split('—')[0].trim(),crew:'1',time:now(),lat,lon,info,status:'New',source};
  state.incidents.unshift(item); state.history.unshift({at:new Date().toISOString(),action:'created',incident:item.id,source});
  saveState(); io.emit('incident:new',item); return item;
}

app.use(express.json());
app.use(express.static(PUBLIC));
app.get('/health',(req,res)=>res.json({ok:true,service:'Ambulance MDT UK CAD',time:new Date().toISOString(),connectedUnits:units.size}));
app.get('/api/state',(req,res)=>res.json({incidents:state.incidents,messages:state.messages,units:[...units.values()]}));
app.get('/control',(req,res)=>res.sendFile(path.join(PUBLIC,'control.html')));

io.on('connection', socket=>{
  socket.emit('state:init',{incidents:state.incidents,messages:state.messages,units:[...units.values()]});

  socket.on('unit:register', u=>{
    const unit={id:u.id||socket.id,callsign:u.callsign||u.id||'Unknown',name:u.name||'',role:u.role||'',partners:u.partners||'',station:u.station||'',vehicle:u.vehicle||'',shift:u.shift||'',radio:u.radio||'',supervisor:u.supervisor||'',registration:u.registration||'',status:u.status||'Available',lat:u.lat||53.8038,lon:u.lon||-3.0502,socketId:socket.id,updatedAt:new Date().toISOString()};
    units.set(unit.id,unit); socket.data.unitId=unit.id; io.emit('unit:update',unit);
  });
  socket.on('unit:status', u=>{
    const unit=units.get(u.id); if(!unit)return;
    Object.assign(unit,{status:u.status||unit.status,lat:u.lat??unit.lat,lon:u.lon??unit.lon,updatedAt:new Date().toISOString()});
    io.emit('unit:update',unit);
  });
  socket.on('unit:location', u=>{
    const unit=units.get(u.id); if(!unit)return;
    unit.lat=u.lat; unit.lon=u.lon; unit.updatedAt=new Date().toISOString(); io.emit('unit:update',unit);
  });
  socket.on('incident:status', p=>{
    const item=state.incidents.find(x=>x.id===p.id); if(!item)return;
    item.status=p.status; if(p.unitId)item.assignedUnit=p.unitId;
    state.history.unshift({at:new Date().toISOString(),action:'status',incident:item.id,status:item.status,unit:p.unitId||null});
    broadcastIncident(item);
  });
  socket.on('incident:note', p=>{
    const item=state.incidents.find(x=>x.id===p.id); if(!item)return;
    item.note=p.note||''; state.history.unshift({at:new Date().toISOString(),action:'note',incident:item.id}); saveState(); io.emit('incident:update',item);
  });
  socket.on('message:send', m=>{
    const msg={id:Date.now().toString(),from:m.from||socket.data.unitId||'Unknown',to:m.to||'CONTROL',text:String(m.text||'').slice(0,1000),at:new Date().toISOString()};
    state.messages.unshift(msg); state.messages=state.messages.slice(0,100); saveState();
    if(msg.to==='ALL') io.emit('message:new',msg);
    else if(msg.to==='CONTROL') io.emit('message:new',msg);
    else {
      const target=units.get(msg.to);
      if(target) io.to(target.socketId).emit('message:new',msg);
      else io.emit('message:new',msg); // fallback for demo/control clients
    }
  });
  socket.on('control:create', p=>{
    const cat=/^C[1-4]$/.test(p.cat)?p.cat:'C3';
    const item={id:id(),cat,type:String(p.type||'General Ambulance Incident').slice(0,100),addr:String(p.addr||'Blackpool').slice(0,200),patient:String(p.patient||'1 adult').slice(0,100),crew:'1',time:now(),lat:Number(p.lat)||53.8175,lon:Number(p.lon)||-3.0357,info:String(p.info||'New incident').slice(0,500),status:'New',source:'Control'};
    state.incidents.unshift(item); state.history.unshift({at:new Date().toISOString(),action:'created',incident:item.id,source:'Control'}); saveState(); io.emit('incident:new',item);
  });
  socket.on('control:message',m=>{
    const msg={id:Date.now().toString(),from:'Blackpool Control',to:m.to||'ALL',text:String(m.text||'').slice(0,1000),at:new Date().toISOString()};
    state.messages.unshift(msg); saveState(); io.emit('message:new',msg);
  });
  socket.on('disconnect',()=>{
    if(socket.data.unitId){ const unit=units.get(socket.data.unitId); if(unit){unit.status='Disconnected';unit.updatedAt=new Date().toISOString();io.emit('unit:update',unit);setTimeout(()=>{const current=units.get(unit.id);if(current?.socketId===socket.id)units.delete(unit.id)},30000);}}
  });
});

// Exactly one server-generated job per minute, shared by all connected MDTs.
setInterval(()=>createJob(jobTemplates[Math.floor(Math.random()*jobTemplates.length)]),60000);

saveState();
server.listen(PORT,HOST,()=>console.log(`Ambulance MDT UK CAD listening on ${HOST}:${PORT}`));
