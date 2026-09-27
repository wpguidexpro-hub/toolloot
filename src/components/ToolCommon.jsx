import React from "react";
import { Trash2, Plus, Download } from "lucide-react";

export function ToolWorkspace({ children, className="" }) {
  return <div className={`toolWorkspace ${className}`.trim()}>{children}</div>;
}
export function ToolFileActions({ onAdd, onClear, clearDisabled=false, addLabel="Add more files", clearLabel="Clear all" }) {
  return <div className="toolFileActions">
    {onAdd && <button type="button" className="secondaryButton" onClick={onAdd}><Plus size={14}/>{addLabel}</button>}
    {onClear && <button type="button" className="textButton" onClick={onClear} disabled={clearDisabled}><Trash2 size={14}/>{clearLabel}</button>}
  </div>;
}
export function ToolDownload({ href, download, children="Download" }) {
  return <a className="downloadButton" href={href} download={download}><Download size={15}/>{children}</a>;
}
