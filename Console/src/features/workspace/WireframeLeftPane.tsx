type WireframeLeftPaneProps = {
  recordCount: number;
  activeCollection?: string;
};

export function WireframeLeftPane({ recordCount, activeCollection = "Education" }: WireframeLeftPaneProps) {
  const navigation = ["⌂ Home", "✦ Workspace", "◇ Domains", "⌁ ForgeKeeper"];
  const collections = ["Gem Hues", "Education", "Employment", "Addresses", "Expense Tracker", "Services"];

  return (
    <aside className="wireframe-demo-sidebar" aria-label="Workspace navigation">
      <div className="demo-brand"><span className="demo-brand-mark">◆</span><strong>GemsForge</strong></div>
      <label className="demo-search"><span aria-hidden="true">⌕</span><input aria-label="Search workspace" placeholder="Search anything…" /><kbd>⌘ K</kbd></label>
      <nav aria-label="Primary navigation" className="demo-nav">{navigation.map((item) => <button type="button" key={item}>{item}</button>)}</nav>
      <p className="demo-sidebar-label">Collections <span aria-hidden="true">＋</span></p>
      <nav className="demo-collections" aria-label="Collections">{collections.map((item) => <button className={item === activeCollection ? "active" : ""} type="button" key={item}>◈ {item}<small>{item === activeCollection ? recordCount : "—"}</small></button>)}</nav>
      <div className="demo-decision">◫ <span>Dual navigation —<br /><strong>recommended, not yet chosen</strong></span></div>
      <div className="demo-sidebar-bottom"><button type="button" className="demo-trash">♜ Trash <small>3</small></button><button type="button" className="demo-trash">⚙ Application Settings</button></div>
    </aside>
  );
}
