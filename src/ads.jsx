import React from "react";
import { Megaphone } from "lucide-react";
export function AdSlot({slot="toolloot-default",className=""}){
 const publisher=import.meta.env.VITE_ADSENSE_CLIENT;
 return <aside className={"tlAdSlot "+className} data-ad-slot={slot}>
  {publisher?<><ins className="adsbygoogle" style={{display:"block"}} data-ad-client={publisher} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true"/><span>Advertisement</span></>:<><Megaphone size={15}/><span>Ad space · monetization ready</span></>}
 </aside>
}
