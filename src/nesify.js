import Canvas, {
  Image,
  ImageData,
} from 'canvas';
import DitherJS from 'ditherjs/dist/ditherjs.dist';

import {
  // SORT_A_B_EQUAL,
  SORT_A_FIRST,
  SORT_B_FIRST,
  comparatorAscending,
  comparatorDescending,
} from './sort';

import {
  COLORS_PER_SUBPALETTE,
  SUBPALETTES_PER_IMAGE,
  nesPalette,
  normalizeColor,
  normalizeColorHex,
  normalizeDitherPalette,
  colorDistance,
  nesColors,
  nesColorMatch,
} from './nesPalette';

export const SCALE_STRETCH = 'stretch';
export const SCALE_ASPECT = 'aspect';
export const SCALE_CONTAIN = 'contain';
export const SCALE_COVER = 'cover';

const ditherjs = new DitherJS();
const arrayProto = [];

const RGBA_BYTES = 4;
export function rgbaOffset(offset) {
  return offset * RGBA_BYTES;
}

export function colorKey(color) {
  return normalizeColorHex(color);
}

export function paletteKey(palette) {
  return palette.map(normalizeColorHex).sort(comparatorAscending).join(',');
}

export function createPaletteSorter(backgroundColor) {
  return (a, b) => {
    if (a === backgroundColor) {
      return SORT_A_FIRST;
    }
    if (b === backgroundColor) {
      return SORT_B_FIRST;
    }
    return comparatorAscending(parseInt(nesColorMatch(a), 16), parseInt(nesColorMatch(b), 16));
  };
}

/**
 * Gets a piece of image data
 *
 * @param  {ImageData} imgData - source image data
 * @param  {number} sx - source x position
 * @param  {number} sy - source y position
 * @param  {number} sw - source width
 * @param  {number} sh - source height
 *
 * @return {ImageData} image data subsection
 */
export function getImageDataSubsection(imgData, sx, sy, sw, sh) {
  const subImgData = new ImageData(sw, sh);
  for (let y = 0; y < sh; y += 1) {
    const start = rgbaOffset(sx + ((sy + y) * imgData.width));
    const length = rgbaOffset(sw);
    const offset = rgbaOffset(y * sw);
    subImgData.data.set(imgData.data.slice(start, start + length), offset);
  }
  return subImgData;
}

/**
 * Calculates the total color distance between each pixel in two images
 *
 * @param  {ImageData} imgDataA - first image
 * @param  {ImageData} imgDataB - second image
 * @return {number} total distance
 */
export function imageDataDistance(imgDataA, imgDataB) {
  const dataLength = imgDataA.data.length;
  let distance = 0;
  for (let i = 0; i < dataLength; i += RGBA_BYTES) {
    distance += colorDistance(
      arrayProto.slice.call(imgDataA.data, i, i + 3),
      arrayProto.slice.call(imgDataB.data, i, i + 3),
    );
  }
  return distance;
}

/**
 * Generates an array of tiles from the given image data and tile size
 *
 * @param  {ImageData} imgData - source image data
 * @param  {number} tileWidth - width of a tile
 * @param  {number} tileHeight - height of a tile
 * @return {Array} tile array
 */
export function splitIntoTiles(imgData, tileWidth, tileHeight) {
  const tilesX = Math.ceil(imgData.width / tileWidth);
  const tilesY = Math.ceil(imgData.height / tileHeight);
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
      // tile.srcImgData = ctx.getImageData(...tile.srcPosition);
      tile.srcImgData = getImageDataSubsection(imgData, ...tile.srcPosition);
    }
  }

  return tiles;
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

  for (let i = 0; i < dataLength; i += RGBA_BYTES) {
    const color = arrayProto.slice.call(imgData.data, i, i + 3);
    const key = colorKey(color);
    const colorUsed = colorsUsedByKey[key] || {
      key,
      color,
      pixelsUsing: 0,
    };
    colorUsed.pixelsUsing += 1;
    colorsUsedByKey[key] = colorUsed;
  }

  return Object.keys(colorsUsedByKey)
    .map(key => colorsUsedByKey[key])
    .sort((a, b) => comparatorDescending(a.pixelsUsing, b.pixelsUsing));
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
    return palette.map(color => [color]);
  } else if (palette.length <= maxColors) {
    return [palette];
  }

  return palette.slice(0, (palette.length + 1) - maxColors)
    .reduce((subpalettes, firstColor, i) => {
      const restPalette = palette.slice(i + 1);
      const restPaletteOptions = enumeratePaletteOptions(restPalette, maxColors - 1);
      restPaletteOptions
        .forEach((restColors) => {
          const allColors = restColors.slice(0);
          allColors.unshift(firstColor);
          subpalettes.push(allColors);
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
 * Dithers some image data
 *
 * @param {ImageData} imgData - source image data
 * @param {Array} palette - palette to use for dithering
 * @param {Object} [ditherOptions] - additional dither options
 *
 * @return {ImageData} dithered image data
 */
export function ditherImageData(imgData, palette, ditherOptions = {}) {
  const ditheredImgData = new ImageData(imgData.width, imgData.height);
  ditheredImgData.data.set(new Uint8ClampedArray(imgData.data));
  ditherjs.ditherImageData(ditheredImgData, {
    palette: normalizeDitherPalette(palette),
    ...ditherOptions,
  });
  return ditheredImgData;
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
 * Creates a canvas with palette swatches
 *
 * @param  {Array} palette - all available colors
 * @param  {number} [swatchSize] - dimensions of each swatch
 * @param  {number} [swatchColumns] - number of columns in the output
 * @return {HTMLCanvasElement} canvas with the color swatches drawn
 */
export function canvasImage(
  palette,
  swatchSize = 16,
  swatchColumns = Math.ceil(Math.sqrt(palette.length)),
) {
  const width = swatchColumns * swatchSize;
  const height = Math.ceil(palette.length / swatchColumns) * swatchSize;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext('2d');

  palette.forEach((color, i) => {
    const x = (i % swatchColumns) * swatchSize;
    const y = Math.floor(i / swatchColumns) * swatchSize;
    ctx.fillStyle = normalizeColorHex(color);
    ctx.fillRect(x, y, swatchSize, swatchSize);
  });

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
 * @param  {Array} [options.globalPalette] - global color palette
 * @param  {Array} [options.backgroundColor] - if set, forces a background color
 * @param  {number} [options.quantizationStep] - quantization steps to use on the first pass
 * @param  {number} [options.tileQuantizationStep] - quantization steps to use on the second pass
 * @param  {string} [options.ditherAlgorithm] - type of dithering to use when applying the palette
 * @param  {number} [options.tileWidth] - width of a tile that gets a subpalette
 * @param  {number} [options.tileHeight] - height of a tile that gets a subpalette
 * @param  {number} [options.tileSampleWidth] - width of a tile used for color sampling
 * @param  {number} [options.tileSampleHeight] - height of a tile used for color sampling
 * @param  {number} [options.upscale] - factor to upscale output
 * @param  {boolean} [options.outputPalette] - if set, the image output will be a palette
 *
 * @return {HTMLCanvasElement} the canvas with the NESified image on it
 */
export function nesify(src, {
  width = 256,
  height = 240,
  scaleMode = SCALE_CONTAIN,
  globalPalette = nesColors,
  backgroundColor = false,
  customPalette = false,
  quantizationStep = 2,
  tileQuantizationStep = 1,
  ditherAlgorithm = 'ordered',
  tileWidth = 8,
  tileHeight = tileWidth,
  tileSampleWidth = tileWidth * 2,
  tileSampleHeight = tileSampleWidth,
  upscale = 1,
  outputPalette = false,
  log = () => {},
} = {}) {
  // Create a new image to load
  const srcImg = new Image();
  srcImg.src = src;

  // Determine canvas dimensions
  const canvasWidth = width;
  const canvasHeight = scaleMode === SCALE_ASPECT ?
    canvasWidth * (srcImg.height / srcImg.width) :
    height;

  // Create a new Canvas
  const canvas = new Canvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');


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
  log(`Using "${scaleMode}" as scale mode`);
  switch (scaleMode) {
    case SCALE_STRETCH:
    case SCALE_ASPECT: {
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
  ctx.fillStyle = normalizeColorHex(globalPalette[0]);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(srcImg, ...srcRect, ...destRect);

  // Store the source ImageData of the scaled image and split into tiles
  const srcImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const tiles = splitIntoTiles(srcImgData, tileWidth, tileHeight);

  //
  // Next, we start reducing the colorspace of the image and dithering to match the NES palette.
  //
  // This happens in multiple phases. First, we get a general estimate of where the overall image
  // lands in the NES colorspace. Working from this image, we can determine the possibilities for
  // more restricted palette. Finally, we narrow down the palettes we actually want to use and apply
  // them to 8x8 tiles of the image.
  //

  // Dither the image and apply the global palette using a clone of the original image data
  log('Creating full image');
  ctx.putImageData(ditherImageData(srcImgData, globalPalette, {
    step: quantizationStep,
    algorithm: ditherAlgorithm,
  }), 0, 0);

  // Determine the local palette for each tile
  const colorsUsedByKey = {};
  const subpalettesByKey = {};
  let sharedBackgroundColor;

  // Split the image into tiles
  if (customPalette) {
    log('Processing custom palette');
    const chunkSize = backgroundColor ? 3 : 4;
    const customPaletteColors = customPalette
      .replace(/[^0-9a-f]/g, '')
      .match(/(.{2})/g)
      .map((key => nesPalette[key]));
    const customPaletteLength = customPaletteColors.length;
    sharedBackgroundColor = customPaletteColors[0];

    // Fill out the colors used
    customPaletteColors.forEach((color) => {
      const key = colorKey(color);
      colorsUsedByKey[key] = { key, color, tilesUsing: 0, pixelsUsing: 0 };
    });

    // Fill out the subpalettes
    for (let i = 0; i < customPaletteLength; i += chunkSize) {
      const palette = customPaletteColors.slice(i, i + chunkSize);
      if (backgroundColor) {
        palette.unshift(backgroundColor);
      }
      const key = paletteKey(palette);
      subpalettesByKey[key] = { key, palette, tilesUsing: 0 };
    }
  } else {
    log('Processing color information');
    splitIntoTiles(srcImgData, tileSampleWidth, tileSampleHeight)
      .forEach((tile) => {
        // Determine the palette and subpalette options from the dithered image data
        const ditheredImgData = ctx.getImageData(...tile.srcPosition);
        const localPalette = getLocalPalette(ditheredImgData);
        const palette = localPalette.map(color => color.color);
        const paletteOptions = enumeratePaletteOptions(palette, COLORS_PER_SUBPALETTE);

        // Aggregate tile and pixel color data for the overall image
        localPalette.forEach((paletteColor) => {
          const { key, color } = paletteColor;
          const colorUsed = colorsUsedByKey[key] || {
            key,
            color,
            tilesUsing: 0,
            pixelsUsing: 0,
          };
          colorUsed.tilesUsing += 1;
          colorUsed.pixelsUsing += paletteColor.pixelsUsing;
          colorsUsedByKey[key] = colorUsed;
        });

        // Aggregate palette option data
        paletteOptions.forEach((paletteOption) => {
          const key = paletteKey(paletteOption);
          const subpalette = subpalettesByKey[key] || {
            key,
            palette: paletteOption,
            tilesUsing: 0,
          };
          subpalette.tilesUsing += 1;
          subpalettesByKey[key] = subpalette;
        });
      });
  }

  // Rank all colors being used by the number of pixels and tiles using them
  log('Checking color usage');
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
  log('Selecting background color');
  if (backgroundColor !== false) {
    sharedBackgroundColor = normalizeColor(backgroundColor);
  } else if (!sharedBackgroundColor) {
    sharedBackgroundColor = colorsUsed[0].color;
  }
  const paletteSorter = createPaletteSorter(sharedBackgroundColor);

  // Ensure that all subpalettes contain the background color
  if (!customPalette) {
    log('Background color sanity check');
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
  }

  // Determine which colors to use
  log('Determining palette');
  log(`${colorsUsed.length} NES colors used`);
  log(`Using ${normalizeColorHex(sharedBackgroundColor)} as background color`);

  // Get an array of subpalettes that we can rank and filter
  let subpalettes = Object.keys(subpalettesByKey).map(key => subpalettesByKey[key]);
  log(`${subpalettes.length} potential subpalettes`);

  // Filter subpalettes to ones that include the background color
  subpalettes = subpalettes.filter(subpalette => (
    subpalette.palette.reduce((hasBackgroundColor, color) => (
      hasBackgroundColor || normalizeColorHex(sharedBackgroundColor) === normalizeColorHex(color)
    ), false)
  ));
  log(`${subpalettes.length} valid subpalettes using the background color`);

  if (subpalettes.length === 0) {
    throw new Error('No color palettes have the background color!');
  }

  // Rank and filter subpalettes
  subpalettes = subpalettes
    .sort(() => (Math.round(Math.random() * 2) - 1))
    .slice(0, SUBPALETTES_PER_IMAGE * 8);
    // .sort((a, b) => comparatorDescending(
    //   paletteScore(a, colorsUsedByKey, colorsUsed.length),
    //   paletteScore(b, colorsUsedByKey, colorsUsed.length),
    // ))
    // .slice(0, SUBPALETTES_PER_IMAGE);

  // Assign a palette to each tile and draw it to the canvas
  log(`Assigning subpalettes to ${tiles.length} tiles from ${subpalettes.length} options`);
  const palettesUsedByKey = {};
  tiles.forEach((tile) => {
    const ditherOptions = {
      step: tileQuantizationStep,
      algorithm: ditherAlgorithm,
    };
    // Ideal tile image data using the full palette
    const tileImgData = ditherImageData(tile.srcImgData, globalPalette, ditherOptions);

    // Calculate dithered versions using each subpalette so we can choose the best one
    const tileImgDataOptions = subpalettes.map((subpalette) => {
      const subpaletteImgData = ditherImageData(tile.srcImgData, subpalette.palette, ditherOptions);
      const distance = imageDataDistance(tileImgData, subpaletteImgData);
      return { distance, subpalette, subpaletteImgData };
    })
      .sort((a, b) => comparatorAscending(a.distance, b.distance));

    const {
      subpalette,
      subpaletteImgData,
    } = tileImgDataOptions[0];

    palettesUsedByKey[paletteKey(subpalette.palette)] = subpalette.palette.sort(paletteSorter);

    ctx.putImageData(subpaletteImgData, tile.srcPosition[0], tile.srcPosition[1]);
  });

  // Draw just the palette
  if (outputPalette) {
    log('Writing palette colors to canvas');
    return canvasImage(
      arrayProto.concat.call(...Object.keys(palettesUsedByKey).map(key => palettesUsedByKey[key])),
      16,
      16,
    );
    // return canvasImage(colorsUsed.map(c => c.color), 16, 16);
  }

  // Upscale final image
  if (upscale > 1) {
    log(`Upscaling ${upscale}x`);
    return upscaleCanvas(canvas, upscale);
  }

  // Have fun, kids
  return canvas;
}

export default nesify;
