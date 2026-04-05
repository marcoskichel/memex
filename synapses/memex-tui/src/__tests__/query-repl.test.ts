import { describe, expect, it } from 'vitest';

interface RecallResult {
  record: {
    id: number;
    data: string;
    tier: 'episodic' | 'semantic';
    createdAt: string;
    metadata: Record<string, unknown>;
  };
  effectiveScore: number;
}

type ReplState =
  | { mode: 'idle' }
  | { mode: 'typing'; input: string }
  | { mode: 'loading'; query: string }
  | { mode: 'results'; query: string; results: RecallResult[]; selected: number }
  | {
      mode: 'detail';
      query: string;
      results: RecallResult[];
      selected: number;
      detail: RecallResult;
    };

type ReplAction =
  | { type: 'char'; char: string }
  | { type: 'backspace' }
  | { type: 'enter' }
  | { type: 'escape' }
  | { type: 'arrow-up' }
  | { type: 'arrow-down' }
  | { type: 'loaded'; results: RecallResult[] }
  | { type: 'expand'; result: RecallResult };

function reduce(state: ReplState, action: ReplAction): ReplState {
  if (state.mode === 'idle') {
    if (action.type === 'char') {
      return { mode: 'typing', input: action.char };
    }
    return state;
  }

  if (state.mode === 'typing') {
    if (action.type === 'char') {
      return { ...state, input: state.input + action.char };
    }
    if (action.type === 'backspace') {
      const next = state.input.slice(0, -1);
      return next ? { ...state, input: next } : { mode: 'idle' };
    }
    if (action.type === 'enter' && state.input.trim()) {
      return { mode: 'loading', query: state.input };
    }
    if (action.type === 'escape') {
      return { mode: 'idle' };
    }
    return state;
  }

  if (state.mode === 'loading') {
    if (action.type === 'loaded') {
      return { mode: 'results', query: state.query, results: action.results, selected: 0 };
    }
    return state;
  }

  if (state.mode === 'results') {
    if (action.type === 'arrow-up') {
      return { ...state, selected: Math.max(0, state.selected - 1) };
    }
    if (action.type === 'arrow-down') {
      return { ...state, selected: Math.min(state.results.length - 1, state.selected + 1) };
    }
    if (action.type === 'expand') {
      return {
        mode: 'detail',
        query: state.query,
        results: state.results,
        selected: state.selected,
        detail: action.result,
      };
    }
    if (action.type === 'escape') {
      return { mode: 'idle' };
    }
    return state;
  }

  if (action.type === 'escape') {
    return {
      mode: 'results',
      query: state.query,
      results: state.results,
      selected: state.selected,
    };
  }
  return state;
}

const fakeResult: RecallResult = {
  record: {
    id: 1,
    data: 'auth system details',
    tier: 'episodic',
    createdAt: '2026-01-01',
    metadata: {},
  },
  effectiveScore: 0.9,
};

describe('QueryRepl state machine', () => {
  it('idle → typing on char', () => {
    const result = reduce({ mode: 'idle' }, { type: 'char', char: 'a' });
    expect(result).toEqual({ mode: 'typing', input: 'a' });
  });

  it('typing → loading on enter', () => {
    const result = reduce({ mode: 'typing', input: 'auth' }, { type: 'enter' });
    expect(result).toEqual({ mode: 'loading', query: 'auth' });
  });

  it('typing: enter on empty input stays typing', () => {
    const result = reduce({ mode: 'typing', input: '' }, { type: 'enter' });
    expect(result.mode).toBe('typing');
  });

  it('typing → idle on escape', () => {
    const result = reduce({ mode: 'typing', input: 'auth' }, { type: 'escape' });
    expect(result).toEqual({ mode: 'idle' });
  });

  it('typing: backspace to empty → idle', () => {
    const result = reduce({ mode: 'typing', input: 'a' }, { type: 'backspace' });
    expect(result).toEqual({ mode: 'idle' });
  });

  it('loading → results on loaded', () => {
    const result = reduce(
      { mode: 'loading', query: 'auth' },
      { type: 'loaded', results: [fakeResult] },
    );
    expect(result).toEqual({ mode: 'results', query: 'auth', results: [fakeResult], selected: 0 });
  });

  it('results: arrow-down increments selected', () => {
    const results = [fakeResult, { ...fakeResult, record: { ...fakeResult.record, id: 2 } }];
    let state: ReplState = { mode: 'results', query: 'auth', results, selected: 0 };
    state = reduce(state, { type: 'arrow-down' });
    expect((state as { selected: number }).selected).toBe(1);
  });

  it('results: arrow-up clamps at 0', () => {
    const result = reduce(
      { mode: 'results', query: 'auth', results: [fakeResult], selected: 0 },
      { type: 'arrow-up' },
    );
    expect((result as { selected: number }).selected).toBe(0);
  });

  it('results → detail on expand', () => {
    const result = reduce(
      { mode: 'results', query: 'auth', results: [fakeResult], selected: 0 },
      { type: 'expand', result: fakeResult },
    );
    expect(result).toMatchObject({ mode: 'detail', detail: fakeResult });
  });

  it('results → idle on escape', () => {
    const result = reduce(
      { mode: 'results', query: 'auth', results: [fakeResult], selected: 0 },
      { type: 'escape' },
    );
    expect(result).toEqual({ mode: 'idle' });
  });

  it('detail → results on escape', () => {
    const result = reduce(
      { mode: 'detail', query: 'auth', results: [fakeResult], selected: 0, detail: fakeResult },
      { type: 'escape' },
    );
    expect(result).toMatchObject({ mode: 'results' });
  });
});
