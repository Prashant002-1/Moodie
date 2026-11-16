/**
 * Emotion Type Definitions
 * 
 * Type definitions for reviewed emotional records.
 * The current seven-key shape is a prototype constraint, not the final product vocabulary.
 */

/**
 * Reviewed emotional values entered directly by the person.
 * All values are normalized between 0 and 1, representing the intensity of each emotion.
 */
export interface EmotionScores {
  /** Neutral emotional state (0-1) */
  neutral: number;
  /** Happy/joyful emotional state (0-1) */
  happy: number;
  /** Sad emotional state (0-1) */
  sad: number;
  /** Angry emotional state (0-1) */
  angry: number;
  /** Fearful/scared emotional state (0-1) */
  fearful: number;
  /** Disgusted emotional state (0-1) */
  disgusted: number;
  /** Surprised emotional state (0-1) */
  surprised: number;
}
