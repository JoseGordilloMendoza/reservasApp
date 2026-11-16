/**
 * Isometric illustrations of the home page, drawn here instead of loaded as pictures: they weigh nothing, stay
 * sharp at any size and use the brand colors. Provisional until the designer delivers the final set.
 *
 * A point (x, y, z) of the scene lands on the screen at ((x - y) cos 30°, (x + y) sin 30° - z). A box shows three
 * faces: its top, the face toward +y (lower left) and the face toward +x (lower right). Boxes are drawn from the
 * back to the front, so nearer ones cover the ones behind.
 */

const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;

type Point = [number, number, number];

function at([x, y, z]: Point): string {
  return `${((x - y) * COS).toFixed(2)},${((x + y) * SIN - z).toFixed(2)}`;
}

function face(points: Point[], fill: string, extra: Record<string, string | number> = {}, key?: string) {
  return <polygon key={key} points={points.map(at).join(" ")} fill={fill} {...extra} />;
}

/** The three colors of a box: top (the lightest), lower left, lower right (the darkest). */
type Shades = [string, string, string];

function Box({ x, y, z, w, d, h, shades }: { x: number; y: number; z: number; w: number; d: number; h: number; shades: Shades }) {
  const [top, left, right] = shades;
  return (
    <g>
      {face([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], left)}
      {face([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], right)}
      {face([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], top)}
    </g>
  );
}

/** A line on a flat surface at height z. */
function flatLine(from: [number, number], to: [number, number], z: number, stroke: string, width = 1.2) {
  return <polyline points={[at([from[0], from[1], z]), at([to[0], to[1], z])].join(" ")} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" />;
}

/** A circle lying on a flat surface at height z (an ellipse on screen). */
function flatCircle(cx: number, cy: number, r: number, z: number, stroke: string, width = 1.2) {
  const points: string[] = [];
  for (let step = 0; step <= 32; step += 1) {
    const angle = (step / 32) * Math.PI * 2;
    points.push(at([cx + r * Math.cos(angle), cy + r * Math.sin(angle), z]));
  }
  return <polyline points={points.join(" ")} fill="none" stroke={stroke} strokeWidth={width} />;
}

const SLAB: Shades = ["#eef3ff", "#c9d6ff", "#a8bcff"];
const BLUE: Shades = ["#6f88ff", "#1238c9", "#0a24a3"];
const GRASS: Shades = ["#36c597", "#1f9271", "#16785c"];
const INK: Shades = ["#2a3f66", "#172b4d", "#0e1c36"];
const SUN: Shades = ["#ffd45c", "#e0a40f", "#b98500"];

/**
 * The hero scene: a platform with a small court, a calendar and a phone with a booking on its screen. Meant for a
 * blue background, in light and dark alike.
 */
export function HeroScene({ className }: { className?: string }) {
  return (
    <svg viewBox="-100 -58 214 176" aria-hidden="true" focusable="false" className={className}>
      {/* The platform. */}
      <Box x={0} y={0} z={0} w={120} d={100} h={8} shades={SLAB} />

      {/* A court, with its lines and a ball. */}
      <Box x={8} y={10} z={8} w={62} d={44} h={2} shades={GRASS} />
      {flatLine([12, 14], [66, 14], 10.2, "#ffffff")}
      {flatLine([66, 14], [66, 50], 10.2, "#ffffff")}
      {flatLine([66, 50], [12, 50], 10.2, "#ffffff")}
      {flatLine([12, 50], [12, 14], 10.2, "#ffffff")}
      {flatLine([39, 14], [39, 50], 10.2, "#ffffff")}
      {flatCircle(39, 32, 7, 10.2, "#ffffff")}

      {/* A calendar block, with the days on its front. */}
      <Box x={16} y={64} z={8} w={28} d={28} h={26} shades={BLUE} />
      <Box x={22} y={68} z={34} w={3} d={3} h={6} shades={INK} />
      <Box x={35} y={68} z={34} w={3} d={3} h={6} shades={INK} />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((column) => {
          const x = 20 + column * 8;
          const z = 12 + row * 6.5;
          const chosen = row === 1 && column === 1;
          return face(
            [[x, 92, z], [x + 6, 92, z], [x + 6, 92, z + 4.5], [x, 92, z + 4.5]],
            chosen ? "#ffd45c" : "#ffffff",
            { fillOpacity: chosen ? 1 : 0.85 },
            `${row}-${column}`,
          );
        }),
      )}

      {/* A coin-like price tag. */}
      <Box x={58} y={70} z={8} w={14} d={14} h={4} shades={SUN} />

      {/* The phone, standing, its screen facing lower right. */}
      <Box x={92} y={34} z={8} w={7} d={34} h={60} shades={INK} />
      {face([[99.2, 37, 14], [99.2, 65, 14], [99.2, 65, 64], [99.2, 37, 64]], "#eaf1ff")}
      {face([[99.4, 40, 52], [99.4, 62, 52], [99.4, 62, 60], [99.4, 40, 60]], "#052ff7")}
      {face([[99.4, 40, 42], [99.4, 62, 42], [99.4, 62, 47], [99.4, 40, 47]], "#a8bcff")}
      {face([[99.4, 40, 34], [99.4, 56, 34], [99.4, 56, 39], [99.4, 40, 39]], "#a8bcff")}
      {face([[99.4, 40, 18], [99.4, 62, 18], [99.4, 62, 26], [99.4, 40, 26]], "#2fb98f")}

      {/* A check that floats above the calendar. */}
      <g transform={`translate(${at([30, 78, 60]).replace(",", " ")})`}>
        <circle r="11" fill="#ffffff" />
        <path d="M-5 0.5 L-1.5 4 L5.5 -3.5" fill="none" stroke="#2fb98f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** A small shop with an awning and a calendar on its window, for the band that speaks to businesses. */
export function ShopScene({ className }: { className?: string }) {
  const STRIPES = ["#ffffff", "#f27ba4"];
  return (
    <svg viewBox="-70 -62 140 120" aria-hidden="true" focusable="false" className={className}>
      <Box x={0} y={0} z={0} w={80} d={70} h={6} shades={SLAB} />
      {/* The building. */}
      <Box x={14} y={12} z={6} w={44} d={40} h={42} shades={["#ffffff", "#dce6ff", "#bccdff"]} />
      {/* The door and the window on the front faces. */}
      {face([[30, 52, 6], [40, 52, 6], [40, 52, 28], [30, 52, 28]], "#172b4d")}
      {face([[58, 20, 18], [58, 44, 18], [58, 44, 36], [58, 20, 36]], "#5fb4f0")}
      {face([[58, 26, 24], [58, 38, 24], [58, 38, 32], [58, 26, 32]], "#ffffff")}
      {/* The awning, in stripes, over the front. */}
      {[0, 1, 2, 3, 4, 5].map((index) =>
        face(
          [
            [14 + index * (44 / 6), 52, 44],
            [14 + (index + 1) * (44 / 6), 52, 44],
            [14 + (index + 1) * (44 / 6), 58, 38],
            [14 + index * (44 / 6), 58, 38],
          ],
          STRIPES[index % 2]!,
          {},
          `awning-${index}`,
        ),
      )}
      {/* A sign on the roof. */}
      <Box x={24} y={26} z={48} w={22} d={4} h={10} shades={BLUE} />
      {/* A plant by the door. */}
      <Box x={4} y={56} z={6} w={6} d={6} h={6} shades={SUN} />
      <g transform={`translate(${at([7, 59, 18]).replace(",", " ")})`}>
        <circle r="6" fill="#2fb98f" />
      </g>
    </svg>
  );
}
