import React from 'react';
import {Composition, continueRender, delayRender, staticFile} from 'remotion';
import {Reel} from './Reel';

const faces: [string, string, string][] = [
  ['Heebo', '400', 'heebo-hebrew-400-normal.woff2'],
  ['Heebo', '700', 'heebo-hebrew-700-normal.woff2'],
  ['Heebo', '800', 'heebo-hebrew-800-normal.woff2'],
  ['HeeboLatin', '500', 'heebo-latin-500-normal.woff2'],
  ['Frank', '900', 'frank-ruhl-libre-hebrew-900-normal.woff2'],
  ['DavidLibre', '700', 'david-libre-hebrew-700-normal.woff2'],
  ['Marker', '700', 'amatic-sc-hebrew-700-normal.woff2'],
];
const handle = delayRender('fonts', {timeoutInMilliseconds: 120000});
Promise.all(faces.map(([fam, w, file]) => new FontFace(fam, `url(${staticFile(file)})`, {weight: w}).load())).then((loaded) => {
  loaded.forEach((f) => document.fonts.add(f));
  continueRender(handle);
});

export const Root: React.FC = () => (
  <Composition id="Reel" component={Reel} durationInFrames={450} fps={30} width={1080} height={1920} />
);
