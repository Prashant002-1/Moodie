import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FeelingChoices } from '../../src/components/diary/FeelingChoices';
import { EmotionScores } from '../../src/types/emotion';
import { FEELING_KEYS, MAX_FEELINGS, feelingWords, feelingsFromOrder, noFeelings, orderedFeelings } from '../../src/utils/feelings';

// The component is controlled, so the tests hold its value the way a form does.
function Harness({ initial = noFeelings(), onChange }: { initial?: EmotionScores; onChange?: (value: EmotionScores) => void }) {
  const [value, setValue] = useState(initial);
  return <FeelingChoices value={value} onChange={next => { setValue(next); onChange?.(next); }} />;
}
const chip = (name: string | RegExp) => screen.getByRole('button', { name });

describe('FeelingChoices', () => {
  it('keeps the order of choosing, and the first chosen is the strongest', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'What did you feel?' })).toBeInTheDocument();
    await userEvent.click(chip('Wonder'));
    await userEvent.click(chip('Joy'));
    await userEvent.click(chip('Melancholy'));
    expect(chip(/^Wonder ?, strongest$/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^Joy ?, second$/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^Melancholy ?, third$/)).toHaveAttribute('aria-pressed', 'true');
    const saved: EmotionScores = onChange.mock.lastCall![0];
    expect(orderedFeelings(saved)).toEqual(['surprised', 'happy', 'sad']);
    expect(saved.surprised).toBeGreaterThan(saved.happy);
    expect(saved.happy).toBeGreaterThan(saved.sad);
    expect(saved.sad).toBeGreaterThan(0);
  });

  it('does not allow a fourth choice', async () => {
    const onChange = vi.fn();
    render(<Harness initial={feelingsFromOrder(['surprised', 'happy', 'sad'])} onChange={onChange} />);
    for (const name of ['Stillness', 'Friction', 'Tension', 'Unease']) expect(chip(name)).toBeDisabled();
    await userEvent.click(chip('Tension'));
    expect(onChange).not.toHaveBeenCalled();
    expect(chip('Tension')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(MAX_FEELINGS);
  });

  it('re-orders the rest when one is removed, and frees a place', async () => {
    const onChange = vi.fn();
    render(<Harness initial={feelingsFromOrder(['surprised', 'happy', 'sad'])} onChange={onChange} />);
    await userEvent.click(chip(/^Wonder ?, strongest$/));
    expect(chip('Wonder')).toHaveAttribute('aria-pressed', 'false');
    expect(chip(/^Joy ?, strongest$/)).toBeInTheDocument();
    expect(chip(/^Melancholy ?, second$/)).toBeInTheDocument();
    expect(onChange.mock.lastCall![0]).toEqual(feelingsFromOrder(['happy', 'sad']));
    expect(chip('Tension')).toBeEnabled();
    await userEvent.click(chip('Tension'));
    expect(chip(/^Tension ?, third$/)).toBeInTheDocument();
    expect(orderedFeelings(onChange.mock.lastCall![0])).toEqual(['happy', 'sad', 'fearful']);
  });

  it('shows words and their order only: no slider, amount or percentage', async () => {
    const { container } = render(<Harness initial={feelingsFromOrder(['happy', 'surprised'])} />);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(container.querySelector('input')).toBeNull();
    expect(container.textContent).not.toMatch(/%|intensity/i);
    expect(screen.getAllByRole('button')).toHaveLength(FEELING_KEYS.length);
    // The only numbers are the places in the order.
    expect(container.textContent?.match(/\d+(\.\d+)?/g)).toEqual(['1', '2']);
  });

  it('cannot be changed while the form is busy', () => {
    render(<FeelingChoices disabled onChange={vi.fn()} value={noFeelings()} />);
    expect(screen.getByRole('group', { name: 'What did you feel?' })).toBeDisabled();
  });
});

describe('feelings', () => {
  it('records order as the only strength, and nothing for words not chosen', () => {
    const saved = feelingsFromOrder(['sad', 'angry', 'neutral']);
    expect(saved.sad).toBeGreaterThan(saved.angry);
    expect(saved.angry).toBeGreaterThan(saved.neutral);
    expect(saved.neutral).toBeGreaterThan(0);
    expect([saved.happy, saved.fearful, saved.disgusted, saved.surprised]).toEqual([0, 0, 0, 0]);
    expect(orderedFeelings(saved)).toEqual(['sad', 'angry', 'neutral']);
    expect(feelingWords(saved)).toEqual(['Melancholy', 'Friction', 'Stillness']);
  });

  it('reads stored responses strongest first and ignores what was not felt', () => {
    expect(orderedFeelings({ happy: '0.2', sad: 0.9, angry: 0.01, surprised: null })).toEqual(['sad', 'happy']);
    expect(orderedFeelings(noFeelings())).toEqual([]);
    expect(orderedFeelings(null)).toEqual([]);
    expect(feelingWords(undefined)).toEqual([]);
  });
});

it('shows only the three strongest feelings of an older response as chosen, and keeps to three once changed', async () => {
  const changed = vi.fn();
  const older = { neutral: .2, happy: .7, sad: .1, angry: .3, fearful: .9, disgusted: 0, surprised: .5 };
  render(<FeelingChoices value={older} onChange={changed} />);
  expect(screen.getAllByRole('button', { pressed: true }).map(button => button.textContent)).toEqual(['2Joy, second', '1Tension, strongest', '3Wonder, third']);
  expect(changed).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /^Wonder/ }));
  expect(changed).toHaveBeenLastCalledWith({ neutral: 0, happy: .6, sad: 0, angry: 0, fearful: 1, disgusted: 0, surprised: 0 });
});
