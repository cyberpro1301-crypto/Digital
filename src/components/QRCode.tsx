// Compact QR Code generator (byte mode, ECC level L, versions 1-10)
// Public domain algorithm based on ISO/IEC 18004

// --- Galois Field GF(256) tables ---
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

// --- Reed-Solomon ---
function rsGenPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenPoly(ecLen);
  const result = data.concat(new Array(ecLen).fill(0));
  for (let i = 0; i < data.length; i++) {
    const coef = result[i];
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      result[i + j] ^= gfMul(gen[j], coef);
    }
  }
  return result.slice(data.length);
}

// --- QR version data (ECC level L) ---
// [totalCodewords, dataCodewords, ecPerBlock, numBlocksGroup1, dataPerBlockGroup1, numBlocksGroup2, dataPerBlockGroup2]
const VERSIONS: Record<number, [number, number, number, number, number, number, number]> = {
  1: [26, 19, 7, 1, 19, 0, 0],
  2: [44, 34, 10, 1, 34, 0, 0],
  3: [70, 55, 15, 1, 55, 0, 0],
  4: [100, 80, 20, 1, 80, 0, 0],
  5: [134, 108, 26, 1, 108, 0, 0],
  6: [172, 142, 18, 2, 71, 0, 0],
  7: [196, 163, 20, 2, 81, 0, 0],
  8: [242, 203, 24, 2, 97, 2, 98],
  9: [292, 241, 30, 2, 116, 2, 117],
  10: [346, 285, 18, 4, 71, 4, 72],
};

// Max byte-mode data capacity (ECC L)
const CAPACITY: Record<number, number> = {
  1: 17, 2: 32, 3: 53, 4: 78, 5: 106, 6: 134, 7: 154, 8: 192, 9: 230, 10: 271,
};

function pickVersion(byteLen: number): number {
  for (let v = 1; v <= 10; v++) {
    if (CAPACITY[v] >= byteLen) return v;
  }
  return 10;
}

// --- Bit stream ---
class BitBuffer {
  bits: number[] = [];
  put(num: number, len: number) {
    for (let i = len - 1; i >= 0; i--) this.bits.push((num >> i) & 1);
  }
  getBytes(): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8 && i + j < this.bits.length; j++) {
        b = (b << 1) | this.bits[i + j];
      }
      bytes.push(b);
    }
    return bytes;
  }
}

function encodeData(text: string, version: number): number[] {
  const bb = new BitBuffer();
  // Mode indicator: byte mode = 0100
  bb.put(0b0100, 4);
  // Character count indicator (8 bits for v1-9, 16 for v10)
  const bytes = new TextEncoder().encode(text);
  if (version < 10) {
    bb.put(bytes.length, 8);
  } else {
    bb.put(bytes.length, 16);
  }
  // Data
  for (const b of bytes) bb.put(b, 8);
  // Padding
  const totalDataBits = VERSIONS[version][1] * 8;
  const remainder = bb.bits.length % 8;
  if (remainder > 0) {
    for (let i = 0; i < 8 - remainder; i++) bb.bits.push(0);
  }
  const paddingBytes = [0xec, 0x11];
  let pi = 0;
  while (bb.bits.length < totalDataBits) {
    bb.put(paddingBytes[pi % 2], 8);
    pi++;
  }
  return bb.getBytes();
}

// --- Module placement ---
function createMatrix(version: number): { matrix: boolean[][]; reserved: boolean[][] } {
  const size = 17 + version * 4;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  
  const placeFinder = (r: number, c: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        if (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) {
          if (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)) {
            matrix[rr][cc] = true;
          }
        }
      }
    }
  };
  
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);
  
  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    reserved[6][i] = true;
    matrix[i][6] = i % 2 === 0;
    reserved[i][6] = true;
  }
  
  // Dark module
  matrix[size - 8][8] = true;
  reserved[size - 8][8] = true;
  
  // Reserve format info areas
  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
  
  // Alignment patterns (v2+)
  if (version >= 2) {
    const alignPos: number[] = [6];
    const step = version < 5 ? 16 : version < 8 ? 18 : 20;
    let pos = size - 7;
    while (pos > step) {
      alignPos.unshift(pos);
      pos -= step;
    }
    if (version >= 2) alignPos.unshift(pos);
    
    for (const r of alignPos) {
      for (const c of alignPos) {
        // Skip if overlapping finder
        if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const rr = r + dr, cc = c + dc;
            reserved[rr][cc] = true;
            matrix[rr][cc] = (dr === 0 && dc === 0) || Math.abs(dr) === 2 || Math.abs(dc) === 2;
          }
        }
      }
    }
  }
  
  return { matrix, reserved };
}

function placeData(matrix: boolean[][], reserved: boolean[][], data: number[], size: number) {
  let bitIndex = 0;
  let direction = -1; // up
  let col = size - 1;
  
  while (col > 0) {
    if (col === 6) col--; // skip timing column
    for (let i = 0; i < size; i++) {
      const row = direction === -1 ? size - 1 - i : i;
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (!reserved[row][cc]) {
          let bit = false;
          if (bitIndex < data.length * 8) {
            const byteIdx = bitIndex >> 3;
            const bitOffset = 7 - (bitIndex & 7);
            bit = ((data[byteIdx] >> bitOffset) & 1) === 1;
          }
          matrix[row][cc] = bit;
          bitIndex++;
        }
      }
    }
    direction = -direction;
    col -= 2;
  }
}

// --- Masking ---
function applyMask(matrix: boolean[][], reserved: boolean[][], mask: number, size: number): boolean[][] {
  const masked = matrix.map((r) => [...r]);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      let invert = false;
      switch (mask) {
        case 0: invert = (r + c) % 2 === 0; break;
        case 1: invert = r % 2 === 0; break;
        case 2: invert = c % 3 === 0; break;
        case 3: invert = (r + c) % 3 === 0; break;
        case 4: invert = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break;
        case 5: invert = ((r * c) % 2 + (r * c) % 3) === 0; break;
        case 6: invert = (((r * c) % 2 + (r * c) % 3) % 2) === 0; break;
        case 7: invert = (((r + c) % 2 + (r * c) % 3) % 2) === 0; break;
      }
      if (invert) masked[r][c] = !masked[r][c];
    }
  }
  return masked;
}

function formatInfoBits(mask: number): number {
  // ECC level L = 01, combined with mask = (01 << 3) | mask
  let data = (0b01 << 3) | mask;
  let bch = data;
  for (let i = 0; i < 10; i++) bch <<= 1;
  // Generator: 0b10100110111 (0x537)
  let g = 0x537;
  for (let i = 14; i >= 10; i--) {
    if ((bch >> i) & 1) bch ^= g << (i - 10);
  }
  const bits = ((data << 10) | bch) ^ 0b101010000010010;
  return bits;
}

function placeFormatInfo(matrix: boolean[][], mask: number, size: number) {
  const bits = formatInfoBits(mask);
  // Top-left
  for (let i = 0; i <= 5; i++) matrix[8][i] = ((bits >> i) & 1) === 1;
  matrix[8][7] = ((bits >> 6) & 1) === 1;
  matrix[8][8] = ((bits >> 7) & 1) === 1;
  matrix[7][8] = ((bits >> 8) & 1) === 1;
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = ((bits >> i) & 1) === 1;
  // Top-right + bottom-left
  for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = ((bits >> i) & 1) === 1;
  for (let i = 8; i < 15; i++) matrix[8][size - 15 + i] = ((bits >> i) & 1) === 1;
  matrix[size - 8][8] = true; // dark module
}

function maskPenalty(matrix: boolean[][], size: number): number {
  let penalty = 0;
  // Rule 1: consecutive same-color modules
  for (let r = 0; r < size; r++) {
    let count = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) { count++; } else { if (count >= 5) penalty += 3 + (count - 5); count = 1; }
    }
    if (count >= 5) penalty += 3 + (count - 5);
  }
  for (let c = 0; c < size; c++) {
    let count = 1;
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) { count++; } else { if (count >= 5) penalty += 3 + (count - 5); count = 1; }
    }
    if (count >= 5) penalty += 3 + (count - 5);
  }
  return penalty;
}

function generateQRMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length);
  const size = 17 + version * 4;
  const { matrix, reserved } = createMatrix(version);
  
  // Encode data
  const dataCodewords = encodeData(text, version);
  const [, , ecLen, g1n, g1d, g2n, g2d] = VERSIONS[version];
  
  // Interleave data and EC across blocks
  const blocks: { data: number[]; ec: number[] }[] = [];
  let offset = 0;
  for (let i = 0; i < g1n; i++) {
    const block = dataCodewords.slice(offset, offset + g1d);
    blocks.push({ data: block, ec: rsEncode(block, ecLen) });
    offset += g1d;
  }
  for (let i = 0; i < g2n; i++) {
    const block = dataCodewords.slice(offset, offset + g2d);
    blocks.push({ data: block, ec: rsEncode(block, ecLen) });
    offset += g2d;
  }
  
  // Interleave
  const maxData = Math.max(g1d, g2d);
  const interleaved: number[] = [];
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) {
      if (i < b.data.length) interleaved.push(b.data[i]);
    }
  }
  for (let i = 0; i < ecLen; i++) {
    for (const b of blocks) {
      interleaved.push(b.ec[i]);
    }
  }
  
  placeData(matrix, reserved, interleaved, size);
  
  // Try all masks, pick lowest penalty
  let bestMask = 0;
  let bestPenalty = Infinity;
  let bestMatrix = matrix;
  for (let m = 0; m < 8; m++) {
    const masked = applyMask(matrix, reserved, m, size);
    placeFormatInfo(masked, m, size);
    const p = maskPenalty(masked, size);
    if (p < bestPenalty) {
      bestPenalty = p;
      bestMask = m;
      bestMatrix = masked;
    }
  }
  
  return bestMatrix;
}

export default function QRCode({ data, size = 200 }: { data: string; size?: number }) {
  const matrix = generateQRMatrix(data);
  const cells = matrix.length;
  const cellSize = size / cells;
  
  const rects: string[] = [];
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (matrix[r][c]) {
        rects.push(`<rect x="${(c * cellSize).toFixed(2)}" y="${(r * cellSize).toFixed(2)}" width="${(cellSize + 0.5).toFixed(2)}" height="${(cellSize + 0.5).toFixed(2)}" fill="white"/>`);
      }
    }
  }
  
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded-lg"
      style={{ backgroundColor: '#0d0d18' }}
      dangerouslySetInnerHTML={{ __html: rects.join('') }}
    />
  );
}
