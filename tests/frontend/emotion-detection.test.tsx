import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmotionCapture } from '../../src/components/EmotionCapture';
import { EmotionDisplay } from '../../src/components/features/emotion/EmotionDisplay';
import { ManualEmotionInput } from '../../src/components/features/emotion/ManualEmotionInput';
import { EmotionProvider } from '../../src/contexts/EmotionContext';
import { createMockEmotionScores } from '../test-utils';

// Mock face-api.js
vi.mock('face-api.js', () => ({
  nets: {
    ssdMobilenetv1: {
      loadFromUri: vi.fn().mockResolvedValue(true),
      isLoaded: vi.fn().mockReturnValue(true),
    },
    faceLandmark68Net: {
      loadFromUri: vi.fn().mockResolvedValue(true),
      isLoaded: vi.fn().mockReturnValue(true),
    },
    faceExpressionNet: {
      loadFromUri: vi.fn().mockResolvedValue(true),
      isLoaded: vi.fn().mockReturnValue(true),
    },
  },
  detectAllFaces: vi.fn().mockResolvedValue([
    {
      expressions: {
        neutral: 0.1,
        happy: 0.7,
        sad: 0.1,
        angry: 0.05,
        fearful: 0.03,
        disgusted: 0.01,
        surprised: 0.01,
      },
    },
  ]),
  resizeResults: vi.fn().mockReturnValue([]),
  matchDimensions: vi.fn(),
}));

// Mock emotion detection service
vi.mock('../../src/services/emotionDetection', () => ({
  LoadModels: vi.fn().mockResolvedValue(undefined),
  DetectEmotionsFromImage: vi.fn(),
  DetectEmotionsFromVideo: vi.fn(),
  EnhanceEmotionScores: vi.fn((scores) => scores),
  GetDominantEmotion: vi.fn().mockReturnValue('happy'),
  GetConfidenceLevel: vi.fn().mockReturnValue(0.8),
  FormatEmotionsForDisplay: vi.fn().mockReturnValue('😊 70% 😐 10%'),
  GetEmotionIcon: vi.fn().mockReturnValue('😊'),
  GetEmotionColor: vi.fn().mockReturnValue('#10B981'),
}));

// Mock MediaDevices API
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <EmotionProvider>
    {children}
  </EmotionProvider>
);

describe('Frontend Emotion Detection - Core Functionality', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('EmotionCapture Component', () => {
    it('should render all input method options', () => {
      render(
        <TestWrapper>
          <EmotionCapture onEmotionsDetected={vi.fn()} />
        </TestWrapper>
      );

      expect(screen.getByText(/webcam/i)).toBeInTheDocument();
      expect(screen.getByText(/upload image/i)).toBeInTheDocument();
      expect(screen.getByText(/manual input/i)).toBeInTheDocument();
    });

    it('should switch between input methods', async () => {
      render(
        <TestWrapper>
          <EmotionCapture onEmotionsDetected={vi.fn()} />
        </TestWrapper>
      );

      const manualTab = screen.getByText(/manual input/i);
      await user.click(manualTab);

      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('should request camera permission for webcam', async () => {
      render(
        <TestWrapper>
          <EmotionCapture onEmotionsDetected={vi.fn()} />
        </TestWrapper>
      );

      const webcamTab = screen.getByText(/webcam/i);
      await user.click(webcamTab);

      const startButton = screen.getByText(/start camera/i);
      await user.click(startButton);

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: { width: 640, height: 480 }
      });
    });

    it('should handle camera permission denial', async () => {
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
        new Error('Permission denied')
      );

      render(
        <TestWrapper>
          <EmotionCapture onEmotionsDetected={vi.fn()} />
        </TestWrapper>
      );

      const webcamTab = screen.getByText(/webcam/i);
      await user.click(webcamTab);

      const startButton = screen.getByText(/start camera/i);
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/camera access denied/i)).toBeInTheDocument();
      });
    });

    it('should process uploaded image file', async () => {
      const mockFile = new File(['fake image'], 'test.jpg', { type: 'image/jpeg' });
      
      render(
        <TestWrapper>
          <EmotionCapture onEmotionsDetected={vi.fn()} />
        </TestWrapper>
      );

      const uploadTab = screen.getByText(/upload image/i);
      await user.click(uploadTab);

      const fileInput = screen.getByLabelText(/choose image/i);
      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByAltText(/uploaded/i)).toBeInTheDocument();
      });
    });

    it('should validate uploaded file type', async () => {
      const mockFile = new File(['fake text'], 'test.txt', { type: 'text/plain' });
      
      render(
        <TestWrapper>
          <EmotionCapture onEmotionsDetected={vi.fn()} />
        </TestWrapper>
      );

      const uploadTab = screen.getByText(/upload image/i);
      await user.click(uploadTab);

      const fileInput = screen.getByLabelText(/choose image/i);
      await user.upload(fileInput, mockFile);

      expect(screen.getByText(/please select a valid image/i)).toBeInTheDocument();
    });

    it('should call onEmotionsDetected when detection completes', async () => {
      const onEmotionsDetected = vi.fn();
      const mockEmotions = createMockEmotionScores({ happy: 0.8 });
      
      vi.mocked(await import('../../src/services/emotionDetection')).DetectEmotionsFromImage
        .mockResolvedValue(mockEmotions);

      render(
        <TestWrapper>
          <EmotionCapture onEmotionsDetected={onEmotionsDetected} />
        </TestWrapper>
      );

      const manualTab = screen.getByText(/manual input/i);
      await user.click(manualTab);

      const submitButton = screen.getByText(/analyze emotions/i);
      await user.click(submitButton);

      await waitFor(() => {
        expect(onEmotionsDetected).toHaveBeenCalledWith(
          expect.objectContaining({
            emotions: expect.any(Object),
            confidence: expect.any(Number),
            method: expect.any(String),
          })
        );
      });
    });
  });

  describe('EmotionDisplay Component', () => {
    const mockEmotions = createMockEmotionScores({
      happy: 0.7,
      sad: 0.2,
      neutral: 0.1,
    });

    it('should display emotions with correct formatting', () => {
      render(
        <TestWrapper>
          <EmotionDisplay 
            emotions={mockEmotions} 
            confidence={0.8}
            method="webcam"
          />
        </TestWrapper>
      );

      expect(screen.getByText(/70%/)).toBeInTheDocument();
      expect(screen.getByText(/😊/)).toBeInTheDocument();
    });

    it('should show confidence level', () => {
      render(
        <TestWrapper>
          <EmotionDisplay 
            emotions={mockEmotions} 
            confidence={0.8}
            method="webcam"
          />
        </TestWrapper>
      );

      expect(screen.getByText(/80%/)).toBeInTheDocument();
    });

    it('should display detection method', () => {
      render(
        <TestWrapper>
          <EmotionDisplay 
            emotions={mockEmotions} 
            confidence={0.8}
            method="webcam"
          />
        </TestWrapper>
      );

      expect(screen.getByText(/webcam/i)).toBeInTheDocument();
    });

    it('should handle low confidence gracefully', () => {
      render(
        <TestWrapper>
          <EmotionDisplay 
            emotions={mockEmotions} 
            confidence={0.3}
            method="webcam"
          />
        </TestWrapper>
      );

      expect(screen.getByText(/low confidence/i)).toBeInTheDocument();
    });

    it('should filter out emotions below threshold', () => {
      const lowEmotions = createMockEmotionScores({
        happy: 0.02, // Below 5% threshold
        sad: 0.08,   // Above threshold
        neutral: 0.9,
      });

      render(
        <TestWrapper>
          <EmotionDisplay 
            emotions={lowEmotions} 
            confidence={0.8}
            method="manual"
          />
        </TestWrapper>
      );

      expect(screen.queryByText(/2%/)).not.toBeInTheDocument();
      expect(screen.getByText(/8%/)).toBeInTheDocument();
    });
  });

  describe('ManualEmotionInput Component', () => {
    it('should render all emotion sliders', () => {
      render(
        <TestWrapper>
          <ManualEmotionInput onEmotionsChange={vi.fn()} />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/happy/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/sad/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/angry/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/fearful/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/disgusted/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/surprised/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/neutral/i)).toBeInTheDocument();
    });

    it('should update emotion values when sliders change', async () => {
      const onEmotionsChange = vi.fn();
      
      render(
        <TestWrapper>
          <ManualEmotionInput onEmotionsChange={onEmotionsChange} />
        </TestWrapper>
      );

      const happySlider = screen.getByLabelText(/happy/i);
      fireEvent.change(happySlider, { target: { value: '80' } });

      expect(onEmotionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          happy: 0.8,
        })
      );
    });

    it('should normalize emotion values to sum to 1', async () => {
      const onEmotionsChange = vi.fn();
      
      render(
        <TestWrapper>
          <ManualEmotionInput onEmotionsChange={onEmotionsChange} />
        </TestWrapper>
      );

      const happySlider = screen.getByLabelText(/happy/i);
      const sadSlider = screen.getByLabelText(/sad/i);
      
      fireEvent.change(happySlider, { target: { value: '50' } });
      fireEvent.change(sadSlider, { target: { value: '50' } });

      const lastCall = onEmotionsChange.mock.calls[onEmotionsChange.mock.calls.length - 1];
      const emotions = lastCall[0];
      const sum = Object.values(emotions).reduce((acc: number, val: number) => acc + val, 0);
      
      expect(sum).toBeCloseTo(1, 2);
    });

    it('should provide reset functionality', async () => {
      const onEmotionsChange = vi.fn();
      
      render(
        <TestWrapper>
          <ManualEmotionInput onEmotionsChange={onEmotionsChange} />
        </TestWrapper>
      );

      const happySlider = screen.getByLabelText(/happy/i);
      fireEvent.change(happySlider, { target: { value: '80' } });

      const resetButton = screen.getByText(/reset/i);
      await user.click(resetButton);

      expect(onEmotionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          neutral: expect.any(Number),
          happy: expect.any(Number),
        })
      );
    });

    it('should show real-time emotion preview', () => {
      render(
        <TestWrapper>
          <ManualEmotionInput onEmotionsChange={vi.fn()} />
        </TestWrapper>
      );

      const happySlider = screen.getByLabelText(/happy/i);
      fireEvent.change(happySlider, { target: { value: '70' } });

      expect(screen.getByText(/70%/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle face-api.js model loading failure', async () => {
      vi.mocked(await import('../../src/services/emotionDetection')).LoadModels
        .mockRejectedValue(new Error('Model loading failed'));

      render(
        <TestWrapper>
          <EmotionCapture onEmotionsDetected={vi.fn()} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });

    it('should handle detection timeout', async () => {
      vi.mocked(await import('../../src/services/emotionDetection')).DetectEmotionsFromImage
        .mockImplementation(() => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Detection timeout')), 1000)
        ));

      render(
        <TestWrapper>
          <EmotionCapture onEmotionsDetected={vi.fn()} />
        </TestWrapper>
      );

      const mockFile = new File(['fake image'], 'test.jpg', { type: 'image/jpeg' });
      const uploadTab = screen.getByText(/upload image/i);
      await user.click(uploadTab);

      const fileInput = screen.getByLabelText(/choose image/i);
      await user.upload(fileInput, mockFile);

      // Wait for timeout error to appear
      await waitFor(() => {
        expect(screen.getByText(/detection timed out|error|failed/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should handle invalid emotion data gracefully', () => {
      const invalidEmotions = { invalid: 'data' } as any;

      expect(() => {
        render(
          <TestWrapper>
            <EmotionDisplay 
              emotions={invalidEmotions} 
              confidence={0.8}
              method="manual"
            />
          </TestWrapper>
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for sliders', () => {
      render(
        <TestWrapper>
          <ManualEmotionInput onEmotionsChange={vi.fn()} />
        </TestWrapper>
      );

      const happySlider = screen.getByLabelText(/happy/i);
      expect(happySlider).toHaveAttribute('role', 'slider');
      expect(happySlider).toHaveAttribute('aria-valuemin', '0');
      expect(happySlider).toHaveAttribute('aria-valuemax', '100');
    });

    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <ManualEmotionInput onEmotionsChange={vi.fn()} />
        </TestWrapper>
      );

      const happySlider = screen.getByLabelText(/happy/i);
      happySlider.focus();
      
      fireEvent.keyDown(happySlider, { key: 'ArrowRight' });
      expect(parseInt(happySlider.value)).toBeGreaterThan(0);
    });
  });
});