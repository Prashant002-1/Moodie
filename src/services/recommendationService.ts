import apiClient from './apiClient';
import { EmotionScores } from '../types/emotion';
import { Movie } from '../types/movie';

export interface RecommendationProfile {
  source: 'people' | 'signal' | 'community';
  historySize: number;
  connectedPeople: number;
  dominantEmotions: { key: keyof EmotionScores; weight: number }[];
}

export interface RecommendationResponse {
  profile: RecommendationProfile;
  forYou: Movie[];
  adjacent: Movie[];
  community: Movie[];
}

export const recommendationService = {
  async get(signal?: EmotionScores): Promise<RecommendationResponse> {
    const response = await apiClient.post('/recommendations', signal ? { signal } : {});
    return response.data;
  },
};
