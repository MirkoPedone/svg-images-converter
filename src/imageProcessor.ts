export async function preprocessImage(
  imageUrl: string, 
  filterId: string, 
  is3DPrint: boolean = false,
  nozzleSize: string = '0.4',
  fixThinLines: boolean = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No canvas context');

      const MAX_DIM = 1200;
      let w = img.width;
      let h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.floor(w * ratio);
        h = Math.floor(h * ratio);
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      const toGrayscale = () => {
        const gray = new Uint8Array(w * h);
        for (let i = 0; i < data.length; i += 4) {
          gray[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        }
        return gray;
      };

      const grayData = toGrayscale();
      let finalBw = new Uint8Array(w * h);
      finalBw.fill(255);

      if (filterId === 'standard') {
        for (let i = 0; i < grayData.length; i++) finalBw[i] = grayData[i] < 128 ? 0 : 255;
      } else if (filterId === 'detailed') {
        for (let i = 0; i < grayData.length; i++) finalBw[i] = grayData[i] < 160 ? 0 : 255;
      } else if (filterId === 'minimal') {
        for (let i = 0; i < grayData.length; i++) finalBw[i] = grayData[i] < 96 ? 0 : 255;
      } else if (filterId === 'edges_thick' || filterId === 'edges_fine') {
        const threshold = filterId === 'edges_thick' ? 40 : 80;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const i00 = (y - 1) * w + (x - 1), i01 = (y - 1) * w + x, i02 = (y - 1) * w + (x + 1);
            const i10 = y * w + (x - 1), i12 = y * w + (x + 1);
            const i20 = (y + 1) * w + (x - 1), i21 = (y + 1) * w + x, i22 = (y + 1) * w + (x + 1);

            const px00 = grayData[i00], px01 = grayData[i01], px02 = grayData[i02];
            const px10 = grayData[i10], px12 = grayData[i12];
            const px20 = grayData[i20], px21 = grayData[i21], px22 = grayData[i22];

            const gx = -px00 + px02 - 2 * px10 + 2 * px12 - px20 + px22;
            const gy = -px00 - 2 * px01 - px02 + px20 + 2 * px21 + px22;
            const mag = Math.sqrt(gx * gx + gy * gy);

            finalBw[y * w + x] = mag > threshold ? 0 : 255;
          }
        }
      } else if (filterId === 'artistic_ink') {
        for (let i = 0; i < grayData.length; i++) {
          const v = grayData[i];
          finalBw[i] = v < 110 ? 0 : 255; 
        }
      } else if (filterId === 'artistic_soft') {
        for (let i = 0; i < grayData.length; i++) {
          const v = grayData[i];
          if (v < 80) finalBw[i] = 0;
          else if (v > 180) finalBw[i] = 255;
          else finalBw[i] = (i % 2 === 0) ? 0 : 255; // simple dithering effect
        }
      } else if (filterId === 'sharp') {
        for (let i = 0; i < grayData.length; i++) {
          finalBw[i] = grayData[i] < 140 ? 0 : 255;
        }
      }

      // Morphological Operations
      if (is3DPrint || fixThinLines) {
        let radius = 1;
        if (nozzleSize === '0.4') radius = 2;
        if (nozzleSize === '0.6') radius = 3;
        if (nozzleSize === '0.8') radius = 4;

        if (fixThinLines) {
          // THICKEN MODE (Pure Dilation of Black / Erosion of White)
          // Expands all black regions by `radius` so thin lines become printable.
          const dilatedBlack = new Uint8Array(w * h);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              let min = 255;
              for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                  const nx = x + dx, ny = y + dy;
                  if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                    if (finalBw[ny * w + nx] === 0) min = 0;
                  }
                }
              }
              dilatedBlack[y * w + x] = min;
            }
          }
          finalBw = dilatedBlack;
        } else if (is3DPrint) {
          // REMOVAL MODE (Morphological Opening of Black)
          // Dilate White
          const erodedBlack = new Uint8Array(w * h);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              let max = 0;
              for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                  const nx = x + dx, ny = y + dy;
                  if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                    if (finalBw[ny * w + nx] === 255) max = 255;
                  }
                }
              }
              erodedBlack[y * w + x] = max;
            }
          }

          // Erode White
          const openedBlack = new Uint8Array(w * h);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              let min = 255;
              for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                  const nx = x + dx, ny = y + dy;
                  if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                    if (erodedBlack[ny * w + nx] === 0) min = 0;
                  }
                }
              }
              openedBlack[y * w + x] = min;
            }
          }
          finalBw = openedBlack;
        }
      }

      // Apply to image data
      for (let i = 0; i < finalBw.length; i++) {
        const val = finalBw[i];
        data[i * 4] = val;
        data[i * 4 + 1] = val;
        data[i * 4 + 2] = val;
        data[i * 4 + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}
