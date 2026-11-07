/* Pure IANA wall-time conversion. No dependencies, Date.now, or I/O. */
const formatters=new Map();
function formatter(zone) {
  if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-GB',{
    timeZone:zone,calendar:'gregory',numberingSystem:'latn',year:'numeric',month:'2-digit',
    day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
  return formatters.get(zone);
}
const pad=n=>String(n).padStart(2,'0');
export function localParts(at,zone) {
  if(!Number.isFinite(at))throw new RangeError('Invalid instant');
  const p=Object.fromEntries(formatter(zone).formatToParts(new Date(at))
    .filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
  const {year,month,day,hour,minute,second}=p;
  return {year,month,day,hour,minute,second,
    localDate:`${String(year).padStart(4,'0')}-${pad(month)}-${pad(day)}`,
    localTime:`${pad(hour)}:${pad(minute)}`};
}
export function toInstant(localDate,localTime,zone,disambiguation){
  if(typeof localDate!=='string'||!/^(\d{4})-(\d{2})-(\d{2})$/.test(localDate))return {ok:false,code:'INVALID_DATE'};
  if(typeof localTime!=='string'||!/^([01]\d|2[0-3]):([0-5]\d)$/.test(localTime))return {ok:false,code:'INVALID_TIME'};
  const [y,m,d]=localDate.split('-').map(Number),[h,min]=localTime.split(':').map(Number);
  const normalized=new Date(Date.UTC(y,m-1,d));
  if(y<100||normalized.getUTCFullYear()!==y||normalized.getUTCMonth()+1!==m||normalized.getUTCDate()!==d)return {ok:false,code:'INVALID_DATE'};
  const naive=Date.UTC(y,m-1,d,h,min),offsets=new Set();
  for(const delta of [-48,-24,-12,0,12,24,48]){
    const candidate=naive+delta*3600000;
    const v=localParts(candidate,zone);
    offsets.add(Date.UTC(v.year,v.month-1,v.day,v.hour,v.minute,v.second)-candidate);
  }
  const matches=[...offsets].map(offset=>naive-offset).filter(t=>{
    const v=localParts(t,zone);
    return v.localDate===localDate&&v.localTime===localTime&&v.second===0;
  }).sort((a,b)=>a-b);
  if(!matches.length)return {ok:false,code:'NONEXISTENT_LOCAL_TIME'};
  if(matches.length>1){
    if(!['earlier','later'].includes(disambiguation))return {ok:false,code:'AMBIGUOUS_LOCAL_TIME'};
    return {ok:true,at:disambiguation==='earlier'?matches[0]:matches.at(-1)};
  }
  return {ok:true,at:matches[0]};
}
export function subtractLocalDays(localDate,days){
  if(!Number.isInteger(days)||days<0||days>366)return null;
  const v=toInstant(localDate,'12:00','UTC');
  return v.ok?localParts(v.at-days*86400000,'UTC').localDate:null;
}
