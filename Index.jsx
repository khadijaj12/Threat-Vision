import { useState, useEffect, useRef } from "react";

// ─── Animation Utilities ───────────────────────────────────────────────────
const useInView = (threshold = 0.15) => {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
            { threshold }
        );
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [threshold]);
    return [ref, inView];
};

const useScrollY = () => {
    const [y, setY] = useState(0);
    useEffect(() => {
        const fn = () => setY(window.scrollY);
        window.addEventListener("scroll", fn, { passive: true });
        return () => window.removeEventListener("scroll", fn);
    }, []);
    return y;
};

// ─── Particle Field ────────────────────────────────────────────────────────
const ParticleField = () => {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const particles = Array.from({ length: 90 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.8 + 0.3,
            dx: (Math.random() - 0.5) * 0.4,
            dy: (Math.random() - 0.5) * 0.4,
            o: Math.random() * 0.5 + 0.1,
        }));
        let raf;
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(168,235,255,${p.o})`;
                ctx.fill();
                p.x += p.dx; p.y += p.dy;
                if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
            });
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const d = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
                    if (d < 110) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(100,200,255,${0.12 * (1 - d / 110)})`;
                        ctx.lineWidth = 0.5;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
            raf = requestAnimationFrame(draw);
        };
        draw();
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        window.addEventListener("resize", resize);
        return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
    }, []);
    return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }} />;
};

// ─── Glowing Orb ──────────────────────────────────────────────────────────
const Orb = ({ style }) => (
    <div style={{
        position: "absolute", borderRadius: "50%", filter: "blur(80px)",
        pointerEvents: "none", zIndex: 0, ...style
    }} />
);

// ─── Reveal Wrapper ───────────────────────────────────────────────────────
const Reveal = ({ children, delay = 0, direction = "up", style = {} }) => {
    const [ref, inView] = useInView();
    const transforms = { up: "translateY(48px)", down: "translateY(-48px)", left: "translateX(-48px)", right: "translateX(48px)" };
    return (
        <div ref={ref} style={{
            transition: `opacity 0.8s cubic-bezier(.22,1,.36,1) ${delay}s, transform 0.8s cubic-bezier(.22,1,.36,1) ${delay}s`,
            opacity: inView ? 1 : 0,
            transform: inView ? "none" : (transforms[direction] || "translateY(48px)"),
            ...style
        }}>
            {children}
        </div>
    );
};

// ─── Floating Badge ───────────────────────────────────────────────────────
const Badge = ({ children, color = "#00d4ff" }) => (
    <span style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 14px", borderRadius: 999,
        background: `${color}18`, border: `1px solid ${color}44`,
        color, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em",
        fontFamily: "'Space Mono', monospace",
    }}>{children}</span>
);

// ─── Section Wrapper ──────────────────────────────────────────────────────
const Section = ({ id, children, style = {} }) => (
    <section id={id} style={{
        position: "relative", overflow: "hidden",
        padding: "120px 0", ...style
    }}>
        {children}
    </section>
);

const Container = ({ children, style = {} }) => (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", ...style }}>
        {children}
    </div>
);

// ─── Glass Card ───────────────────────────────────────────────────────────
const GlassCard = ({ children, style = {}, hover = true }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20,
                backdropFilter: "blur(12px)",
                transition: "all 0.4s cubic-bezier(.22,1,.36,1)",
                transform: hover && hovered ? "translateY(-6px) scale(1.01)" : "none",
                boxShadow: hover && hovered ? "0 24px 60px rgba(0,212,255,0.12), 0 0 0 1px rgba(0,212,255,0.15)" : "0 4px 24px rgba(0,0,0,0.3)",
                ...style
            }}
        >
            {children}
        </div>
    );
};

// ─── Navbar ───────────────────────────────────────────────────────────────
const Navbar = () => {
    const scrollY = useScrollY();
    const [open, setOpen] = useState(false);
    const scrolled = scrollY > 40;
    const links = ["Features", "Menu", "AR Preview", "Tech"];
    return (
        <nav style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
            padding: scrolled ? "12px 32px" : "20px 32px",
            transition: "all 0.4s cubic-bezier(.22,1,.36,1)",
            background: scrolled ? "rgba(4,10,20,0.85)" : "transparent",
            backdropFilter: scrolled ? "blur(20px)" : "none",
            borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
            display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "linear-gradient(135deg, #00d4ff, #0066ff)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, boxShadow: "0 0 20px rgba(0,212,255,0.4)",
                }}>◈</div>
                <span style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "0.05em"
                }}>AR<span style={{ color: "#00d4ff" }}>View</span></span>
            </div>
            <div style={{ display: "flex", gap: 36, alignItems: "center" }}>
                {links.map(l => (
                    <a key={l} href={`#${l.toLowerCase().replace(" ", "-")}`} style={{
                        color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 500,
                        textDecoration: "none", fontFamily: "'Space Mono', monospace",
                        letterSpacing: "0.04em", transition: "color 0.2s",
                    }}
                        onMouseEnter={e => e.target.style.color = "#00d4ff"}
                        onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.6)"}
                    >{l}</a>
                ))}
                <button style={{
                    padding: "9px 22px", borderRadius: 999,
                    background: "linear-gradient(135deg, #00d4ff, #0066ff)",
                    border: "none", color: "#fff", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "'Space Mono', monospace",
                    letterSpacing: "0.05em", boxShadow: "0 0 24px rgba(0,212,255,0.35)",
                    transition: "all 0.2s",
                }}>Get Started →</button>
            </div>
        </nav>
    );
};

// ─── Hero Section ─────────────────────────────────────────────────────────
const HeroSection = () => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);
    return (
        <Section style={{ minHeight: "100vh", display: "flex", alignItems: "center", paddingTop: 100 }}>
            <ParticleField />
            <Orb style={{ width: 600, height: 600, top: -100, left: -150, background: "radial-gradient(circle, rgba(0,100,255,0.18) 0%, transparent 70%)" }} />
            <Orb style={{ width: 500, height: 500, top: 100, right: -100, background: "radial-gradient(circle, rgba(0,212,255,0.14) 0%, transparent 70%)" }} />
            <Container style={{ position: "relative", zIndex: 1 }}>
                <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
                    <div style={{
                        transition: `opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s`,
                        opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(30px)", marginBottom: 24
                    }}>
                        <Badge color="#00d4ff">✦ AI-Powered Augmented Reality</Badge>
                    </div>
                    <h1 style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: "clamp(48px, 8vw, 88px)", fontWeight: 700,
                        lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 24px",
                        transition: `opacity 0.9s ease 0.3s, transform 0.9s ease 0.3s`,
                        opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(40px)",
                    }}>
                        <span style={{ color: "#fff" }}>See Before</span>
                        <br />
                        <span style={{
                            background: "linear-gradient(90deg, #00d4ff, #0066ff, #00d4ff)",
                            backgroundSize: "200% auto",
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                            animation: "shimmer 3s linear infinite",
                        }}>You Decide.</span>
                    </h1>
                    <p style={{
                        fontSize: 20, color: "rgba(255,255,255,0.55)", lineHeight: 1.7,
                        margin: "0 auto 48px", maxWidth: 540,
                        fontFamily: "'DM Serif Display', Georgia, serif",
                        transition: `opacity 0.9s ease 0.5s, transform 0.9s ease 0.5s`,
                        opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(30px)",
                    }}>
                        Try on outfits. Preview food in 3D. Experience reality-augmented menus before you order.
                    </p>
                    <div style={{
                        display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap",
                        transition: `opacity 0.9s ease 0.7s, transform 0.9s ease 0.7s`,
                        opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(20px)",
                    }}>
                        <button style={{
                            padding: "16px 36px", borderRadius: 999,
                            background: "linear-gradient(135deg, #00d4ff, #0066ff)",
                            border: "none", color: "#fff", fontSize: 16, fontWeight: 700,
                            cursor: "pointer", letterSpacing: "0.04em",
                            fontFamily: "'Space Mono', monospace",
                            boxShadow: "0 0 40px rgba(0,212,255,0.4), 0 8px 32px rgba(0,102,255,0.3)",
                            transition: "all 0.25s",
                        }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 0 60px rgba(0,212,255,0.6), 0 12px 40px rgba(0,102,255,0.4)"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 0 40px rgba(0,212,255,0.4), 0 8px 32px rgba(0,102,255,0.3)"; }}
                        >Try AR Now ↗</button>
                        <button style={{
                            padding: "16px 36px", borderRadius: 999,
                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
                            color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer",
                            letterSpacing: "0.04em", fontFamily: "'Space Mono', monospace", transition: "all 0.25s",
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.borderColor = "rgba(0,212,255,0.4)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
                        >Watch Demo ▶</button>
                    </div>
                    <div style={{
                        display: "flex", gap: 24, justifyContent: "center", marginTop: 72, flexWrap: "wrap",
                        transition: `opacity 0.9s ease 0.9s`, opacity: mounted ? 1 : 0,
                    }}>
                        {[["98%", "Accuracy"], ["0.3s", "Render Time"], ["50K+", "Items in AR"]].map(([val, lbl]) => (
                            <div key={lbl} style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 32, fontWeight: 800, color: "#00d4ff", fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>{val}</div>
                                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>{lbl}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </Container>
            <div style={{
                position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                opacity: 0.5, animation: "bounce 2s ease-in-out infinite",
            }}>
                <div style={{ width: 1, height: 48, background: "linear-gradient(to bottom, rgba(0,212,255,0.8), transparent)" }} />
                <span style={{ fontSize: 10, color: "#00d4ff", letterSpacing: "0.15em", fontFamily: "'Space Mono', monospace" }}>SCROLL</span>
            </div>
        </Section>
    );
};

// ─── Virtual Try-On ───────────────────────────────────────────────────────
const VirtualTryOn = () => {
    const [active, setActive] = useState(0);
    const items = [
        { emoji: "👗", label: "Dress", color: "#ff6b9d" },
        { emoji: "👔", label: "Shirt", color: "#00d4ff" },
        { emoji: "🧥", label: "Jacket", color: "#a855f7" },
        { emoji: "👟", label: "Shoes", color: "#00ff94" },
    ];
    return (
        <Section id="features" style={{ background: "linear-gradient(180deg, transparent, rgba(0,50,100,0.15), transparent)" }}>
            <Orb style={{ width: 400, height: 400, top: 0, right: 0, background: "radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)" }} />
            <Container>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
                    <div>
                        <Reveal delay={0}>
                            <Badge color="#a855f7">✦ Virtual Try-On</Badge>
                            <h2 style={{
                                fontFamily: "'Space Mono', monospace",
                                fontSize: "clamp(36px,5vw,56px)", fontWeight: 700,
                                color: "#fff", margin: "20px 0 20px", lineHeight: 1.1, letterSpacing: "-0.02em",
                            }}>
                                Wear It Without<br /><span style={{ color: "#a855f7" }}>Trying It.</span>
                            </h2>
                            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 17, lineHeight: 1.8, maxWidth: 420, fontFamily: "'DM Serif Display', Georgia, serif" }}>
                                Our AI maps your body in real time and drapes any garment perfectly — lighting, shadows, and all.
                            </p>
                        </Reveal>
                        <Reveal delay={0.15}>
                            <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
                                {items.map((item, i) => (
                                    <button key={i} onClick={() => setActive(i)} style={{
                                        padding: "10px 20px", borderRadius: 999,
                                        background: active === i ? `${item.color}22` : "rgba(255,255,255,0.04)",
                                        border: `1px solid ${active === i ? item.color : "rgba(255,255,255,0.1)"}`,
                                        color: active === i ? item.color : "rgba(255,255,255,0.5)",
                                        cursor: "pointer", fontSize: 14, fontWeight: 600,
                                        fontFamily: "'Space Mono', monospace",
                                        transition: "all 0.3s cubic-bezier(.22,1,.36,1)",
                                        transform: active === i ? "scale(1.05)" : "none",
                                    }}>
                                        {item.emoji} {item.label}
                                    </button>
                                ))}
                            </div>
                        </Reveal>
                    </div>
                    <Reveal delay={0.2} direction="left">
                        <GlassCard style={{ padding: 32, aspectRatio: "4/5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                            <Orb style={{ width: 300, height: 300, top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: `radial-gradient(circle, ${items[active].color}20 0%, transparent 70%)`, transition: "background 0.5s" }} />
                            <div style={{
                                fontSize: 120, transition: "all 0.4s cubic-bezier(.34,1.56,.64,1)",
                                transform: `scale(1) rotate(${active * 5 - 10}deg)`,
                                filter: `drop-shadow(0 0 40px ${items[active].color}66)`,
                                position: "relative", zIndex: 1,
                            }}>{items[active].emoji}</div>
                            <div style={{
                                marginTop: 24, padding: "8px 20px", borderRadius: 999,
                                background: `${items[active].color}18`, border: `1px solid ${items[active].color}44`,
                                color: items[active].color, fontSize: 13,
                                fontFamily: "'Space Mono', monospace", fontWeight: 700, transition: "all 0.4s",
                            }}>AR Preview Active ●</div>
                            {[...Array(6)].map((_, i) => (
                                <div key={i} style={{
                                    position: "absolute", left: 0, right: 0,
                                    height: 1, background: `rgba(255,255,255,0.03)`, top: `${16 + i * 14}%`,
                                }} />
                            ))}
                        </GlassCard>
                    </Reveal>
                </div>
            </Container>
        </Section>
    );
};

// ─── Food Preview ─────────────────────────────────────────────────────────
const FoodPreview = () => {
    const foods = [
        { emoji: "🍣", name: "Sashimi Platter", cal: "320 kcal", price: "$28", color: "#ff6b6b" },
        { emoji: "🍝", name: "Truffle Pasta", cal: "580 kcal", price: "$22", color: "#ffd93d" },
        { emoji: "🥩", name: "Wagyu Steak", cal: "740 kcal", price: "$65", color: "#ff9f43" },
        { emoji: "🍱", name: "Bento Box", cal: "450 kcal", price: "$18", color: "#00d4ff" },
        { emoji: "🍜", name: "Ramen Bowl", cal: "510 kcal", price: "$16", color: "#a855f7" },
        { emoji: "🥗", name: "Kale Caesar", cal: "280 kcal", price: "$14", color: "#00ff94" },
    ];
    return (
        <Section id="menu">
            <Orb style={{ width: 500, height: 500, bottom: 0, left: -100, background: "radial-gradient(circle, rgba(255,107,107,0.1) 0%, transparent 70%)" }} />
            <Container>
                <Reveal>
                    <div style={{ textAlign: "center", marginBottom: 64 }}>
                        <Badge color="#ffd93d">✦ Food in AR</Badge>
                        <h2 style={{
                            fontFamily: "'Space Mono', monospace", fontSize: "clamp(36px,5vw,56px)",
                            fontWeight: 700, color: "#fff", margin: "20px 0 16px", letterSpacing: "-0.02em",
                        }}>
                            See Your Meal<br /><span style={{ color: "#ffd93d" }}>Before It Arrives.</span>
                        </h2>
                        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 17, maxWidth: 480, margin: "0 auto", fontFamily: "'DM Serif Display', Georgia, serif", lineHeight: 1.7 }}>
                            Photorealistic 3D previews of every dish — portion sizes, plating, and all.
                        </p>
                    </div>
                </Reveal>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
                    {foods.map((f, i) => (
                        <Reveal key={f.name} delay={i * 0.08}>
                            <GlassCard style={{ padding: 28 }}>
                                <div style={{ fontSize: 64, marginBottom: 16, display: "block", filter: `drop-shadow(0 0 20px ${f.color}55)` }}>{f.emoji}</div>
                                <div style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 18, color: "#fff", marginBottom: 8 }}>{f.name}</div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{f.cal}</span>
                                    <span style={{ fontSize: 18, fontWeight: 800, color: f.color, fontFamily: "'Space Mono', monospace" }}>{f.price}</span>
                                </div>
                                <button style={{
                                    width: "100%", marginTop: 16, padding: "10px", borderRadius: 10,
                                    background: `${f.color}18`, border: `1px solid ${f.color}44`, color: f.color,
                                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                                    fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em", transition: "all 0.2s",
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.background = `${f.color}30`; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = `${f.color}18`; }}
                                >◈ View in AR</button>
                            </GlassCard>
                        </Reveal>
                    ))}
                </div>
            </Container>
        </Section>
    );
};

// ─── AI Features ──────────────────────────────────────────────────────────
const AIFeatures = () => {
    const features = [
        { icon: "⚡", title: "Real-Time Rendering", desc: "Sub-300ms AR previews powered by on-device neural processing.", color: "#ffd93d" },
        { icon: "🧠", title: "Body AI Mapping", desc: "68-point skeletal tracking for perfect garment draping at any angle.", color: "#00d4ff" },
        { icon: "🎨", title: "Material Simulation", desc: "Physics-based fabric, texture, and lighting that responds to your environment.", color: "#a855f7" },
        { icon: "🔮", title: "Predictive Sizing", desc: "AI learns your preferences and recommends items with 94% accuracy.", color: "#00ff94" },
    ];
    return (
        <Section id="ar-preview" style={{ background: "linear-gradient(180deg, transparent, rgba(0,30,60,0.3), transparent)" }}>
            <Container>
                <Reveal>
                    <div style={{ textAlign: "center", marginBottom: 72 }}>
                        <Badge color="#00ff94">✦ Core AI Features</Badge>
                        <h2 style={{
                            fontFamily: "'Space Mono', monospace", fontSize: "clamp(36px,5vw,56px)",
                            fontWeight: 700, color: "#fff", margin: "20px 0 0", letterSpacing: "-0.02em",
                        }}>
                            The Technology<br /><span style={{ color: "#00ff94" }}>Behind the Magic.</span>
                        </h2>
                    </div>
                </Reveal>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
                    {features.map((f, i) => (
                        <Reveal key={f.title} delay={i * 0.1}>
                            <GlassCard style={{ padding: 36, height: "100%" }}>
                                <div style={{
                                    width: 56, height: 56, borderRadius: 16,
                                    background: `${f.color}18`, border: `1px solid ${f.color}33`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 26, marginBottom: 24, boxShadow: `0 0 30px ${f.color}22`,
                                }}>{f.icon}</div>
                                <h3 style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 12 }}>{f.title}</h3>
                                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, lineHeight: 1.7, fontFamily: "'DM Serif Display', Georgia, serif" }}>{f.desc}</p>
                                <div style={{ marginTop: 24, height: 2, borderRadius: 999, background: `linear-gradient(to right, ${f.color}80, transparent)` }} />
                            </GlassCard>
                        </Reveal>
                    ))}
                </div>
            </Container>
        </Section>
    );
};

// ─── Tech Stack ───────────────────────────────────────────────────────────
const TechStack = () => {
    const techs = [
        ["⚛", "React 18"], ["🧊", "Three.js"], ["🤖", "TensorFlow"],
        ["🔷", "TypeScript"], ["⚡", "WebGL 2"], ["🎯", "MediaPipe"],
        ["🌐", "WebXR"], ["💡", "WASM"],
    ];
    return (
        <Section id="tech">
            <Container>
                <Reveal>
                    <div style={{ textAlign: "center", marginBottom: 56 }}>
                        <Badge color="#0066ff">✦ Tech Stack</Badge>
                        <h2 style={{
                            fontFamily: "'Space Mono', monospace", fontSize: "clamp(32px,4vw,48px)",
                            fontWeight: 700, color: "#fff", margin: "20px 0 0", letterSpacing: "-0.02em",
                        }}>Built on the<br /><span style={{ color: "#0066ff" }}>Bleeding Edge.</span></h2>
                    </div>
                </Reveal>
                <Reveal delay={0.1}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
                        {techs.map(([icon, name]) => (
                            <div key={name} style={{
                                display: "flex", alignItems: "center", gap: 10, padding: "14px 24px",
                                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 12, cursor: "default", transition: "all 0.3s cubic-bezier(.22,1,.36,1)",
                            }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,212,255,0.08)"; e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.transform = "none"; }}
                            >
                                <span style={{ fontSize: 20 }}>{icon}</span>
                                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{name}</span>
                            </div>
                        ))}
                    </div>
                </Reveal>
            </Container>
        </Section>
    );
};

// ─── Menu Catalog ──────────────────────────────────────────────────────────
const MenuCatalog = () => (
    <Section>
        <Container>
            <Reveal>
                <div style={{ textAlign: "center" }}>
                    <Badge color="#ff6b9d">✦ Full Menu</Badge>
                    <h2 style={{ fontFamily: "'Space Mono', monospace", fontSize: "clamp(32px,4vw,48px)", fontWeight: 700, color: "#fff", margin: "20px 0 16px", letterSpacing: "-0.02em" }}>
                        300+ Dishes,<br /><span style={{ color: "#ff6b9d" }}>All in AR.</span>
                    </h2>
                    <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 17, maxWidth: 400, margin: "0 auto", fontFamily: "'DM Serif Display', Georgia, serif", lineHeight: 1.7 }}>
                        Browse the full catalog with real-time 3D previews, nutrition facts, and instant ordering.
                    </p>
                    <button style={{
                        marginTop: 36, padding: "14px 40px", borderRadius: 999,
                        background: "linear-gradient(135deg, #ff6b9d, #ff4081)",
                        border: "none", color: "#fff", fontSize: 15, fontWeight: 700,
                        cursor: "pointer", fontFamily: "'Space Mono', monospace",
                        boxShadow: "0 0 32px rgba(255,64,129,0.35)", transition: "all 0.25s",
                    }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "none"}
                    >Browse Full Menu →</button>
                </div>
            </Reveal>
        </Container>
    </Section>
);

// ─── Root Page ─────────────────────────────────────────────────────────────
export default function Index() {
    return (
        <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
            <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #040a14; color: #fff; overflow-x: hidden; }
        @keyframes shimmer { 0% { background-position: 0% center } 100% { background-position: 200% center } }
        @keyframes bounce { 0%,100% { transform: translateX(-50%) translateY(0) } 50% { transform: translateX(-50%) translateY(8px) } }
        @keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
        ::selection { background: rgba(0,212,255,0.25); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #040a14; }
        ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.3); border-radius: 999px; }
      `}</style>
            <div style={{ minHeight: "100vh", background: "#040a14", position: "relative" }}>
                <div style={{
                    position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
                    background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,100,255,0.12) 0%, transparent 60%)",
                }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                    <Navbar />
                    <HeroSection />
                    <VirtualTryOn />
                    <FoodPreview />
                    <MenuCatalog />
                    <AIFeatures />
                    <TechStack />
                    <footer style={{ padding: "60px 32px 40px", borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
                        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #00d4ff, #0066ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>◈</div>
                                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: "#fff" }}>AR<span style={{ color: "#00d4ff" }}>View</span></span>
                            </div>
                            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>
                                © 2026 ARView — AI-Powered Augmented Reality Previews
                            </p>
                            <div style={{ display: "flex", gap: 24 }}>
                                {["Privacy", "Terms", "Contact"].map(l => (
                                    <a key={l} href="#" style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none", fontFamily: "'Space Mono', monospace", transition: "color 0.2s" }}
                                        onMouseEnter={e => e.target.style.color = "#00d4ff"}
                                        onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.35)"}
                                    >{l}</a>
                                ))}
                            </div>
                        </div>
                    </footer>
                </div>
            </div>
        </>
    );
}
