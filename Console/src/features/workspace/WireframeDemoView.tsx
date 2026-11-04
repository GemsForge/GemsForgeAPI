import { useState } from "react";

const places = [
  ["Amalfi Coast", "Italy", "Coast · Food", "#e8b17d"],
  ["Canadian Rockies", "Canada", "Mountains · Hiking", "#a8d2cf"],
  ["Kyoto", "Japan", "Culture · Temples", "#e8b3b7"],
  ["Santorini", "Greece", "Islands · Views", "#9dc9e0"],
  ["Lisbon", "Portugal", "Cities · Food", "#e4b27d"],
  ["Bali", "Indonesia", "Beaches · Nature", "#9ed5bd"],
  ["Lake Como", "Italy", "Lakes · Luxury", "#9bbfc7"],
  ["Cappadocia", "Türkiye", "History · Unique", "#e3b0a5"],
  ["Bora Bora", "French Polynesia", "Islands · Snorkeling", "#75c7c9"],
] as const;

type ViewMode = "table" | "list" | "gallery";

export function WireframeDemoView() {
  const [view, setView] = useState<ViewMode>("gallery");
  const [selected, setSelected] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const place = places[selected];
  return (
    <section className={`wireframe-demo ${expanded ? "is-expanded" : ""}`} aria-labelledby="wireframe-demo-title">
      <aside className="wireframe-demo-sidebar">
        <div className="demo-brand">
          <span className="demo-brand-mark">◆</span>
          <strong>GemsForge</strong>
        </div>
        <label className="demo-search">
          <span aria-hidden="true">⌕</span>
          <input aria-label="Search workspace" placeholder="Search anything…" />
          <kbd>⌘ K</kbd>
        </label>
        <nav aria-label="Demo navigation" className="demo-nav">
          {["⌂ Home", "✉ Inbox", "◷ Today", "☆ Starred", "▣ All collections"].map((item) => (
            <button type="button" key={item}>
              {item}
            </button>
          ))}
        </nav>
        <p className="demo-sidebar-label">
          My collections <span>＋</span>
        </p>
        <nav aria-label="Demo collections" className="demo-collections">
          {[
            "Travel Library",
            "Recipes",
            "Books",
            "Design Inspiration",
            "Personal Finance",
            "Wellness",
            "Home & Living",
            "Work Resources",
          ].map((item, index) => (
            <button className={index === 0 ? "active" : ""} type="button" key={item}>
              {" "}
              <span>{["◈", "♜", "▤", "▧", "▥", "♧", "⌂", "▣"][index]}</span>
              {item}
              <small>{[24, 12, 18, 36, 14, 9, 11, 27][index]}</small>
            </button>
          ))}
        </nav>
        <div className="demo-decision">
          ◫{" "}
          <span>
            Dual navigation —<br />
            <strong>recommended, not yet chosen</strong>
          </span>
        </div>
        <button type="button" className="demo-trash">
          ♜ Trash <small>3</small>
        </button>
        <div className="demo-sidebar-settings">
          <button
            type="button"
            className="demo-trash"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            ⚙ Application Settings
          </button>
          {settingsOpen ? (
            <div className="demo-settings-panel" role="dialog" aria-label="Application settings">
              <strong>Application settings</strong>
              <button type="button" onClick={() => setSettingsOpen(false)}>
                Theme <span>System⌄</span>
              </button>
              <button type="button" onClick={() => setSettingsOpen(false)}>
                Density <span>Comfortable⌄</span>
              </button>
              <button type="button" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>
          ) : null}
        </div>
      </aside>
      <main className="wireframe-demo-main">
        <header className="demo-collection-header">
          <div className="demo-collection-title">
            <span className="demo-collection-icon">➤</span>
            <div>
              <h2 id="wireframe-demo-title">Travel Library</h2>
              <p>Places, plans, notes and inspiration from around the world.</p>
            </div>
          </div>
          <span className="demo-record-count">24 records</span>
          <button type="button" className="demo-icon-button" aria-label="More collection actions">
            •••
          </button>
        </header>
        <div className="demo-toolbar">
          <div className="demo-view-tabs">
            {(["table", "list", "gallery"] as const).map((mode) => (
              <button className={view === mode ? "active" : ""} type="button" onClick={() => setView(mode)} key={mode}>
                {mode === "table" ? "▣" : mode === "list" ? "☷" : "▦"} {mode[0].toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <label className="demo-collection-search">
            ⌕ <input aria-label="Search this collection" placeholder="Search this collection…" />
          </label>
          <button type="button" className="demo-filter">
            ≡
          </button>
          <button type="button" className="demo-sort">
            ↕ Sort⌄
          </button>
        </div>
        <div className={`demo-results demo-${view}`} role="list" aria-label="Travel Library records">
          {places.map((item, index) => (
            <button
              type="button"
              className={`demo-place-card ${selected === index ? "selected" : ""}`}
              onClick={() => setSelected(index)}
              key={item[0]}
            >
              <span
                className="demo-place-image"
                style={{ background: `linear-gradient(135deg, ${item[3]}, #527b82)` }}
                aria-hidden="true"
              />
              <span className="demo-place-copy">
                <strong>{item[0]}</strong>
                <small>{item[1]}</small>
                <em>{item[2]}</em>
                <small className="demo-place-meta">
                  ◷ {index % 2 ? "Sep 2023" : "Apr 2024"} ▤ {index + 3}
                </small>
              </span>
            </button>
          ))}
        </div>
      </main>
      <aside className="wireframe-demo-inspector">
        <div className="demo-inspector-heading">
          <div>
            <p>{expanded ? "Record page" : "Record inspector"}</p>
            <h3>{place[0]}</h3>
          </div>
          <div className="demo-inspector-actions">
            {expanded ? (
              <button
                type="button"
                aria-label="Back to collection"
                title="Back to collection"
                onClick={() => setExpanded(false)}
              >
                ←
              </button>
            ) : (
              <button
                type="button"
                aria-label="Open full page"
                title="Open full page"
                onClick={() => setExpanded(true)}
              >
                ↗
              </button>
            )}
            <button type="button" aria-label="Close inspector">
              ×
            </button>
          </div>
        </div>
        {expanded ? (
          <div className="demo-expanded-breadcrumb">
            Travel Library <span>›</span> Places <span>›</span> {place[0]}
          </div>
        ) : null}
        <div className="demo-cover" style={{ background: `linear-gradient(135deg, ${place[3]}, #406f74)` }} />
        {expanded ? (
          <div className="demo-expanded-title">
            <p className="demo-eyebrow">Travel Library · place record</p>
            <h1>{place[0]}</h1>
            <p>
              {place[1]} · {place[2]}
            </p>
          </div>
        ) : null}
        <button type="button" className="demo-secondary-button">
          ▧ Change cover
        </button>
        <dl>
          <div>
            <dt>Title</dt>
            <dd>{place[0]}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>⌖ {place[1]}</dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd>
              <span>{place[2].split(" · ")[0]}</span>
              <span>{place[2].split(" · ")[1]}</span>
            </dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>▣ Apr 2024</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>Stunning places, charming details, and a perfect mix of culture, nature and discovery.</dd>
          </div>
        </dl>
        {expanded ? (
          <div className="demo-expanded-content">
            <h4>About this place</h4>
            <p>
              Capture the details that make this place worth remembering, then connect it to plans, references, and
              future ideas.
            </p>
          </div>
        ) : null}
        <h4>
          Attachments <button type="button">＋ Add</button>
        </h4>
        <ul className="demo-attachments">
          <li>
            ▧ Amalfi_View.jpg <small>2.4 MB · Image</small>
          </li>
          <li>
            ▤ Itinerary.pdf <small>1.1 MB · PDF</small>
          </li>
          <li>
            ◫ Places to Visit <small>4 items · Note</small>
          </li>
        </ul>
        {expanded ? (
          <div className="demo-page-actions">
            <button type="button" className="demo-secondary-button">
              Edit record
            </button>
            <button type="button" className="demo-secondary-button">
              Share page
            </button>
          </div>
        ) : null}
      </aside>
    </section>
  );
}
