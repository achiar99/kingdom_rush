// The figures that fight on foot: phalanx hoplites, summoned reinforcements,
// and the five champions.
//
// One rig draws all of them, because they share an anatomy — a Greek soldier
// seen from three-quarters above: round hoplon on the near arm, weapon on the
// far one, crested helm. What changes between them is the helm type, the
// blazon on the shield, the weapon, and the scale. Achilles and a rank-and-file
// hoplite are the same drawing with different dials, which is exactly right:
// he's the best of them, not a different species.
import { SUMMON } from "../data/abilities.js";
import { state } from "../state.js";
import { ctx, groundShadow } from "./canvas.js";

// ------------------------------------------------------------------- hoplite
// o: { s, dir, fighting, helm, crest, tunic, cape, weapon, blazon, bare }
function drawHoplite(x, y, o) {
  const s = o.s || 1;
  const dir = o.dir || 1;
  const [light, mid, dark] = o.tunic;
  const swing = o.fighting ? Math.sin(performance.now() / 95) : 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);

  // --- legs: bare, in sandals, one forward ---
  ctx.strokeStyle = "#c8a074";
  ctx.lineCap = "round";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-1.5, 3); ctx.lineTo(-3 + swing * 1.2, 10);
  ctx.moveTo(2, 3);    ctx.lineTo(3.5 - swing * 1.2, 10);
  ctx.stroke();
  ctx.strokeStyle = "#6b4a24";                         // sandal straps
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-4.4 + swing * 1.2, 10.4); ctx.lineTo(-1.6 + swing * 1.2, 10.4);
  ctx.moveTo(2.2 - swing * 1.2, 10.4);  ctx.lineTo(5 - swing * 1.2, 10.4);
  ctx.stroke();

  // --- cape, behind the body ---
  if (o.cape) {
    ctx.fillStyle = o.cape;
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.quadraticCurveTo(-11 - swing, 0, -7 - swing, 9);
    ctx.lineTo(-1, 6);
    ctx.closePath();
    ctx.fill();
  }

  // --- linothorax: the stiff linen cuirass, with its shoulder yoke ---
  const body = ctx.createLinearGradient(-5, -7, 5, 6);
  body.addColorStop(0, light);
  body.addColorStop(0.55, mid);
  body.addColorStop(1, dark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-5, -7);
  ctx.lineTo(5, -7);
  ctx.lineTo(4.2, 4);
  ctx.lineTo(-4.2, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.3)";             // yoke over the shoulders
  ctx.fillRect(-5, -7, 10, 1.8);
  ctx.fillStyle = dark;                                 // pteruges (leather strips)
  for (let i = -2; i <= 2; i++) ctx.fillRect(i * 2 - 0.7, 4, 1.5, 3.4);

  // --- far arm with the weapon ---
  ctx.strokeStyle = "#c8a074";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(3, -4.5);
  ctx.lineTo(7 + swing * 2, -1);
  ctx.stroke();
  ctx.save();
  ctx.translate(7 + swing * 2, -1);
  ctx.rotate(-0.5 + swing * 0.8);
  drawWeapon(o.weapon || "spear");
  ctx.restore();

  // --- the hoplon: a big round shield, the most recognisable thing about him
  if (!o.bare) {
    const face = ctx.createRadialGradient(-7, -4, 1, -5.5, -2, 8.5);
    face.addColorStop(0, "#e8c070");
    face.addColorStop(0.7, "#b8862c");
    face.addColorStop(1, "#6e4c10");
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.ellipse(-5.5, -1.5, 7.2, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(50,32,8,0.65)";
    ctx.lineWidth = 1.1;
    ctx.stroke();
    if (o.blazon) {                                     // painted device
      ctx.save();
      ctx.scale(dir, 1);                                // keep letters unmirrored
      ctx.fillStyle = o.blazonColor || "#20304a";
      ctx.font = "bold 8px Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(o.blazon, dir * -5.5, -1);
      ctx.restore();
    }
  }

  // --- head and helm ---
  ctx.fillStyle = "#d8b088";
  ctx.beginPath();
  ctx.arc(0, -10, 3.6, 0, Math.PI * 2);
  ctx.fill();

  const [hl, hd] = o.helm || ["#e8d8a8", "#8a6a2c"];
  const hg = ctx.createLinearGradient(0, -14, 0, -7);
  hg.addColorStop(0, hl);
  hg.addColorStop(1, hd);
  ctx.fillStyle = hg;

  if (o.helm2 === "phrygian") {
    // forward-curling cap — the light-troops look, for Atalanta and Perseus
    ctx.beginPath();
    ctx.arc(0, -10.5, 4.2, Math.PI, 0);
    ctx.quadraticCurveTo(5.5, -15, 2, -16.5);
    ctx.quadraticCurveTo(1, -13.5, -4.2, -10.5);
    ctx.closePath();
    ctx.fill();
  } else {
    // Corinthian: full-face bowl with a nose guard and an eye slot
    ctx.beginPath();
    ctx.arc(0, -10.5, 4.4, Math.PI, 0);
    ctx.lineTo(4.4, -8);
    ctx.lineTo(-4.4, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-0.9, -9, 1.8, 3.6);                   // nasal
    ctx.fillStyle = "rgba(20,14,6,0.75)";               // eye slot
    ctx.fillRect(-3.6, -11.2, 3, 1.5);
    ctx.fillRect(0.6, -11.2, 3, 1.5);
  }

  if (o.crest) {                                        // horsehair crest
    ctx.fillStyle = o.crest;
    ctx.beginPath();
    ctx.moveTo(-3.6, -13.4);
    ctx.quadraticCurveTo(0, -20, 3.6, -13.4);
    ctx.quadraticCurveTo(0, -15.6, -3.6, -13.4);
    ctx.fill();
  }

  ctx.restore();
}

// Weapons, drawn from the grip outward along +x.
function drawWeapon(kind) {
  if (kind === "bow") {
    ctx.strokeStyle = "#7a5228";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(3, 0, 6, -1.2, 1.2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(250,245,225,0.85)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(5.2, -5.6); ctx.lineTo(5.2, 5.6);
    ctx.stroke();
    return;
  }
  if (kind === "staff") {
    ctx.strokeStyle = "#6b4a24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-1, 4); ctx.lineTo(3, -12);
    ctx.stroke();
    const g = ctx.createRadialGradient(3.4, -13, 0, 3.4, -13, 4);
    g.addColorStop(0, "#f0d0ff");
    g.addColorStop(1, "rgba(160,80,216,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(3.4, -13, 4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (kind === "hammer") {                              // Ajax's spear + tower shield look
    ctx.strokeStyle = "#6b4a24";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-3, 3); ctx.lineTo(9, -12);
    ctx.stroke();
    ctx.fillStyle = "#d8cdb0";
    ctx.beginPath();
    ctx.moveTo(9, -15.5); ctx.lineTo(11.4, -10.5); ctx.lineTo(6.8, -11);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (kind === "dagger") {                              // harpe — the hooked sword
    ctx.strokeStyle = "#6b4a24";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 1); ctx.lineTo(2, -2);
    ctx.stroke();
    ctx.strokeStyle = "#e6e0cc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(2, -2);
    ctx.quadraticCurveTo(9, -6, 8, -11);
    ctx.stroke();
    ctx.beginPath();                                    // the hook
    ctx.moveTo(7.5, -7.5);
    ctx.quadraticCurveTo(12, -8, 11.5, -4);
    ctx.stroke();
    return;
  }
  if (kind === "sword") {                               // xiphos: short leaf blade
    ctx.fillStyle = "#5a3a1c";
    ctx.fillRect(-1, -1.2, 3, 2.4);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(2, -2.4, 1.6, 4.8);
    const g = ctx.createLinearGradient(0, -2, 0, 2);
    g.addColorStop(0, "#f4f0e0");
    g.addColorStop(1, "#9aa0a8");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(3.6, -2);
    ctx.lineTo(9, -1.4);
    ctx.lineTo(11.5, 0);
    ctx.lineTo(9, 1.4);
    ctx.lineTo(3.6, 2);
    ctx.closePath();
    ctx.fill();
    return;
  }
  // default: the dory, a long thrusting spear — what a hoplite actually holds
  ctx.strokeStyle = "#6b4a24";
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(-5, 4); ctx.lineTo(11, -9);
  ctx.stroke();
  ctx.fillStyle = "#d8cdb0";                            // leaf-shaped head
  ctx.beginPath();
  ctx.moveTo(11, -12.5);
  ctx.lineTo(13.4, -8.6);
  ctx.lineTo(9.4, -7.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8a6a30";                            // butt-spike
  ctx.beginPath();
  ctx.arc(-5.4, 4.4, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function smallHpBar(x, y, hp, maxHp) {
  const w = 16, h = 3, pct = Math.max(0, hp / maxHp);
  if (pct >= 1) return;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = "#5ad1a5";
  ctx.fillRect(x - w / 2, y, w * pct, h);
}

// face whatever we're fighting; default to facing right
const faceTarget = (u) => (u.target && u.target.x < u.x ? -1 : 1);

// ------------------------------------------------------------------ soldiers
export function drawSoldier(s) {
  groundShadow(s.x + 1, s.y + 9, 9, 4);
  drawHoplite(s.x, s.y, {
    s: 0.9, dir: faceTarget(s), fighting: !!s.target, weapon: "spear",
    tunic: ["#f0e6cc", "#c8b88c", "#8a7a52"],           // bleached linen
    helm: ["#e8cf8e", "#8a6a2c"], crest: "#b8452e",     // bronze + crimson
    blazon: "Λ",
  });
  smallHpBar(s.x, s.y - 20, s.hp, s.maxHp);
}

// Reinforcements: the same rig in campaign green, so a temporary summon reads
// as distinct from a permanent phalanx at a glance.
export function drawSummonedSoldier(s) {
  groundShadow(s.x + 1, s.y + 9, 9, 4);
  drawHoplite(s.x, s.y, {
    s: 0.85, dir: faceTarget(s), fighting: !!s.target, weapon: "spear",
    tunic: [SUMMON.colors.light, SUMMON.colors.mid, SUMMON.colors.dark],
    helm: ["#cfe4c8", "#4a6a44"], crest: "#5ad1a5",
    blazon: null,
  });
  smallHpBar(s.x, s.y - 20, s.hp, s.maxHp);
}

// -------------------------------------------------------------------- heroes
// Each champion's distinguishing marks. Everything else comes from its def in
// data/hero.js, so a hero's colours and weapon stay in one place.
const HERO_MARKS = {
  achilles: { crest: "#c0392b", blazon: "Α", helm2: null },
  ajax:     { crest: null,      blazon: "Α", helm2: null },      // no crest: the plain wall
  atalanta: { crest: null,      blazon: null, helm2: "phrygian", bare: true },
  perseus:  { crest: "#7fd8d8", blazon: null, helm2: "phrygian" },
  circe:    { crest: null,      blazon: null, helm2: "phrygian", bare: true },
};

export function drawHero(hero) {
  if (!hero.alive) {
    const p = hero.commandPos;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(20,24,34,0.55)";
    ctx.fill();
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💀", p.x, p.y - 1);
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#ffcf52";
    ctx.fillText(Math.ceil(hero.respawn) + "s", p.x, p.y + 15);
    return;
  }

  const r = 14;
  if (state.heroSelected) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
    ctx.beginPath();
    ctx.arc(hero.x, hero.y, r + 6 + pulse * 2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(90,209,165,${0.5 + 0.4 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  groundShadow(hero.x + 2, hero.y + r * 0.85, r * 1.1, r * 0.45);

  const def = hero.def;
  const marks = HERO_MARKS[def.key] || {};
  drawHoplite(hero.x, hero.y, {
    // heroes grow visibly as they level, so a veteran reads as one
    s: def.figureScale + ((hero.level || 1) - 1) * 0.03,
    dir: faceTarget(hero), fighting: !!hero.target, weapon: def.weapon,
    tunic: [def.colors.light, def.colors.mid, def.colors.dark],
    helm: def.helm, cape: def.cape,
    crest: marks.crest ?? def.plume, blazon: marks.blazon,
    helm2: marks.helm2, bare: marks.bare,
  });

  const w = 34, h = 5, pct = Math.max(0, hero.hp / hero.maxHp);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(hero.x - w / 2, hero.y - r - 15, w, h);
  ctx.fillStyle = pct > 0.5 ? "#5ad1a5" : pct > 0.25 ? "#ffcf52" : "#ff6b6b";
  ctx.fillRect(hero.x - w / 2, hero.y - r - 15, w * pct, h);
}
