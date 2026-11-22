import React from 'react';
import {Composition, continueRender, delayRender, staticFile} from 'remotion';
import {Reel} from './Reel';

const handle = delayRender('fonts', {timeoutInMilliseconds: 120000});
new FontFace('Heebo', `url(${staticFile('heebo-hebrew-400-normal.woff2')})`, {weight: '400'}).load().then((f) => {
  document.fonts.add(f);
  continueRender(handle);
});

export const Root: React.FC = () => (
  <Composition id="Reel" component={Reel} durationInFrames={210} fps={30} width={1080} height={1920} />
);
