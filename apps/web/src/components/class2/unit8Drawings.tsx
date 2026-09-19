/**
 * Unit 8 illustrations: Mita's family and the family rhyme.
 *
 * Original artwork — the NCTB pictures stay in the book. Every member of the
 * family is the same `Person` as the rest of the course with a few things
 * changed (hair, glasses, moustache, size), so the family reads as one family
 * and a child can tell grandpa from father by what is different, not by a
 * label.
 */
import { PALETTE } from './alphabetDrawings';
import { Bg, Person } from './unit3Drawings';

const C = PALETTE;

type Draw = (animate: boolean) => React.ReactNode;

const GREY = '#d9dde3';
const DARK = '#2f2a28';

/** A person, positioned and scaled so that it sits on the ground of a 100x100 card. */
function At({ x = 0, s = 1, children }: { x?: number; s?: number; children: React.ReactNode }) {
  // Person is drawn 14..94 tall; keep its feet on y = 94 whatever the scale.
  return <g transform={`translate(${x} ${94 * (1 - s)}) scale(${s})`}>{children}</g>;
}

function Glasses() {
  return (
    <g fill="none" stroke={C.ink} strokeWidth="1.6">
      <circle cx="44" cy="34" r="4.6" /><circle cx="56" cy="34" r="4.6" /><path d="M48.6 34 h2.8" />
    </g>
  );
}

function Moustache({ colour = DARK }: { colour?: string }) {
  return <path d="M43 39.5 q3.5 -3 7 0 q3.5 -3 7 0 q-3.5 4 -7 1.5 q-3.5 2.5 -7 -1.5 Z" fill={colour} />;
}

function LongHair({ colour = DARK }: { colour?: string }) {
  return (
    <g fill="none" stroke={colour} strokeWidth="7" strokeLinecap="round">
      <path d="M36 30 q-5 20 3 32" /><path d="M64 30 q5 20 -3 32" />
    </g>
  );
}

function Pigtails() {
  return (
    <g fill={DARK}>
      <circle cx="33" cy="38" r="5" /><circle cx="67" cy="38" r="5" />
    </g>
  );
}

/* Each family member is a function so it can be reused at a different size. */
const Mother = () => (<><Person shirt="#b8578f" /><LongHair /></>);
const Father = () => (<><Person shirt={C.deep} /><Moustache /></>);
const Sister = () => (<><Person shirt={C.pink} /><Pigtails /></>);
const Brother = () => (<Person shirt={C.green} />);
const Me = () => (<Person shirt={C.orange} armR="M62 54 q-8 10 -14 6" />);
const Grandpa = () => (
  <>
    <Person shirt="#7a8f6a" hair={GREY} />
    <Glasses /><Moustache colour={GREY} />
    <path d="M78 58 v36" stroke={C.brown} strokeWidth="4" strokeLinecap="round" />
  </>
);
const Grandma = () => (
  <>
    <Person shirt={C.teal} hair={GREY} />
    <circle cx="50" cy="15" r="6" fill={GREY} /><Glasses />
  </>
);
const Uncle = () => (<><Person shirt="#a9713f" /><Moustache /></>);
const Aunt = () => (<><Person shirt={C.yellow} /><LongHair /><circle cx="35" cy="42" r="2" fill={C.orange} /><circle cx="65" cy="42" r="2" fill={C.orange} /></>);

export const UNIT8_DRAWINGS: Record<string, Draw> = {
  'fam-mother': () => <Bg tint="#fdeef7"><At><Mother /></At></Bg>,
  'fam-father': () => <Bg tint="#eaf3ff"><At><Father /></At></Bg>,
  'fam-sister': () => <Bg tint="#fff0f6"><At x={10} s={0.82}><Sister /></At></Bg>,
  'fam-brother': () => <Bg tint="#eefbf3"><At x={10} s={0.82}><Brother /></At></Bg>,
  'fam-me': () => <Bg tint="#fff4e3"><At x={12} s={0.78}><Me /></At></Bg>,
  'fam-grandpa': () => <Bg tint="#f3f5f0"><At><Grandpa /></At></Bg>,
  'fam-grandma': () => <Bg tint="#eefaf8"><At><Grandma /></At></Bg>,
  'fam-uncle': () => <Bg tint="#fbf1e6"><At><Uncle /></At></Bg>,
  'fam-aunt': () => <Bg tint="#fffbe0"><At><Aunt /></At></Bg>,
  'fam-cousins': () => (
    <Bg tint="#f1eeff">
      <At x={-14} s={0.6}><Brother /></At>
      <At x={30} s={0.6}><Sister /></At>
    </Bg>
  ),
  'fam-parents': () => (
    <Bg tint="#eef2ff">
      <At x={-12} s={0.72}><Father /></At>
      <At x={40} s={0.72}><Mother /></At>
    </Bg>
  ),

  /* --- the people of the reading passages -------------------------------- */
  mita: () => (
    <Bg tint="#fff1ee">
      <At><Person shirt={C.red} armR="M62 54 q4 -4 -6 -14" /><Pigtails /></At>
    </Bg>
  ),
  kamal: () => (
    <Bg tint="#eaf3ff">
      <At>
        <rect x="26" y="52" width="14" height="20" rx="4" fill={C.orange} />
        <Person shirt={C.white} armR="M62 54 q12 -6 14 -20" armClass="c2-wave-hand" />
      </At>
    </Bg>
  ),
  colouring: () => (
    <Bg tint="#fff8e0">
      <rect x="14" y="26" width="46" height="58" rx="5" fill={C.white} stroke={C.grey} strokeWidth="2.5" />
      <path d="M22 60 q10 -22 20 0 q6 8 12 -6" stroke={C.blue} strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="30" cy="42" r="6" fill={C.yellow} />
      {[[66, C.red], [74, C.green], [82, C.blue]].map(([x, c], i) => (
        <g key={i} transform={`rotate(18 ${x} 60)`}>
          <rect x={(x as number) - 3.5} y="34" width="7" height="34" rx="2" fill={c as string} />
          <path d={`M${(x as number) - 3.5} 68 h7 l-3.5 8 Z`} fill={C.sand} />
        </g>
      ))}
    </Bg>
  ),
  'health-worker': () => (
    <Bg tint="#fff0f0">
      <At><Person shirt={C.white} /></At>
      <rect x="56" y="58" width="24" height="22" rx="4" fill={C.white} stroke={C.red} strokeWidth="2.5" />
      <path d="M68 62 v14 M61 69 h14" stroke={C.red} strokeWidth="4" strokeLinecap="round" />
    </Bg>
  ),
  motorbike: () => (
    <Bg tint="#eef2f7">
      <circle cx="26" cy="68" r="14" fill="none" stroke={C.ink} strokeWidth="4" />
      <circle cx="74" cy="68" r="14" fill="none" stroke={C.ink} strokeWidth="4" />
      <path d="M26 68 L44 46 H62 L74 68 M44 46 L36 34 h-8 M62 46 L66 32 h10" stroke="#c93c3c" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M40 46 h22 l4 -6 h-28 Z" fill="#c93c3c" />
    </Bg>
  ),
  farmer: () => (
    <Bg tint="#eaf7ee">
      <path d="M0 76 H100 V100 H0 Z" fill="#7cc36a" />
      {[8, 22, 36, 62, 78, 92].map((x) => <path key={x} d={`M${x} 90 q2 -14 6 -18 M${x + 4} 90 q0 -12 -3 -16`} stroke="#3f9e4d" strokeWidth="3" strokeLinecap="round" fill="none" />)}
      <path d="M22 30 q28 -24 56 0 Z" fill="#555c66" />
      <path d="M50 30 V74" stroke={C.ink} strokeWidth="3" />
      <g transform="translate(0 6) scale(0.86)"><Person shirt={C.white} /></g>
    </Bg>
  ),
  field: () => (
    <Bg tint="#eaf7ee">
      <path d="M0 40 H100 V100 H0 Z" fill="#7cc36a" />
      {[10, 26, 42, 58, 74, 90].map((x) => (
        <path key={x} d={`M${x} 88 q-2 -20 2 -32 M${x + 5} 88 q1 -16 -2 -26 M${x - 4} 88 q-3 -12 -1 -20`} stroke="#3f9e4d" strokeWidth="3" strokeLinecap="round" fill="none" />
      ))}
      <path d="M0 40 q30 -10 100 0" stroke="#b6e0a8" strokeWidth="3" fill="none" />
    </Bg>
  ),
  cooking: () => (
    <Bg tint="#fff1e6">
      <path d="M24 42 h52 q0 30 -26 32 q-26 -2 -26 -32 Z" fill="#8a6a55" stroke="#5c4636" strokeWidth="3" strokeLinejoin="round" />
      <rect x="20" y="38" width="60" height="7" rx="3" fill="#a8846a" />
      <path d="M36 28 q-4 -8 0 -14 M50 28 q-4 -8 0 -14 M64 28 q-4 -8 0 -14" stroke={C.grey} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M22 84 L48 74 M78 84 L52 74" stroke={C.brown} strokeWidth="5" strokeLinecap="round" />
      <path d="M38 88 q12 -18 24 0 q-12 -6 -24 0 Z" fill={C.orange} />
    </Bg>
  ),
  umbrella: () => (
    <Bg tint="#eaf3ff">
      <path d="M10 52 a40 34 0 0 1 80 0 q-10 -8 -20 0 q-10 -8 -20 0 q-10 -8 -20 0 q-10 -8 -20 0 Z" fill="#c93c3c" />
      <path d="M50 52 V84 q0 8 -8 8 q-6 0 -6 -6" stroke={C.ink} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M50 18 V12" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
    </Bg>
  ),

  'family-tree': () => (
    <Bg tint="#eefaea">
      <path d="M50 92 V10" stroke="#2f9e4d" strokeWidth="5" strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map((row) => {
        const y = 20 + row * 16;
        return (
          <g key={row}>
            <ellipse cx="30" cy={y} rx="16" ry="8" fill="#3fb45a" /><ellipse cx="70" cy={y} rx="16" ry="8" fill="#3fb45a" />
            <circle cx="30" cy={y} r="5.6" fill={C.skin} stroke={C.white} strokeWidth="1.5" />
            <circle cx="70" cy={y} r="5.6" fill={C.skin} stroke={C.white} strokeWidth="1.5" />
            <circle cx="28.4" cy={y - 1} r="0.9" fill={C.ink} /><circle cx="31.6" cy={y - 1} r="0.9" fill={C.ink} />
            <circle cx="68.4" cy={y - 1} r="0.9" fill={C.ink} /><circle cx="71.6" cy={y - 1} r="0.9" fill={C.ink} />
          </g>
        );
      })}
    </Bg>
  ),
};
