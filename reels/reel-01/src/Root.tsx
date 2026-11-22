import React from 'react';
import {Composition, continueRender, delayRender, staticFile} from 'remotion';
import {Reel} from './Reel';

const fonts: [string, string][] = [
  ['900', 'heebo-hebrew-900-normal.woff2'],
  ['800', 'heebo-hebrew-800-normal.woff2'],
  ['500', 'heebo-hebrew-500-normal.woff2'],
];
const handle = delayRender('fonts');
Promise.all([
  ...fonts.map(([w, f]) => new FontFace('Heebo', `url(${staticFile(f)})`, {weight: w}).load()),
  new FontFace('HeeboLatin', `url(${staticFile('heebo-latin-900-normal.woff2')})`, {weight: '900'}).load(),
]).then((faces) => {
  faces.forEach((f) => document.fonts.add(f));
  continueRender(handle);
});

export const Root: React.FC = () => (
  <Composition id="Reel" component={Reel} durationInFrames={450} fps={30} width={1080} height={1920} />
);
