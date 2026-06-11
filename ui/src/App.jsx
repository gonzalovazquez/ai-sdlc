import { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

// Palette lifted from the accompanying PowerPoint deck (cncf-langgraph-agents.pptx)
const COLORS = {
  bg: "#0A1628",
  card: "#13233d",
  cardHover: "#1a2e4d",
  border: "#1f3354",
  tealDeep: "#028090",
  teal: "#00A896",
  tealBright: "#02C39A",
  white: "#f8f9fa",
  gray: "#94A3B8",
  grayDark: "#475569",
  gold: "#f4a261",
  red: "#e63946",
};

const fonts = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
`;

const SLIDES = [
  "hero",
  "problem",
  "sdlc",
  "architecture",
  "agents",
  "graph",
  "cncf",
  "demo",
  "thankyou",
];

const REPO_URL = "https://github.com/gonzalovazquez/ai-sdlc";

// ─── Utility: Intersection Observer Hook ───
function useInView(threshold = 0.2) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

// ─── Animated Counter ───
function Counter({ end, duration = 1500, suffix = "", prefix = "", inView }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = end / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= end) { setVal(end); clearInterval(id); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(id);
  }, [inView, end, duration]);
  return <span>{prefix}{val}{suffix}</span>;
}

// ─── Section Wrapper ───
function Section({ id, children, style = {} }) {
  const [ref, inView] = useInView(0.1);
  return (
    <section
      ref={ref}
      id={id}
      style={{
        minHeight: "100vh",
        padding: "100px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.bg,
        position: "relative",
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(40px)",
        transition: "opacity 0.8s ease, transform 0.8s ease",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function SectionTitle({ kicker, title, subtitle }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 56, maxWidth: 900 }}>
      {kicker && (
        <div style={{
          fontFamily: "'JetBrains Mono'", fontSize: 12, color: COLORS.tealBright,
          letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16,
        }}>{kicker}</div>
      )}
      <h2 style={{
        fontFamily: "'Outfit'", fontWeight: 800, fontSize: "clamp(32px, 4.5vw, 52px)",
        color: COLORS.white, margin: "0 0 12px", lineHeight: 1.1,
      }}>{title}</h2>
      {subtitle && (
        <p style={{
          fontFamily: "'Outfit'", fontWeight: 300, fontSize: "clamp(16px, 2vw, 20px)",
          color: COLORS.gray, margin: 0,
        }}>{subtitle}</p>
      )}
    </div>
  );
}

// ─── Navigation ───
function Nav({ active, presentationMode }) {
  const items = [
    { id: "hero", label: "Home" },
    { id: "problem", label: "Problem" },
    { id: "sdlc", label: "AI-Native SDLC" },
    { id: "architecture", label: "Architecture" },
    { id: "agents", label: "Agents" },
    { id: "graph", label: "State Machine" },
    { id: "cncf", label: "CNCF" },
    { id: "demo", label: "Demo" },
    { id: "thankyou", label: "Thank You" },
  ];

  if (presentationMode) return null;

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(10,22,40,0.85)", backdropFilter: "blur(16px)",
      borderBottom: `1px solid ${COLORS.border}`,
      display: "flex", justifyContent: "center", gap: 6, padding: "12px 16px",
      flexWrap: "wrap",
    }}>
      <span style={{
        fontFamily: "'JetBrains Mono'", fontWeight: 700, color: COLORS.tealBright,
        fontSize: 14, marginRight: "auto", paddingLeft: 8,
        letterSpacing: "0.05em",
      }}>CNCF Toronto 2026</span>
      {items.map(it => (
        <a key={it.id} href={`#${it.id}`} style={{
          color: active === it.id ? COLORS.tealBright : COLORS.gray,
          textDecoration: "none", fontSize: 13, fontFamily: "'Outfit'",
          fontWeight: active === it.id ? 600 : 400,
          padding: "4px 12px", borderRadius: 6,
          background: active === it.id ? "rgba(2,195,154,0.1)" : "transparent",
          transition: "all 0.2s",
        }}>{it.label}</a>
      ))}
    </nav>
  );
}

// ─── Slide Indicator (presentation mode) ───
function SlideIndicator({ current, total }) {
  return (
    <div style={{
      position: "fixed", right: 24, top: "50%", transform: "translateY(-50%)",
      zIndex: 200, display: "flex", flexDirection: "column", gap: 8, alignItems: "center",
    }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i === current ? 10 : 6,
          height: i === current ? 10 : 6,
          borderRadius: "50%",
          background: i === current ? COLORS.tealBright : COLORS.grayDark,
          transition: "all 0.3s ease",
          boxShadow: i === current ? `0 0 8px ${COLORS.tealBright}` : "none",
        }} />
      ))}
      <div style={{
        fontFamily: "'JetBrains Mono'", fontSize: 10, color: COLORS.gray, marginTop: 4,
      }}>
        {current + 1}/{total}
      </div>
    </div>
  );
}

// ─── Presentation Controls Hint ───
function PresentationHint({ visible }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 200, display: "flex", gap: 16, alignItems: "center",
      background: "rgba(10,22,40,0.9)", backdropFilter: "blur(12px)",
      padding: "8px 20px", borderRadius: 8,
      border: `1px solid ${COLORS.border}`,
      opacity: visible ? 1 : 0,
      transition: "opacity 0.5s ease",
      pointerEvents: "none",
    }}>
      {[
        { keys: "← →", label: "Navigate" },
        { keys: "Space", label: "Next" },
        { keys: "F", label: "Fullscreen" },
        { keys: "Esc", label: "Exit" },
      ].map(h => (
        <div key={h.keys} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontFamily: "'JetBrains Mono'", fontSize: 10, color: COLORS.tealBright,
            background: "rgba(2,195,154,0.15)", padding: "2px 8px", borderRadius: 4,
          }}>{h.keys}</span>
          <span style={{ fontFamily: "'Outfit'", fontSize: 11, color: COLORS.gray }}>{h.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Slide 1: Hero ───
function Hero() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 100); }, []);
  return (
    <section id="hero" style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center",
      background: `radial-gradient(ellipse at 50% 30%, #11294a 0%, ${COLORS.bg} 70%)`,
      padding: "60px 24px", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.06,
        backgroundImage: `linear-gradient(${COLORS.teal} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.teal} 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />
      <div style={{
        position: "absolute", top: "20%", left: "50%", transform: "translate(-50%,-50%)",
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(2,195,154,0.12) 0%, transparent 70%)",
        filter: "blur(60px)",
      }} />
      <div style={{
        position: "relative", zIndex: 1,
        opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(30px)",
        transition: "all 1s ease 0.2s",
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono'", fontSize: 13, color: COLORS.tealBright,
          letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 24,
          background: "rgba(2,195,154,0.1)", display: "inline-block",
          padding: "6px 20px", borderRadius: 20, border: "1px solid rgba(2,195,154,0.2)",
        }}>CNCF Toronto &middot; June 11, 2026</div>
        <h1 style={{
          fontFamily: "'Outfit'", fontWeight: 900, fontSize: "clamp(42px, 7vw, 86px)",
          color: COLORS.white, lineHeight: 1.05, margin: "16px 0", maxWidth: 860,
        }}>
          Building apps <span style={{ color: COLORS.tealBright }}>with AI agents</span>
        </h1>
        <p style={{
          fontFamily: "'Outfit'", fontWeight: 300, fontSize: "clamp(18px, 2.5vw, 26px)",
          color: COLORS.teal, margin: "12px 0 32px",
        }}>
          A LangGraph pipeline from idea to deploy
        </p>
        <div style={{ fontFamily: "'Outfit'", fontSize: 15, color: COLORS.gray, marginBottom: 40 }}>
          Gonzalo Vazquez &middot; Director, Cloud Engineering &middot; RBC
        </div>
        <a href="#problem" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: COLORS.tealBright, color: COLORS.bg, fontFamily: "'Outfit'",
          fontWeight: 600, fontSize: 15, padding: "14px 32px", borderRadius: 8,
          textDecoration: "none", boxShadow: "0 4px 24px rgba(2,195,154,0.3)",
        }}>
          Explore the Pipeline &#8595;
        </a>
      </div>
    </section>
  );
}

// ─── Slide 2: Problem ───
function ProblemSection() {
  const [ref, inView] = useInView(0.3);
  const stats = [
    { end: 70, suffix: "%", label: "of dev time is spent on boilerplate + context switching" },
    { text: "3–6mo", label: "average MVP time-to-market" },
    { end: 45, suffix: "%", label: "of project cost is coordination overhead" },
  ];
  return (
    <Section id="problem">
      <SectionTitle
        kicker="The problem"
        title="Software development is expensive and slow"
      />
      <div ref={ref} style={{
        display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center", maxWidth: 1000,
      }}>
        {stats.map((s) => (
          <div key={s.label} style={{
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 16, padding: "40px 32px", width: 280, textAlign: "center",
          }}>
            <div style={{
              fontFamily: "'Outfit'", fontWeight: 900, fontSize: 64,
              color: COLORS.tealBright, lineHeight: 1,
            }}>
              {s.text ? s.text : <Counter end={s.end} suffix={s.suffix} inView={inView} />}
            </div>
            <div style={{
              fontFamily: "'Outfit'", fontSize: 15, color: COLORS.gray, marginTop: 16, lineHeight: 1.5,
            }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 56, maxWidth: 760, textAlign: "center",
        background: "rgba(2,195,154,0.08)", border: "1px solid rgba(2,195,154,0.25)",
        borderRadius: 12, padding: "24px 32px",
      }}>
        <p style={{
          fontFamily: "'Outfit'", fontWeight: 500, fontSize: "clamp(18px, 2.4vw, 24px)",
          color: COLORS.white, margin: 0,
        }}>
          What if AI agents handled the repetitive work across your{" "}
          <span style={{ color: COLORS.tealBright }}>entire SDLC</span>?
        </p>
      </div>
    </Section>
  );
}

// ─── Slide 3: The AI-native SDLC ───
function SDLCSection() {
  const phases = ["Ideation", "Design", "Architecture", "Code", "QA", "Release", "Infra", "Monitor"];
  const stack = [
    { name: "Next.js 15", desc: "App Router + RSC" },
    { name: "Vercel", desc: "Deploy + CDN + CI/CD" },
    { name: "Supabase", desc: "PostgreSQL + Auth + Storage" },
    { name: "Tailwind + shadcn", desc: "UI components" },
    { name: "LangGraph.js", desc: "Agent orchestration" },
    { name: "Claude API", desc: "LLM backbone" },
  ];
  return (
    <Section id="sdlc">
      <SectionTitle
        kicker="The AI-native SDLC"
        title="One pipeline, the full lifecycle"
        subtitle="A multi-agent pipeline that orchestrates the full development lifecycle"
      />
      <div style={{
        display: "flex", alignItems: "center", flexWrap: "wrap", justifyContent: "center",
        gap: 8, maxWidth: 1100, marginBottom: 12,
      }}>
        {phases.map((p, i) => (
          <div key={p} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              fontFamily: "'JetBrains Mono'", fontSize: 14, fontWeight: 600,
              color: COLORS.white, background: COLORS.card,
              border: `1px solid ${COLORS.tealDeep}`, borderRadius: 8, padding: "10px 18px",
            }}>{p}</div>
            {i < phases.length - 1 && (
              <span style={{ color: COLORS.tealBright, fontSize: 18 }}>&#8594;</span>
            )}
          </div>
        ))}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono'", fontSize: 12, color: COLORS.gold, marginBottom: 56,
      }}>
        &#8592; Feedback loop: Monitor &#8594; PM &#8594; next iteration
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 16, maxWidth: 900, width: "100%",
      }}>
        {stack.map((s) => (
          <div key={s.name} style={{
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 12, padding: "18px 24px",
            display: "flex", alignItems: "baseline", gap: 12,
          }}>
            <span style={{
              fontFamily: "'Outfit'", fontWeight: 700, fontSize: 16, color: COLORS.tealBright,
              whiteSpace: "nowrap",
            }}>{s.name}</span>
            <span style={{ fontFamily: "'Outfit'", fontSize: 14, color: COLORS.gray }}>{s.desc}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Slide 4: Architecture overview ───
function ArchitectureSection() {
  const layerStyle = {
    background: COLORS.card, border: `1px solid ${COLORS.border}`,
    borderRadius: 12, padding: "20px 28px", width: "100%", maxWidth: 860, textAlign: "center",
  };
  const agents = ["PM", "Architect", "Design", "Code", "QA", "Infra", "Release", "Monitor"];
  return (
    <Section id="architecture">
      <SectionTitle kicker="Architecture overview" title="From browser to cloud" />
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
        width: "100%", maxWidth: 860,
      }}>
        <div style={layerStyle}>
          <div style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: 18, color: COLORS.white }}>
            Next.js web app
          </div>
          <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, color: COLORS.gray, marginTop: 4 }}>
            React + SSE streaming
          </div>
        </div>
        <div style={{ color: COLORS.tealBright, fontSize: 20, padding: "6px 0" }}>&#9660;</div>
        <div style={{ ...layerStyle, border: `1px solid ${COLORS.tealDeep}` }}>
          <div style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: 18, color: COLORS.tealBright }}>
            LangGraph.js orchestrator
          </div>
          <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, color: COLORS.gray, margin: "6px 0 14px" }}>
            Stateful graph &middot; Checkpoints &middot; Human-in-the-loop &middot; Conditional routing
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {agents.map((a) => (
              <span key={a} style={{
                fontFamily: "'JetBrains Mono'", fontSize: 12, fontWeight: 600,
                color: COLORS.white, background: COLORS.cardHover,
                border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 12px",
              }}>{a}</span>
            ))}
          </div>
        </div>
        <div style={{ color: COLORS.tealBright, fontSize: 20, padding: "6px 0" }}>&#9660;</div>
        <div style={layerStyle}>
          <div style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: 15, color: COLORS.white }}>
            MCP servers
          </div>
          <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, color: COLORS.gray, marginTop: 4 }}>
            Stitch &middot; Linear &middot; Supabase &middot; Pulumi &middot; Notion
          </div>
        </div>
        <div style={{ color: COLORS.tealBright, fontSize: 20, padding: "6px 0" }}>&#9660;</div>
        <div style={layerStyle}>
          <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: COLORS.gray }}>
            PostgreSQL <span style={{ color: COLORS.grayDark }}>(state)</span> &middot;{" "}
            GitHub <span style={{ color: COLORS.grayDark }}>(code)</span> &middot;{" "}
            Supabase <span style={{ color: COLORS.grayDark }}>(data)</span> &middot;{" "}
            Vercel <span style={{ color: COLORS.grayDark }}>(deploy)</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
          {["CloudEvents", "OpenTelemetry"].map((t) => (
            <span key={t} style={{
              fontFamily: "'JetBrains Mono'", fontSize: 12, color: COLORS.gold,
              background: "rgba(244,162,97,0.1)", border: "1px solid rgba(244,162,97,0.3)",
              borderRadius: 16, padding: "6px 16px",
            }}>{t}</span>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Slide 5: Meet the agents ───
function AgentsSection() {
  const agents = [
    { name: "PM Agent", icon: "\u{1F4CB}", desc: "Requirements → Linear tickets" },
    { name: "Architect", icon: "\u{1F4D0}", desc: "Patterns, data layer, ADRs" },
    { name: "Design", icon: "\u{1F3A8}", desc: "Stitch UI mockups + animations" },
    { name: "Code", icon: "\u{1F4BB}", desc: "Next.js + React generation" },
    { name: "QA", icon: "\u{1F50D}", desc: "Tests, lint, code review" },
    { name: "Infra", icon: "\u{1F3D7}️", desc: "Supabase schema + Pulumi" },
    { name: "Release", icon: "\u{1F680}", desc: "Vercel deploy + CI/CD" },
    { name: "Monitor", icon: "\u{1F4E1}", desc: "Sentry errors → new tickets" },
  ];
  return (
    <Section id="agents">
      <SectionTitle
        kicker="Meet the agents"
        title="Eight specialists, one pipeline"
        subtitle="Eight specialized agents, each owning one SDLC phase"
      />
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16, maxWidth: 1000, width: "100%",
      }}>
        {agents.map((a) => (
          <div key={a.name} style={{
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 12, padding: "24px 20px", textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{a.icon}</div>
            <div style={{
              fontFamily: "'Outfit'", fontWeight: 700, fontSize: 17, color: COLORS.tealBright,
              marginBottom: 8,
            }}>{a.name}</div>
            <div style={{ fontFamily: "'Outfit'", fontSize: 13, color: COLORS.gray, lineHeight: 1.5 }}>
              {a.desc}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Slide 6: LangGraph state machine ───
function GraphSection() {
  const concepts = [
    {
      term: "Stateful graph",
      desc: "Each agent is a node. State is passed between nodes via a shared SDLCState object (messages, projectConfig, designAssets, codeArtifacts).",
    },
    {
      term: "Checkpointing",
      desc: "Full state is persisted to PostgreSQL after every node. Close the browser, come back, resume where you left off.",
    },
    {
      term: "Conditional edges",
      desc: "routeAfterArchitect() forks to Design + Infra in parallel. routeAfterQA() loops back to Code on failure.",
    },
    {
      term: "Human-in-the-loop",
      desc: "Pipeline pauses at approval gates. The user reviews design mockups and architecture before the Code agent runs.",
    },
    {
      term: "MCP integration",
      desc: "Agents call external tools (Stitch, Linear, Supabase, GitHub) via Model Context Protocol servers.",
    },
  ];
  const node = (label, highlight = false) => (
    <div style={{
      fontFamily: "'JetBrains Mono'", fontSize: 13, fontWeight: 600,
      color: highlight ? COLORS.bg : COLORS.white,
      background: highlight ? COLORS.tealBright : COLORS.card,
      border: `1px solid ${highlight ? COLORS.tealBright : COLORS.tealDeep}`,
      borderRadius: 8, padding: "10px 16px", whiteSpace: "nowrap",
    }}>{label}</div>
  );
  const arrow = <span style={{ color: COLORS.tealBright, fontSize: 16 }}>&#8594;</span>;
  return (
    <Section id="graph">
      <SectionTitle
        kicker="LangGraph state machine"
        title="Routing, gates, and loops"
        subtitle="Stateful graph with conditional routing + human-in-the-loop gates"
      />
      <div style={{
        background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16,
        padding: "32px 28px", maxWidth: 960, width: "100%", marginBottom: 40,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {node("User input")} {arrow} {node("PM Agent")} {arrow} {node("Architect")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{
            fontFamily: "'JetBrains Mono'", fontSize: 11, color: COLORS.gold,
            border: "1px dashed rgba(244,162,97,0.4)", borderRadius: 6, padding: "4px 10px",
          }}>parallel fork</span>
          {node("Design")} {node("Infra")}
          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: COLORS.grayDark }}>
            (skip if no backend)
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {node("Human review", true)} {arrow} {node("Code Agent")} {arrow} {node("QA Agent")}
          <span style={{
            fontFamily: "'JetBrains Mono'", fontSize: 11, color: COLORS.red,
          }}>&#8592; fail: loop back</span>
        </div>
      </div>
      <div style={{ maxWidth: 960, width: "100%" }}>
        <div style={{
          fontFamily: "'JetBrains Mono'", fontSize: 12, color: COLORS.tealBright,
          letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16, textAlign: "center",
        }}>Key concepts</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {concepts.map((c) => (
            <div key={c.term} style={{
              background: COLORS.card, border: `1px solid ${COLORS.border}`,
              borderRadius: 12, padding: "18px 20px",
            }}>
              <div style={{
                fontFamily: "'Outfit'", fontWeight: 700, fontSize: 15, color: COLORS.white, marginBottom: 6,
              }}>{c.term}</div>
              <div style={{ fontFamily: "'Outfit'", fontSize: 13, color: COLORS.gray, lineHeight: 1.55 }}>
                {c.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Slide 7: CNCF projects ───
function CNCFSection() {
  const projects = [
    {
      name: "OpenTelemetry",
      desc: "Instruments every LangGraph agent as a traced span. Produces a live waterfall showing agent execution order, duration, and attributes — pipeable to Jaeger, Grafana Tempo, or Vercel's built-in dashboard.",
      bullets: [
        "@vercel/otel — zero-config for Next.js 15",
        "One span per agent node",
        "Demo: live Jaeger waterfall after pipeline run",
      ],
    },
    {
      name: "CloudEvents",
      desc: "Standardizes the event envelope agents emit on completion. Makes inter-agent messages inspectable, replayable, and compatible with Knative Eventing, Dapr, Azure Event Grid, or any OTel-aware broker.",
      bullets: [
        "One CloudEvent per agent completion",
        "type: dev.sdlc.agent.<name>.completed",
        "Plug into any CNCF eventing platform",
      ],
    },
  ];
  return (
    <Section id="cncf">
      <SectionTitle
        kicker="CNCF projects in the stack"
        title="Cloud-native to the core"
        subtitle="Two CNCF incubating projects bridge the pipeline to the cloud-native ecosystem"
      />
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center", maxWidth: 1000 }}>
        {projects.map((p) => (
          <div key={p.name} style={{
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 16, padding: "32px 28px", width: 440, maxWidth: "100%",
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono'", fontSize: 10, color: COLORS.gold,
              letterSpacing: "0.2em", marginBottom: 12,
            }}>CNCF INCUBATING</div>
            <div style={{
              fontFamily: "'Outfit'", fontWeight: 800, fontSize: 26, color: COLORS.tealBright,
              marginBottom: 12,
            }}>{p.name}</div>
            <p style={{
              fontFamily: "'Outfit'", fontSize: 14, color: COLORS.gray, lineHeight: 1.6, marginTop: 0,
            }}>{p.desc}</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {p.bullets.map((b) => (
                <li key={b} style={{
                  fontFamily: "'JetBrains Mono'", fontSize: 12.5, color: COLORS.white,
                  lineHeight: 1.9,
                }}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 40, maxWidth: 820, textAlign: "center",
        fontFamily: "'Outfit'", fontSize: 16, color: COLORS.gray, lineHeight: 1.6,
      }}>
        Together: <span style={{ color: COLORS.tealBright }}>OTel traces what happened.</span>{" "}
        <span style={{ color: COLORS.gold }}>CloudEvents defines how agents talk to each other.</span>{" "}
        Both are CNCF-standard.
      </div>
    </Section>
  );
}

// ─── Slide 8: Demo ───
function DemoSection() {
  return (
    <Section id="demo" style={{
      background: `radial-gradient(ellipse at 50% 50%, #11294a 0%, ${COLORS.bg} 75%)`,
    }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        fontFamily: "'JetBrains Mono'", fontSize: 13, fontWeight: 700, color: COLORS.red,
        background: "rgba(230,57,70,0.1)", border: "1px solid rgba(230,57,70,0.35)",
        borderRadius: 20, padding: "6px 20px", marginBottom: 32, letterSpacing: "0.2em",
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%", background: COLORS.red,
          animation: "pulse 1.2s ease-in-out infinite",
        }} />
        LIVE
      </div>
      <h2 style={{
        fontFamily: "'Outfit'", fontWeight: 900, fontSize: "clamp(48px, 8vw, 96px)",
        color: COLORS.white, margin: "0 0 16px", textAlign: "center",
      }}>Demo time</h2>
      <p style={{
        fontFamily: "'Outfit'", fontWeight: 300, fontSize: "clamp(18px, 2.5vw, 26px)",
        color: COLORS.teal, margin: "0 0 48px", textAlign: "center",
      }}>
        Describe a project &#8594; watch agents build it
      </p>
      <div style={{
        fontFamily: "'JetBrains Mono'", fontSize: "clamp(12px, 1.6vw, 15px)", color: COLORS.gray,
        background: COLORS.card, border: `1px solid ${COLORS.border}`,
        borderRadius: 10, padding: "16px 28px", textAlign: "center", lineHeight: 1.8,
      }}>
        PM Agent creates tickets &nbsp;&#8594;&nbsp; Design Agent generates UI &nbsp;&#8594;&nbsp; Code Agent scaffolds React
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </Section>
  );
}

// ─── Slide 9: Thank you ───
function ThankYouSection() {
  const links = [
    { name: "LangGraph.js", url: "github.com/langchain-ai/langgraphjs" },
    { name: "Google Stitch", url: "stitch.withgoogle.com" },
    { name: "Supabase", url: "supabase.com" },
    { name: "Vercel", url: "vercel.com" },
    { name: "CNCF Toronto", url: "community.cncf.io/toronto" },
  ];
  return (
    <Section id="thankyou">
      <SectionTitle title="Thank you" />
      <div style={{
        display: "flex", gap: 48, flexWrap: "wrap", justifyContent: "center", alignItems: "center",
        maxWidth: 900,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            background: COLORS.white, borderRadius: 16, padding: 16, display: "inline-block",
          }}>
            <QRCodeSVG value={REPO_URL} size={168} fgColor={COLORS.bg} bgColor="#ffffff" />
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono'", fontSize: 13, color: COLORS.tealBright, marginTop: 14,
          }}>github.com/gonzalovazquez/ai-sdlc</div>
        </div>
        <div>
          <div style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: 24, color: COLORS.white }}>
            Gonzalo Vazquez
          </div>
          <div style={{ fontFamily: "'Outfit'", fontSize: 15, color: COLORS.gray, margin: "6px 0 2px" }}>
            Director, Cloud Engineering
          </div>
          <div style={{ fontFamily: "'Outfit'", fontSize: 15, color: COLORS.gray, marginBottom: 10 }}>
            Modern Applications | RBC
          </div>
          <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: COLORS.tealBright, marginBottom: 28 }}>
            github.com/gonzalovazquez
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono'", fontSize: 11, color: COLORS.gray,
            letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12,
          }}>Explore</div>
          {links.map((l) => (
            <div key={l.name} style={{ fontFamily: "'Outfit'", fontSize: 14, lineHeight: 2 }}>
              <span style={{ color: COLORS.white, fontWeight: 600 }}>{l.name}</span>{" "}
              <span style={{ color: COLORS.gray }}>&mdash; {l.url}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── App shell ───
export default function App() {
  const [active, setActive] = useState("hero");
  const [presentationMode, setPresentationMode] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  const goToSlide = useCallback((index) => {
    const clampedIndex = Math.max(0, Math.min(index, SLIDES.length - 1));
    const el = document.getElementById(SLIDES[clampedIndex]);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    setActive(SLIDES[clampedIndex]);
  }, []);

  const currentIndex = SLIDES.indexOf(active);

  // Track active section while scrolling
  useEffect(() => {
    const onScroll = () => {
      for (const id of [...SLIDES].reverse()) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight / 2) {
          setActive(id);
          break;
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        goToSlide(currentIndex + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goToSlide(currentIndex - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goToSlide(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goToSlide(SLIDES.length - 1);
      } else if (e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      } else if (e.key.toLowerCase() === "p") {
        setPresentationMode((m) => !m);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, goToSlide]);

  // Presentation mode follows fullscreen
  useEffect(() => {
    const onFsChange = () => setPresentationMode(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Fade the controls hint out after a few seconds
  useEffect(() => {
    const id = setTimeout(() => setHintVisible(false), 6000);
    return () => clearTimeout(id);
  }, []);

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh" }}>
      <style>{fonts}</style>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { background: ${COLORS.bg}; }
        ::selection { background: rgba(2,195,154,0.3); }
      `}</style>
      <Nav active={active} presentationMode={presentationMode} />
      <SlideIndicator current={currentIndex} total={SLIDES.length} />
      <PresentationHint visible={hintVisible} />
      <Hero />
      <ProblemSection />
      <SDLCSection />
      <ArchitectureSection />
      <AgentsSection />
      <GraphSection />
      <CNCFSection />
      <DemoSection />
      <ThankYouSection />
    </div>
  );
}
