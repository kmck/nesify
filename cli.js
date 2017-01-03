/* eslint-disable no-console */

import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import url from 'url';

import chalk from 'chalk';
import expandTilde from 'expand-tilde';
import minimist from 'minimist';

import nesify from '.';

const argv = minimist(process.argv.slice(2));
const {
  srcUrl = '',
  srcFile = '',
  outSrcFile = path.join(process.cwd(), 'out', `nesify-src-img${path.extname(srcUrl || srcFile)}`),
  outFile = path.join(process.cwd(), 'out', 'nesify.png'),
  ...restArgs
} = argv;

/**
 * Reads an image URL and converts it to a Buffer
 *
 * @param  {string} imageUrl - URL of the image to read
 * @return {Promise} resolves with the Buffer
 */
const readImageToBuffer = imageUrl => new Promise((resolve, reject) => {
  const options = {
    ...url.parse(imageUrl),
    method: 'GET',
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.95 Safari/537.36',
    },
  };

  (url.parse(imageUrl).protocol === 'https:' ? https : http)
    // .get(imageUrl, (response) => {
    .request(options, (response) => {
      if (response.statusCode !== 200) {
        reject('Non-200 response code');
        return;
      }

      const data = [];
      response
        .on('data', (chunk) => {
          data.push(chunk);
        })
        .on('end', () => {
          setTimeout(() => {
            resolve(Buffer.concat(data));
          }, 3000);
        })
        .on('error', (err) => {
          reject(err);
        });
    })
    .end();
});

/**
 * Reads an image from disk and converts it to a buffer
 *
 * @param  {string} filePath - path to the file
 * @return {[type]}          [description]
 */
const readFileToBuffer = filePath => new Promise((resolve, reject) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      reject(err);
      return;
    }
    resolve(data);
  });
});

// Read the input URL and convert it inline
let srcBuffer;
if (srcUrl) {
  console.log(`Reading image URL from ${chalk.magenta(srcUrl)}`);
  srcBuffer = readImageToBuffer(srcUrl);
} else if (srcFile) {
  console.log(`Reading image file from ${chalk.magenta(srcFile)}`);
  srcBuffer = readFileToBuffer(expandTilde(srcFile));
} else {
  srcBuffer = Promise.reject(`Please specify a ${chalk.cyan(srcUrl)} or ${chalk.cyan(srcFile)}`);
}

srcBuffer
  .then(buffer => new Promise((resolve) => {
    fs.writeFile(outSrcFile, buffer, (err) => {
      if (err) {
        console.error(err);
      }
      resolve(buffer);
    });
  }))
  .then((buffer) => {
    const canvas = nesify(buffer, {
      ...restArgs,
      log: (...args) => {
        console.log(...args);
      },
    });

    console.log(`Writing output to ${chalk.blue(outFile)}`);
    fs.writeFile(outFile, canvas.toBuffer(), (err) => {
      if (err) {
        console.error('err', err);
      }
    });
  })
  .catch((err) => {
    console.error(err);
  });
