/**
 * Biometric Face & Crown Alignment Engine
 * Detects the head crown (topmost foreground), horizontal facial midline,
 * sets standard 10% headroom, and frames shoulders to selected aspect ratio.
 */

export function autoDetectBiometricCrop(canvas, targetRatio = 35 / 45, headroomRatio = 0.10) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, W, H);
  const data = imgData.data;

  let minY = -1;
  let maxY = -1;
  let minX = W;
  let maxX = -1;

  // Scan alpha channel to locate foreground subject
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const alpha = data[(y * W + x) * 4 + 3];
      if (alpha > 30) {
        if (minY === -1) minY = y;
        maxY = y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }

  // Fallback to center crop if no foreground detected
  if (minY === -1) {
    if (W / H > targetRatio) {
      const cw = Math.round(H * targetRatio);
      return {
        x: Math.round((W - cw) / 2),
        y: 0,
        width: cw,
        height: H,
        normalized: [(W - cw) / (2 * W), 0, cw / W, 1.0],
      };
    } else {
      const ch = Math.round(W / targetRatio);
      const top = Math.max(0, Math.round((H - ch) * headroomRatio));
      return {
        x: 0,
        y: top,
        width: W,
        height: Math.min(H, top + ch),
        normalized: [0, top / H, 1.0, ch / H],
      };
    }
  }

  const personH = Math.max(20, maxY - minY);
  const headBottom = minY + Math.round(personH * 0.35);

  // Compute horizontal center of mass in head region (top 35% of person)
  let sumX = 0;
  let countHeadPixels = 0;
  for (let y = minY; y < headBottom; y++) {
    for (let x = minX; x <= maxX; x++) {
      const alpha = data[(y * W + x) * 4 + 3];
      if (alpha > 30) {
        sumX += x;
        countHeadPixels++;
      }
    }
  }

  const headCX = countHeadPixels > 0 ? sumX / countHeadPixels : (minX + maxX) / 2;

  // In passport ID standard, head to upper-chest occupies ~88% of vertical frame
  let cropH = Math.round(personH / 0.88);
  let cropW = Math.round(cropH * targetRatio);

  if (cropH > H) {
    cropH = H;
    cropW = Math.round(cropH * targetRatio);
  }
  if (cropW > W) {
    cropW = W;
    cropH = Math.round(cropW / targetRatio);
  }

  const cropX0 = Math.max(0, Math.min(W - cropW, Math.round(headCX - cropW / 2)));
  const cropY0 = Math.max(0, Math.min(H - cropH, Math.round(minY - cropH * headroomRatio)));
  const actualW = Math.min(W - cropX0, cropW);
  const actualH = Math.min(H - cropY0, cropH);

  return {
    x: cropX0,
    y: cropY0,
    width: actualW,
    height: actualH,
    normalized: [
      cropX0 / W,
      cropY0 / H,
      actualW / W,
      actualH / H,
    ],
  };
}
