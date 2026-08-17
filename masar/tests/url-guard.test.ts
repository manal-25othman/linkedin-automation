import { describe, expect, it } from 'vitest';
import { isPrivateAddress } from '@/lib/job/url-guard';

describe('isPrivateAddress', () => {
  it('يمنع الحلقة المحلية والشبكات الخاصة', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '172.16.0.1', '172.31.255.255']) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
  });

  it('يمنع عنوان بيانات اعتماد السحابة', () => {
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
  });

  it('يمنع نطاق CGNAT و 0.0.0.0/8', () => {
    expect(isPrivateAddress('100.64.0.1')).toBe(true);
    expect(isPrivateAddress('0.0.0.0')).toBe(true);
  });

  it('يمنع IPv6 المحلي والمُغلَّف داخل IPv4', () => {
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('fe80::1')).toBe(true);
    expect(isPrivateAddress('fd00::1')).toBe(true);
    // الالتفاف الشائع: عنوان خاص مُغلَّف بصيغة IPv6
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
  });

  it('يسمح بالعناوين العامة', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('172.32.0.1')).toBe(false); // خارج نطاق 172.16/12
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false);
  });

  it('يرفض ما ليس عنوانًا صالحًا', () => {
    expect(isPrivateAddress('ليس عنوانًا')).toBe(true);
    expect(isPrivateAddress('999.1.1.1')).toBe(true);
  });
});
