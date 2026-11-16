const numeric=['id','year','duration','tempo','energy','danceability','valence','acousticness','instrumentalness','speechiness','loudness','musical_key','time_signature'];
const allowed=new Set([...numeric,'title','artist','album','genre','synthetic','sections','components']);
const bad=message=>{throw Object.assign(Error(message),{status:400});};
export function parseCSV(text,delimiter=','){
 if(typeof text!=='string'||Buffer.byteLength(text)>1500000)bad('CSV must be text, at most 1.5 MB.');
 if(![',',';','\t'].includes(delimiter))bad('Delimiter must be comma, semicolon, or tab.');
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
 const pushField=()=>{row.push(field);if(row.length>64)bad('CSV supports at most 64 columns.');field='';closed=false;};
 const pushRow=()=>{pushField();if(row.some(v=>v!==''))rows.push(row);row=[];if(rows.length>1001)bad('CSV supports at most 1,000 records.');};
 for(let i=0;i<text.length;i++){
  const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c===delimiter){pushField();continue;}
  if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;pushRow();continue;}
  if(closed)bad('Unexpected characters after a closing CSV quote.');
  if(c==='"'){if(field)bad('Quotes must begin at the start of a CSV field.');quoted=true;}else field+=c;
 }
 if(quoted)bad('CSV has an unterminated quoted field.');
 if(field||row.length||closed)pushRow();
 if(!rows.length)bad('CSV is empty.');
 const headers=rows.shift().map(h=>h.trim());if(headers.some(h=>!h)||new Set(headers).size!==headers.length)bad('Column headers must be nonempty and unique.');
 return {headers,records:rows};
}
export function previewCSV(input,existing,validateSong){
 if(!input||typeof input!=='object')bad('Provide csv, and optionally mapping/defaults/delimiter.');
 const {headers,records}=parseCSV(input.csv,input.delimiter??',');
 const mapping=input.mapping??Object.fromEntries(headers.filter(h=>allowed.has(h)).map(h=>[h,h]));
 const defaults=input.defaults??{};
 if(!mapping||typeof mapping!=='object'||Array.isArray(mapping)||!defaults||typeof defaults!=='object'||Array.isArray(defaults))bad('mapping and defaults must be objects.');
 for(const [key,column] of Object.entries(mapping))if(!allowed.has(key)||typeof column!=='string'||!headers.includes(column))bad(`Invalid mapping for ${key}.`);
 if(Object.keys(defaults).some(k=>!allowed.has(k)))bad('Unknown default field.');
 const ids=new Set(existing.map(s=>s.id)),seen=new Set(),names=new Set(existing.map(s=>`${s.artist.toLowerCase()}\0${s.title.toLowerCase()}`));
 const rows=records.map((values,index)=>{
  const result={row:index+2,status:'ready',errors:[],warnings:[]};
  try{
   if(values.length!==headers.length)bad(`Expected ${headers.length} columns, found ${values.length}.`);
   const song={...defaults};for(const [key,column] of Object.entries(mapping)){const raw=values[headers.indexOf(column)].trim();if(raw==='')continue;
    if(numeric.includes(key)){if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw))bad(`${key} is not a number.`);song[key]=Number(raw);}
    else if(key==='synthetic'){if(!['true','false','1','0'].includes(raw.toLowerCase()))bad('synthetic must be true/false or 1/0.');song[key]=['true','1'].includes(raw.toLowerCase());}
    else if(key==='sections'||key==='components'){try{song[key]=JSON.parse(raw);}catch{bad(`${key} must contain a JSON array.`);}}
    else song[key]=raw;
   }
   result.song=validateSong(song);
   if(seen.has(result.song.id))bad('This ID appears more than once in the CSV.');seen.add(result.song.id);
   if(ids.has(result.song.id)){result.status='existing_id';result.warnings.push('Existing ID will be skipped and preserved.');}
   const name=`${result.song.artist.toLowerCase()}\0${result.song.title.toLowerCase()}`;if(names.has(name))result.warnings.push('The same artist/title already appears in the collection or import.');names.add(name);
  }catch(e){result.status='invalid';result.errors.push(e.message);delete result.song;}
  return result;
 });
 return {headers,rows,valid:rows.every(r=>r.status!=='invalid'),counts:{total:rows.length,ready:rows.filter(r=>r.status==='ready').length,skipped:rows.filter(r=>r.status==='existing_id').length,invalid:rows.filter(r=>r.status==='invalid').length}};
}
