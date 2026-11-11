import http from 'node:http';
const PORT = Number(process.env.PORT || 7000);
const TMDB_KEY = process.env.TMDB_API_KEY || '';
const ORIGIN = process.env.PUBLIC_URL || '';
const FALLBACK = {movie:[{id:'masr:movie:1',type:'movie',name:'الإرهاب والكباب',releaseInfo:'1992',description:'Egyptian comedy film; catalog-only listing.'},{id:'masr:movie:2',type:'movie',name:'عسل أسود',releaseInfo:'2010',description:'Egyptian comedy film; catalog-only listing.'},{id:'masr:movie:3',type:'movie',name:'الفيل الأزرق',releaseInfo:'2014',description:'Egyptian thriller film; catalog-only listing.'}],series:[{id:'masr:series:1',type:'series',name:'لن أعيش في جلباب أبي',releaseInfo:'1996',description:'Egyptian television drama; catalog-only listing.'},{id:'masr:series:2',type:'series',name:'الكبير أوي',releaseInfo:'2010',description:'Egyptian comedy series; catalog-only listing.'}]};
const manifest = {
 id:'org.masrstream.egypt',version:'1.2.0',name:'MasrStream 🇪🇬',
 description:'Egyptian movies and series discovery with optional authorized direct video streams. No paid debrid required.',
 logo:'https://upload.wikimedia.org/wikipedia/commons/f/fe/Flag_of_Egypt.svg',
 resources:['catalog','meta','stream'],types:['movie','series'],idPrefixes:['tmdb:','masr:'],
 catalogs:[
  {type:'movie',id:'egypt-movies',name:'أفلام مصرية',extra:[{name:'search',isRequired:false},{name:'skip',isRequired:false}]},
  {type:'series',id:'egypt-series',name:'مسلسلات مصرية',extra:[{name:'search',isRequired:false},{name:'skip',isRequired:false}]}
 ],behaviorHints:{configurable:false}
};
const allowed = (()=>{try{const v=JSON.parse(process.env.AUTHORIZED_STREAMS_JSON||'{}');return v && typeof v==='object' && !Array.isArray(v)?v:{}}catch{return {}}})();
function reply(res,status,data,ttl=300){res.writeHead(status,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','cache-control':`public, max-age=${ttl}`});res.end(JSON.stringify(data));}
async function tmdb(path,params={}){
 if(!TMDB_KEY)throw new Error('TMDB_API_KEY is not configured');
 const url=new URL('https://api.themoviedb.org/3/'+path);
 url.searchParams.set('api_key',TMDB_KEY);url.searchParams.set('language','ar-EG');
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
 try{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw new Error('TMDB returned '+r.status);return await r.json();}finally{clearTimeout(timer)}
}
const poster=p=>p?'https://image.tmdb.org/t/p/w500'+p:undefined;
function summary(x,type){return {id:'tmdb:'+x.id,type,name:x.title||x.name||x.original_title||x.original_name||'Untitled',poster:poster(x.poster_path),background:poster(x.backdrop_path),description:x.overview||'',releaseInfo:(x.release_date||x.first_air_date||'').slice(0,4)};}
function streamList(id){const v=allowed[id];if(!Array.isArray(v))return [];return v.filter(x=>x && typeof x.url==='string' && /^https?:\/\//.test(x.url)).map(x=>({name:String(x.name||'Authorized source'),title:String(x.title||'Direct video'),url:x.url}));}
async function meta(type,id){
 const num=id.replace(/^tmdb:/,'');if(!/^\d+$/.test(num))return null;
 const isSeries=type==='series';const d=await tmdb((isSeries?'tv/':'movie/')+num);
 const result={...summary(d,type),genres:(d.genres||[]).map(g=>g.name),runtime:d.runtime||d.episode_run_time?.[0]};
 if(isSeries){const seasons=(d.seasons||[]).filter(s=>s.season_number>0).slice(0,35);const fetched=await Promise.allSettled(seasons.map(s=>tmdb(`tv/${num}/season/${s.season_number}`)));
  result.videos=fetched.flatMap((v,i)=>v.status==='fulfilled'?(v.value.episodes||[]).map(e=>({id:`tmdb:${num}:${seasons[i].season_number}:${e.episode_number}`,title:e.name||`Episode ${e.episode_number}`,season:seasons[i].season_number,episode:e.episode_number,released:e.air_date?new Date(e.air_date+'T00:00:00Z').toISOString():undefined,thumbnail:poster(e.still_path),overview:e.overview||''})):[]);
 }
 return result;
}
async function handler(req,res){
 if(req.method!=='GET')return reply(res,405,{error:'Method not allowed'});
 const url=new URL(req.url,'http://localhost');const path=decodeURIComponent(url.pathname);
 if(path==='/' || path==='/health')return reply(res,200,{name:'MasrStream',version:'1.2.0',tmdbConfigured:!!TMDB_KEY,streamsConfigured:Object.keys(allowed).length>0,manifest:(ORIGIN||'')+'/manifest.json'},0);
 if(path==='/manifest.json')return reply(res,200,manifest,3600);
 const m=path.match(/^\/(catalog|meta|stream)\/(movie|series)\/(.+)\.json$/);
 if(!m)return reply(res,404,{error:'Not found'});
 const [,resource,type,raw]=m;
 if(resource==='stream')return reply(res,200,{streams:streamList(raw)},60);
 if(resource==='meta')return reply(res,200,{meta:raw.startsWith('masr:')?(FALLBACK[type].find(x=>x.id===raw)||null):await meta(type,raw)},3600);
 const [catalogId,...extra]=raw.split('/');if(catalogId!==(type==='movie'?'egypt-movies':'egypt-series'))return reply(res,200,{metas:[]});
 const params=new URLSearchParams(extra.join('/'));const search=params.get('search');const skip=Math.max(0,Math.min(10000,Number(params.get('skip'))||0));const page=Math.floor(skip/20)+1;
 const kind=type==='movie'?'movie':'tv';
 if(!TMDB_KEY){const items=FALLBACK[type].filter(x=>!search || x.name.includes(search) || x.name.toLowerCase().includes(search.toLowerCase()));return reply(res,200,{metas:items.slice(skip,skip+20)},900)}
 const data=await tmdb((search?'search/':'discover/')+kind,search?{query:search,include_adult:false,page}:{with_origin_country:'EG',sort_by:'popularity.desc',page,include_adult:false});
 const entries=(data.results||[]).filter(x=>!search || (x.origin_country||[]).includes('EG') || (x.original_language==='ar'));
 return reply(res,200,{metas:entries.map(x=>summary(x,type))},900);
}
const server=http.createServer((req,res)=>handler(req,res).catch(err=>reply(res,502,{error:err.message},0)));
if(process.env.NODE_ENV!=='test')server.listen(PORT,'0.0.0.0',()=>console.log(`MasrStream listening on ${PORT}`));
export {server,manifest,streamList};
