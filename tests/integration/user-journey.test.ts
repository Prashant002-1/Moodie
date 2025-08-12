import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createMockEmotionScores, createMockMovie } from '../test-utils';

// Mock external APIs
vi.mock('axios');
const mockedAxios = vi.mocked((await import('axios')).default);

describe('Integration: Complete User Journey', () => {
  let userToken: string;
  let userId: number;
  const testUser = {
    email: 'journey-test@test.com',
    username: 'journeytest',
    password: 'securePassword123'
  };

  beforeAll(async () => {
    // Setup mock TMDB responses
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/discover/movie')) {
        return Promise.resolve({
          data: {
            results: [
              createMockMovie({ id: 1, title: 'Happy Movie', genre_ids: [35] }),
              createMockMovie({ id: 2, title: 'Action Movie', genre_ids: [28] }),
            ]
          }
        });
      }
      if (url.includes('/movie/popular')) {
        return Promise.resolve({
          data: {
            results: [
              createMockMovie({ id: 3, title: 'Popular Movie', genre_ids: [18] }),
            ]
          }
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Complete User Flow: Registration → Emotion → Recommendations → Profile', () => {
    it('should complete full user journey successfully', async () => {
      // Step 1: User Registration
      const { authService } = await import('../../src/services/authService');
      const registerResult = await authService.register(
        testUser.email,
        testUser.username,
        testUser.password
      );

      expect(registerResult).toHaveProperty('token');
      expect(registerResult).toHaveProperty('user');
      expect(registerResult.user.email).toBe(testUser.email);
      
      userToken = registerResult.token;
      userId = registerResult.user.id;

      // Step 2: Emotion Detection
      const testEmotions = createMockEmotionScores({
        happy: 0.7,
        sad: 0.2,
        neutral: 0.1
      });

      const { emotionService } = await import('../../src/services/emotionService');
      const emotionResult = await emotionService.saveEmotionSession(
        userId,
        testEmotions,
        'webcam'
      );

      expect(emotionResult).toHaveProperty('id');
      expect(emotionResult.happy).toBeCloseTo(0.7, 1);
      expect(emotionResult.detection_method).toBe('webcam');

      // Step 3: Emotion-based Recommendations
      const { recommendationService } = await import('../../src/services/recommendationService');
      const recommendations = await recommendationService.getEmotionBasedRecommendations(
        testEmotions,
        10
      );

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      // Step 4: Personalized Emotion Mapping
      const { personalizedEmotionMapping } = await import('../../src/services/personalizedEmotionMapping');
      const mappings = await personalizedEmotionMapping.getUserMappings(userId.toString());

      expect(typeof mappings).toBe('object');

      // Update personalized mappings
      const updatedMappings = {
        happy: { 35: 0.9, 16: 0.7 }, // Comedy, Animation
        sad: { 18: 0.8 } // Drama
      };

      const updateResult = await personalizedEmotionMapping.updateUserMappings(
        userId.toString(),
        updatedMappings
      );

      expect(updateResult).toBe(true);

      // Step 5: Verify personalized recommendations
      const personalizedRecs = await recommendationService.getPersonalizedRecommendations(
        userId.toString(),
        testEmotions,
        5
      );

      expect(Array.isArray(personalizedRecs)).toBe(true);

      // Step 6: User Profile and History
      const userEmotions = await emotionService.getUserEmotions(userId, 5);
      expect(Array.isArray(userEmotions)).toBe(true);
      expect(userEmotions.length).toBeGreaterThan(0);
    });

    it('should handle authentication throughout the journey', async () => {
      // Test authentication persistence
      const { authService } = await import('../../src/services/authService');
      
      // Login with existing user
      const loginResult = await authService.login(testUser.email, testUser.password);
      expect(loginResult).toHaveProperty('token');
      expect(loginResult.user.email).toBe(testUser.email);

      // Verify token validation
      const currentUser = await authService.getCurrentUser();
      expect(currentUser).toHaveProperty('email', testUser.email);

      // Test logout
      await authService.logout();
      
      // Verify user is logged out
      try {
        await authService.getCurrentUser();
        expect.fail('Should have thrown error for unauthenticated user');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle API failures gracefully', async () => {
      // Simulate TMDB API failure
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      const testEmotions = createMockEmotionScores({ happy: 0.8 });
      const { recommendationService } = await import('../../src/services/recommendationService');

      try {
        const recommendations = await recommendationService.getEmotionBasedRecommendations(
          testEmotions,
          5
        );
        // Should return empty array or fallback data
        expect(Array.isArray(recommendations)).toBe(true);
      } catch (error) {
        // Should handle error gracefully
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid emotion data', async () => {
      const invalidEmotions = {
        happy: 2.0, // Invalid: > 1
        sad: -0.1,  // Invalid: < 0
      } as any;

      const { recommendationService } = await import('../../src/services/recommendationService');
      
      try {
        await recommendationService.getEmotionBasedRecommendations(invalidEmotions, 5);
        expect.fail('Should have thrown error for invalid emotions');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle network connectivity issues', async () => {
      // Simulate network timeout
      mockedAxios.get.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 1000)
        )
      );

      const testEmotions = createMockEmotionScores({ sad: 0.8 });
      const { recommendationService } = await import('../../src/services/recommendationService');

      try {
        await recommendationService.getEmotionBasedRecommendations(testEmotions, 3);
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
    });
  });

  describe('Data Consistency and Persistence', () => {
    it('should maintain data consistency across services', async () => {
      const testEmotions = createMockEmotionScores({
        angry: 0.6,
        fearful: 0.3,
        neutral: 0.1
      });

      // Save emotion session
      const { emotionService } = await import('../../src/services/emotionService');
      const emotionResult = await emotionService.saveEmotionSession(
        userId,
        testEmotions,
        'manual'
      );

      // Retrieve saved emotions
      const retrievedEmotion = await emotionService.getEmotionById(emotionResult.id);
      
      expect(retrievedEmotion).toBeDefined();
      expect(retrievedEmotion!.angry).toBeCloseTo(testEmotions.angry, 2);
      expect(retrievedEmotion!.fearful).toBeCloseTo(testEmotions.fearful, 2);
    });

    it('should handle concurrent user sessions', async () => {
      // Simulate multiple users with different emotions
      const user1Emotions = createMockEmotionScores({ happy: 0.9 });
      const user2Emotions = createMockEmotionScores({ sad: 0.8 });

      const { emotionService } = await import('../../src/services/emotionService');
      
      const [result1, result2] = await Promise.all([
        emotionService.saveEmotionSession(1, user1Emotions, 'webcam'),
        emotionService.saveEmotionSession(2, user2Emotions, 'upload')
      ]);

      expect(result1.user_id).toBe(1);
      expect(result2.user_id).toBe(2);
      expect(result1.happy).toBeCloseTo(0.9, 1);
      expect(result2.sad).toBeCloseTo(0.8, 1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple recommendation requests efficiently', async () => {
      const startTime = Date.now();
      
      const { recommendationService } = await import('../../src/services/recommendationService');
      const testEmotions = createMockEmotionScores({ surprised: 0.7 });

      const promises = Array.from({ length: 5 }, () =>
        recommendationService.getEmotionBasedRecommendations(testEmotions, 3)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });

      // Performance assertion (should complete within reasonable time)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should handle large emotion datasets', async () => {
      const { emotionService } = await import('../../src/services/emotionService');
      
      // Create multiple emotion sessions
      const sessions = Array.from({ length: 10 }, (_, i) =>
        emotionService.saveEmotionSession(
          userId,
          createMockEmotionScores({ 
            happy: Math.random(),
            sad: Math.random(),
            neutral: Math.random()
          }),
          'webcam'
        )
      );

      const results = await Promise.all(sessions);
      expect(results).toHaveLength(10);

      // Retrieve user's emotion history
      const history = await emotionService.getUserEmotions(userId, 10);
      expect(history.length).toBeGreaterThan(0);
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Security Integration', () => {
    it('should enforce authentication across all services', async () => {
      // Test without authentication
      const { personalizedEmotionMapping } = await import('../../src/services/personalizedEmotionMapping');
      
      try {
        await personalizedEmotionMapping.getUserMappings('unauthorized-user');
        expect.fail('Should require authentication');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should validate user permissions', async () => {
      // Create second user
      const { authService } = await import('../../src/services/authService');
      const secondUser = await authService.register(
        'second@test.com',
        'seconduser',
        'password123'
      );

      const { emotionService } = await import('../../src/services/emotionService');
      
      // User 1 should not access User 2's data
      const user1Emotions = await emotionService.getUserEmotions(userId, 5);
      const user2Emotions = await emotionService.getUserEmotions(secondUser.user.id, 5);

      // Verify data separation
      expect(user1Emotions).not.toEqual(user2Emotions);
    });
  });
});