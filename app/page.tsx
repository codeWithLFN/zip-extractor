"use client";
import {useEffect,useMemo,useState} from "react";
import JSZip from "jszip";

type Entry={path:string;dir:boolean;file:JSZip.JSZipObject;size:number|null};
type Kind="all"|"pdf"|"image"|"text"|"other";
const MAX_ZIP=300*1024*1024;
const MAX_FILES=10000;
const MAX_PREVIEW=8*1024*1024;
const MAX_SINGLE=250*1024*1024;
const MAX_TOTAL=750*1024*1024;
function ext(path:string){return path.split(".").pop()?.toLowerCase()||""}
function kind(path:string):Kind{const e=ext(path);if(e==="pdf")return "pdf";if(["png","jpg","jpeg","gif","webp","bmp","svg","avif"].includes(e))return "image";if(["txt","md","csv","json","xml","html","css","js","jsx","ts","tsx","py","java","log","yml","yaml","sql"].includes(e))return "text";return "other"}
function format(bytes:number|null){if(bytes===null)return "Size unavailable";if(bytes<1024)return bytes+" B";if(bytes<1048576)return (bytes/1024).toFixed(1)+" KB";return (bytes/1048576).toFixed(1)+" MB"}
function getSize(file:JSZip.JSZipObject):number|null{const raw=file as unknown as {_data?:{uncompressedSize?:number}};const n=raw._data?.uncompressedSize;return typeof n==="number"&&Number.isFinite(n)?n:null}
function filename(path:string){return path.replace(/\/$/,"").split("/").pop()||path}
const buttonStyle={background:"#6366f1",color:"white",border:0,borderRadius:10,padding:"10px 14px",cursor:"pointer"} as const;
export default function Home(){
const [entries,setEntries]=useState<Entry[]>([]);
const [archive,setArchive]=useState("");
const [folder,setFolder]=useState("");
const [query,setQuery]=useState("");
const [filter,setFilter]=useState<Kind>("all");
const [selected,setSelected]=useState<string[]>([]);
const [preview,setPreview]=useState<{path:string;url?:string;text?:string;type:Kind}|null>(null);
const [busy,setBusy]=useState(false);
const [error,setError]=useState("");
const files=useMemo(()=>entries.filter(x=>!x.dir),[entries]);
const selection=useMemo(()=>new Set(selected),[selected]);
const visible=useMemo(()=>{
 const search=query.trim().toLowerCase();
 return entries.filter(x=>{
 if(search||filter!=="all"){
  if(x.dir)return false;
  return (!search||x.path.toLowerCase().includes(search))&&(filter==="all"||kind(x.path)===filter);
 }
 return x.path.startsWith(folder)&&x.path!==folder&&x.path.slice(folder.length).replace(/\/$/,"").split("/").length===1;
 }).sort((a,b)=>Number(b.dir)-Number(a.dir)||a.path.localeCompare(b.path));
},[entries,folder,query,filter]);
useEffect(()=>()=>{if(preview?.url)URL.revokeObjectURL(preview.url)},[preview]);
function save(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
async function load(file?:File){if(!file)return;setBusy(true);setError("");setPreview(null);try{
 if(!file.name.toLowerCase().endsWith(".zip"))throw Error("Choose a .zip archive.");
 if(file.size>MAX_ZIP)throw Error("Archive exceeds the 300 MB upload limit.");
 const zip=await JSZip.loadAsync(file);
 const list=Object.values(zip.files);
 if(list.length>MAX_FILES)throw Error("Archive contains too many entries.");
 const safe=list.filter(x=>!x.name.startsWith("/")&&!x.name.split("/").includes("..")&&!/^[a-zA-Z]:/.test(x.name)&&!x.name.includes("\\"));
 const mapped=safe.map(x=>({path:x.name,dir:x.dir,file:x,size:x.dir?null:getSize(x)}));
 const known=mapped.reduce((sum,x)=>sum+(x.size||0),0);
 if(known>MAX_TOTAL)throw Error("Uncompressed archive is too large for browser processing.");
 setEntries(mapped);setArchive(file.name);setFolder("");setQuery("");setFilter("all");setSelected(mapped.filter(x=>!x.dir).map(x=>x.path));
}catch(e){setError(e instanceof Error?e.message:"Unable to open archive.");}finally{setBusy(false)}}
function toggle(entry:Entry){const paths=entry.dir?files.filter(x=>x.path.startsWith(entry.path)).map(x=>x.path):[entry.path];const all=paths.every(x=>selection.has(x));setSelected(old=>all?old.filter(x=>!paths.includes(x)):[...new Set([...old,...paths])])}
async function downloadFile(entry:Entry){setBusy(true);setError("");try{if(entry.size!==null&&entry.size>MAX_SINGLE)throw Error("This file exceeds the 250 MB extraction limit.");const data=await entry.file.async("uint8array");if(data.byteLength>MAX_SINGLE)throw Error("File is too large.");save(new Blob([new Uint8Array(data)]),filename(entry.path))}catch(e){setError(e instanceof Error?e.message:"Unable to download file.")}finally{setBusy(false)}}
async function downloadZip(targets:Entry[],name:string){if(!targets.length)return;setBusy(true);setError("");try{
 const known=targets.reduce((sum,x)=>sum+(x.size||0),0);
 if(known>MAX_TOTAL)throw Error("Selected files exceed the 750 MB extraction limit.");
 const zip=new JSZip();let total=0;
 for(const entry of targets){if(entry.size!==null&&entry.size>MAX_SINGLE)throw Error("A selected file exceeds the 250 MB limit.");const bytes=await entry.file.async("uint8array");total+=bytes.byteLength;if(total>MAX_TOTAL)throw Error("Selected files exceed the 750 MB limit.");zip.file(entry.path,new Uint8Array(bytes))}
 save(await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:3}}),name);
}catch(e){setError(e instanceof Error?e.message:"Unable to create ZIP.")}finally{setBusy(false)}}
async function openPreview(entry:Entry){setBusy(true);setError("");setPreview(null);try{
 const type=kind(entry.path);
 if(!["pdf","image","text"].includes(type))throw Error("Preview is not available for this file type.");
 if(entry.size!==null&&entry.size>MAX_PREVIEW)throw Error("Preview is limited to 8 MB per file.");
 const bytes=await entry.file.async("uint8array");
 if(bytes.byteLength>MAX_PREVIEW)throw Error("Preview is limited to 8 MB per file.");
 if(type==="text"){setPreview({path:entry.path,type,text:new TextDecoder("utf-8",{fatal:false}).decode(bytes)})}
 else {const mime=type==="pdf"?"application/pdf":({png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",bmp:"image/bmp",avif:"image/avif",svg:"image/svg+xml"} as Record<string,string>)[ext(entry.path)]||"application/octet-stream";
 if(ext(entry.path)==="svg")throw Error("SVG preview is disabled for security. Download the file to inspect it.");
 const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:mime}));setPreview({path:entry.path,type,url})}
}catch(e){setError(e instanceof Error?e.message:"Preview failed.")}finally{setBusy(false)}}
const active=Boolean(query.trim()||filter!=="all");
return <main style={{maxWidth:1020,margin:"auto",padding:"30px 20px",color:"#e5e7eb"}}>
<header style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}><h2>▣ zip<span style={{color:"#818cf8"}}>extractor</span></h2><span style={{fontSize:13,color:"#2dd4bf"}}>● Private browser processing</span></header>
<section style={{textAlign:"center",padding:"32px 0 28px"}}><h1 style={{fontSize:"clamp(34px,6vw,60px)",lineHeight:1.1,margin:"10px 0"}}>Unzip. Explore.<br/><span style={{color:"#818cf8"}}>Get what you need.</span></h1><p style={{color:"#94a3b8"}}>Search, preview and download files from ZIP archives. No account required.</p></section>
<label onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void load(e.dataTransfer.files[0])}} style={{display:"block",textAlign:"center",padding:"30px 15px",border:"2px dashed #6366f1",borderRadius:16,background:"#141d30",cursor:"pointer"}}><div style={{fontSize:32}}>⇧</div><h2>Drop a ZIP file here</h2><p style={{color:"#94a3b8"}}>Or click to choose an archive · Max 300 MB</p><span style={buttonStyle}>Choose ZIP file</span><input type="file" accept=".zip,application/zip" style={{display:"none"}} onChange={e=>{void load(e.target.files?.[0]);e.target.value=""}}/></label>
{error&&<p role="alert" style={{color:"#fda4af",padding:"10px 0"}}>{error}</p>}{busy&&<p role="status" style={{color:"#a5b4fc"}}>Processing, please wait…</p>}
{archive&&<section style={{background:"#141d30",borderRadius:16,padding:20,marginTop:25}}>
<h2 style={{overflowWrap:"anywhere"}}>📦 {archive}</h2><p style={{color:"#94a3b8"}}>{files.length} files · {entries.filter(x=>x.dir).length} folders · {format(files.every(x=>x.size!==null)?files.reduce((sum,x)=>sum+(x.size||0),0):null)} uncompressed</p>
<div style={{display:"flex",gap:10,flexWrap:"wrap",margin:"18px 0"}}><input aria-label="Search files" placeholder="Search files and folders…" value={query} onChange={e=>setQuery(e.target.value)} style={{flex:"1 1 220px",padding:12,borderRadius:9,border:"1px solid #475569",background:"#0b1220",color:"white"}}/><select aria-label="Filter file type" value={filter} onChange={e=>setFilter(e.target.value as Kind)} style={{padding:12,borderRadius:9,border:"1px solid #475569",background:"#0b1220",color:"white"}}><option value="all">All file types</option><option value="pdf">PDFs</option><option value="image">Images</option><option value="text">Text and code</option><option value="other">Other files</option></select></div>
<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><button disabled={busy} onClick={()=>{setFolder("");setQuery("");setFilter("all")}} style={buttonStyle}>Root</button>{!active&&folder&&<button disabled={busy} style={buttonStyle} onClick={()=>{const parts=folder.replace(/\/$/,"").split("/");parts.pop();setFolder(parts.length?parts.join("/")+"/":"")}}>← Back</button>}<span style={{color:"#94a3b8",overflowWrap:"anywhere"}}>{active?"Search results":folder||"All files"}</span></div>
{visible.length===0&&<p style={{color:"#94a3b8"}}>No matching files.</p>}
{visible.map(entry=><div key={entry.path} style={{display:"flex",gap:10,alignItems:"center",borderBottom:"1px solid #293449",padding:"12px 0",flexWrap:"wrap"}}>
<input aria-label={"Select "+entry.path} type="checkbox" checked={entry.dir?files.filter(x=>x.path.startsWith(entry.path)).every(x=>selection.has(x.path)):selection.has(entry.path)} onChange={()=>toggle(entry)}/>
<button style={{flex:"1 1 160px",minWidth:0,textAlign:"left",background:"none",border:0,color:"#e5e7eb",cursor:"pointer",overflowWrap:"anywhere"}} onClick={()=>entry.dir?(setFolder(entry.path),setQuery(""),setFilter("all")):void openPreview(entry)}>{entry.dir?"📁":"📄"} {active?entry.path:entry.path.slice(folder.length).replace(/\/$/,"")}</button>
<span style={{fontSize:12,color:"#94a3b8"}}>{entry.dir?"Folder":format(entry.size)}</span>
{entry.dir?<button disabled={busy} style={buttonStyle} onClick={()=>void downloadZip(files.filter(x=>x.path.startsWith(entry.path)),filename(entry.path)+".zip")}>Download folder</button>:<><button disabled={busy||kind(entry.path)==="other"} style={{...buttonStyle,background:"#334155"}} onClick={()=>void openPreview(entry)}>Preview</button><button disabled={busy} style={buttonStyle} onClick={()=>void downloadFile(entry)}>Download</button></>}
</div>)}
<div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center",marginTop:20}}><div><span>{selected.length} selected</span> <button style={{...buttonStyle,background:"#334155",marginLeft:8}} onClick={()=>setSelected(files.map(x=>x.path))}>Select all</button> <button style={{...buttonStyle,background:"#334155"}} onClick={()=>setSelected([])}>Clear</button></div><button disabled={busy||!selected.length} style={buttonStyle} onClick={()=>void downloadZip(files.filter(x=>selection.has(x.path)),archive.replace(/\.zip$/i,"")+"-selected.zip")}>Download selected ZIP ↓</button></div>
</section>}
{preview&&<div role="dialog" aria-label={"Preview "+preview.path} style={{position:"fixed",inset:0,zIndex:20,background:"rgba(0,0,0,.83)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><section style={{background:"#141d30",width:"min(900px,100%)",maxHeight:"90vh",borderRadius:14,padding:18,display:"flex",flexDirection:"column",gap:12}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}><strong style={{overflowWrap:"anywhere"}}>{preview.path}</strong><button autoFocus onClick={()=>setPreview(null)} style={buttonStyle}>Close ✕</button></div>{preview.type==="text"?<pre style={{whiteSpace:"pre-wrap",overflow:"auto",background:"#0b1220",padding:15,maxHeight:"70vh",fontSize:13}}>{preview.text}</pre>:preview.type==="image"?<img alt={"Preview of "+preview.path} src={preview.url} style={{maxWidth:"100%",maxHeight:"72vh",objectFit:"contain",alignSelf:"center"}}/>:<iframe title={"PDF preview "+preview.path} src={preview.url} sandbox="" style={{width:"100%",height:"70vh",border:0,background:"white"}}/>}</section></div>}
<footer style={{textAlign:"center",padding:35,color:"#64748b"}}>Processed on your device · No uploads to a server</footer>
</main>}
