import React from 'react';
import BannerAd from './BannerAd';

interface BottomAdBannerProps {
  text?: string;
}

const BottomAdBanner: React.FC<BottomAdBannerProps> = () => {
  return <BannerAd />;
};

export default BottomAdBanner;
