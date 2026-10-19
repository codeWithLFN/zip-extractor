import type {ReactNode} from "react";
export const metadata={title:"ZIP Extractor",description:"Private browser-based ZIP explorer"};
export default function Layout({children}:{children:ReactNode}){return <html lang="en"><body style={{margin:0,background:"#0b1220",color:"#e5e7eb",fontFamily:"Arial,sans-serif"}}>{children}</body></html>}