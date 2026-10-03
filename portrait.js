// 読み札の歌仙絵（歌人の姿）を SVG で描く
// 天皇・男性の貴族（束帯）・女性（十二単）・僧・蝉丸（頭巾の隠者）を描き分け、
// 天皇・皇族は御簾と繧繝縁（うんげんべり）の畳、ほかは高麗縁（こうらいべり）の畳に座らせる。
(function () {
  const EMPEROR = [1, 13, 15, 68, 77, 99, 100];
  const ROYAL_WOMAN = [2, 89];
  const WOMAN = [2, 9, 19, 38, 53, 54, 56, 57, 58, 59, 60, 61, 62, 65, 67, 72, 80, 88, 89, 90, 92];
  const MONK = [8, 12, 21, 47, 66, 69, 70, 76, 82, 83, 85, 86, 87, 95, 96];
  const HERMIT = [10];

  // 十二単の重ね色（外 → 内）
  const KASANE = [
    ['#5b1f2e', '#9c2f45', '#cc5f73', '#eba3b0', '#f7e0e4'],   // 紅梅
    ['#2f4a1f', '#5c7f2b', '#8fae4b', '#c9d98c', '#f1f4d6'],   // 萌黄
    ['#7a3b0c', '#b8650f', '#e09a26', '#f2c955', '#fbefc4'],   // 山吹
    ['#3b2753', '#5f4386', '#8d74b5', '#bfaedb', '#efe8f7'],   // 藤
    ['#6a1f1a', '#a4342a', '#2f5a3a', '#6e9a5e', '#eef0dc'],   // 松重
    ['#1f3550', '#2f5b85', '#5b8fc0', '#a8c8e3', '#eaf2f8'],   // 縹
  ];
  const ROBE_MAN = ['#1b1a20', '#221c26', '#16202b', '#1d1d1d'];        // 黒の袍
  const UNDER = ['#9b2b23', '#e8e1d0', '#7a2440', '#2d5a40'];            // 下襲の色
  const KESA = ['#8a5a2b', '#a77b2e', '#7d2d27', '#4b5a33', '#6b4a7a'];  // 袈裟の色
  const SKIN = '#f4e4cf', SKIN2 = '#e2c9ab', INK = '#17130f';

  const cat = no => HERMIT.includes(no) ? 'hermit' : MONK.includes(no) ? 'monk'
    : WOMAN.includes(no) ? 'woman' : EMPEROR.includes(no) ? 'emperor' : 'man';

  function tatami(royal, id) {
    // 上げ畳：手前に縁（へり）。天皇は繧繝縁、ほかは高麗縁
    const ferri = royal
      ? `<rect x="2" y="72" width="96" height="1.2" fill="#b3262b"/><rect x="2" y="73.2" width="96" height="1" fill="#e8b33a"/>
         <rect x="2" y="74.2" width="96" height="1" fill="#2c6a4a"/><rect x="2" y="75.2" width="96" height="1" fill="#2d4f8a"/>
         <rect x="2" y="76.2" width="96" height="0.8" fill="#f2ead8"/>`
      : `<rect x="2" y="72" width="96" height="5" fill="#f0ead8"/>
         <rect x="2" y="72" width="96" height="5" fill="url(#korai${id})"/>`;
    return `<defs><pattern id="korai${id}" width="6" height="5" patternUnits="userSpaceOnUse">
        <path d="M3 0.6 L5.2 2.5 L3 4.4 L0.8 2.5 Z" fill="none" stroke="#1d1d1d" stroke-width="0.5"/>
        <circle cx="3" cy="2.5" r="0.6" fill="#1d1d1d"/></pattern>
        <pattern id="igusa${id}" width="2" height="2" patternUnits="userSpaceOnUse">
        <rect width="2" height="2" fill="#cdbb78"/><rect width="2" height="0.6" fill="#bda865"/></pattern></defs>
      <polygon points="8,60 92,60 98,72 2,72" fill="url(#igusa${id})"/>
      <polygon points="8,60 92,60 92,61 8,61" fill="#a99350"/>
      ${ferri}`;
  }

  function misu() {
    // 御簾：細い竹の線と、帽額（もこう）の布、赤い房
    let lines = '';
    for (let x = 1; x < 100; x += 1.6) lines += `<line x1="${x}" y1="0" x2="${x}" y2="13" stroke="#8a6a35" stroke-width="0.45"/>`;
    return `<rect x="0" y="0" width="100" height="13" fill="#d9bf86"/>${lines}
      <rect x="0" y="0" width="100" height="3" fill="#5b2d1e"/>
      <rect x="0" y="13" width="100" height="1.6" fill="#5b2d1e"/>
      <path d="M22 14.6 v4 M78 14.6 v4" stroke="#b3262b" stroke-width="1.2"/>
      <circle cx="22" cy="19.5" r="1.4" fill="#b3262b"/><circle cx="78" cy="19.5" r="1.4" fill="#b3262b"/>`;
  }

  function face(kind, no) {
    const eye = `<path d="M41.6 21.6 q1.4 -0.7 2.6 0" stroke="${INK}" stroke-width="0.55" fill="none"/>`;
    const brow = kind === 'woman'
      ? `<ellipse cx="43.2" cy="17.4" rx="1.3" ry="0.75" fill="#3a2d26" opacity=".8"/>`        // 引眉
      : `<path d="M41.4 19.6 q1.6 -0.9 3 0" stroke="${INK}" stroke-width="0.5" fill="none"/>`;
    const beard = (kind === 'man' || kind === 'emperor') && no % 3 === 0
      ? `<path d="M41 26.2 q1.5 0.8 3 0 M42 27.4 q0.6 2.4 -0.2 3.6" stroke="${INK}" stroke-width="0.45" fill="none"/>` : '';
    return `<ellipse cx="46" cy="22.5" rx="6" ry="7.4" fill="${SKIN}" stroke="${SKIN2}" stroke-width="0.4"/>
      <ellipse cx="51.6" cy="22.8" rx="1.1" ry="1.8" fill="${SKIN}" stroke="${SKIN2}" stroke-width="0.4"/>
      ${brow}${eye}
      <path d="M40.6 23 q-0.8 1 0.3 1.6" stroke="${SKIN2}" stroke-width="0.5" fill="none"/>
      <ellipse cx="41.9" cy="26" rx="0.75" ry="0.45" fill="#b3262b"/>${beard}`;
  }

  // 束帯の男性（天皇は立纓の冠・黄櫨染）
  function man(no, emperor) {
    const robe = emperor ? (no % 2 ? '#8a6a2a' : '#efe9da') : ROBE_MAN[no % ROBE_MAN.length];
    const shade = emperor ? (no % 2 ? '#6e5420' : '#d7cfbd') : '#0d0c10';
    const under = UNDER[no % UNDER.length];
    const ei = emperor
      ? `<path d="M50.5 9 C51 3 54 0.5 57 0.8 L57.6 2.4 C55 2.6 53.2 5 53 9.4 Z" fill="${INK}"/>`        // 立纓
      : `<path d="M51.5 13 C60 12 68 16 72 26 C73 28 71 29 70 27 C66 19 60 15.5 51.5 15.5 Z" fill="${INK}"/>`; // 垂纓
    return `
      <path d="M78 58 C86 58 94 60 99 66 L99 72 L76 72 Z" fill="${under}"/>
      <path d="M40 30 C28 34 20 48 15 70 L87 70 C83 50 73 35 58 29.5 Z" fill="${robe}"/>
      <path d="M58 29.5 C70 35 80 48 84 66" stroke="${shade}" stroke-width="0.8" fill="none" opacity=".7"/>
      <path d="M16 66 L86 66 L87 70 L15 70 Z" fill="${shade}" opacity=".55"/>
      <ellipse cx="48.5" cy="30.5" rx="7.5" ry="2.6" fill="${shade}"/>
      <path d="M42 30.5 q6.5 2.4 13 0" stroke="${under}" stroke-width="0.9" fill="none"/>
      <path d="M36 38 C25 44 20 55 22 66 L46 66 C44 55 43 46 41 38 Z" fill="${robe}" stroke="${shade}" stroke-width="0.6"/>
      <path d="M22 64 q12 -2.4 24 0" stroke="${under}" stroke-width="1.2" fill="none"/>
      <line x1="37" y1="49" x2="33.4" y2="31" stroke="#efe4c6" stroke-width="2.3" stroke-linecap="round"/>
      <ellipse cx="37.4" cy="48.6" rx="2.2" ry="1.6" fill="${SKIN}"/>
      ${face('man', no)}
      ${ei}
      <path d="M39.4 19.6 C39 12.5 45 10 51 12 C53.4 13.4 53.8 17 52.6 19.8 C48 17.6 43.6 17.8 39.4 19.6 Z" fill="${INK}"/>
      <rect x="46.6" y="6.6" width="5.6" height="7.6" rx="2.4" fill="${INK}"/>`;
  }

  // 十二単の女性：裾と袖口に重ね色が段になってのぞく。長い黒髪を背に流す
  function woman(no) {
    const k = KASANE[no % KASANE.length];
    let layers = '';
    // 内側の衣ほど裾が下・外に広がる。内 → 外の順に描く
    for (let i = k.length - 1; i >= 0; i--) {
      const d = i * 2.2;                       // 0 = いちばん外（表着）
      const hem = 70 - (k.length - 1 - i) * 0 - (4 - i) * 0;
      layers += `<path d="M40 30 C${27 - d} 36 ${16 - d} 50 ${10 - d} ${hem - (k.length - 1 - i) * 2.2} L${92 + d} ${hem - (k.length - 1 - i) * 2.2} C${85 + d * 0.5} 52 74 36 58 29.5 Z" fill="${c(i)}"/>`;
    }
    function c(i) { return k[i]; }
    let sleeve = '';
    k.forEach((col, i) => {
      const r = 11 - i * 1.7;
      sleeve += `<ellipse cx="26" cy="57" rx="${r}" ry="${r * 0.8}" fill="${col}"/>`;
    });
    return `
      ${layers}
      <path d="M36 36 C24 42 17 51 17 61 C21 66 30 67 36 63 C38 55 40 46 40.5 37 Z" fill="${k[0]}"/>
      ${sleeve}
      <path d="M30 46 L20 35.5 A14 14 0 0 1 35 31 Z" fill="#e7c76a" stroke="#9c7a2a" stroke-width="0.5"/>
      <path d="M30 46 L23.5 33 M30 46 L27.4 31.6 M30 46 L31.4 31" stroke="#9c7a2a" stroke-width="0.4"/>
      <path d="M30 46 C27 51 26 55 27.5 60" stroke="${k[1]}" stroke-width="0.9" fill="none"/>
      <ellipse cx="45" cy="30.6" rx="6.4" ry="2.2" fill="${k[2]}"/>
      <path d="M40 30.6 q5 2 10 0" stroke="${k[4]}" stroke-width="0.9" fill="none"/>
      <path d="M50.5 16 C58 19 60 30 62 44 C63.5 56 68 64 80 70 L70 70 C62 64 58 54 56 44 C54.6 36 53.4 30 51.5 25 Z" fill="${INK}"/>
      ${face('woman', no)}
      <path d="M39.2 20.5 C38.4 11.5 47 9 52 12.6 C55 15 55.4 22 54.6 33 C52.6 27 51.6 21 50.4 17.4 C46.6 15.2 42.6 16.2 39.2 20.5 Z" fill="${INK}"/>`;
  }

  // 僧：剃った頭、墨染の衣、袈裟、数珠
  function monk(no) {
    const kesa = KESA[no % KESA.length];
    let grid = '';
    for (let i = 0; i < 6; i++) grid += `<path d="M${46 + i * 3.4} 31.5 L${61 + i * 2.3} 66" stroke="#00000033" stroke-width="0.5"/>`;
    return `
      <path d="M40 30 C28 34 20 48 15 70 L87 70 C83 50 73 35 58 29.5 Z" fill="#2c2a30"/>
      <path d="M43 31 L58 30 L78 66 L58 66 Z" fill="${kesa}"/>${grid}
      <path d="M58 66 L78 66 L79 70 L57 70 Z" fill="#00000030"/>
      <path d="M36 38 C25 44 20 55 22 66 L46 66 C44 55 43 46 41 38 Z" fill="#35323a" stroke="#1b1a1e" stroke-width="0.6"/>
      <ellipse cx="38" cy="50" rx="3.4" ry="2.2" fill="${SKIN}"/>
      <path d="M35 51 q3 5 6 0" stroke="#5a3a24" stroke-width="1" stroke-dasharray="0.9 0.6" fill="none"/>
      <ellipse cx="46" cy="21.5" rx="6.6" ry="7.8" fill="${SKIN}" stroke="${SKIN2}" stroke-width="0.4"/>
      <path d="M40 17 C41 12 50 11 52.4 16" stroke="#9fa0a6" stroke-width="2.2" fill="none" opacity=".35"/>
      <ellipse cx="51.8" cy="22.6" rx="1.1" ry="1.8" fill="${SKIN}" stroke="${SKIN2}" stroke-width="0.4"/>
      <path d="M41.4 19.8 q1.6 -0.9 3 0" stroke="${INK}" stroke-width="0.5" fill="none"/>
      <path d="M41.6 21.8 q1.4 -0.7 2.6 0" stroke="${INK}" stroke-width="0.55" fill="none"/>
      <path d="M40.4 23.2 q-0.8 1 0.3 1.6" stroke="${SKIN2}" stroke-width="0.5" fill="none"/>
      <ellipse cx="41.8" cy="26.2" rx="0.75" ry="0.45" fill="#a33a2a"/>`;
  }

  // 蝉丸：頭巾をかぶった隠者、杖
  function hermit(no) {
    return `
      <line x1="30" y1="70" x2="35" y2="18" stroke="#6b4a24" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M40 30 C28 34 20 48 15 70 L87 70 C83 50 73 35 58 29.5 Z" fill="#6d5a3e"/>
      <path d="M36 38 C25 44 20 55 22 66 L46 66 C44 55 43 46 41 38 Z" fill="#5b4a32" stroke="#3e3222" stroke-width="0.6"/>
      <ellipse cx="34" cy="44" rx="2.2" ry="1.7" fill="${SKIN}"/>
      ${face('man', no)}
      <path d="M38.6 22 C37 10 54 7 55 18 C55.6 24 55 30 53 34 C52 28 51.6 21 49.5 17.6 C46 16 42 17.4 38.6 22 Z" fill="#8a7650"/>`;
  }

  function portraitSVG(no) {
    const k = cat(no);
    const royal = k === 'emperor' || ROYAL_WOMAN.includes(no);
    const id = 'p' + no;
    let fig;
    if (k === 'woman') fig = woman(no);
    else if (k === 'monk') fig = monk(no);
    else if (k === 'hermit') fig = hermit(no);
    else fig = man(no, k === 'emperor');
    return `<svg class="kasen" viewBox="0 0 100 78" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      ${royal ? misu() : ''}${tatami(royal, id)}
      <g transform="translate(2 -6) scale(1.0)">${fig}</g></svg>`;
  }

  window.portraitSVG = portraitSVG;
})();
