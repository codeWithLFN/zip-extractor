"use client";
import {useState} from "react";
import JSZip from "jszip";
type Item={path:string,dir:boolean,file:JSZip.JSZipObject};
export default function Home(){
const [items,setItems]=useState<Item[]>([]),[name,setName]=useState(""),[folder,setFolder]=useState(""),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
const files=items.filter(x=>!x.dir);
async function load(f?:File){if(!f)return;setError("");setBusy(true);try{
if(!f.name.toLowerCase().endsWith(".zip"))throw Error("Please select a ZIP file.");
if(f.size>300*1024*1024)throw Error("ZIP file exceeds 300 MB.");
const z=await JSZip.loadAsync(f);const entries=Object.values(z.files).filter(x=>!x.name.startsWith("/")&&!x.name.split("/").includes("..")&&!/^[A-Za-z]:/.test(x.name));
if(entries.length>10000)throw Error("Archive contains too many files.");
setItems(entries.map(x=>({path:x.name,dir:x.dir,file:x})));setSelected(entries.filter(x=>!x.dir).map(x=>x.name));setName(f.name);setFolder("");
}catch(e){setError(e instanceof Error?e.message:"Could not read archive");}finally{setBusy(false)}}
function save(blob:Blob,filename:string){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
async function single(x:Item){setBusy(true);try{const bytes=await x.file.async("uint8array");save(new Blob([new Uint8Array(bytes)]),x.path.split("/").pop()||"file")}catch{setError("Unable to extract this file.")}finally{setBusy(false)}}
async function bundle(){setBusy(true);setError("");try{const z=new JSZip();for(const x of files.filter(x=>selected.includes(x.path))){const bytes=await x.file.async("uint8array");z.file(x.path,new Uint8Array(bytes))}save(await z.generateAsync({type:"blob"}),name.replace(/\.zip$/i,"")+"-extracted.zip")}catch{setError("Unable to create download ZIP.")}finally{setBusy(false)}}
const shown=items.filter(x=>x.path.startsWith(folder)&&x.path!==folder&&x.path.slice(folder.length).replace(/\/$/,"").split("/").length===1);
const btn={background:"#6366f1",color:"white",border:0,borderRadius:10,padding:"12px 18px",cursor:"pointer"} as const;
return <main style={{maxWidth:900,margin:"auto",padding:"35px 22px"}}>
<header style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2>▣ zip<span style={{color:"#818cf8"}}>extractor</span></h2><small style={{color:"#2dd4bf"}}>● Files stay on your device</small></header>
<section style={{textAlign:"center",padding:"45px 0 25px"}}><h1 style={{fontSize:"clamp(38px,7vw,64px)",marginBottom:10}}>Unzip. Explore.<br/><span style={{color:"#818cf8"}}>Get what you need.</span></h1><p style={{color:"#94a3b8"}}>Browse and extract files for your ChatGPT Projects, privately in your browser.</p></section>
<label onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void load(e.dataTransfer.files[0])}} style={{display:"block",textAlign:"center",border:"2px dashed #6366f1",borderRadius:18,padding:45,background:"#141d30",cursor:"pointer"}}><div style={{fontSize:35}}>⇧</div><h2>Drop your ZIP file here</h2><p style={{color:"#94a3b8"}}>or click to browse · Up to 300 MB</p><span style={btn}>Choose ZIP file</span><input type="file" accept=".zip" style={{display:"none"}} onChange={e=>{void load(e.target.files?.[0]);e.target.value=""}}/></label>
{error&&<p role="alert" style={{color:"#fda4af"}}>{error}</p>}{busy&&<p>Processing…</p>}
{name&&<section style={{background:"#141d30",borderRadius:18,marginTop:28,padding:24}}><h2>📦 {name}</h2><p style={{color:"#94a3b8"}}>{files.length} files · {items.filter(x=>x.dir).length} folders</p>
<div style={{margin:"20px 0"}}><button style={btn} onClick={()=>setFolder("")}>Root</button> <span style={{color:"#94a3b8"}}>{folder}</span></div>
{shown.map(x=><div key={x.path} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 4px",borderBottom:"1px solid #273349"}}>
<input type="checkbox" checked={x.dir?files.filter(y=>y.path.startsWith(x.path)).every(y=>selected.includes(y.path)):selected.includes(x.path)} onChange={()=>{const targets=x.dir?files.filter(y=>y.path.startsWith(x.path)).map(y=>y.path):[x.path];setSelected(prev=>targets.every(t=>prev.includes(t))?prev.filter(t=>!targets.includes(t)):[...new Set([...prev,...targets])])}}/>
<button onClick={()=>x.dir?setFolder(x.path):void single(x)} style={{background:"none",border:0,color:"#e5e7eb",cursor:"pointer",textAlign:"left",flex:1,fontSize:15}}>{x.dir?"📁":"📄"} {x.path.slice(folder.length).replace(/\/$/,"")}</button>{!x.dir&&<button onClick={()=>void single(x)} disabled={busy} style={{...btn,padding:"8px 12px"}}>Download</button>}</div>)}
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",paddingTop:22}}><span>{selected.length} selected</span><button style={btn} disabled={busy||!selected.length} onClick={()=>void bundle()}>Download selected ZIP ↓</button></div></section>}
<footer style={{textAlign:"center",padding:40,color:"#64748b"}}>Private by default · No account required</footer></main>}
