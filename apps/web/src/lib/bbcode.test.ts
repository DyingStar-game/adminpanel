import { describe, expect, it } from 'vitest';
import { hasBBCode, parseBBCode } from './bbcode';

describe('parseBBCode', () => {
  it("interprets the game editor's tags", () => {
    expect(parseBBCode("[b]Salut[/b], c'est [color=#F8C3CD]Frank Leboeuf[/color]")).toEqual([
      { tag: 'b', children: ['Salut'] },
      ", c'est ",
      { tag: 'color', color: '#F8C3CD', children: ['Frank Leboeuf'] },
    ]);
    expect(parseBBCode('[i][u]a[/u][/i] [s]b[/s] [color=red]c[/color]')).toEqual([
      { tag: 'i', children: [{ tag: 'u', children: ['a'] }] },
      ' ',
      { tag: 's', children: ['b'] },
      ' ',
      { tag: 'color', color: 'red', children: ['c'] },
    ]);
  });

  it("draws Godot's horizontal rule, whatever its options", () => {
    expect(parseBBCode('a\n[hr]\nb [hr width=50% color=red]c')).toEqual([
      'a\n',
      { tag: 'hr' },
      '\nb ',
      { tag: 'hr' },
      'c',
    ]);
    expect(hasBBCode('[hr]')).toBe(true);
  });

  it('keeps any other tag, an unclosed one or an odd colour as typed', () => {
    expect(parseBBCode('[url=https://x.test]site[/url]')).toEqual([
      '[url=https://x.test]site[/url]',
    ]);
    expect(parseBBCode('a [b]b\n[i]c')).toEqual(['a [b]b\n[i]c']);
    expect(parseBBCode('[color=url(x)]d[/color]')).toEqual(['[color=url(x)]d[/color]']);
    expect(parseBBCode('[son: oui] plain')).toEqual(['[son: oui] plain']);
    // A forum tag Godot does not know either: raw in game too.
    expect(parseBBCode('[size=150]Scythia[/size]')).toEqual(['[size=150]Scythia[/size]']);
  });

  it('says whether there is anything to interpret', () => {
    expect(hasBBCode('[b]x[/b]')).toBe(true);
    expect(hasBBCode('Hauls ore [url]x[/url]')).toBe(false);
  });
});
