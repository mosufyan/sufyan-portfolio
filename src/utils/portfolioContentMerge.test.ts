import { describe, expect, it } from 'vitest';
import { CERTIFICATIONS } from '../data/portfolioData';
import { mergeById, mergeCertifications } from './portfolioContentMerge';

describe('portfolioContentMerge', () => {
  it('overrides static items by id and appends new cloud items', () => {
    const staticSeed = [
      { id: 'a', title: 'Static A' },
      { id: 'b', title: 'Static B' },
    ];
    const cloud = [
      { id: 'b', title: 'Cloud B', source: 'cloud' as const },
      { id: 'c', title: 'Cloud C', source: 'cloud' as const },
    ];
    expect(mergeById(staticSeed, cloud)).toEqual([
      { id: 'a', title: 'Static A' },
      { id: 'b', title: 'Cloud B', source: 'cloud' },
      { id: 'c', title: 'Cloud C', source: 'cloud' },
    ]);
  });

  it('hides static items marked deleted in cloud', () => {
    const staticSeed = [{ id: 'a', title: 'Static A' }];
    const cloud = [{ id: 'a', title: 'Static A', source: 'cloud' as const, deleted: true }];
    expect(mergeById(staticSeed, cloud)).toEqual([]);
  });

  it('hides static items listed in seed hide markers', () => {
    const staticSeed = [
      { id: 'a', title: 'Static A' },
      { id: 'b', title: 'Static B' },
    ];
    expect(mergeById(staticSeed, [], ['a'])).toEqual([{ id: 'b', title: 'Static B' }]);
  });

  it('merges real certifications without dropping the static catalog when cloud empty', () => {
    expect(mergeCertifications([])).toHaveLength(CERTIFICATIONS.length);
  });
});
