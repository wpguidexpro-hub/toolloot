import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Search, Boxes, Sparkles, Code2, Image, FileText, Calculator,
  Menu, X, Sun, Moon, Upload, Download, SlidersHorizontal, RotateCcw
} from "lucide-react";
import "./styles.css";

const categories = [
  ["All Tools", Boxes], ["AI & Smart", Sparkles], ["Developer", Code2],
  ["Images", Image], ["Documents", FileText], ["Calculators", Calculator]
];

const tools = [
  { id: "image-compressor", name: "Image Compressor", description: "Compress JPG, PNG and WebP images in your browser.", category: "Images", path: "/tools/image-compressor" }
];

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / 1024 ** i).toFixed(i ? 2 : 0) + " " + units[i];
}

function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Tools");
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState(false);
  const filtered = useMemo(() => tools.filter(t =>
    (category === "All Tools" || t.category === category) &&
    (t.name + " " + t.description).toLowerCase().includes(query.toLowerCase())
  ), [query, category]);
  return <div className={dark ? "app dark" : "app"}>
    <header className="header">
      <a className="brand" href="#top"><span className="brandIcon"><Boxes size={18}/></span>ToolLoot</a>
      <nav className={menu ? "nav open" : "nav"}>
        <a href="#tools" onClick={() => setMenu(false)}>Tools</a>
        <a href="#categories" onClick={() => setMenu(false)}>Categories</a>
        <a href="#about" onClick={() => setMenu(false)}>About</a>
      </nav>
      <div className="headerActions">
        <button className="iconButton" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
        <button className="iconButton mobileMenu" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X size={19}/> : <Menu size={19}/>}</button>
      </div>
    </header>
    <main id="top">
      <section className="hero"><div className="container heroInner">
        <div className="eyebrow">TOOLLOOT</div><h1>Useful tools, all in one place.</h1>
        <p>Simple, fast and free-to-use tools for everyday work.</p>
        <label className="searchBox"><Search size={20}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tools..."/></label>
      </div></section>
      <section className="container section" id="categories">
        <div className="sectionHead"><div><h2>Categories</h2><p>Browse tools by category.</p></div></div>
        <div className="categoryRow">{categories.map(([name, Icon]) =>
          <button key={name} className={category === name ? "category active" : "category"} onClick={() => setCategory(name)}><Icon size={17}/>{name}</button>)}</div>
      </section>
      <section className="container section" id="tools">
        <div className="sectionHead"><div><h2>Tools</h2><p>{filtered.length} available</p></div></div>
        <div className="toolGrid">{filtered.map(tool =>
          <a className="toolCard" href={tool.path} key={tool.id}><div className="toolIcon"><Image size={20}/></div><h3>{tool.name}</h3><p>{tool.description}</p><span className="toolLink">Open tool →</span></a>)}</div>
      </section>
      <section className="container section about" id="about">
        <h2>About ToolLoot</h2><p>Simple browser-based tools with a clean, reusable foundation.</p>
      </section>
    </main><footer><div className="container footerInner"><span>© 2026 ToolLoot</span><span>Simple tools. No clutter.</span></div></footer>
  </div>;
}

function ImageCompressor() {
  const [files, setFiles] = useState([]);
  const [quality, setQuality] = useState(0.7);
  const [maxWidth, setMaxWidth] = useState(0);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  const addFiles = e => { setFiles(Array.from(e.target.files || [])); setResults([]); };

  async function compress() {
    if (!files.length) return;
    setBusy(true);
    const output = [];
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await new Promise(resolve => { img.onload = resolve; });
      const scale = maxWidth && img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const type = file.type === "image/png" ? "image/png" : "image/jpeg";
      const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
      output.push({ name: file.name.replace(/\.[^.]+$/, "") + "-compressed." + (type === "image/png" ? "png" : "jpg"), blob, original: file.size });
      URL.revokeObjectURL(url);
    }
    setResults(output); setBusy(false);
  }

  return <div className="toolPage">
    <div className="container toolPageInner">
      <a className="backLink" href="#top">← Back to ToolLoot</a>
      <div className="toolTitle"><div className="toolIcon large"><Image size={24}/></div><div><h1>Image Compressor</h1><p>Reduce image file size directly in your browser. Your images stay on your device.</p></div></div>
      <div className="compressor">
        <label className="dropZone"><Upload size={28}/><strong>{files.length ? files.length + " image(s) selected" : "Choose images"}</strong><span>JPG, PNG or WebP</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addFiles}/></label>
        <div className="settings">
          <label>Quality <b>{Math.round(quality * 100)}%</b><input type="range" min=".1" max="1" step=".05" value={quality} onChange={e => setQuality(Number(e.target.value))}/></label>
          <label>Max width <b>{maxWidth ? maxWidth + " px" : "Original"}</b><input type="range" min="0" max="3000" step="100" value={maxWidth} onChange={e => setMaxWidth(Number(e.target.value))}/></label>
          <button className="primaryButton" disabled={!files.length || busy} onClick={compress}>{busy ? "Compressing..." : "Compress images"}</button>
        </div>
      </div>
      {results.length > 0 && <div className="results"><h2>Compressed images</h2>{results.map(item =>
        <div className="resultRow" key={item.name}><div><strong>{item.name}</strong><span>{formatBytes(item.original)} → {formatBytes(item.blob.size)}</span></div>
          <a className="downloadButton" href={URL.createObjectURL(item.blob)} download={item.name}><Download size={17}/>Download</a></div>)}</div>}
      <div className="privacyNote"><SlidersHorizontal size={17}/><span>Compression runs locally in your browser. No upload or server is required.</span></div>
    </div></div>;
}

function Root() {
  const path = window.location.pathname;
  return path.endsWith("/tools/image-compressor") ? <ImageCompressor/> : <App/>;
}
createRoot(document.getElementById("root")).render(<Root/>);
