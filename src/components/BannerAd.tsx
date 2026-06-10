import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';

// Official Google AdMob Test Banner Unit IDs (preserved for fallback text/reference)
const TEST_BANNER_UNIT_ID = Platform.select({
  android: 'ca-app-pub-3940256099942544/6300978111',
  ios: 'ca-app-pub-3940256099942544/2934735716',
  default: 'ca-app-pub-3940256099942544/6300978111',
}) || 'ca-app-pub-3940256099942544/6300978111';

interface BannerAdProps {
  onAdFailedToLoad?: (error: Error) => void;
}

export const BannerAd: React.FC<BannerAdProps> = () => {
  // Fallback Mock Ad Banner for Local Testing / Expo Go
  return (
    <View style={styles.mockContainer}>
      <View style={styles.adBadge}>
        <Text style={styles.adBadgeText}>AD</Text>
      </View>
      <Text style={styles.mockText}>
        Sortli Sponsor Ad • Test Unit ID: {TEST_BANNER_UNIT_ID.substring(0, 19)}...
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  mockContainer: {
    height: 60,
    width: '100%',
    backgroundColor: '#EEF2FF', // Soft indigo background
    borderTopWidth: 1,
    borderTopColor: '#E0E7FF',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  mockText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#312E81', // Dark indigo text
    textAlign: 'right',
  },
  adBadge: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  adBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});

export default BannerAd;
