/**
 * Unit 10 illustrations: Story Time — "The crow and the jar" and "The boys
 * and the frogs".
 *
 * Original artwork, like the rest of the set — the NCTB pictures stay in the
 * book. Consecutive book panels that show the same pose (the crow flying
 * toward the jar in two panels, the crow sitting on the jar in two more) share
 * one illustration key rather than being redrawn, the same shortcut Unit 5's
 * story lesson already takes with "rima-water".
 */
import { PALETTE } from './alphabetDrawings';
import { Bg, Person } from './unit3Drawings';

const C = PALETTE;

type Draw = (animate: boolean) => React.ReactNode;

const SKY = '#dff0ff';
const POND = '#bfe3f0';

function Sun({ x = 78, y = 20, r = 11 }: { x?: number; y?: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={C.red} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line key={deg} x1={x} y1={y} x2={x} y2={y - r - 6} stroke={C.orange}
              strokeWidth="3" strokeLinecap="round" transform={`rotate(${deg} ${x} ${y})`} />
      ))}
    </g>
  );
}

function GroundTree({ x = 24 }: { x?: number }) {
  return (
    <g>
      <path d={`M${x} 92 q-2 -30 6 -46`} stroke={C.brown} strokeWidth="7"
            strokeLinecap="round" fill="none" />
      <circle cx={x + 8} cy={40} r="20" fill={C.leaf} />
      <circle cx={x - 8} cy={48} r="14" fill="#3fa050" />
    </g>
  );
}

/** The branch the crow starts on, bare against the sky. */
function Branch() {
  return (
    <path d="M10 66 q28 -6 50 -2" stroke={C.brown} strokeWidth="6"
          strokeLinecap="round" fill="none" />
  );
}

/**
 * The water jar, drawn open at the front so the level inside is visible. The
 * whole story turns on how high the water is, and a child cannot follow that
 * from an opaque pot.
 */
function Jar({ water }: { water: 'none' | 'low' | 'brim' }) {
  return (
    <g>
      <ellipse cx="50" cy="70" rx="23" ry="20" fill={C.wood}
               stroke={C.brown} strokeWidth="3" />
      <path d="M40 52 q10 -5 20 0 l-3 10 q-7 -3 -14 0 Z" fill={C.wood}
            stroke={C.brown} strokeWidth="2.5" strokeLinejoin="round" />
      <ellipse cx="50" cy="72" rx="15" ry="14" fill="#f2e2ca" />
      {water === 'low' && <ellipse cx="50" cy="82" rx="13" ry="4" fill={C.blue} />}
      {water === 'brim' && <ellipse cx="50" cy="74" rx="15" ry="12" fill={C.blue} />}
      <ellipse cx="50" cy="50" rx="13" ry="4.5" fill={C.brown} />
      <ellipse cx="50" cy="50" rx="9" ry="2.8"
               fill={water === 'brim' ? C.blue : '#6f4423'} />
      {([[72, 84], [78, 89], [68, 91]] as const).map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r="3.2" fill={C.grey} />
      ))}
    </g>
  );
}

/** One crow, perched, flying or drinking. Reused across every scene so it
 *  reads as the same bird throughout the story. */
function Crow({
  x = 50, y = 50, pose = 'perched', flip = false,
}: { x?: number; y?: number; pose?: 'perched' | 'flying' | 'drinking'; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) ${flip ? 'scale(-1 1)' : ''}`}>
      {pose === 'flying' ? (
        <>
          <ellipse cx="0" cy="0" rx="16" ry="8" fill={C.black} transform="rotate(-14)" />
          <path d="M-4 -4 q-16 -14 -26 -6 q10 4 22 10 Z" fill="#1f2226" />
          <path d="M4 -4 q16 -14 26 -6 q-10 4 -22 10 Z" fill="#1f2226" />
          <circle cx="14" cy="-6" r="7" fill={C.black} />
          <path d="M20 -6 l9 3 -9 3 Z" fill={C.orange} />
        </>
      ) : pose === 'drinking' ? (
        <>
          <ellipse cx="0" cy="0" rx="15" ry="10" fill={C.black} transform="rotate(-16)" />
          <circle cx="-15" cy="7" r="7" fill={C.black} />
          <path d="M-21 8 l-9 4 9 3 Z" fill={C.orange} />
          <circle cx="-16" cy="4" r="1.6" fill={C.white} />
          <path d="M-2 8 l-1 10 M6 7 l1 10" stroke={C.orange} strokeWidth="2.8"
                strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="0" cy="0" rx="15" ry="10" fill={C.black} />
          <circle cx="12" cy="-10" r="8" fill={C.black} />
          <path d="M19 -10 l9 3 -9 3 Z" fill={C.orange} />
          <circle cx="15" cy="-12" r="1.6" fill={C.white} />
          <path d="M-6 -6 q-10 -4 -14 4 q8 4 14 -1 Z" fill="#1f2226" />
          <path d="M-9 8 l-2 10 M7 8 l2 10" stroke={C.orange} strokeWidth="2.8"
                strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

function Pebbles({ x = 68, y = 84 }: { x?: number; y?: number }) {
  return (
    <>
      {([[0, 0], [8, 3], [-6, 4], [14, -2]] as const).map(([dx, dy], i) => (
        <circle key={i} cx={x + dx} cy={y + dy} r="3" fill={C.grey} />
      ))}
    </>
  );
}

/**
 * The pond: a grassy bank the boys stand on, water below it, and frogs on
 * lily pads. `dead` turns the last frog belly-up, which is the one thing in
 * this story a child has to be able to see rather than be told.
 */
function Pond({ frogs = 3, dead = false }: { frogs?: number; dead?: boolean }) {
  const pads = ([[22, 80], [48, 87], [74, 79], [86, 92], [36, 94]] as const)
    .slice(0, frogs + (dead ? 1 : 0));
  return (
    <>
      <path d="M0 44 q50 -6 100 0 V72 H0 Z" fill="#7cc36a" />
      <path d="M0 64 q50 -8 100 0 V100 H0 Z" fill={POND} />
      <ellipse cx="14" cy="70" rx="8" ry="3.5" fill={C.white} stroke={C.pink} strokeWidth="1.5" />
      <ellipse cx="62" cy="72" rx="6" ry="2.8" fill={C.white} stroke={C.pink} strokeWidth="1.5" />
      {pads.map(([px, py], i) => {
        const isDead = dead && i === pads.length - 1;
        return (
          <g key={i}>
            <ellipse cx={px} cy={py} rx="11" ry="5" fill={C.leaf} />
            {isDead ? (
              <g transform={`translate(${px} ${py - 4})`}>
                <ellipse cx="0" cy="0" rx="7" ry="4.5" fill="#cfe0a8" />
                <path d="M-5 -3 l-3 -5 M5 -3 l3 -5 M-4 3 l-4 4 M4 3 l4 4"
                      stroke="#8aa86a" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : (
              <g transform={`translate(${px} ${py - 4})`}>
                <ellipse cx="0" cy="0" rx="7" ry="5" fill="#5cb85c" />
                <circle cx="-3" cy="-4" r="2.2" fill={C.white} />
                <circle cx="3" cy="-4" r="2.2" fill={C.white} />
                <circle cx="-3" cy="-4" r="1" fill={C.ink} />
                <circle cx="3" cy="-4" r="1" fill={C.ink} />
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}

/** The stones the boys find by the road, piled on the bank. */
function StonePile({ x = 82, y = 58 }: { x?: number; y?: number }) {
  return (
    <>
      {([[0, 0], [7, 2], [-6, 3], [2, 5]] as const).map(([dx, dy], i) => (
        <circle key={i} cx={x + dx} cy={y + dy} r="3" fill="#9aa7b4" />
      ))}
    </>
  );
}

/** Three boys standing at the pond's edge — the book's own trio. */
function Boys({ mood = 'neutral' }: { mood?: 'neutral' | 'throwing' | 'sorry' }) {
  const arm = mood === 'throwing' ? 'M62 54 q14 -10 16 -26' : mood === 'sorry'
    ? 'M62 54 q6 4 4 14' : undefined;
  return (
    <g>
      <g transform="translate(-14 4) scale(0.56)">
        <Person shirt={C.teal} mouth={mood === 'sorry' ? 'flat' : 'smile'} armR={arm} />
      </g>
      <g transform="translate(16 0) scale(0.6)">
        <Person shirt={C.orange} mouth={mood === 'sorry' ? 'flat' : 'smile'} armR={arm} />
      </g>
      <g transform="translate(44 4) scale(0.56)">
        <Person shirt={C.white} hair="#3b2b45" mouth={mood === 'sorry' ? 'flat' : 'smile'} armR={arm} />
      </g>
    </g>
  );
}

export const UNIT10_DRAWINGS: Record<string, Draw> = {
  /* --- Lesson 1: The crow and the jar ------------------------------------ */
  'crow-thirsty': () => (
    <Bg tint={SKY}>
      <Sun />
      <Branch />
      <Crow x={36} y={48} pose="perched" />
    </Bg>
  ),

  'crow-searching': () => (
    <Bg tint={SKY}>
      <Sun x={84} y={16} r={9} />
      <Crow x={46} y={50} pose="flying" flip />
    </Bg>
  ),

  'jar-under-tree': () => (
    <Bg tint="#eef7e6">
      <GroundTree x={22} />
      <Jar water="none" />
    </Bg>
  ),

  'crow-to-jar': () => (
    <Bg tint="#eef7e6">
      <GroundTree x={20} />
      <Jar water="none" />
      <Crow x={70} y={28} pose="flying" />
    </Bg>
  ),

  'crow-on-jar': () => (
    <Bg tint="#eef7e6">
      <GroundTree x={20} />
      <Jar water="low" />
      <Crow x={62} y={38} pose="perched" />
    </Bg>
  ),

  'crow-pebble': () => (
    <Bg tint="#eef7e6">
      <GroundTree x={20} />
      <Jar water="low" />
      <Pebbles />
      <Crow x={70} y={30} pose="flying" />
    </Bg>
  ),

  'jar-rising': () => (
    <Bg tint="#eef7e6">
      <GroundTree x={20} />
      <Jar water="brim" />
      <Crow x={70} y={26} pose="flying" />
    </Bg>
  ),

  'crow-drinks': () => (
    <Bg tint="#eef7e6">
      <GroundTree x={20} />
      <Jar water="brim" />
      <Crow x={72} y={40} pose="drinking" />
    </Bg>
  ),

  'crow-happy': () => (
    <Bg tint={SKY}>
      <Sun x={84} y={16} r={9} />
      <Branch />
      <Crow x={46} y={40} pose="flying" />
    </Bg>
  ),

  /* --- Lesson 2: The boys and the frogs ---------------------------------- */
  'pond-frogs': () => (
    <Bg tint="#eaf7ff">
      <Pond frogs={3} />
    </Bg>
  ),

  'boys-pond-stones': () => (
    <Bg tint="#eaf7ff">
      <Pond frogs={3} />
      <StonePile />
      <g transform="translate(2 -4)"><Boys /></g>
    </Bg>
  ),

  'boys-throw-stones': () => (
    <Bg tint="#eaf7ff">
      <Pond frogs={3} />
      <StonePile />
      <g transform="translate(2 -4)"><Boys mood="throwing" /></g>
      {([[30, 44], [22, 54], [14, 64]] as const).map(([sx, sy], i) => (
        <circle key={i} cx={sx} cy={sy} r="3" fill="#9aa7b4" />
      ))}
    </Bg>
  ),

  'frog-dead-shout': () => (
    <Bg tint="#eaf7ff">
      <Pond frogs={2} dead />
    </Bg>
  ),

  'frog-speaks': () => (
    <Bg tint="#eaf7ff">
      <Pond frogs={2} dead />
      <g transform="translate(2 -4)"><Boys /></g>
      {/* The bubble sits low, over the water: it is the frog who says this,
          not one of the boys. */}
      <path d="M44 78 l4 7 l8 -7 Z" fill={C.white} stroke={C.leaf} strokeWidth="2.5"
            strokeLinejoin="round" />
      <rect x="30" y="64" width="44" height="15" rx="7.5" fill={C.white}
            stroke={C.leaf} strokeWidth="2.5" />
      <text x="52" y="75" textAnchor="middle" fontSize="9" fontWeight="800"
            fill={C.leaf}>Stop!</text>
    </Bg>
  ),

  'boys-sorry': () => (
    <Bg tint="#eaf7ff">
      <Pond frogs={2} dead />
      <g transform="translate(2 -4)"><Boys mood="sorry" /></g>
    </Bg>
  ),
  /* --- the words themselves ----------------------------------------------
   * The story panels above are wide scenes. A vocabulary card is shown at
   * about 56px, where a wide scene turns to mush, so each word gets a picture
   * drawn for that size: one subject, close up, and nothing else in the frame
   * that a child could mistake for the word being taught.
   *
   * "branch" is not here — Unit 5 already draws one, and the set reuses a key
   * rather than drawing the same thing twice.
   * ---------------------------------------------------------------------- */

  /** A close-up, because thirst lives in the open beak and the dry tongue,
   *  and both vanish at the size the wide crow panels are shown at. */
  thirsty: (animate) => (
    <Bg tint="#fff1e0">
      <Sun x={16} y={18} r={9} />
      <g transform="translate(32 60)">
        <circle cx="0" cy="0" r="21" fill={C.black} />
        <circle cx="6" cy="-7" r="4.5" fill={C.white} />
        <circle cx="7" cy="-7" r="2.2" fill={C.ink} />
        <path d="M16 -7 L48 -13 L18 3 Z" fill={C.orange} />
        <path d="M17 5 L44 16 L16 10 Z" fill="#d97f30" />
        <path d="M21 5 q7 3 11 5" stroke={C.pink} strokeWidth="3.5"
              strokeLinecap="round" fill="none" />
      </g>
      {/* what it wants, and cannot reach */}
      <g className={animate ? 'c2-pulse' : undefined}
         style={{ transformOrigin: '74px 22px' }}>
        <circle cx="74" cy="22" r="13" fill={C.white} stroke={C.blue} strokeWidth="2.5" />
        <path d="M74 14 q7 9 7 12 a7 7 0 0 1 -14 0 q0 -3 7 -12 Z" fill={C.blue} />
      </g>
      <circle cx="59" cy="34" r="3" fill={C.white} stroke={C.blue} strokeWidth="1.8" />
    </Bg>
  ),

  /** Small, smooth and many — one at a time is all a crow can carry. */
  pebbles: () => (
    <Bg tint="#fdf3e0">
      <path d="M0 68 q50 -8 100 0 V100 H0 Z" fill={C.sand} />
      {([[26, 74, 8, 6, -12], [50, 78, 9.5, 7, 8], [74, 73, 8, 6, -6],
         [38, 89, 9, 6.5, 6], [64, 90, 8.5, 6, -10], [88, 85, 7, 5, 10]] as const)
        .map(([x, y, rx, ry, rot], i) => (
          <g key={i} transform={`rotate(${rot} ${x} ${y})`}>
            <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={i % 2 ? C.light : '#cfd8e2'}
                     stroke={C.grey} strokeWidth="2" />
            <ellipse cx={x - rx * 0.3} cy={y - ry * 0.4} rx={rx * 0.28} ry={ry * 0.22}
                     fill={C.white} opacity="0.75" />
          </g>
        ))}
    </Bg>
  ),

  /** The word is the rim, not the water, so the rim is ringed and pointed at
   *  — otherwise this is just the full jar the story already shows. */
  brim: () => (
    <Bg tint="#eef7e6">
      <Jar water="brim" />
      <ellipse cx="50" cy="50" rx="18" ry="7.5" fill="none" stroke={C.red} strokeWidth="3" />
      <path d="M50 16 v16 m-6 -6 l6 6 l6 -6" stroke={C.red} strokeWidth="3.5"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Bg>
  ),

  /** Bigger than the pebbles and sharp-edged: these are thrown, not dropped,
   *  and the two words sit in the same unit a page apart. */
  stones: () => (
    <Bg tint="#eef1f4">
      <path d="M0 66 q50 -6 100 0 V100 H0 Z" fill="#cfd8c4" />
      <path d="M0 62 q50 -6 100 0 v8 q-50 -6 -100 0 Z" fill="#bdb5a7" />
      <path d="M22 94 l-12 -13 l9 -14 l18 3 l6 16 l-9 11 Z" fill="#8d98a4"
            stroke={C.ink} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M58 96 l-10 -15 l11 -13 l15 4 l4 16 l-10 11 Z" fill="#a6b1bd"
            stroke={C.ink} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M88 88 l-9 -11 l8 -11 l13 5 v13 l-8 7 Z" fill="#8d98a4"
            stroke={C.ink} strokeWidth="2.5" strokeLinejoin="round" />
    </Bg>
  ),

  /** Two of the story's boys, laughing at what they have just done. */
  laughing: (animate) => (
    <Bg tint="#fff6e0">
      <g className={animate ? 'c2-bounce' : undefined}>
        <g transform="translate(-14 14) scale(0.72)">
          <Person shirt={C.teal} mouth="laugh" eyes="happy"
                  armL="M38 54 q-12 -4 -12 -18" armR="M62 54 q12 -4 12 -18" />
        </g>
        <g transform="translate(22 16) scale(0.7)">
          <Person shirt={C.orange} hair="#3b2b45" mouth="laugh" eyes="happy"
                  armL="M38 54 q-12 4 -10 18" armR="M62 54 q12 -8 10 -20" />
        </g>
      </g>
      <path d="M8 28 l9 5 M17 14 l4 10 M94 30 l-9 5 M86 16 l-4 10"
            stroke={C.orange} strokeWidth="3.5" strokeLinecap="round" />
    </Bg>
  ),

  /** It is the frogs who shout in this story, so a frog does it here: mouth
   *  wide open, and the sound coming out of both sides of the frame. */
  shout: (animate) => (
    <Bg tint="#eaf7ff">
      <ellipse cx="50" cy="92" rx="30" ry="7" fill={C.leaf} />
      <g transform="translate(50 56)">
        <ellipse cx="0" cy="8" rx="25" ry="21" fill="#5cb85c" />
        <circle cx="-13" cy="-13" r="9.5" fill="#5cb85c" />
        <circle cx="13" cy="-13" r="9.5" fill="#5cb85c" />
        <circle cx="-13" cy="-14" r="5.5" fill={C.white} />
        <circle cx="13" cy="-14" r="5.5" fill={C.white} />
        <circle cx="-12" cy="-14" r="2.6" fill={C.ink} />
        <circle cx="14" cy="-14" r="2.6" fill={C.ink} />
        <ellipse cx="0" cy="13" rx="13" ry="12" fill="#7a2f34" />
        <ellipse cx="0" cy="20" rx="8" ry="5" fill={C.pink} />
      </g>
      <g className={animate ? 'c2-pulse' : undefined}
         style={{ transformOrigin: '50px 58px' }}>
        <path d="M82 44 q9 12 0 24 M92 34 q15 22 0 44" stroke={C.orange}
              strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M18 44 q-9 12 0 24 M8 34 q-15 22 0 44" stroke={C.orange}
              strokeWidth="4" strokeLinecap="round" fill="none" />
      </g>
    </Bg>
  ),

  /** A boy saying it, in the same bubble the frog gets on the page before. */
  sorry: () => (
    <Bg tint="#eaf7ff">
      <g transform="translate(-6 20) scale(0.72)">
        <Person shirt={C.teal} mouth="flat"
                armL="M38 54 q-7 8 -3 20" armR="M62 54 q7 8 3 20" />
      </g>
      <path d="M50 34 l-10 11 l14 2 Z" fill={C.white} stroke={C.deep}
            strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="44" y="14" width="52" height="22" rx="11" fill={C.white}
            stroke={C.deep} strokeWidth="2.5" />
      <text x="70" y="30" textAnchor="middle" fontSize="13" fontWeight="800"
            fill={C.deep}>Sorry</text>
    </Bg>
  ),
};
