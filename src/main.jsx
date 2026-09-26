import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Search, Boxes, Sparkles, Code2, Image, FileText, Calculator, Menu, X, Sun, Moon } from "lucide-react";
import "./styles.css";

const categories = [
  ["All Tools", Boxes], ["AI & Smart", Sparkles], ["Developer", Code2],
  ["Images", Image], ["Documents", FileText], ["Calculators", Calculator]
];

const tools = [];

function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Tools");
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState(false);
  const filtered = useMemo(() => tools.filter((tool) =>
    (category === "All Tools" || tool.category === category) &&
    tool.name.toLowerCase().includes(query.toLowerCase())
  ), [query, category]);

  return <div className={dark ? "app dark" : "app"}>
    <header className="header">
      <a className="brand" href="#top"><span className="brandIcon"><Boxes size={18} /></span>ToolLoot</a>
      <nav className={menu ? "nav open" : "nav"}>
        <a href="#tools" onClick={() => setMenu(false)}>Tools</a>
        <a href="#categories" onClick={() => setMenu(false)}>Categories</a>
        <a href="#about" onClick={() => setMenu(false)}>About</a>
      </nav>
      <div className="headerActions">
        <button className="iconButton" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button className="iconButton mobileMenu" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X size={19} /> : <Menu size={19} />}</button>
      </div>
    </header>

    <main id="top">
      <section className="hero">
        <div className="container heroInner">
          <div className="eyebrow">TOOLLOOT</div>
          <h1>Useful tools, all in one place.</h1>
          <p>Simple, fast and free-to-use tools for everyday work.</p>
          <label className="searchBox">
            <Search size={20} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tools..." />
          </label>
        </div>
      </section>

      <section className="container section" id="categories">
        <div className="sectionHead"><div><h2>Categories</h2><p>Browse tools by category.</p></div></div>
        <div className="categoryRow">
          {categories.map(([name, Icon]) => <button key={name} className={category === name ? "category active" : "category"} onClick={() => setCategory(name)}><Icon size={17} />{name}</button>)}
        </div>
      </section>

      <section className="container section" id="tools">
        <div className="sectionHead"><div><h2>Tools</h2><p>{filtered.length} available</p></div></div>
        {filtered.length ? <div className="toolGrid">{filtered.map(tool => <article className="toolCard" key={tool.id}><h3>{tool.name}</h3><p>{tool.description}</p></article>)}</div> :
          <div className="empty"><Boxes size={30} /><h3>No tools added yet</h3><p>The platform is ready. New tools will appear here as they are added.</p></div>}
      </section>

      <section className="container section about" id="about">
        <h2>About ToolLoot</h2>
        <p>ToolLoot is a simple, dynamic home for useful web tools. The platform is designed so new tools can be added without rebuilding the whole site.</p>
        <div className="aboutGrid"><div><strong>Dynamic registry</strong><span>Tools and categories are managed from one reusable foundation.</span></div><div><strong>Ready for PWA</strong><span>Responsive, install-ready structure for desktop and mobile.</span></div><div><strong>Future-ready</strong><span>Prepared for APIs, engines and additional services later.</span></div></div>
      </section>
    </main>

    <footer><div className="container footerInner"><span>© 2026 ToolLoot</span><span>Simple tools. No clutter.</span></div></footer>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
