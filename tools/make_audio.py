"""百人一首の読み上げ音声を作る（Open JTalk + 音声「メイ」）。

かるたの読手のように
  ・一音ずつほぼ同じ長さで読む
  ・音の高さをほぼ一定にする（少しだけ抑揚を残す）
  ・句の終わりを長くのばす（上の句・下の句の最後は「余韻」として長く）
ように、Open JTalk の合成エンジンの時間と高さを直接いじって作ります。

使い方: python3 tools/make_audio.py /tmp/poems.json audio/
出力: audio/kami_001.mp3, audio/shimo_001.mp3, audio/joka.mp3, audio/timing.js
"""
import ctypes, json, math, os, re, subprocess, sys, glob
import numpy as np
import pyworld as pw
import pyopenjtalk

SO = glob.glob(os.path.join(os.path.dirname(pyopenjtalk.__file__), 'htsengine*.so'))[0]
VOICE = os.path.join(os.path.dirname(pyopenjtalk.__file__), 'htsvoice', 'mei_normal.htsvoice')
lib = ctypes.CDLL(SO)
E = ctypes.c_void_p
def fn(name, res, *args):
    f = getattr(lib, name); f.restype = res; f.argtypes = list(args); return f
initialize = fn('HTS_Engine_initialize', None, E)
load = fn('HTS_Engine_load', ctypes.c_char, E, ctypes.POINTER(ctypes.c_char_p), ctypes.c_size_t)
set_buf = fn('HTS_Engine_set_audio_buff_size', None, E, ctypes.c_size_t)
set_align = fn('HTS_Engine_set_phoneme_alignment_flag', None, E, ctypes.c_char)
gen_states = fn('HTS_Engine_generate_state_sequence_from_strings', ctypes.c_char, E, ctypes.POINTER(ctypes.c_char_p), ctypes.c_size_t)
nstate = fn('HTS_Engine_get_nstate', ctypes.c_size_t, E)
total_state = fn('HTS_Engine_get_total_state', ctypes.c_size_t, E)
state_dur = fn('HTS_Engine_get_state_duration', ctypes.c_size_t, E, ctypes.c_size_t)
get_mean = fn('HTS_Engine_get_state_mean', ctypes.c_double, E, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t)
set_mean = fn('HTS_Engine_set_state_mean', None, E, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_double)
gen_params = fn('HTS_Engine_generate_parameter_sequence', ctypes.c_char, E)
gen_samples = fn('HTS_Engine_generate_sample_sequence', ctypes.c_char, E)
nsamples = fn('HTS_Engine_get_nsamples', ctypes.c_size_t, E)
get_speech = fn('HTS_Engine_get_generated_speech', ctypes.c_double, E, ctypes.c_size_t)
refresh = fn('HTS_Engine_refresh', None, E)
get_sr = fn('HTS_Engine_get_sampling_frequency', ctypes.c_size_t, E)
get_fp = fn('HTS_Engine_get_fperiod', ctypes.c_size_t, E)
set_gv = fn('HTS_Engine_set_gv_weight', None, E, ctypes.c_size_t, ctypes.c_double)

buf = ctypes.create_string_buffer(1 << 20)   # HTS_Engine 構造体用（十分大きく確保）
eng = ctypes.cast(buf, E)
initialize(eng)
assert load(eng, (ctypes.c_char_p * 1)(VOICE.encode()), 1) == b'\x01'
set_buf(eng, 0)
SR, FP = get_sr(eng), get_fp(eng)
FRAME = FP / SR                      # 1フレームの秒数（5ms）

VOWELS = set('aiueo')
def phone(lab): return re.search(r'-(.*?)\+', lab).group(1)
def undevoice(lab):
    # 無声化（「きく」の「き」がささやき声になる）を止めて、はっきり声に出す
    head, rest = lab.split('/A:', 1)
    return re.sub(r'[AIUEO]', lambda m: m.group(0).lower(), head) + '/A:' + rest

# 読み方の設定（秒）
MORA = 0.255          # 一音の長さ
KU_HOLD = 0.55        # 句の終わりをのばす長さ
PAUSE = 0.32          # 句と句の間
FINAL_HOLD = 1.45     # 上の句・下の句の最後の余韻
ACCENT_KEEP = 0.2    # 元の抑揚をどれだけ残すか（0=完全に一定）
TARGET_DB = -17.0      # 声の部分の平均の強さ（dBFS）。すべての音声でそろえる
BASE_HZ = 255         # 読む声の高さ（Hz）。すべての歌で同じ高さにそろえる

def synth(kus, final_hold=FINAL_HOLD):
    labels = [undevoice(l) for l in pyopenjtalk.extract_fullcontext('、'.join(kus))]
    arr = (ctypes.c_char_p * len(labels))(*[l.encode() for l in labels])
    set_align(eng, b'\x00')
    assert gen_states(eng, arr, len(labels)) == b'\x01'
    ns = nstate(eng)
    pred = [sum(state_dur(eng, i * ns + s) for s in range(ns)) for i in range(len(labels))]
    refresh(eng)

    phones = [phone(l) for l in labels]
    # 音（モーラ）にまとめる：子音＋母音、ん(N)、っ(cl)
    morae, cur = [], []
    for i, p in enumerate(phones):
        if p in ('sil', 'pau'):
            if cur: morae.append(cur); cur = []
            morae.append([i]); continue
        cur.append(i)
        if p in VOWELS or p in ('N', 'cl'):
            morae.append(cur); cur = []
    if cur: morae.append(cur)

    # 句ごとの最後の音を探す
    ku_last, k, last_real = {}, 0, None
    for mi, m in enumerate(morae):
        p = phones[m[0]]
        if p == 'pau': ku_last[k] = last_real; k += 1
        elif p != 'sil': last_real = mi
    ku_last[k] = last_real
    final_morae = set(ku_last.values())
    nku = k + 1

    frames = [0] * len(labels)
    mora_times, t, ku = [], 0, 0
    kumora = [[] for _ in range(nku)]
    for mi, m in enumerate(morae):
        p0 = phones[m[0]]
        if p0 == 'sil':
            frames[m[0]] = round((0.15 if mi == 0 else 0.25) / FRAME)
        elif p0 == 'pau':
            frames[m[0]] = round(PAUSE / FRAME); ku += 1
        else:
            kumora[ku].append(t * FRAME)
            target = MORA
            if mi in final_morae:
                target += final_hold if ku == nku - 1 else KU_HOLD
            tf = round(target / FRAME)
            cons = m[:-1]
            cf = [min(pred[i], round(MORA * 0.55 / FRAME)) for i in cons]
            for i, f in zip(cons, cf): frames[i] = max(f, 3)
            frames[m[-1]] = max(tf - sum(frames[i] for i in cons), 4)
        t += sum(frames[i] for i in m)
    total = t * FRAME

    # 時間を指定したラベルで合成しなおす
    timed, st = [], 0
    for l, f in zip(labels, frames):
        a, b = st * FP * 10_000_000 // SR, (st + f) * FP * 10_000_000 // SR
        timed.append(f'{a} {b} {l}'); st += f
    arr = (ctypes.c_char_p * len(timed))(*[x.encode() for x in timed])
    set_align(eng, b'\x01')
    assert gen_states(eng, arr, len(timed)) == b'\x01'

    assert gen_params(eng) == b'\x01'
    assert gen_samples(eng) == b'\x01'
    n = nsamples(eng)
    wav = np.array([get_speech(eng, i) for i in range(n)], dtype=np.float64)
    refresh(eng)

    # 高さ：WORLD で声を分解し、読手のような高さの線に描きかえて組み立てなおす
    #   句の頭は少し低く入り → まっすぐ保つ → のばす所でゆっくり下げる
    fp_ms = FRAME * 1000
    f0, tt = pw.harvest(wav, SR, frame_period=fp_ms, f0_floor=120, f0_ceil=600)
    sp = pw.cheaptrick(wav, f0, tt, SR)
    ap = pw.d4c(wav, f0, tt, SR)
    base = BASE_HZ
    ph_of_frame, st = np.zeros(len(f0), dtype=int), 0
    for i, f in enumerate(frames):
        ph_of_frame[st:st + f] = i; st += f
    ph_of_frame[st:] = len(frames) - 1
    mora_of_ph = {i: mi for mi, m in enumerate(morae) for i in m}
    ku_start = {}
    for mi, m in enumerate(morae):
        k = sum(1 for x in morae[:mi] if phones[x[0]] == 'pau')
        if phones[m[0]] not in ('sil', 'pau'): ku_start.setdefault(k, mi)
    final_vowel = {morae[mi][-1] for mi in final_morae if mi is not None}
    vstart = {}
    for i, f in enumerate(frames): vstart[i] = sum(frames[:i])
    semis = np.zeros(len(f0))
    for j in range(len(f0)):
        ph = ph_of_frame[j]; mi = mora_of_ph.get(ph, 0)
        k = sum(1 for x in morae[:mi] if phones[x[0]] == 'pau')
        r = mi - ku_start.get(k, mi)
        s_ = 0.0
        if r == 0: s_ = -1.4 + 1.0 * min(1, (j - vstart[morae[mi][0]]) / 30)   # 少し下から入る
        elif r == 1: s_ = -0.3
        if ph in final_vowel:
            prog = (j - vstart[ph]) / max(frames[ph], 1)
            s_ -= 2.2 * max(0, prog - 0.25) / 0.75                               # のばしながら下げる
        semis[j] = s_
    nat = np.where(f0 > 0, 12 * np.log2(np.maximum(f0, 1) / base), 0)
    nat = np.clip(nat, -3, 3) * ACCENT_KEEP
    target = np.convolve(semis + nat, np.ones(9) / 9, mode='same')               # なめらかに
    vib = 0.12 * np.sin(2 * np.pi * 5.2 * tt) * (semis < -0.05)                   # のばす所に少しだけ揺れ
    # 母音・「ん」の間は最後まで声を出す（のばした終わりがかすれないように）
    is_vow = np.array([phones[ph] in VOWELS or phones[ph] == 'N' for ph in ph_of_frame])
    last_ap = None
    for j in range(len(f0)):
        if f0[j] > 0: last_ap = ap[j].copy()
        elif is_vow[j] and last_ap is not None and ph_of_frame[j] == ph_of_frame[max(j - 1, 0)]:
            f0[j] = base; ap[j] = last_ap
    # 長くのばした母音の後半は元の合成で声が消えるので、よく響いている所の音色を引きのばす
    for ph in final_vowel:
        a, n = vstart[ph], frames[ph]
        en = sp[a:a + n].sum(axis=1)
        if n < 10 or not len(en): continue
        good = a + int(np.argmax(en[:max(8, min(n, 40))]))
        ref_en = en[good - a]
        for j in range(good + 1, min(a + n, len(sp))):
            if sp[j].sum() < 0.6 * ref_en:
                sp[j] = sp[good]; ap[j] = ap[good]
                f0[j] = f0[good] if f0[good] > 0 else base
    new_f0 = np.where(f0 > 0, base * 2 ** ((target + vib) / 12), 0)
    wav = pw.synthesize(new_f0, sp, ap, SR, frame_period=fp_ms)

    # のばす母音が小さくなりすぎないよう、音量を持ち上げる（終わりに向けて自然に弱める）
    hop = FP
    rms = np.array([np.sqrt(np.mean(wav[j * hop:(j + 1) * hop] ** 2) + 1e-12) for j in range(len(f0))])
    ref = float(np.median(rms[is_vow & (new_f0 > 0)]))
    gain = np.ones(len(f0))
    for ph in final_vowel:
        a, n = vstart[ph], frames[ph]
        for j in range(a, min(a + n, len(f0))):
            prog = (j - a) / max(n, 1)
            want = ref * (0.8 - 0.5 * prog ** 2)
            gain[j] = np.clip(want / rms[j], 0.6, 3.0)
    gain = np.convolve(gain, np.ones(15) / 15, mode='same')
    wav = wav * np.pad(np.repeat(gain, hop), (0, max(0, len(wav) - len(gain) * hop)), constant_values=1)[:len(wav)]
    return wav, kumora, total

def to_mp3(wav, path):
    # 聞こえる大きさでそろえる：声が出ている部分（大きいほう半分）の平均の強さを一定にする
    x = wav / (np.max(np.abs(wav)) or 1)
    hop = int(SR * 0.02)
    fr = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    loud = np.sort(fr)[len(fr) // 2:]
    rms = float(np.sqrt(np.mean(loud ** 2))) or 1e-6
    x = x * (10 ** (TARGET_DB / 20) / rms)
    x = np.tanh(x * 1.1) / np.tanh(1.1) * 0.93 if np.max(np.abs(x)) > 0.9 else x   # 大きすぎる所はやわらかく抑える
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-af', 'highpass=f=70,aecho=0.85:0.4:38|61:0.10|0.06,afade=t=out:st=%.2f:d=0.35' % (len(wav) / SR - 0.4),
                    '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '48k', path], input=pcm, check=True)

def main(src, out):
    os.makedirs(out, exist_ok=True)
    poems = json.load(open(src, encoding='utf8'))
    timing = {}
    for p in poems:
        no = p['no']
        entry = {}
        for part, yomi, kana in (('kami', p['kamiYomi'], p['kamiKana']), ('shimo', p['shimoYomi'], p['shimoKana'])):
            kus = yomi.split(' ')
            wav, kumora, total = synth(kus)
            for k, (km, kk) in enumerate(zip(kumora, kana.split(' '))):
                if len(km) != len(kk):
                    print(f'  ! {no} {part} 句{k+1}: 音{len(km)} / 字{len(kk)} {kk}')
            to_mp3(wav, os.path.join(out, f'{part}_{no:03d}.mp3'))
            entry[part] = {'t': [[round(x, 3) for x in km] for km in kumora], 'len': round(total, 2)}
        timing[no] = entry
        print(no, end=' ', flush=True)
    wav, kumora, total = synth(['なにわづに', 'さくやこのはな', 'ふゆごもり', 'いまをはるべと', 'さくやこのはな'])
    to_mp3(wav, os.path.join(out, 'joka.mp3'))
    # 序歌の下の句（本番では、序歌のあと下の句をもう一度読んでから1首目に入る）
    wav, kumora, total = synth(['いまをはるべと', 'さくやこのはな'])
    to_mp3(wav, os.path.join(out, 'joka_shimo.mp3'))
    with open(os.path.join(out, 'timing.js'), 'w', encoding='utf8') as f:
        f.write('// 読み上げ音声の中で、各句の一音ずつが始まる時刻（秒）。tools/make_audio.py で自動生成\n')
        f.write('const AUDIO_TIMING = ' + json.dumps(timing, separators=(',', ':')) + ';\n')
    print('\ndone')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
