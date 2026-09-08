import { hashDeepSeek } from '../../src/deepseek/pow'

describe('DeepSeek proof-of-work hashing', () => {
  it('matches the DeepSeekHashV1 reference digest', () => {
    expect(hashDeepSeek('abc')).toBe(
      'f841106c601ce9be9bc38525e90d4178d47f21dd8eb9f238fc55ffaa4ca94506'
    )
  })

  it('applies the final padded block for empty and full-rate inputs', () => {
    expect(hashDeepSeek('')).toBe(
      'e594808bc5b7151ac160c6d39a02e0a8e261ed588578403099e3561dc40c26b3'
    )
    expect(hashDeepSeek('a'.repeat(136))).toBe(
      '680364b336f77918ed390287a581f96f1371599825acd1e348fa7649fcecbbab'
    )
  })
})
