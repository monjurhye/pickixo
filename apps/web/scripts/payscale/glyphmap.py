# -*- coding: utf-8 -*-
"""gid -> unicode map for the NikoshBAN / Nikosh subset embedded in gazet.pdf
Base Bengali range verified: gid = 404 + index into ordered list of Bengali
codepoints assigned in Unicode, with U+09D7 absent from the font.
Anchors verified visually: 406=ং 408=অ 420=ক 442=ব 446=র 454=া 461=ে 469=য় 474=০ 483=৯
"""
def _bengali_order():
    cps = []
    cps += [0x0980,0x0981,0x0982,0x0983]
    cps += list(range(0x0985,0x098D))
    cps += [0x098F,0x0990]
    cps += list(range(0x0993,0x09A9))
    cps += list(range(0x09AA,0x09B1))
    cps += [0x09B2]
    cps += list(range(0x09B6,0x09BA))
    cps += [0x09BC,0x09BD]
    cps += list(range(0x09BE,0x09C5))
    cps += [0x09C7,0x09C8]
    cps += [0x09CB,0x09CC,0x09CD,0x09D7]   # font omits U+09CE, includes U+09D7
    cps += [0x09DC,0x09DD]
    cps += list(range(0x09DF,0x09E4))
    cps += list(range(0x09E6,0x09F0))
    return cps

GID = {}
for i, cp in enumerate(_bengali_order()):
    GID[404 + i] = chr(cp)

# Standard Macintosh glyph ordering for the Latin part (verified: 8=% 11=( 16=- 19..28 digits 29=: 62=[ 64=])
_mac = (" !\"#$%&'()*+,-./0123456789:;<=>?@"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`"
        "abcdefghijklmnopqrstuvwxyz{|}~")
for i, ch in enumerate(_mac):
    GID[3 + i] = ch
GID[403] = '।'
GID[348] = '‘'; GID[349] = '’'; GID[351] = '“'; GID[352] = '”'

# Conjunct / vowel-ligature glyphs identified from rendered glyph sheets.
LIG = {
 495:'ে', 496:'ৈ',
 543:'REPH',                      # invisible / zero-width
 583:'্য',                # -্য
 584:'ক্র', 585:'খ্র',
 586:'গ্র', 593:'ট্র', 595:'ড্র',
 598:'ত্র', 600:'দ্র', 603:'প্র',
 606:'ভ্র', 610:'শ্র',
 618:'\u099f\u09bf', 620:'\u09a0\u09bf', 622:'\u0995\u09cd\u0995', 624:'\u0995\u09cd\u099f',
 627:'ক্ত', 633:'\u0995\u09cd\u09b7\u09cd\u09ae', 635:'ক্ষ', 636:'\u0995\u09cd\u09b8',
 642:'\u0997\u09cd\u09ae', 648:'ঙ্ক', 650:'ঙ্গ',
 654:'চ্চ', 657:'চ্ছ', 661:'জ্জ',
 663:'জ্ঞ', 665:'ঞ্চ', 667:'ঞ্জ',
 670:'ট্ট', 676:'\u09a3\u09cd\u099f', 680:'ণ্ড',
 686:'\u09a4\u09cd\u09a4\u09cd\u09ac', 687:'ত্ত',
 695:'দ্ব', 696:'দ্দ', 698:'দ্ধ',
 700:'\u09a6\u09cd\u09ad', 705:'\u09a8\u09cd\u099f\u09cd\u09b0', 706:'ন্ট', 709:'ন্ড',
 712:'ন্ত্র', 713:'ন্ত', 714:'\u09a8\u09cd\u09a5',
 717:'ন্দ', 720:'ন্ধ', 721:'ন্ন',
 722:'ন্ম', 723:'ন্স', 724:'প্ট',
 726:'প্ত', 730:'প্ল', 736:'ব্দ',
 739:'ব্ল', 744:'ম্ন', 747:'\u09ae\u09cd\u09aa', 751:'\u09ae\u09cd\u09ad', 752:'\u09ae\u09cd\u09ae',
 766:'\u09b2\u09cd\u09aa', 770:'ল্ল', 771:'\u09b6\u09cd\u099a', 776:'\u09b6\u09cd\u09b2', 779:'\u09b7\u09cd\u099f\u09cd\u09b0', 780:'স্ট',
 782:'\u09b7\u09cd\u09a0', 785:'\u09b7\u09cd\u09aa', 790:'স্ক', 793:'\u09b8\u09cd\u099f', 795:'\u09b8\u09cd\u09a4\u09cd\u09b0', 796:'স্ত',
 797:'\u09b8\u09cd\u09a5', 798:'\u09b8\u09cd\u09a8', 801:'\u09b8\u09cd\u09aa', 804:'\u09b8\u09cd\u09ae', 805:'\u09b8\u09cd\u09b2',
 813:'REPH',                # reph
 818:'\u0995\u09c1', 822:'গু', 841:'ত্ব', 847:'\u09a6\u09cd\u09ac',
 851:'ধ্ব', 860:'\u09ac\u09cd\u09b0\u09c1', 868:'ন্তু', 871:'\u09a8\u09cd\u09ac',
 879:'ম্ব', 880:'\u09b0\u09c1', 881:'রূ', 884:'শু', 885:'শ্ব',
 903:'স্ব',
 907:'খ্য', 908:'গ্য', 911:'ণ্য',
 912:'থ্য', 913:'দ্য', 914:'ধ্য',
 915:'ন্য', 916:'প্য', 917:'ব্য',
 918:'ম্য', 921:'ল্য', 922:'শ্য',
 924:'ষ্য', 943:'দৃ', 1010:'\u09be\u0981',
 1048:'ঞ্জু',
 1165:'কৃ', 1166:'খু', 1177:'চু', 1178:'চূ',
 1180:'ছু', 1183:'জু', 1186:'\u099d\u09c1', 1206:'তু',
 1208:'তৃ', 1212:'দু', 1213:'দূ', 1215:'ধু',
 1218:'নু', 1219:'নূ', 1221:'পু', 1222:'পূ',
 1223:'পৃ', 1227:'বু', 1229:'বৃ', 1230:'ভু',
 1233:'মু', 1234:'মূ', 1235:'মৃ', 1236:'যু',
 1239:'লু', 1247:'সু', 1249:'সৃ', 1257:'\u09df\u09c1',
 1260:'\u09ce',
}
GID.update(LIG)
for _k,_v in list(GID.items()):
    pass

PREBASE = {'ি', 'ে', 'ৈ'}   # i-kar, e-kar, ai-kar render before base

_VOWEL_SIGNS = set('ািীুূৃৄেৈোৌঁংঃ্')

def decode_glyphs(gids):
    out = []
    pend = None
    for g in gids:
        s = GID.get(g)
        if s is None:
            s = '⟦%d⟧' % g
        if s == 'REPH':
            # reph glyph follows its base cluster in the stream; move it in front
            i = len(out) - 1
            while i >= 0 and out[i] and out[i][0] in _VOWEL_SIGNS:
                i -= 1
            if i >= 0:
                out[i] = 'র্' + out[i]
            else:
                out.append('র্')
            continue
        if s in PREBASE:
            pend = s
            continue
        out.append(s)
        if pend:
            out.append(pend)
            pend = None
    if pend:
        out.append(pend)
    return ''.join(out).replace('ৌ', 'ৌ')
