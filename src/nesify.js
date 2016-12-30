import Canvas, { Image } from 'canvas';
import DitherJS from 'ditherjs/dist/ditherjs.dist';
import { rgb2hex } from 'color-functions';

import {
  comparatorAscending,
  comparatorDescending,
} from './sort';

import {
  COLORS_PER_SUBPALETTE,
  SUBPALETTES_PER_IMAGE,
  nesPalette,
  normalizeColor,
} from './nesPalette';

export * from './nesPalette';

const ditherjs = new DitherJS();
const arrayProto = [];

export const SCALE_STRETCH = 'stretch';
export const SCALE_CONTAIN = 'contain';
export const SCALE_COVER = 'cover';


export function colorKey(hex) {
  return hex;
}

export function paletteKey(palette) {
  return palette.join(',');
}

/**
 * Gets the unique colors used in the supplied image data
 *
 * @param  {ImageData} imgData - source image data
 * @return {Array} colors used in the image
 */
export function getLocalPalette(imgData) {
  const colorsUsedByKey = {};
  const dataLength = imgData.data.length;

  for (let i = 0; i < dataLength; i += 4) {
    const hex = rgb2hex(...arrayProto.slice.call(imgData.data, i, i + 3));
    const key = colorKey(hex);
    const color = colorsUsedByKey[key] || { color: hex, pixelsUsing: 0 };
    color.pixelsUsing += 1;
    colorsUsedByKey[key] = color;
  }

  return Object.keys(colorsUsedByKey)
    .map(key => colorsUsedByKey[key])
    .sort((a, b) => comparatorAscending(a.color, b.color));
}

/**
 * Recursively enumerates all n-color palette variations
 *
 * @param  {Array} palette - all available colors
 * @param  {number} maxColors - max number of colors per subpalette
 *
 * @return {Array} subpalettes
 */
export function enumeratePaletteOptions(palette, maxColors) {
  if (maxColors === 0) {
    return [];
  } else if (maxColors === 1) {
    return palette;
  } else if (palette.length <= maxColors) {
    return [palette];
  }

  return palette.slice(0, (palette.length + 1) - maxColors)
    .reduce((subpalettes, firstColor, i) => {
      const restPalette = palette.slice(i + 1);
      enumeratePaletteOptions(restPalette, maxColors - 1)
        .forEach((restColors) => {
          subpalettes.push([firstColor].concat(restColors));
        });
      return subpalettes;
    }, []);
}

/**
 * Calculate a score for the palette based
 *
 * @param  {Object} paletteOption - palette option containing tile usage and colors
 * @param  {Array} colorsUsedByKey - colors used by key, containing ranking info
 * @return {number} a score for the palette
 */
export function paletteScore(paletteOption, colorsUsedByKey, numColors) {
  let score = paletteOption.tilesUsing;
  paletteOption.palette.forEach((color) => {
    const key = colorKey(color);
    if (key in colorsUsedByKey) {
      score += 20 * ((1 - (colorsUsedByKey[key].ranking / numColors)) ** 2);
    }
  });
  return score;
}

/**
 * Upscales a canvas by the given factor
 *
 * @param  {HTMLCanvasElement} canvas - source canvas
 * @param  {number} upscale - factor to upscale canvas
 * @return {HTMLCanvasElement} the upscaled canvas
 */
export function upscaleCanvas(srcCanvas, upscale) {
  const width = upscale * srcCanvas.width;
  const height = upscale * srcCanvas.height;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext('2d');
  !('antialias' in ctx) || (ctx.antialias = 'none'); // node-canvas
  !('imageSmoothingEnabled' in ctx) || (ctx.imageSmoothingEnabled = false);
  !('oImageSmoothingEnabled' in ctx) || (ctx.imageSmoothingEnabled = false);
  !('msImageSmoothingEnabled' in ctx) || (ctx.imageSmoothingEnabled = false);
  !('mozImageSmoothingEnabled' in ctx) || (ctx.imageSmoothingEnabled = false);
  !('webkitImageSmoothingEnabled' in ctx) || (ctx.imageSmoothingEnabled = false);
  ctx.drawImage(srcCanvas, 0, 0, width, height);
  return canvas;
}

/**
 * Squishes an image to NES palette limitations
 *
 * This creates its own Canvas to do the drawing and returns it.
 *
 * @param  {HTMLCanvasElement|HTMLImageElement|Buffer} src - image input
 * @param  {Object} [options] - processing options
 * @param  {number} [options.width] - output width
 * @param  {number} [options.height] - output height
 * @param  {string} [options.scaleMode] - scale mode to use when the source and destination aspect
 *         ratios are mismatched
 * @param  {Array} [options.globalPalette] - normalized DitherJS palettte
 * @param  {Array} [options.backgroundColor] - if set, forces a background color
 * @param  {string} [options.ditherAlgorithm] - type of dithering to use when applying the palette
 *
 * @return {HTMLCanvasElement} the canvas with the NESified image on it
 */
export function nesify(src, {
  width = 256,
  height = 240,
  scaleMode = SCALE_CONTAIN,
  quantizationStep = 1,
  globalPalette = nesPalette,
  backgroundColor = false,
  ditherAlgorithm = 'ordered',
  tileWidth = 8,
  tileHeight = 8,
  upscale = 1,
  log = () => {},
} = {}) {
  // Create a new Canvas
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext('2d');

  // Create a new image to load
  const srcImg = new Image();
  srcImg.src = src;

  //
  // First, we want to scale the source image to our target canvas size.
  //
  // If the source and destination aspect ratios don't match, we deal with it here, either scaling
  // or stretching until we have the right output.
  //

  // Set initial rectangles
  let srcRect = [0, 0, srcImg.width, srcImg.height];
  let destRect = [0, 0, canvas.width, canvas.height];

  // Modify rectangles based on scale mode
  log(`Using ${scaleMode} scale mode`);
  switch (scaleMode) {
    case SCALE_STRETCH: {
      break;
    }
    case SCALE_CONTAIN: {
      const srcRatio = srcImg.width / srcImg.height;
      const destRatio = canvas.width / canvas.height;
      if (srcRatio > destRatio) {
        // Source is too wide, letterbox
        const destHeight = canvas.width / srcRatio;
        destRect = [
          0, Math.round(0.5 * (canvas.height - destHeight)),
          canvas.width, destHeight,
        ];
      } else if (srcRatio < destRatio) {
        // Source is too tall, pillarbox
        const destWidth = canvas.height * srcRatio;
        destRect = [
          Math.round(0.5 * (canvas.width - destWidth)), 0,
          destWidth, canvas.height,
        ];
      }
      break;
    }
    case SCALE_COVER: {
      const srcRatio = srcImg.width / srcImg.height;
      const destRatio = canvas.width / canvas.height;
      if (srcRatio > destRatio) {
        // Source is too wide, crop horizontally
        const srcWidth = srcImg.height * destRatio;
        srcRect = [
          Math.round(0.5 * (srcImg.width - srcWidth)), 0,
          Math.round(srcWidth), srcImg.height,
        ];
      } else if (srcRatio < destRatio) {
        // Source is too tall, crop vertically
        const srcHeight = srcImg.width / destRatio;
        srcRect = [
          0, Math.round(0.5 * (srcImg.height - srcHeight)),
          srcImg.width, Math.round(srcHeight),
        ];
      }
      break;
    }
    default: {
      break;
    }
  }

  // Set the background color and draw the scaled source image to the canvas
  log('Drawing image to canvas');
  ctx.fillStyle = rgb2hex(...globalPalette[0]);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(srcImg, ...srcRect, ...destRect);

  // Split the image into tiles
  const tilesX = Math.ceil(canvas.width / tileWidth);
  const tilesY = Math.ceil(canvas.height / tileHeight);
  const tiles = [];
  for (let y = 0; y < tilesY; y += 1) {
    for (let x = 0; x < tilesX; x += 1) {
      // Create the new tile
      const tile = { x, y };
      tiles.push(tile);

      // Determine the coordinates relative to the source image data
      tile.srcPosition = [
        x * tileWidth,
        y * tileHeight,
        tileWidth,
        tileHeight,
      ];

      // Save the source image data, which we'll need to try out the different subpalettes
      tile.srcImgData = ctx.getImageData(...tile.srcPosition);
    }
  }

  //
  // Next, we start reducing the colorspace of the image and dithering to match the NES palette.
  //
  // This happens in multiple phases. First, we get a general estimate of where the overall image
  // lands in the NES colorspace. Working from this image, we can determine the possibilities for
  // more restricted palette. Finally, we narrow down the palettes we actually want to use and apply
  // them to 8x8 tiles of the image.
  //

  // Store the source ImageData of the scaled image
  const srcImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Dither the image and apply the global palette using a clone of the original image data
  log('Creating full image');
  const imgData = ctx.createImageData(canvas.width, canvas.height);
  imgData.data.set(new Uint8ClampedArray(srcImgData.data));
  ditherjs.ditherImageData(imgData, {
    step: quantizationStep,
    palette: globalPalette,
    algorithm: ditherAlgorithm,
  });
  ctx.putImageData(imgData, 0, 0);

  // Determine the local palette for each tile
  log('Analyzing tile colors');
  const colorsUsedByKey = {};
  const subpalettesByKey = {};

  tiles.forEach((tile) => {
    // Determine the palette from the dithered image data
    const ditheredImgData = ctx.getImageData(...tile.srcPosition);
    const localPalette = getLocalPalette(ditheredImgData);
    const palette = localPalette.map(color => color.color);
    const paletteOptions = enumeratePaletteOptions(palette, COLORS_PER_SUBPALETTE);

    localPalette.forEach((paletteColor) => {
      const key = paletteColor.color;
      const color = colorsUsedByKey[key] || {
        color: key,
        tilesUsing: 0,
        pixelsUsing: 0,
      };
      color.tilesUsing += 1;
      color.pixelsUsing += paletteColor.pixelsUsing;
      colorsUsedByKey[key] = color;
    });

    paletteOptions.forEach((paletteOption) => {
      const key = paletteKey(paletteOption);
      const subpalette = subpalettesByKey[key] || {
        palette: paletteOption,
        tilesUsing: 0,
      };
      subpalette.tilesUsing += 1;
      subpalettesByKey[key] = subpalette;
    });

    Object.assign(tile, {
      ditheredImgData,
      palette,
      paletteOptions,
    });
  });

  // Rank all colors being used by the number of pixels and tiles using them
  const colorsUsed = Object.keys(colorsUsedByKey)
    .map(key => colorsUsedByKey[key])
    .sort((a, b) => (
      comparatorDescending(a.pixelsUsing, b.pixelsUsing) ||
      comparatorDescending(a.tilesUsing, b.tilesUsing)
    ));

  // Add color rankings
  colorsUsed.forEach((color, ranking) => {
    Object.assign(color, { ranking });
  });

  // Pick a background color
  const sharedBackgroundColor = backgroundColor !== false ?
    rgb2hex(...normalizeColor(backgroundColor)) :
    colorsUsed[0].color;

  // Ensure that all subpalettes contain the background color
  Object.keys(subpalettesByKey)
    .forEach((key) => {
      const subpalette = subpalettesByKey[key];
      if (
        subpalette.palette.length < COLORS_PER_SUBPALETTE &&
        subpalette.palette.indexOf(sharedBackgroundColor) < 0
      ) {
        subpalette.palette = subpalette.palette
          .concat([sharedBackgroundColor])
          .sort((a, b) => comparatorAscending(a.color, b.color));
        const newKey = paletteKey(subpalette.palette);
        if (newKey in subpalettesByKey) {
          subpalettesByKey[newKey].tilesUsing += subpalette.tilesUsing;
        } else {
          subpalettesByKey[newKey] = subpalette;
        }
        delete subpalettesByKey[key];
      }
    });

  // @TODO: Generate wildcard variations for small palettes, maybe?

  // Rank all possible subpalettes by the number of tiles that could use them
  let subpalettes = Object.keys(subpalettesByKey)
    .map(key => subpalettesByKey[key])
    .sort((a, b) => (
      comparatorDescending(
        paletteScore(a, colorsUsedByKey, colorsUsed.length),
        paletteScore(b, colorsUsedByKey, colorsUsed.length),
      )
    ));

  // Determine which colors to use
  log('Determining palette');
  log(`${colorsUsed.length} NES colors used`);
  log(`Using #${sharedBackgroundColor} as background color`);
  log(`${subpalettes.length} potential subpalettes`);
  log(`Looking for the best ${SUBPALETTES_PER_IMAGE} subpalettes`);

  // Filter subpalettes to ones that include the background color
  subpalettes = subpalettes.filter(subpalette => (
    subpalette.palette.indexOf(sharedBackgroundColor) >= 0
  ));
  log(`${subpalettes.length} valid subpalettes using the background color`);

  // Loop through the tiles and narrow down the number of subpalettes
  // @TODO

  // Randomize subpalettes
  // subpalettes = subpalettes
  //   .sort(() => comparatorDescending(Math.random(), Math.random()));

  // Assign a palette to each tile and draw it to the canvas
  tiles.forEach((tile) => {
    // const subpalette = subpalettes[Math.floor(Math.random() * subpalettes.length)].palette
    // const subpalette = subpalettes[0].palette
    // const subpalette = subpalettes[Math.floor(Math.random() * SUBPALETTES_PER_IMAGE)].palette
    const subpalette = tile.paletteOptions[Math.floor(Math.random() * tile.paletteOptions.length)]
      .map(normalizeColor);

    // Make sure we have more than one color
    if (subpalette.length === 1) {
      subpalette.unshift(normalizeColor(sharedBackgroundColor));
    }

    const subpaletteImgData = ctx.createImageData(tile.srcImgData.width, tile.srcImgData.height);
    subpaletteImgData.data.set(new Uint8ClampedArray(tile.srcImgData.data));
    ditherjs.ditherImageData(subpaletteImgData, {
      step: quantizationStep,
      palette: subpalette,
      algorithm: ditherAlgorithm,
    });
    Object.assign(tile, { subpaletteImgData, subpalette });
    ctx.putImageData(subpaletteImgData, tile.srcPosition[0], tile.srcPosition[1]);
  });

  // Upscale final image
  if (upscale > 1) {
    log(`Upscaling ${upscale}x`);
    return upscaleCanvas(canvas, upscale);
  }

  // Have fun, kids
  return canvas;
}

export default nesify;
