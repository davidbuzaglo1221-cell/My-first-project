import React from 'react';
import {Composition, continueRender, delayRender, staticFile} from 'remotion';
import {Reel} from './Reel';

const handle = delayRender('fonts', {timeoutInMilliseconds: 120000});
Promise.all([
  new FontFace('Heebo', `url(${staticFile('heebo-hebrew-400-normal.woff2')})`, {weight: '400'}).load(),
  new FontFace('Frank', `url(${staticFile('frank-ruhl-libre-hebrew-900-normal.woff2')})`, {weight: '900'}).load(),
]).then((fs) => {
  fs.forEach((f) => document.fonts.add(f));
  continueRender(handle);
});

export const Root: React.FC = () => (
  <Composition id="Reel" component={Reel} durationInFrames={600} fps={30} width={1080} height={1920} />
);
