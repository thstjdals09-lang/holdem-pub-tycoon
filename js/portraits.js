// DealerPortraits: 딜러 16명의 치비 초상화를 SVG로 그려서 data URI로 돌려준다.
// 외부 이미지 에셋 없이 도감/가챠 연출에 쓸 일러스트를 확보하기 위한 모듈.
// 아트 방향: 쿠키런류의 두꺼운 아웃라인 + 셀셰이딩 + 파스텔, 3D 씬 팔레트와 톤을 맞췄다.
const DealerPortraits = (() => {
  const OUTLINE = "#3a2a30";

  // 등급별 배경 그라디언트 / 테두리
  const RARITY_STYLE = {
    common: { a: "#e9e9ef", b: "#c7c7d4", ring: "#9b9b9b" },
    rare: { a: "#d6ecff", b: "#9fccff", ring: "#4fa3ff" },
    epic: { a: "#f0dcff", b: "#cfa4ff", ring: "#c86bff" },
    legendary: { a: "#fff0c9", b: "#ffd166", ring: "#ffb400" },
  };

  // 딜러별 외형 정의 — 이름/설명과 맞아떨어지도록 하나씩 지정했다.
  const LOOKS = {
    minsu: { skin: "#ffd9b3", hair: "#4a3628", style: "short", outfit: "#7fb3e8", accent: "#ffffff", acc: "cap" },
    jieun: { skin: "#ffe0c2", hair: "#6b4a2f", style: "bob", outfit: "#ffc2d9", accent: "#ffffff", acc: "ribbon" },
    taeho: { skin: "#ffd2a8", hair: "#2f2a26", style: "spiky", outfit: "#a8e0c0", accent: "#ffffff", acc: "cup" },
    sujin: { skin: "#ffe3c9", hair: "#3b2b20", style: "ponytail", outfit: "#c9b8ff", accent: "#ffffff", acc: "glasses" },
    doyun: { skin: "#ffd9b3", hair: "#5a4632", style: "wavy", outfit: "#ffd98a", accent: "#ffffff", acc: "headphones" },
    haneul: { skin: "#ffe6cf", hair: "#8a6a4a", style: "bun", outfit: "#bfe6ff", accent: "#ffffff", acc: "cloud" },
    jungwoo: { skin: "#f2c79a", hair: "#241f1c", style: "short", outfit: "#2f3550", accent: "#4fa3ff", acc: "sunglasses" },
    soyeon: { skin: "#ffe0c2", hair: "#7a3f2a", style: "long", outfit: "#2f3550", accent: "#ff8fab", acc: "shaker" },
    leo: { skin: "#ffd2a8", hair: "#1f1a2e", style: "wavy", outfit: "#3a2f55", accent: "#ffd166", acc: "tophat" },
    yuna: { skin: "#ffe6cf", hair: "#c98a4a", style: "bob", outfit: "#ffb9d2", accent: "#ffffff", acc: "sparkle" },
    jun: { skin: "#ffd9b3", hair: "#332a24", style: "ponytail", outfit: "#3f4a6b", accent: "#ffd166", acc: "cards" },
    sera: { skin: "#ffe0c2", hair: "#2a2a3a", style: "bob", outfit: "#26304f", accent: "#ffffff", acc: "bowtie" },
    kangtae: { skin: "#eabb8c", hair: "#1c1a1a", style: "spiky", outfit: "#4a2140", accent: "#5fe0b0", acc: "dragon" },
    mina: { skin: "#ffe6cf", hair: "#5aa85a", style: "long", outfit: "#a8e0a8", accent: "#ffffff", acc: "clover" },
    royal: { skin: "#f7d3ab", hair: "#d4b06a", style: "wavy", outfit: "#5a2a6b", accent: "#ffd166", acc: "crown" },
    diana: { skin: "#ffe3c9", hair: "#2b2440", style: "long", outfit: "#2a2350", accent: "#9fe7ff", acc: "tiara" },
  };

  const FALLBACK = { skin: "#ffd9b3", hair: "#4a3628", style: "short", outfit: "#9b9b9b", accent: "#fff", acc: "none" };

  // ---------- 헤어 ----------
  function hairBack(L) {
    const h = L.hair;
    switch (L.style) {
      case "long":
        return `<path d="M22 44 Q20 74 27 84 L73 84 Q80 74 78 44 Z" fill="${h}" stroke="${OUTLINE}" stroke-width="2.4"/>`;
      case "bob":
        return `<path d="M24 42 Q22 62 28 70 L72 70 Q78 62 76 42 Z" fill="${h}" stroke="${OUTLINE}" stroke-width="2.4"/>`;
      case "ponytail":
        return `<path d="M74 38 Q88 44 86 60 Q84 72 76 74 Q82 60 74 48 Z" fill="${h}" stroke="${OUTLINE}" stroke-width="2.4"/>`;
      case "wavy":
        return `<path d="M23 44 Q18 64 26 72 Q30 64 27 56 Q34 66 30 74 L70 74 Q66 66 73 56 Q70 64 74 72 Q82 64 77 44 Z" fill="${h}" stroke="${OUTLINE}" stroke-width="2.2"/>`;
      default:
        return "";
    }
  }

  function hairFront(L) {
    const h = L.hair;
    const shade = shadeOf(h);
    const cap = `<path d="M26 40 Q26 18 50 18 Q74 18 74 40 Q74 34 68 31 Q60 36 50 34 Q40 36 32 31 Q26 34 26 40 Z" fill="${h}" stroke="${OUTLINE}" stroke-width="2.6" stroke-linejoin="round"/>`;
    let extra = "";
    if (L.style === "spiky") {
      extra = `<path d="M28 34 L33 22 L38 32 L44 19 L50 31 L56 19 L62 32 L67 22 L72 34 Q60 28 50 29 Q40 28 28 34 Z" fill="${h}" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/>`;
    } else if (L.style === "bun") {
      extra = `<circle cx="50" cy="15" r="9" fill="${h}" stroke="${OUTLINE}" stroke-width="2.4"/>`;
    }
    const gloss = `<path d="M34 26 Q42 21 52 22" fill="none" stroke="${shade}" stroke-width="3" stroke-linecap="round" opacity="0.65"/>`;
    return cap + extra + gloss;
  }

  // 머리색보다 밝은 하이라이트 색을 대충 계산
  function shadeOf(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) + 70);
    const g = Math.min(255, ((n >> 8) & 255) + 70);
    const b = Math.min(255, (n & 255) + 70);
    return `rgb(${r},${g},${b})`;
  }

  // ---------- 액세서리 ----------
  function accessory(L) {
    const A = L.accent;
    switch (L.acc) {
      case "cap":
        return `<path d="M25 30 Q25 12 50 12 Q75 12 75 30 Z" fill="${L.outfit}" stroke="${OUTLINE}" stroke-width="2.6" stroke-linejoin="round"/>
          <path d="M24 30 Q40 25 60 29 L74 31 Q60 37 24 34 Z" fill="${L.outfit}" stroke="${OUTLINE}" stroke-width="2.4" stroke-linejoin="round"/>
          <circle cx="50" cy="14" r="3" fill="${A}" stroke="${OUTLINE}" stroke-width="1.6"/>`;
      case "ribbon":
        return `<path d="M72 26 L84 18 L84 34 Z" fill="#ff8fab" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/>
          <path d="M72 26 L62 18 L62 34 Z" fill="#ff8fab" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/>
          <circle cx="72" cy="26" r="4" fill="#ffc2d9" stroke="${OUTLINE}" stroke-width="2"/>`;
      case "cup":
        return `<path d="M76 66 L84 66 L82 82 L78 82 Z" fill="#ffffff" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/>
          <rect x="76" y="66" width="8" height="4" fill="#ff8fab" stroke="${OUTLINE}" stroke-width="1.8"/>
          <rect x="79" y="58" width="2.5" height="9" fill="#7bc67e" stroke="${OUTLINE}" stroke-width="1.4"/>`;
      case "glasses":
        return `<g fill="none" stroke="${OUTLINE}" stroke-width="2.4">
            <circle cx="40" cy="50" r="8" fill="#ffffff" fill-opacity="0.55"/>
            <circle cx="60" cy="50" r="8" fill="#ffffff" fill-opacity="0.55"/>
            <path d="M48 50 L52 50"/>
          </g>`;
      case "headphones":
        return `<path d="M24 46 Q24 18 50 18 Q76 18 76 46" fill="none" stroke="${OUTLINE}" stroke-width="4.5" stroke-linecap="round"/>
          <path d="M24 46 Q24 20 50 20 Q76 20 76 46" fill="none" stroke="${A}" stroke-width="2.4" stroke-linecap="round"/>
          <rect x="17" y="42" width="12" height="17" rx="5" fill="${L.outfit}" stroke="${OUTLINE}" stroke-width="2.4"/>
          <rect x="71" y="42" width="12" height="17" rx="5" fill="${L.outfit}" stroke="${OUTLINE}" stroke-width="2.4"/>`;
      case "cloud":
        return `<g fill="#ffffff" stroke="${OUTLINE}" stroke-width="2">
            <circle cx="74" cy="20" r="6"/><circle cx="82" cy="22" r="5"/><circle cx="67" cy="23" r="4.5"/>
          </g>`;
      case "sunglasses":
        return `<path d="M30 46 L70 46" stroke="${OUTLINE}" stroke-width="2.6"/>
          <path d="M31 46 L46 46 Q47 58 39 58 Q31 58 31 46 Z" fill="${OUTLINE}"/>
          <path d="M69 46 L54 46 Q53 58 61 58 Q69 58 69 46 Z" fill="${OUTLINE}"/>
          <path d="M46 49 L54 49" stroke="${OUTLINE}" stroke-width="2.4"/>
          <path d="M34 49 L38 52" stroke="${A}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>`;
      case "shaker":
        return `<path d="M74 64 L86 64 L84 84 L76 84 Z" fill="#dfe6ee" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/>
          <rect x="73" y="59" width="14" height="6" rx="2" fill="#b9c4cf" stroke="${OUTLINE}" stroke-width="2"/>
          <circle cx="80" cy="55" r="2.5" fill="${A}" stroke="${OUTLINE}" stroke-width="1.4"/>`;
      case "tophat":
        return `<rect x="30" y="4" width="40" height="22" rx="3" fill="${L.outfit}" stroke="${OUTLINE}" stroke-width="2.6"/>
          <rect x="30" y="20" width="40" height="6" fill="${A}" stroke="${OUTLINE}" stroke-width="2.2"/>
          <path d="M20 27 L80 27" stroke="${OUTLINE}" stroke-width="5" stroke-linecap="round"/>
          <path d="M20 26 L80 26" stroke="${L.outfit}" stroke-width="3" stroke-linecap="round"/>`;
      case "sparkle":
        return `<g fill="${A}" stroke="${OUTLINE}" stroke-width="1.4">
            <path d="M80 22 L82 28 L88 30 L82 32 L80 38 L78 32 L72 30 L78 28 Z"/>
            <path d="M18 34 L19.5 38 L23.5 39.5 L19.5 41 L18 45 L16.5 41 L12.5 39.5 L16.5 38 Z"/>
          </g>`;
      case "cards":
        return `<g stroke="${OUTLINE}" stroke-width="2">
            <rect x="70" y="62" width="12" height="17" rx="2" fill="#fff" transform="rotate(-18 76 70)"/>
            <rect x="75" y="62" width="12" height="17" rx="2" fill="#fff" transform="rotate(4 81 70)"/>
            <path d="M81 68 l2.5 3 -2.5 3 -2.5 -3 Z" fill="#ff5c8a" stroke="none"/>
          </g>`;
      case "bowtie":
        return `<path d="M44 78 L36 73 L36 85 Z" fill="${A}" stroke="${OUTLINE}" stroke-width="2"/>
          <path d="M56 78 L64 73 L64 85 Z" fill="${A}" stroke="${OUTLINE}" stroke-width="2"/>
          <circle cx="50" cy="79" r="3.6" fill="${A}" stroke="${OUTLINE}" stroke-width="2"/>`;
      case "dragon":
        return `<path d="M22 70 L14 60 L26 62 Z" fill="${A}" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>
          <path d="M78 70 L86 60 L74 62 Z" fill="${A}" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>
          <path d="M30 24 L36 14 L42 24" fill="none" stroke="${A}" stroke-width="3" stroke-linecap="round"/>`;
      case "clover":
        return `<g fill="#5fbf5f" stroke="${OUTLINE}" stroke-width="1.8">
            <circle cx="74" cy="18" r="4"/><circle cx="82" cy="18" r="4"/>
            <circle cx="74" cy="26" r="4"/><circle cx="82" cy="26" r="4"/>
          </g>
          <path d="M78 27 L79 36" stroke="${OUTLINE}" stroke-width="2" stroke-linecap="round"/>`;
      case "crown":
        return `<path d="M28 24 L28 8 L38 17 L50 5 L62 17 L72 8 L72 24 Z" fill="#ffd166" stroke="${OUTLINE}" stroke-width="2.6" stroke-linejoin="round"/>
          <rect x="27" y="22" width="46" height="7" rx="3" fill="#ffb400" stroke="${OUTLINE}" stroke-width="2.4"/>
          <circle cx="50" cy="25.5" r="2.6" fill="#ff5c8a" stroke="${OUTLINE}" stroke-width="1.4"/>
          <circle cx="37" cy="25.5" r="2" fill="#4fa3ff" stroke="${OUTLINE}" stroke-width="1.2"/>
          <circle cx="63" cy="25.5" r="2" fill="#4fa3ff" stroke="${OUTLINE}" stroke-width="1.2"/>`;
      case "tiara":
        return `<path d="M34 24 L34 14 L42 20 L50 10 L58 20 L66 14 L66 24 Z" fill="#cfefff" stroke="${OUTLINE}" stroke-width="2.4" stroke-linejoin="round"/>
          <circle cx="50" cy="15" r="3.2" fill="#9fe7ff" stroke="${OUTLINE}" stroke-width="1.6"/>
          <g fill="#9fe7ff" stroke="${OUTLINE}" stroke-width="1.2"><circle cx="38" cy="21" r="1.8"/><circle cx="62" cy="21" r="1.8"/></g>`;
      default:
        return "";
    }
  }

  // ---------- 조립 ----------
  function buildSvg(dealerId, rarity) {
    const L = LOOKS[dealerId] || FALLBACK;
    const R = RARITY_STYLE[rarity] || RARITY_STYLE.common;
    const isLegend = rarity === "legendary";

    const shoulders = `<path d="M16 100 Q18 78 34 72 L66 72 Q82 78 84 100 Z" fill="${L.outfit}" stroke="${OUTLINE}" stroke-width="2.8" stroke-linejoin="round"/>
      <path d="M44 72 L50 84 L56 72" fill="${L.accent}" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/>`;
    const neck = `<rect x="44" y="60" width="12" height="14" rx="5" fill="${L.skin}" stroke="${OUTLINE}" stroke-width="2.4"/>`;
    const head = `<ellipse cx="50" cy="44" rx="25" ry="24" fill="${L.skin}" stroke="${OUTLINE}" stroke-width="2.8"/>`;
    const ears = `<circle cx="25" cy="47" r="4.5" fill="${L.skin}" stroke="${OUTLINE}" stroke-width="2.2"/>
      <circle cx="75" cy="47" r="4.5" fill="${L.skin}" stroke="${OUTLINE}" stroke-width="2.2"/>`;

    // 선글라스를 끼는 딜러는 눈을 그리지 않는다
    const hidesEyes = L.acc === "sunglasses";
    const eyes = hidesEyes
      ? ""
      : `<g>
          <ellipse cx="40" cy="49" rx="4.6" ry="5.6" fill="${OUTLINE}"/>
          <ellipse cx="60" cy="49" rx="4.6" ry="5.6" fill="${OUTLINE}"/>
          <circle cx="41.8" cy="46.8" r="1.9" fill="#ffffff"/>
          <circle cx="61.8" cy="46.8" r="1.9" fill="#ffffff"/>
        </g>`;
    const blush = `<ellipse cx="31" cy="55" rx="5" ry="3" fill="#ff9ec2" opacity="0.55"/>
      <ellipse cx="69" cy="55" rx="5" ry="3" fill="#ff9ec2" opacity="0.55"/>`;
    const mouth = `<path d="M46 58 Q50 62 54 58" fill="none" stroke="${OUTLINE}" stroke-width="2.2" stroke-linecap="round"/>`;

    const glow = isLegend
      ? `<g opacity="0.85">
          <circle cx="16" cy="18" r="2.4" fill="#fff6c9"/>
          <circle cx="86" cy="42" r="2" fill="#fff6c9"/>
          <circle cx="12" cy="66" r="1.6" fill="#fff6c9"/>
        </g>`
      : "";

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${R.a}"/><stop offset="1" stop-color="${R.b}"/>
        </linearGradient>
        <clipPath id="clip"><rect x="0" y="0" width="100" height="100" rx="16"/></clipPath>
      </defs>
      <g clip-path="url(#clip)">
        <rect width="100" height="100" fill="url(#bg)"/>
        <circle cx="50" cy="52" r="34" fill="#ffffff" opacity="0.28"/>
        ${glow}
        ${hairBack(L)}
        ${shoulders}
        ${neck}
        ${ears}
        ${head}
        ${eyes}
        ${blush}
        ${mouth}
        ${hairFront(L)}
        ${accessory(L)}
      </g>
      <rect x="1.5" y="1.5" width="97" height="97" rx="15" fill="none" stroke="${R.ring}" stroke-width="3"/>
    </svg>`;
  }

  const cache = new Map();

  // 도감/가챠 연출에서 <img src>로 바로 쓸 수 있는 data URI
  function url(dealerId, rarity) {
    const key = `${dealerId}:${rarity}`;
    if (!cache.has(key)) {
      cache.set(key, "data:image/svg+xml;charset=utf-8," + encodeURIComponent(buildSvg(dealerId, rarity)));
    }
    return cache.get(key);
  }

  function ringColor(rarity) {
    return (RARITY_STYLE[rarity] || RARITY_STYLE.common).ring;
  }

  return { url, ringColor, buildSvg };
})();
