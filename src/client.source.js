window.__ModuleLoader__.load({
  id: 'dsh-prts-startup',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef, useMemo, useCallback } = React

    const CSS = "__PRTS_CSS__"
    const AUDIO = "__PRTS_AUDIO__"
    const ART = "__PRTS_ART__"

    /* ── constants ────────────────────────────────────────────────────────── */

    const CONFIG_KEY = 'dsh-prts-startup:config:v1'
    const SHOWN_KEY = 'dsh-prts-startup:shown:v1'
    const DAY_KEY = 'dsh-prts-startup:day:v1'
    const REPLAY_EVENT = 'dsh-prts-startup:replay'

    const HOLD_BASE = 1500
    const SPEED_MIN = 0.5
    const SPEED_MAX = 2

    const DEFAULTS = Object.freeze({
      enabled: true,
      mode: 'always',
      speed: 1,
      sound: true,
      voice: true,
      callsign: '预言家',
      designation: '博士',
      showDossier: true,
      fullscreen: false,
    })

    const MODES = [
      ['always', '每次页面加载'],
      ['session', '每个标签页一次'],
      ['daily', '每天一次'],
    ]

    /* English narration; the UI itself is Chinese. */
    const VOICE_TEXT = {
      boot: 'PRTS core online. Archive signal detected.',
      archive: 'Archive integrity: three point seven percent.',
      handshake: 'Neural handshake required.',
      link: 'Neural link established.',
      fragments: 'Select a memory fragment.',
      originium: 'The stone that ate the sky. We called it salvation.',
      sarcophagus: 'You slept through the end of the world.',
      priestess: 'She stayed behind. You were not supposed to wake alone.',
      identity: 'Subject confirmed. Prophet. Doctor. Omega clearance.',
      forget: 'Do not forget me.',
      welcome_doctor: 'Welcome home, Doctor.',
      welcome_prophet: 'Prophet.',
      error_rewrite: 'Error. Identity rewrite in progress.',
      thank_you_prophet: 'Thank you, Prophet.',
    }


    const PHASE_STEP = {
      boot: 1,
      archive: 2,
      handshake: 3,
      link: 3,
      fragments: 4,
      result: 5,
      priestessNormal: 5,
      corruption: 5,
      identity: 5,
      welcome: 6,
      exit: 6,
    }

    const PHASE_LABEL = {
      boot: '冷启动',
      archive: '档案',
      handshake: '神经握手',
      link: '链接',
      fragments: '记忆回收',
      result: '碎片',
      priestessNormal: '碎片',
      corruption: '记忆异常',
      identity: '身份',
      welcome: '访问',
      exit: '访问',
    }

    const PHASE_PROGRESS = {
      boot: 0.07,
      archive: 0.19,
      handshake: 0.36,
      link: 0.48,
      fragments: 0.6,
      result: 0.72,
      priestessNormal: 0.72,
      corruption: 0.78,
      identity: 0.84,
      welcome: 0.95,
      exit: 1,
    }

    const BOOT_LINES = [
      { n: '00', key: 'PRTS 核心', val: '在线', tone: 'ok' },
      { n: '01', key: '罗德岛链路', val: '稳定', tone: 'ok' },
      { n: '02', key: '前文明档案', val: '封存', tone: 'warn' },
      { n: '03', key: '石棺信号', val: '已检测', tone: 'ok' },
      { n: '04', key: '记忆完整度', val: '3.7%', tone: 'warn' },
      { n: '05', key: '操作员档案', val: '未确认', tone: 'warn' },
    ]

    const FRAGMENTS = [
      {
        id: 'originium',
        code: '01',
        title: '源石',
        desc: '吞下天空的石头',
        quote: '我们造出了一块能吞下天空的石头，并称之为救赎。',
        coherence: '31%',
        glyph: 'crystal',
      },
      {
        id: 'priestess',
        code: '02',
        title: '普瑞赛斯',
        desc: '旧世界最后的回音',
        quote: '她留下来完成最后的方程式。你本不该独自醒来。',
        coherence: '38%',
        glyph: 'priestess',
      },
      {
        id: 'sarcophagus',
        code: '03',
        title: '石棺',
        desc: '拒绝闭合的摇篮',
        quote: '你睡过了世界的终结。世界却没有睡过你。',
        coherence: '27%',
        glyph: 'sarcophagus',
      },
    ]

    const ERROR_CARDS = [
      {
        id: 'E-01',
        title: '记忆读取失败',
        code: 'MEM_READ_FAULT // 0x00A1',
        lines: ['目标扇区不可读', '校验和 0xDEADBEEF'],
      },
      {
        id: 'E-02',
        title: '档案校验冲突',
        code: 'ARCHIVE_CONFLICT // PRIESTESS',
        lines: ['对象与当前权限不匹配', '写入来源：未知'],
      },
      {
        id: 'E-03',
        title: '检测到未授权记忆',
        code: 'UNAUTHORIZED_MEMORY // 0x7F',
        lines: ['这段记忆不属于你', '建议：不要忘记'],
      },
      {
        id: 'E-04',
        title: '覆写被拒绝',
        code: 'WRITE_DENIED // PRTS',
        lines: ['你没有权限删除这段记忆', '重试次数：∞'],
      },
      {
        id: 'E-05',
        title: '信号丢失',
        code: 'SIGNAL_LOST // 0x0000',
        lines: ['没有回应', '但她还在看着你'],
      },
      {
        id: 'E-06',
        title: '对象不在档案中',
        code: 'SUBJECT_NOT_FOUND // 0x??',
        lines: ['检索结果为空', '不要忘记'],
      },
    ]

    /* ── small utilities ──────────────────────────────────────────────────── */

    function clamp(n, lo, hi) {
      return Math.min(hi, Math.max(lo, n))
    }

    function pad2(n) {
      return (n < 10 ? '0' : '') + n
    }

    function localDayKey() {
      const d = new Date()
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
    }

    function readStore(store, key) {
      try {
        return window[store].getItem(key)
      } catch (e) {
        return null
      }
    }

    function writeStore(store, key, value) {
      try {
        window[store].setItem(key, value)
      } catch (e) {
        /* Private mode or a locked store: the sequence still works. */
      }
    }

    function removeStore(store, key) {
      try {
        window[store].removeItem(key)
      } catch (e) {
        /* noop */
      }
    }

    function sanitizeConfig(raw) {
      const src = raw && typeof raw === 'object' ? raw : {}
      const mode = MODES.some((m) => m[0] === src.mode) ? src.mode : DEFAULTS.mode
      const callsign = String(src.callsign == null ? DEFAULTS.callsign : src.callsign)
        .trim()
        .slice(0, 20)
        .toUpperCase()
      let designation = String(src.designation == null ? DEFAULTS.designation : src.designation)
        .trim()
        .slice(0, 24)
        .toUpperCase()
      let finalCallsign = callsign
      if (finalCallsign === 'PROPHET') finalCallsign = '预言家'
      if (designation === 'DOCTOR') designation = '博士'
      return {
        enabled: src.enabled !== false,
        mode,
        speed: clamp(Number(src.speed) || DEFAULTS.speed, SPEED_MIN, SPEED_MAX),
        sound: src.sound !== false,
        voice: src.voice !== false,
        callsign: finalCallsign || DEFAULTS.callsign,
        designation: designation || DEFAULTS.designation,
        showDossier: src.showDossier !== false,
        fullscreen: false,
      }
    }

    function loadConfig() {
      try {
        const raw = JSON.parse(readStore('localStorage', CONFIG_KEY) || 'null')
        return sanitizeConfig(raw)
      } catch (e) {
        return sanitizeConfig(null)
      }
    }

    function saveConfig(patch) {
      const next = sanitizeConfig(Object.assign({}, loadConfig(), patch))
      writeStore('localStorage', CONFIG_KEY, JSON.stringify(next))
      return next
    }

    function shouldAutoPlay(cfg) {
      if (!cfg.enabled) return false
      if (cfg.mode === 'always') return true
      if (cfg.mode === 'session') return readStore('sessionStorage', SHOWN_KEY) !== '1'
      if (cfg.mode === 'daily') return readStore('localStorage', DAY_KEY) !== localDayKey()
      return false
    }

    function markPlayed(cfg) {
      if (cfg.mode === 'session') writeStore('sessionStorage', SHOWN_KEY, '1')
      if (cfg.mode === 'daily') writeStore('localStorage', DAY_KEY, localDayKey())
    }

    function hashString(text) {
      let hash = 2166136261
      for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i)
        hash = Math.imul(hash, 16777619) >>> 0
      }
      return hash >>> 0
    }

    function makeRng(seed) {
      let state = seed >>> 0
      return function rng() {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        return state / 4294967296
      }
    }

    function formatClock(date) {
      return pad2(date.getHours()) + ':' + pad2(date.getMinutes()) + ':' + pad2(date.getSeconds())
    }

    function hexLine(rng, groups) {
      const chars = '0123456789ABCDEF'
      let out = ''
      for (let i = 0; i < groups; i++) {
        if (i) out += ' '
        out += chars[(rng() * 16) | 0] + chars[(rng() * 16) | 0]
      }
      return out
    }

    const GLYPHS = '0123456789ABCDEF#/\\+*'
    const CJK_GLYPHS = '前文明档案核心稳定在线检测未确认石棺信号操作员源石普瑞赛斯权限欧米伽记忆完整度'
    function randomGlyph(ch) {
      if (ch && ch.charCodeAt(0) > 0x2e7f) {
        return CJK_GLYPHS[(Math.random() * CJK_GLYPHS.length) | 0]
      }
      return GLYPHS[(Math.random() * GLYPHS.length) | 0]
    }

    /* ── audio director: CC0 samples, TTS voice, synthesized fallback ─────── */

    function createAudioDirector() {
      let ctx = null
      let master = null
      let hum = null
      let muted = false
      let unlocked = false
      let voiceOn = true
      let sfxOn = true
      let voiceAudio = null
      let pendingVoice = null
      let pendingAt = 0
      let ducked = false
      let activeSamples = []
      let voiceShots = []

      function ensure() {
        if (ctx) return ctx
        try {
          const AC = window.AudioContext || window.webkitAudioContext
          if (!AC) return null
          ctx = new AC()
          master = ctx.createGain()
          master.gain.value = 0.22
          master.connect(ctx.destination)
        } catch (e) {
          ctx = null
          master = null
        }
        return ctx
      }

      function duck(on) {
        ducked = !!on
        if (!hum || !ctx) return
        try {
          hum.g.gain.setTargetAtTime(ducked ? 0.007 : 0.022, ctx.currentTime, 0.12)
        } catch (e) {
          hum.g.gain.value = ducked ? 0.007 : 0.022
        }
      }

      function stopVoice() {
        if (voiceAudio) {
          try {
            voiceAudio.pause()
            voiceAudio.currentTime = 0
          } catch (e) {
            /* noop */
          }
          voiceAudio = null
        }
        duck(false)
        try {
          if (window.speechSynthesis) window.speechSynthesis.cancel()
        } catch (e) {
          /* noop */
        }
      }

      function stopVoiceShots() {
        for (let i = 0; i < voiceShots.length; i++) {
          try {
            voiceShots[i].pause()
            voiceShots[i].currentTime = 0
          } catch (e) {
            /* noop */
          }
        }
        voiceShots = []
      }

      function stopSamples() {
        for (let i = 0; i < activeSamples.length; i++) {
          try {
            activeSamples[i].pause()
            activeSamples[i].currentTime = 0
          } catch (e) {
            /* noop */
          }
        }
        activeSamples = []
      }

      function speakFallback(text, volume) {
        if (!voiceOn || muted || !text) return
        try {
          const synth = window.speechSynthesis
          if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return
          synth.cancel()
          const utterance = new window.SpeechSynthesisUtterance(text)
          utterance.lang = 'en-GB'
          utterance.rate = 0.86
          utterance.pitch = 0.82
          utterance.volume = clamp(Number(volume) || 0.95, 0, 1)
          const voices = synth.getVoices ? synth.getVoices() || [] : []
          let chosen = null
          for (let i = 0; i < voices.length; i++) {
            const voice = voices[i]
            if (!/^en/i.test(String(voice.lang || ''))) continue
            if (/Sonia|Ava|Aria|Emma|Libby|Michelle|Hazel|Susan|Zira|female/i.test(String(voice.name || ''))) {
              chosen = voice
              break
            }
          }
          if (chosen) utterance.voice = chosen
          synth.speak(utterance)
        } catch (e) {
          /* noop */
        }
      }

      function speak(key, text, retry, volume) {
        if (!voiceOn || muted) return
        stopVoice()
        const source = AUDIO && AUDIO.voice && AUDIO.voice[key]
        if (!source) {
          speakFallback(text, volume)
          return
        }
        try {
          const audio = new Audio(source)
          audio.preload = 'auto'
          audio.volume = clamp(Number(volume) || 0.95, 0, 1)
          voiceAudio = audio
          for (let i = 0; i < voiceShots.length; i++) {
            try {
              voiceShots[i].volume = Math.min(voiceShots[i].volume, 0.08)
            } catch (e) {
              /* noop */
            }
          }
          duck(true)
          audio.addEventListener('ended', function onEnded() {
            if (voiceAudio === audio) voiceAudio = null
            duck(false)
          })
          const playing = audio.play()
          if (playing && typeof playing.catch === 'function') {
            playing.catch(function onBlocked() {
              if (voiceAudio === audio) voiceAudio = null
              duck(false)
              if (retry) {
                speakFallback(text, volume)
                return
              }
              pendingVoice = { key: key, text: text, volume: volume }
              pendingAt = Date.now()
            })
          }
        } catch (e) {
          speakFallback(text, volume)
        }
      }

      function playSample(name, gain) {
        if (!sfxOn || muted) return
        const source = AUDIO && AUDIO.sfx && AUDIO.sfx[name]
        if (!source) return
        try {
          const audio = new Audio(source)
          audio.preload = 'auto'
          audio.volume = clamp(Number(gain) || 0.3, 0, 1)
          audio.muted = muted
          activeSamples.push(audio)
          audio.addEventListener('ended', function onEnded() {
            const index = activeSamples.indexOf(audio)
            if (index >= 0) activeSamples.splice(index, 1)
          })
          const playing = audio.play()
          if (playing && typeof playing.catch === 'function') playing.catch(function noop() {})
        } catch (e) {
          /* noop */
        }
      }

      function speakPriestess(key, text) {
        if (!voiceOn || muted) return
        stopVoice()
        const source = AUDIO && AUDIO.voice && AUDIO.voice[key]
        if (!source) {
          speakFallback(text, 1)
          return
        }
        try {
          const audio = new Audio(source)
          audio.preload = 'auto'
          audio.volume = 1
          audio.muted = muted
          voiceAudio = audio
          duck(true)
          const c = ensure()
          if (c) {
            try {
              const src = c.createMediaElementSource(audio)
              const low = c.createBiquadFilter()
              low.type = 'lowpass'
              low.frequency.value = 2100
              low.Q.value = 0.55
              const shelf = c.createBiquadFilter()
              shelf.type = 'lowshelf'
              shelf.frequency.value = 220
              shelf.gain.value = 4
              const comp = c.createDynamicsCompressor()
              comp.threshold.value = -22
              comp.knee.value = 18
              comp.ratio.value = 3.5
              comp.attack.value = 0.008
              comp.release.value = 0.35
              const gain = c.createGain()
              gain.gain.value = 0.95
              src.connect(low)
              low.connect(shelf)
              shelf.connect(comp)
              comp.connect(gain)
              gain.connect(c.destination)
              if (c.state === 'suspended' && typeof c.resume === 'function') c.resume().catch(function noop() {})
            } catch (e) {
              if (voiceAudio === audio) voiceAudio = null
              duck(false)
              try {
                audio.pause()
              } catch (ignore) {
                /* noop */
              }
              speakFallback(text, 1)
              return
            }
          }
          audio.addEventListener('ended', function onEnded() {
            if (voiceAudio === audio) voiceAudio = null
            duck(false)
          })
          const playing = audio.play()
          if (playing && typeof playing.catch === 'function') {
            playing.catch(function onBlocked() {
              if (voiceAudio === audio) voiceAudio = null
              duck(false)
              speakFallback(text, 1)
            })
          }
        } catch (e) {
          speakFallback(text, 1)
        }
      }

      function playVoiceShot(name, gain) {
        if (!voiceOn || muted) return
        const source = AUDIO && AUDIO.voice && AUDIO.voice[name]
        if (!source) return
        try {
          while (voiceShots.length >= 2) {
            const oldest = voiceShots.shift()
            try {
              oldest.pause()
              oldest.currentTime = 0
            } catch (e) {
              /* noop */
            }
          }
          const audio = new Audio(source)
          audio.preload = 'auto'
          const underMainVoice = voiceAudio && !voiceAudio.paused ? 0.5 : 1
          audio.volume = clamp((Number(gain) || 0.12) * underMainVoice, 0, 1)
          audio.muted = muted
          voiceShots.push(audio)
          audio.addEventListener('ended', function onEnded() {
            const index = voiceShots.indexOf(audio)
            if (index >= 0) voiceShots.splice(index, 1)
          })
          const playing = audio.play()
          if (playing && typeof playing.catch === 'function') {
            playing.catch(function onBlocked() {
              const index = voiceShots.indexOf(audio)
              if (index >= 0) voiceShots.splice(index, 1)
            })
          }
        } catch (e) {
          /* noop */
        }
      }

      function unlock() {
        const c = ensure()
        if (c) {
          try {
            if (c.state === 'suspended' && typeof c.resume === 'function') c.resume()
          } catch (e) {
            /* noop */
          }
          if (!unlocked) {
            unlocked = true
            humStart()
          }
        } else {
          unlocked = true
        }
        const pending = pendingVoice
        if (pending && Date.now() - pendingAt < 7000) {
          pendingVoice = null
          speak(pending.key, pending.text, true, pending.volume)
        }
      }

      function setMuted(value) {
        muted = !!value
        if (master && ctx) {
          try {
            master.gain.setTargetAtTime(muted ? 0 : 0.22, ctx.currentTime, 0.04)
          } catch (e) {
            master.gain.value = muted ? 0 : 0.22
          }
        }
        if (voiceAudio) voiceAudio.muted = muted
        for (let i = 0; i < voiceShots.length; i++) voiceShots[i].muted = muted
        for (let i = 0; i < activeSamples.length; i++) activeSamples[i].muted = muted
        if (!muted && unlocked) humStart()
        if (muted) {
          pendingVoice = null
          try {
            if (window.speechSynthesis) window.speechSynthesis.cancel()
          } catch (e) {
            /* noop */
          }
        }
      }

      function setVoiceEnabled(value) {
        voiceOn = !!value
        if (!voiceOn) {
          stopVoice()
          stopVoiceShots()
        }
      }

      function setSfxEnabled(value) {
        sfxOn = !!value
        if (!sfxOn) stopSamples()
      }

      function tone(opts) {
        if (!unlocked || muted) return
        const c = ensure()
        if (!c) return
        const o = typeof opts === 'number' ? { freq: opts } : opts || {}
        const freq = Number(o.freq) || 440
        const dur = Number(o.dur) || 0.12
        const type = o.type || 'sine'
        const gain = Number(o.gain) || 0.12
        const delay = Number(o.delay) || 0
        try {
          const t0 = c.currentTime + delay
          const osc = c.createOscillator()
          const g = c.createGain()
          osc.type = type
          osc.frequency.setValueAtTime(freq, t0)
          if (o.slide) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(24, Number(o.slide)), t0 + dur)
          }
          g.gain.setValueAtTime(0.0001, t0)
          g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012)
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
          osc.connect(g)
          g.connect(master)
          osc.start(t0)
          osc.stop(t0 + dur + 0.03)
        } catch (e) {
          /* audio is optional */
        }
      }

      function noise(dur, gain, freq) {
        if (!unlocked || muted) return
        const c = ensure()
        if (!c) return
        try {
          const length = Math.floor(c.sampleRate * (Number(dur) || 0.3))
          const buffer = c.createBuffer(1, length, c.sampleRate)
          const data = buffer.getChannelData(0)
          for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / length)
          }
          const src = c.createBufferSource()
          src.buffer = buffer
          const filter = c.createBiquadFilter()
          filter.type = 'bandpass'
          filter.frequency.value = Number(freq) || 1200
          filter.Q.value = 0.8
          const g = c.createGain()
          g.gain.value = Number(gain) || 0.08
          src.connect(filter)
          filter.connect(g)
          g.connect(master)
          src.start()
        } catch (e) {
          /* noop */
        }
      }

      function chord(freqs, dur, gain) {
        const list = freqs || [220, 330, 440]
        for (let i = 0; i < list.length; i++) {
          tone({ freq: list[i], dur: dur || 0.6, type: 'sine', gain: gain || 0.07, delay: i * 0.03 })
        }
      }

      function humStart() {
        if (hum || muted) return
        const c = ensure()
        if (!c) return
        try {
          const g = c.createGain()
          g.gain.value = ducked ? 0.007 : 0.022
          const lp = c.createBiquadFilter()
          lp.type = 'lowpass'
          lp.frequency.value = 240
          const o1 = c.createOscillator()
          o1.type = 'sine'
          o1.frequency.value = 48
          const o2 = c.createOscillator()
          o2.type = 'triangle'
          o2.frequency.value = 72
          const lfo = c.createOscillator()
          lfo.frequency.value = 0.11
          const lfoGain = c.createGain()
          lfoGain.gain.value = 0.009
          lfo.connect(lfoGain)
          lfoGain.connect(g.gain)
          o1.connect(g)
          o2.connect(g)
          g.connect(lp)
          lp.connect(master)
          o1.start()
          o2.start()
          lfo.start()
          hum = { o1, o2, lfo, g }
        } catch (e) {
          hum = null
        }
      }

      function humStop() {
        if (!hum) return
        try {
          hum.o1.stop()
          hum.o2.stop()
          hum.lfo.stop()
        } catch (e) {
          /* noop */
        }
        hum = null
      }

      function fadeOut() {
        if (!ctx || !master) return
        try {
          master.gain.setTargetAtTime(0, ctx.currentTime, 0.08)
        } catch (e) {
          /* noop */
        }
      }

      function dispose() {
        stopVoice()
        stopVoiceShots()
        stopSamples()
        pendingVoice = null
        humStop()
        if (ctx) {
          try {
            ctx.close()
          } catch (e) {
            /* noop */
          }
        }
        ctx = null
        master = null
        unlocked = false
      }

      return {
        unlock,
        setMuted,
        setVoiceEnabled,
        setSfxEnabled,
        speak,
        speakPriestess,
        stopVoice,
        stopVoiceShots,
        stopSamples,
        playSample,
        playVoiceShot,
        tone,
        noise,
        chord,
        humStart,
        humStop,
        fadeOut,
        dispose,
      }
    }

    /* ── hooks ────────────────────────────────────────────────────────────── */

    function useReducedMotion() {
      const [reduced, setReduced] = useState(function initial() {
        try {
          return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches
        } catch (e) {
          return false
        }
      })

      useEffect(function watch() {
        let mq = null
        try {
          mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        } catch (e) {
          return undefined
        }
        const onChange = function onChange() {
          setReduced(mq.matches)
        }
        if (mq.addEventListener) mq.addEventListener('change', onChange)
        else if (mq.addListener) mq.addListener(onChange)
        return function cleanup() {
          if (mq.removeEventListener) mq.removeEventListener('change', onChange)
          else if (mq.removeListener) mq.removeListener(onChange)
        }
      }, [])

      return reduced
    }

    function useClock(enabled) {
      const [now, setNow] = useState(function initial() {
        return new Date()
      })
      useEffect(function tick() {
        if (!enabled) return undefined
        setNow(new Date())
        const id = window.setInterval(function update() {
          setNow(new Date())
        }, 1000)
        return function cleanup() {
          window.clearInterval(id)
        }
      }, [enabled])
      return now
    }

    /* ── tiny primitives ──────────────────────────────────────────────────── */

    function DecodeValue(props) {
      const text = String(props.text == null ? '' : props.text)
      const [shown, setShown] = useState(text)

      useEffect(function decode() {
        let frame = 0
        const id = window.setInterval(function step() {
          frame += 1
          if (frame >= 6) {
            setShown(text)
            window.clearInterval(id)
            return
          }
          const reveal = Math.floor((frame / 6) * text.length)
          let next = ''
          for (let i = 0; i < text.length; i++) {
            const ch = text.charAt(i)
            next += i < reveal || ch === ' ' ? ch : randomGlyph(ch)
          }
          setShown(next)
        }, 34)
        return function cleanup() {
          window.clearInterval(id)
        }
      }, [text])

      return h('span', { className: props.className }, shown)
    }

    function BrandMark() {
      return h(
        'svg',
        { viewBox: '0 0 32 32', 'aria-hidden': true },
        h('circle', { cx: 16, cy: 16, r: 13, fill: 'none', stroke: 'currentColor', strokeOpacity: 0.28, strokeWidth: 1 }),
        h('path', { d: 'M16 3v5M16 24v5M3 16h5M24 16h5', stroke: 'currentColor', strokeOpacity: 0.65, strokeWidth: 1 }),
        h('rect', { x: 10.5, y: 10.5, width: 11, height: 11, transform: 'rotate(45 16 16)', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 }),
        h('rect', { x: 14, y: 14, width: 4, height: 4, transform: 'rotate(45 16 16)', fill: 'currentColor' })
      )
    }

    function FragmentGlyph(props) {
      const kind = props.kind
      if (kind === 'priestess') {
        return h(
          'svg',
          { viewBox: '0 0 64 64', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 },
          h('circle', { cx: 32, cy: 32, r: 15, strokeOpacity: 0.85 }),
          h('path', { d: 'M32 4a28 28 0 1 0 0 56', strokeOpacity: 0.3, strokeDasharray: '2 4' }),
          h('path', { d: 'M46 18a20 20 0 0 0 0 28', strokeOpacity: 0.55 }),
          h('path', { d: 'M32 22v20M22 32h20', strokeOpacity: 0.24 }),
          h('path', { d: 'M32 9l2.2 5.2L39 16l-4.8 1.8L32 23l-2.2-5.2L25 16l4.8-1.8z', fill: 'currentColor', stroke: 'none', opacity: 0.9 })
        )
      }
      if (kind === 'sarcophagus') {
        return h(
          'svg',
          { viewBox: '0 0 64 64', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 },
          h('path', { d: 'M22 8h20l8 12v24l-8 12H22L14 44V20z', strokeOpacity: 0.8 }),
          h('path', { d: 'M14 20h36M14 44h36', strokeOpacity: 0.25 }),
          h('path', { d: 'M26 27h12M26 33h12M26 39h12', strokeOpacity: 0.7 }),
          h('path', { d: 'M32 8v8M32 48v8', strokeOpacity: 0.3, strokeDasharray: '2 3' }),
          h('circle', { cx: 32, cy: 36, r: 1.8, fill: 'currentColor', stroke: 'none' })
        )
      }
      return h(
        'svg',
        { viewBox: '0 0 64 64', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 },
        h('path', { d: 'M32 6L50 22 42 50H22L14 22z', strokeOpacity: 0.85 }),
        h('path', { d: 'M32 6v44M14 22l28 28M50 22L22 50', strokeOpacity: 0.22 }),
        h('path', { d: 'M32 18l9 9-9 9-9-9z', fill: 'currentColor', fillOpacity: 0.18, strokeOpacity: 0.75 }),
        h('path', { d: 'M32 25v12', strokeOpacity: 0.3 })
      )
    }

    /* ── emblem / biometrics / hold graphic ───────────────────────────────── */

    let emblemUid = 0

    function Emblem(props) {
      const uid = useMemo(function makeId() {
        emblemUid += 1
        return 'prts-em-' + emblemUid
      }, [])
      const gradId = uid + '-grad'
      const ticks = useMemo(function makeTicks() {
        const out = []
        for (let i = 0; i < 48; i++) {
          const angle = (i / 48) * Math.PI * 2
          const major = i % 4 === 0
          const r0 = major ? 154 : 160
          const r1 = 172
          out.push(
            h('line', {
              key: i,
              className: 'prts-em-tick' + (major ? ' major' : ''),
              x1: 200 + Math.cos(angle) * r0,
              y1: 200 + Math.sin(angle) * r0,
              x2: 200 + Math.cos(angle) * r1,
              y2: 200 + Math.sin(angle) * r1,
            })
          )
        }
        return out
      }, [])

      return h(
        'div',
        { className: 'prts-emblem ' + (props.className || '') },
        h(
          'svg',
          { viewBox: '0 0 400 400', 'aria-hidden': true },
          h(
            'defs',
            null,
            h(
              'linearGradient',
              { id: gradId, x1: '0', y1: '0', x2: '1', y2: '1' },
              h('stop', { offset: '0', stopColor: '#f2f2f2' }),
              h('stop', { offset: '0.46', stopColor: '#cfcfcf' }),
              h('stop', { offset: '1', stopColor: '#4a4a4a' })
            )
          ),
          h(
            'g',
            { className: 'prts-em-spin-a' },
            h('circle', {
              cx: 200,
              cy: 200,
              r: 184,
              fill: 'none',
              stroke: 'rgba(242,242,242,0.16)',
              strokeWidth: 1,
              strokeDasharray: '1 9',
            }),
            h('path', {
              className: 'prts-em-arc',
              d: 'M 200 16 A 184 184 0 0 1 384 200',
              stroke: 'url(#' + gradId + ')',
              strokeWidth: 2.6,
            }),
            h('path', {
              className: 'prts-em-arc',
              d: 'M 200 384 A 184 184 0 0 1 16 200',
              stroke: 'url(#' + gradId + ')',
              strokeWidth: 2.6,
            }),
            h('path', {
              className: 'prts-em-arc',
              d: 'M 132.7 45.6 A 184 184 0 0 0 45.6 132.7',
              stroke: 'rgba(255, 255, 255, 0.22)',
              strokeWidth: 1,
            }),
            h('path', {
              className: 'prts-em-arc',
              d: 'M 354.4 267.3 A 184 184 0 0 0 267.3 354.4',
              stroke: 'rgba(255, 255, 255, 0.22)',
              strokeWidth: 1,
            })
          ),
          h(
            'g',
            { className: 'prts-em-spin-b' },
            h('circle', {
              cx: 200,
              cy: 200,
              r: 140,
              fill: 'none',
              stroke: 'rgba(242,242,242,0.13)',
              strokeWidth: 1,
              strokeDasharray: '2 7',
            }),
            h('path', {
              className: 'prts-em-arc',
              d: 'M 200 68 A 132 132 0 0 1 332 200',
              stroke: 'rgba(255, 255, 255, 0.38)',
              strokeWidth: 1.4,
              strokeDasharray: '20 10',
            }),
            h('path', {
              className: 'prts-em-arc',
              d: 'M 200 332 A 132 132 0 0 1 68 200',
              stroke: 'rgba(255, 255, 255, 0.38)',
              strokeWidth: 1.4,
              strokeDasharray: '20 10',
            })
          ),
          h('circle', {
            className: 'prts-em-comet',
            cx: 200,
            cy: 200,
            r: 184,
            fill: 'none',
            strokeWidth: 2.2,
            strokeLinecap: 'round',
            strokeDasharray: '26 1130',
          }),
          h('g', null, ticks),
          h(
            'g',
            null,
            h('path', { className: 'prts-em-cross', d: 'M 200 38v30M 200 332v30M 38 200h30M 332 200h30' }),
            h('circle', { cx: 200, cy: 200, r: 116, fill: 'none', stroke: 'rgba(242,242,242,0.08)', strokeWidth: 1 }),
            h(
              'g',
              { className: 'prts-em-center' },
              h('rect', {
                x: 152,
                y: 152,
                width: 96,
                height: 96,
                transform: 'rotate(45 200 200)',
                fill: 'none',
                stroke: 'url(#' + gradId + ')',
                strokeWidth: 2,
              }),
              h('rect', {
                x: 174,
                y: 174,
                width: 52,
                height: 52,
                transform: 'rotate(45 200 200)',
                fill: 'rgba(255, 255, 255, 0.08)',
                stroke: 'rgba(255, 255, 255, 0.5)',
                strokeWidth: 1,
              }),
              h('rect', {
                x: 193,
                y: 193,
                width: 14,
                height: 14,
                transform: 'rotate(45 200 200)',
                fill: '#f2f2f2',
              })
            ),
            h('circle', { className: 'prts-em-node', cx: 200, cy: 24, r: 2.4 }),
            h('circle', { className: 'prts-em-node', cx: 200, cy: 376, r: 2.4 }),
            h('circle', { className: 'prts-em-node', cx: 24, cy: 200, r: 2.4 }),
            h('circle', { className: 'prts-em-node', cx: 376, cy: 200, r: 2.4 })
          )
        )
      )
    }

    function HoldRing(props) {
      const radius = 188
      const circumference = 2 * Math.PI * radius
      const progress = clamp(Number(props.progress) || 0, 0, 1)
      const ticks = useMemo(function makeHoldTicks() {
        const out = []
        for (let i = 0; i < 32; i++) {
          const angle = (i / 32) * Math.PI * 2
          const major = i % 4 === 0
          out.push(
            h('line', {
              key: i,
              x1: 200 + Math.cos(angle) * (major ? 158 : 164),
              y1: 200 + Math.sin(angle) * (major ? 158 : 164),
              x2: 200 + Math.cos(angle) * 174,
              y2: 200 + Math.sin(angle) * 174,
              stroke: major ? 'rgba(255, 255, 255, 0.38)' : 'rgba(242,242,242,0.2)',
              strokeWidth: 1,
            })
          )
        }
        return out
      }, [])

      return h(
        'svg',
        {
          className: 'prts-hold-ring' + (props.holding ? ' is-holding' : ''),
          viewBox: '0 0 400 400',
          'aria-hidden': true,
        },
        h('circle', { className: 'prts-hold-orbit', cx: 200, cy: 200, r: 196 }),
        h('circle', { className: 'prts-hold-orbit-inner', cx: 200, cy: 200, r: 132 }),
        h('circle', { className: 'prts-hold-track', cx: 200, cy: 200, r: radius }),
        h('circle', {
          cx: 200,
          cy: 200,
          r: 174,
          fill: 'none',
          stroke: 'rgba(242,242,242,0.07)',
          strokeWidth: 1,
          strokeDasharray: '1 7',
        }),
        h('g', null, ticks),
        h('circle', {
          className: 'prts-hold-progress',
          cx: 200,
          cy: 200,
          r: radius,
          strokeDasharray: circumference,
          strokeDashoffset: circumference * (1 - progress),
        }),
        h('circle', { className: 'prts-hold-inner', cx: 200, cy: 200, r: 142 })
      )
    }

    function Fingerprint() {
      const lines = useMemo(function makeLines() {
        const rng = makeRng(0x50525453)
        const out = []
        for (let i = 0; i < 18; i++) {
          const rx = 15 + i * 4.1 + rng() * 2
          const ry = 22 + i * 4.8 + rng() * 2
          out.push(
            h('ellipse', {
              key: i,
              cx: 100,
              cy: 121,
              rx,
              ry,
              fill: 'none',
              stroke: 'rgba(242,242,242,' + (0.42 - i * 0.014).toFixed(3) + ')',
              strokeWidth: 0.75,
              strokeDasharray: (7 + i * 2.4).toFixed(1) + ' ' + (5 + i * 1.7).toFixed(1),
              transform: 'rotate(' + (i * 3.1 - 8).toFixed(1) + ' 100 121)',
            })
          )
        }
        return out
      }, [])

      return h(
        'svg',
        { className: 'prts-fingerprint', viewBox: '0 0 200 240', 'aria-hidden': true },
        h(
          'defs',
          null,
          h('clipPath', { id: 'prts-fp-clip' }, h('rect', { x: 8, y: 8, width: 184, height: 224 }))
        ),
        h('g', { clipPath: 'url(#prts-fp-clip)' }, lines),
        h('path', { d: 'M100 18v204', stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 0.8, strokeDasharray: '2 5' }),
        h('path', { d: 'M18 120h164', stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 0.8, strokeDasharray: '2 5' }),
        h('circle', { cx: 100, cy: 121, r: 4, fill: 'none', stroke: 'rgba(255, 255, 255, 0.5)', strokeWidth: 1 }),
        h('path', { d: 'M14 26V14h12M186 26V14h-12M14 214v12h12M186 214v12h-12', stroke: 'rgba(242,242,242,0.28)', strokeWidth: 1 }),
        h('text', { x: 14, y: 226, fill: 'rgba(242,242,242,0.32)', fontSize: 7, fontFamily: 'monospace', letterSpacing: 1 }, 'PRTS-0001 // 欧米伽')
      )
    }

    function PortraitSilhouette() {
      return h(
        'svg',
        { className: 'prts-silhouette', viewBox: '0 0 200 240', 'aria-hidden': true },
        h(
          'g',
          { fill: 'none', stroke: 'rgba(255,255,255,0.14)', strokeWidth: 1 },
          h('path', {
            d: 'M100 22c-23 0-40 18-40 43 0 15 6 27 15 35-24 10-38 32-38 62v54h126v-54c0-30-14-52-38-62 9-8 15-20 15-35 0-25-17-43-40-43z',
            fill: 'rgba(255,255,255,0.035)',
          }),
          h('path', { d: 'M64 94c5-29 17-46 36-46s31 17 36 46', strokeOpacity: 0.18 }),
          h('path', { d: 'M100 28v176M28 120h144', strokeOpacity: 0.07, strokeDasharray: '2 6' })
        ),
        h(
          'g',
          { fill: 'none', stroke: 'rgba(255,255,255,0.18)' },
          h('circle', { cx: 100, cy: 96, r: 46, strokeDasharray: '2 7' }),
          h('path', { d: 'M100 44v10M100 138v10M48 96h10M142 96h10' })
        ),
        h('rect', { x: 66, y: 80, width: 68, height: 7, fill: '#050505', stroke: 'rgba(255,255,255,0.22)' }),
        h('rect', { x: 76, y: 98, width: 48, height: 3, fill: 'rgba(255,255,255,0.18)' }),
        h(
          'g',
          { fill: 'rgba(255,255,255,0.45)' },
          h('rect', { x: 142, y: 150, width: 2, height: 28 }),
          h('rect', { x: 147, y: 150, width: 1, height: 28 }),
          h('rect', { x: 151, y: 150, width: 3, height: 28 }),
          h('rect', { x: 157, y: 150, width: 1, height: 28 }),
          h('rect', { x: 161, y: 150, width: 2, height: 28 }),
          h('rect', { x: 166, y: 150, width: 4, height: 28 }),
          h('rect', { x: 173, y: 150, width: 1, height: 28 }),
          h('rect', { x: 177, y: 150, width: 2, height: 28 })
        ),
        h('path', { d: 'M20 204h160M20 210h92', stroke: 'rgba(255,255,255,0.16)' })
      )
    }

    /* ── living dust field ────────────────────────────────────────────────── */

    function Dust(props) {
      const reduced = props.reduced
      const canvasRef = useRef(null)

      useEffect(function animate() {
        const canvas = canvasRef.current
        if (!canvas) return undefined
        let ctx = null
        try {
          ctx = canvas.getContext('2d')
        } catch (e) {
          return undefined
        }
        if (!ctx) return undefined

        const rng = makeRng(0x50525454)
        const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
        let width = 1
        let height = 1
        let parts = []
        let raf = 0
        let running = false
        let start = 0

        function spawn() {
          const count = Math.max(44, Math.min(120, Math.round((width * height) / 16500)))
          parts = []
          for (let i = 0; i < count; i++) {
            parts.push({
              x: rng() * width,
              y: rng() * height,
              z: 0.28 + rng() * 0.72,
              r: 0.32 + rng() * 1.25,
              drift: 6 + rng() * 22,
              rise: 5 + rng() * 16,
              ph: rng() * Math.PI * 2,
              tw: 0.00035 + rng() * 0.00085,
              warm: rng() < 0.18,
            })
          }
        }

        function resize() {
          const rect = canvas.getBoundingClientRect()
          width = Math.max(1, rect.width || window.innerWidth || 1)
          height = Math.max(1, rect.height || window.innerHeight || 1)
          canvas.width = Math.round(width * dpr)
          canvas.height = Math.round(height * dpr)
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          spawn()
        }

        function draw(now, still) {
          if (!ctx) return
          const t = still ? 0 : now - start
          ctx.clearRect(0, 0, width, height)
          ctx.globalCompositeOperation = 'lighter'

          for (let i = 0; i < parts.length; i++) {
            const p = parts[i]
            const y = ((p.y - t * 0.001 * p.rise) % height + height) % height
            const x = p.x + Math.sin(t * 0.00024 + p.ph) * p.drift
            const twinkle = 0.62 + 0.38 * Math.sin(t * p.tw + p.ph)
            const edge = Math.min(1, Math.max(0.25, (Math.abs(x / width - 0.5) * 2 + 0.35)))
            const alpha = (0.05 + p.z * 0.19) * twinkle * edge
            const rgb = p.warm ? '235,235,235' : '170,170,170'
            ctx.beginPath()
            ctx.fillStyle = 'rgba(' + rgb + ',' + alpha.toFixed(3) + ')'
            ctx.arc(x, y, p.r * p.z, 0, Math.PI * 2)
            ctx.fill()
            if (p.r > 1.05) {
              ctx.beginPath()
              ctx.fillStyle = 'rgba(' + rgb + ',' + (alpha * 0.1).toFixed(3) + ')'
              ctx.arc(x, y, p.r * 4.4, 0, Math.PI * 2)
              ctx.fill()
            }
          }

          for (let line = 0; line < 3; line++) {
            ctx.beginPath()
            for (let x = 0; x <= width; x += 26) {
              const y =
                height * (0.8 + line * 0.048) +
                Math.sin(x * 0.006 + t * 0.0002 + line * 1.7) * (3 + line * 1.3) +
                Math.sin(x * 0.012 - t * 0.00013 + line) * 1.4
              if (x === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            ctx.strokeStyle = 'rgba(' + (line === 1 ? '235,235,235' : '170,170,170') + ',0.045)'
            ctx.lineWidth = 0.8
            ctx.stroke()
          }

          ctx.globalCompositeOperation = 'source-over'
        }

        function frame(now) {
          if (!running) return
          draw(now, false)
          raf = window.requestAnimationFrame(frame)
        }

        function startLoop() {
          if (reduced || running) return
          running = true
          raf = window.requestAnimationFrame(frame)
        }

        function stopLoop() {
          running = false
          if (raf) {
            window.cancelAnimationFrame(raf)
            raf = 0
          }
        }

        function onResize() {
          resize()
          draw(0, true)
        }

        function onVisibility() {
          if (document.hidden) stopLoop()
          else startLoop()
        }

        resize()
        start = performance.now()
        draw(0, true)
        startLoop()
        window.addEventListener('resize', onResize)
        document.addEventListener('visibilitychange', onVisibility)

        return function cleanup() {
          stopLoop()
          window.removeEventListener('resize', onResize)
          document.removeEventListener('visibilitychange', onVisibility)
        }
      }, [reduced])

      return h('canvas', { ref: canvasRef, className: 'prts-dust', 'aria-hidden': true })
    }

    /* ── phases ───────────────────────────────────────────────────────────── */

    function BootPhase(props) {
      const speed = Math.max(SPEED_MIN, Number(props.speed) || 1)
      const [count, setCount] = useState(0)
      const done = count >= BOOT_LINES.length

      useEffect(function reveal() {
        if (count >= BOOT_LINES.length) return undefined
        const id = window.setTimeout(function advance() {
          setCount(function next(n) {
            return n + 1
          })
        }, Math.max(70, Math.round((count === 0 ? 180 : 390) / speed)))
        return function cleanup() {
          window.clearTimeout(id)
        }
      }, [count, speed])

      return h(
        'div',
        { className: 'prts-boot' },
        h(
          'div',
          { className: 'prts-boot-heading' },
          h('h2', { className: 'prts-boot-title' }, '冷', h('span', null, '启动')),
          h('div', { className: 'prts-boot-caption' }, 'PRTS 核心 / 节点 01')
        ),
        h(
          'div',
          { className: 'prts-boot-frame' },
          h(
            'div',
            { className: 'prts-boot-meta' },
            h('span', null, '启动序列'),
            h('span', null, '罗德岛 // 04:17')
          ),
          h(
            'div',
            { className: 'prts-log' },
            BOOT_LINES.slice(0, count).map(function row(line) {
              return h(
                'div',
                { className: 'prts-log-row', key: line.n },
                h('span', { className: 'prts-log-num' }, line.n),
                h('span', { className: 'prts-log-key' }, line.key),
                h('span', { className: 'prts-log-dots' }),
                h(DecodeValue, { text: line.val, className: 'prts-log-val is-' + line.tone })
              )
            })
          ),
          h(
            'div',
            { className: 'prts-boot-bar' },
            h('i', { style: { width: Math.round((count / BOOT_LINES.length) * 100) + '%' } })
          ),
          h(
            'div',
            { className: 'prts-boot-tail' + (done ? ' is-on' : '') },
            h('span', null, 'PRTS 核心就绪 — ', h('b', null, '等待操作员')),
            h('span', null, '按 ESC 跳过', h('i', { className: 'prts-caret' }))
          )
        )
      )
    }

    function ArchivePhase() {
      return h(
        'div',
        null,
        h('div', { className: 'prts-kicker centered' }, '档案层 00 / 前文明'),
        h(Emblem, {}),
        h('h1', { className: 'prts-title' }, 'PR', h('em', null, 'TS')),
        h('div', { className: 'prts-subtitle' }, '初等罗德岛终端服务'),
        h('div', { className: 'prts-rule' }),
        h(
          'p',
          { className: 'prts-line' },
          '终端记得世界遗忘的',
          h('strong', null, '一切'),
          '。'
        ),
        h(
          'div',
          { className: 'prts-warning' },
          h('i', { className: 'prts-warning-dot' }),
          '档案完整度 ',
          h('b', null, '3.7%'),
          ' — 需要重建'
        )
      )
    }

    function HandshakePhase(props) {
      const progress = clamp(Number(props.progress) || 0, 0, 1)
      const pct = Math.round(progress * 100)

      function onPointerDown(event) {
        event.preventDefault()
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch (e) {
          /* noop */
        }
        event.currentTarget.focus()
        props.onDown()
      }

      function onPointerUp(event) {
        event.preventDefault()
        props.onUp()
      }

      return h(
        'div',
        { className: 'prts-handshake' },
        h('div', { className: 'prts-kicker centered' }, '身份门 / 神经握手'),
        h(
          'div',
          { className: 'prts-hold-wrap' },
          h(HoldRing, { progress, holding: props.holding }),
          h('div', { className: 'prts-hold-pulse' + (props.holding ? ' is-holding' : ''), 'aria-hidden': true }),
          h(
            'div',
            {
              ref: props.coreRef,
              className: 'prts-hold-core' + (props.holding ? ' is-holding' : ''),
              role: 'button',
              tabIndex: 0,
              'aria-label': '按住以同步神经链接',
              'aria-pressed': !!props.holding,
              onPointerDown,
              onPointerUp,
              onPointerCancel: onPointerUp,
              onPointerLeave: onPointerUp,
              onLostPointerCapture: onPointerUp,
              onContextMenu: function noMenu(event) {
                event.preventDefault()
              },
              onDragStart: function noDrag(event) {
                event.preventDefault()
              },
            },
            h(
              'div',
              { className: 'prts-hold-pct' },
              h('b', null, pct + '%'),
              h('span', null, props.holding ? '同步中' : '按住')
            )
          )
        ),
        h('h2', { className: 'prts-hold-title' }, '将手掌置于终端'),
        h(
          'p',
          { className: 'prts-hold-desc' },
          '档案只向它的创造者开放。保持接触以完成同步。'
        ),
        h(
          'div',
          { className: 'prts-hold-hint' },
          '按住核心 — 或按住 ',
          h('kbd', null, '空格'),
          ' / ',
          h('kbd', null, '回车')
        ),
        h(
          'div',
          { className: 'prts-hold-status' + (props.failed ? ' is-error' : ''), role: 'status' },
          props.failed
            ? '接触中断 — 请按久一点'
            : props.holding
              ? '神经链接同步中'
              : '等待接触'
        )
      )
    }

    function LinkPhase() {
      const bars = useMemo(function makeBars() {
        const out = []
        for (let i = 0; i < 36; i++) {
          const height = 8 + Math.round(Math.abs(Math.sin(i * 1.73)) * 42)
          out.push({ h: height, d: (i * 37) % 900 })
        }
        return out
      }, [])

      return h(
        'div',
        { className: 'prts-link' },
        h('div', { className: 'prts-link-shock', 'aria-hidden': true }),
        h('div', { className: 'prts-link-shock delay', 'aria-hidden': true }),
        h('div', { className: 'prts-kicker centered' }, '神经同步 / 完成'),
        h('div', { className: 'prts-link-word' }, '链接', h('em', null, '已建立')),
        h(
          'div',
          { className: 'prts-wave', 'aria-hidden': true },
          bars.map(function bar(item, index) {
            return h('i', { key: index, style: { '--h': item.h + 'px', '--d': item.d + 'ms' } })
          })
        ),
        h('div', { className: 'prts-link-sub' }, '操作员信号已识别'),
        h('div', { className: 'prts-link-meta' }, '神经同步 99.8% // 档案访问已授权')
      )
    }

    function FragmentsPhase(props) {
      const firstRef = useRef(null)
      const [priestessHover, setPriestessHover] = useState(false)

      useEffect(function focusFirst() {
        const id = window.requestAnimationFrame(function focus() {
          if (firstRef.current) firstRef.current.focus()
        })
        return function cleanup() {
          window.cancelAnimationFrame(id)
        }
      }, [])

      return h(
        'div',
        { className: 'prts-frag-stage' },
        h(
          'div',
          { className: 'prts-frag-head' },
          h('div', { className: 'prts-kicker centered' }, '记忆回收 / 03 个碎片'),
          h('h2', { className: 'prts-frag-title' }, '选择一个记忆'),
          h(
            'p',
            { className: 'prts-frag-desc' },
            '崩塌后残留三段印记。选择一段作为重建锚点。'
          )
        ),
        h(
          'div',
          { className: 'prts-cards' },
          FRAGMENTS.map(function card(fragment, index) {
            const isPriestess = fragment.id === 'priestess'
            const cardProps = {
              key: fragment.id,
              ref: index === 0 ? firstRef : null,
              type: 'button',
              className: 'prts-card' + (isPriestess ? ' prts-card--priestess' : ''),
              onClick: function choose() {
                props.onSelect(fragment)
              },
              'aria-label': fragment.title + ' — ' + fragment.desc,
            }
            if (isPriestess) {
              cardProps.onMouseEnter = function reveal() {
                setPriestessHover(true)
              }
              cardProps.onMouseLeave = function conceal() {
                setPriestessHover(false)
              }
              cardProps.onFocus = function revealFocus() {
                setPriestessHover(true)
              }
              cardProps.onBlur = function concealFocus() {
                setPriestessHover(false)
              }
            }
            return h(
              'button',
              cardProps,
              h('i', { className: 'prts-card-corner tl' }),
              h('i', { className: 'prts-card-corner tr' }),
              h('i', { className: 'prts-card-corner bl' }),
              h('i', { className: 'prts-card-corner br' }),
              fragment.id === 'priestess'
                ? h('span', {
                    className: 'prts-card-art' + (priestessHover ? ' is-visible' : ''),
                    style: { backgroundImage: 'url(' + ART.priestess + ')' },
                    'aria-hidden': true,
                  })
                : null,
              h('span', { className: 'prts-card-idx' }, '碎片 ' + fragment.code),
              h('span', { className: 'prts-card-glyph' }, h(FragmentGlyph, { kind: fragment.glyph })),
              h('span', { className: 'prts-card-title' }, fragment.title),
              h('span', { className: 'prts-card-desc' }, fragment.desc),
              h(
                'span',
                { className: 'prts-card-meta' },
                h('span', null, '完整度 ', h('b', null, fragment.coherence)),
                h('span', null, '回收 ▸')
              )
            )
          })
        ),
        h('div', { className: 'prts-frag-foot' }, '数据不会消失，只会错位。')
      )
    }

    const FORGET_CODE = '01アイウエオ{}[]<>/#%&*ABCDEF'
    function ForgetText(props) {
      const target = '不许忘记我'
      const revealed = Math.max(0, Math.min(target.length, Number(props.revealed) || 0))
      const [tick, setTick] = useState(0)

      useEffect(function scramble() {
        const id = window.setInterval(function nextTick() {
          setTick(function bump(value) {
            return value + 1
          })
        }, 72)
        return function cleanup() {
          window.clearInterval(id)
        }
      }, [])

      return h(
        'div',
        { className: 'prts-forget-text', role: 'img', 'aria-label': target },
        target.split('').map(function glyph(ch, index) {
          const locked = index < revealed
          const code = locked ? ch : FORGET_CODE.charAt((tick * 7 + index * 13) % FORGET_CODE.length)
          return h(
            'span',
            {
              key: index,
              className: 'prts-forget-char' + (locked ? ' is-locked' : ''),
              style: { '--i': index },
            },
            code
          )
        }),
        h('i', { className: 'prts-forget-caret', 'aria-hidden': true })
      )
    }

    function CorruptionPhase(props) {
      const GOAL = 5
      const DEADLINE = 5
      const MAX_POPUPS = 14

      const latest = useRef(props)
      latest.current = props

      const popupIdRef = useRef(0)
      const assembledRef = useRef(false)
      const closedRef = useRef(new Set())
      const timersRef = useRef([])

      // 随机贴在四周，避开中央正文：左右窄带 + 上下窄带，位置用像素，防止溢出屏幕。
      function edgeSpot(width) {
        const vw = window.innerWidth || 1280
        const vh = window.innerHeight || 800
        const w = Math.min(width, Math.max(140, vw - 24))
        const m = 10
        const xMax = Math.max(0, vw - w - m * 2)
        const yMax = Math.max(0, vh - 150)
        const band = Math.random()
        let x = m
        let y = m
        if (band < 0.3) {
          x = m + Math.random() * Math.min(90, xMax)
          y = m + Math.random() * yMax
        } else if (band < 0.6) {
          x = m + xMax - Math.random() * Math.min(90, xMax)
          y = m + Math.random() * yMax
        } else if (band < 0.8) {
          x = m + Math.random() * xMax
          y = m + Math.random() * Math.min(64, yMax)
        } else {
          x = m + Math.random() * xMax
          y = m + yMax - Math.random() * Math.min(64, yMax)
        }
        return { left: Math.round(x), top: Math.round(y) }
      }

      const makePopup = useCallback(function makePopup() {
        popupIdRef.current += 1
        const id = popupIdRef.current
        const card = ERROR_CARDS[Math.floor(Math.random() * ERROR_CARDS.length)]
        const upper = Math.random() < 0.5
        return {
          id: 'popup-' + id,
          x: 2 + Math.random() * 64,
          y: upper ? 2 + Math.random() * 6 : 67 + Math.random() * 9,
          rotate: Math.random() * 13 - 6.5,
          width: 235 + Math.round(Math.random() * 90),
          title: card.title,
          code: card.code,
          line: card.lines[0] || '',
          z: id,
          collapsing: false,
        }
      }, [])

      const [popups, setPopups] = useState(function initialPopups() {
        const count = Math.random() < 0.45 ? 2 : 1
        const list = []
        for (let i = 0; i < count; i++) list.push(makePopup())
        return list
      })
      const [revealed, setRevealed] = useState(0)
      const [assembled, setAssembled] = useState(false)
      const [timeLeft, setTimeLeft] = useState(DEADLINE)

      const triggerAssembly = useCallback(function triggerAssembly(reason) {
        if (assembledRef.current) return
        assembledRef.current = true
        setAssembled(true)
        setRevealed(GOAL)
        setPopups(function collapseAll(list) {
          return list.map(function collapse(popup) {
            return Object.assign({}, popup, { collapsing: true })
          })
        })
        if (latest.current.onAssembleSound) latest.current.onAssembleSound(reason)
        const clear = window.setTimeout(function clearPopups() {
          setPopups([])
        }, 480)
        const done = window.setTimeout(function finishScene() {
          if (latest.current.onComplete) latest.current.onComplete(reason)
        }, 650)
        timersRef.current.push(clear, done)
      }, [])

      const closePopup = useCallback(
        function closePopup(popup, event) {
          if (event) {
            event.preventDefault()
            event.stopPropagation()
          }
          if (assembledRef.current || closedRef.current.has(popup.id)) return
          closedRef.current.add(popup.id)
          setPopups(function remove(list) {
            return list.filter(function keep(item) {
              return item.id !== popup.id
            })
          })
          if (latest.current.onCloseSound) latest.current.onCloseSound()
          setPopups(function spawn(list) {
            const nextList = list.slice()
            const add = Math.min(2 + Math.floor(Math.random() * 3), MAX_POPUPS - nextList.length)
            for (let i = 0; i < add; i++) nextList.push(makePopup())
            return nextList
          })
        },
        [makePopup]
      )

      useEffect(function autoErrors() {
        if (assembled) return undefined
        let timer = 0
        function schedule() {
          timer = window.setTimeout(function addError() {
            if (assembledRef.current) return
            setPopups(function add(list) {
              if (list.length >= MAX_POPUPS) return list
              const nextList = list.slice()
              const addCount = 1 + (Math.random() < 0.45 ? 1 : 0)
              for (let i = 0; i < addCount && nextList.length < MAX_POPUPS; i++) {
                nextList.push(makePopup())
              }
              return nextList
            })
            if (latest.current.onErrorSound) latest.current.onErrorSound()
            schedule()
          }, 1700 + Math.random() * 1400)
        }
        schedule()
        return function cleanup() {
          if (timer) window.clearTimeout(timer)
        }
      }, [assembled, makePopup])

      useEffect(function revealOverTime() {
        if (assembled) return undefined
        const started = performance.now()
        const points = [200, 1400, 2300, 2900, 3300]
        const id = window.setInterval(function reveal() {
          if (assembledRef.current) return
          const elapsed = performance.now() - started
          let count = 0
          for (let i = 0; i < points.length; i++) {
            if (elapsed >= points[i]) count += 1
          }
          setRevealed(function keep(value) {
            return Math.max(value, count)
          })
        }, 80)
        return function cleanup() {
          window.clearInterval(id)
        }
      }, [assembled])

      useEffect(function countdown() {
        if (assembled) return undefined
        if (timeLeft <= 0) {
          triggerAssembly('timeout')
          return undefined
        }
        const id = window.setTimeout(function tick() {
          setTimeLeft(function dec(value) {
            return Math.max(0, value - 1)
          })
        }, 1000)
        return function cleanup() {
          window.clearTimeout(id)
        }
      }, [timeLeft, assembled, triggerAssembly])

      useEffect(function cleanupTimers() {
        return function cleanup() {
          for (let i = 0; i < timersRef.current.length; i++) window.clearTimeout(timersRef.current[i])
        }
      }, [])

      const codeFragments = useMemo(function makeFragments() {
        const rng = makeRng((Math.random() * 0xffffffff) >>> 0)
        const words = [
          '0x00A1',
          'ERR_PRIESTESS',
          'MEM://',
          'NULL',
          'DO_NOT_FORGET',
          'SEGFAULT',
          '//',
          '0xDEADBEEF',
          'FORGET?',
          'PRTS',
          '0x7F',
        ]
        const out = []
        for (let i = 0; i < 28; i++) {
          out.push({
            x: 3 + rng() * 94,
            y: 3 + rng() * 94,
            text: words[(rng() * words.length) | 0],
            delay: Math.round(rng() * 1500),
            rotate: (rng() * 24 - 12).toFixed(1),
          })
        }
        return out
      }, [])

      const timeWidth = Math.max(0, Math.min(100, (timeLeft / DEADLINE) * 100))

      return h(
        'div',
        { className: 'prts-corruption' + (assembled ? ' is-assembled' : '') },
        h('div', {
          className: 'prts-corruption-portrait',
          style: { backgroundImage: 'url(' + ART.priestess + ')' },
          'aria-hidden': true,
        }),
        h('div', { className: 'prts-corruption-scan', 'aria-hidden': true }),
        h(
          'div',
          { className: 'prts-corruption-hud' },
          h('span', { className: 'prts-hud-brand' }, 'MEMORY OVERRIDE // PRIESTESS'),
          h(
            'span',
            { className: 'prts-hud-timer' },
            assembled ? '覆写完成' : 'RECONSTRUCTION 00:' + pad2(Math.max(0, timeLeft))
          ),
          h('span', { className: 'prts-hud-count' }, '碎片 ' + revealed + ' / 5')
        ),
        h(
          'div',
          { className: 'prts-corruption-timer', 'aria-hidden': true },
          h('i', { style: { width: timeWidth.toFixed(1) + '%' } })
        ),
        h(
          'div',
          { className: 'prts-error-stack' },
          popups.map(function errorCard(popup) {
            return h(
              'div',
              {
                key: popup.id,
                className: 'prts-error-card' + (popup.collapsing ? ' is-collapsing' : ''),
                style: {
                  left: (popup.collapsing ? 50 : popup.x).toFixed(1) + '%',
                  top: (popup.collapsing ? 50 : popup.y).toFixed(1) + '%',
                  width: popup.width + 'px',
                  transform: popup.collapsing
                    ? 'translate(-50%, -50%) scale(0.3) rotate(0deg)'
                    : 'rotate(' + popup.rotate.toFixed(1) + 'deg)',
                  opacity: popup.collapsing ? 0 : 1,
                  zIndex: 10 + popup.z,
                },
              },
              h(
                'div',
                { className: 'prts-error-bar' },
                h('span', { className: 'prts-error-id' }, '错误'),
                h('span', { className: 'prts-error-code' }, popup.code),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'prts-error-close',
                    onClick: function close(event) {
                      closePopup(popup, event)
                    },
                    'aria-label': '关闭错误弹窗',
                  },
                  '×'
                )
              ),
              h('div', { className: 'prts-error-title' }, popup.title),
              h('div', { className: 'prts-error-lines' }, '> ' + popup.line),
              h(
                'div',
                { className: 'prts-error-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'prts-error-confirm',
                    onClick: function confirm(event) {
                      closePopup(popup, event)
                    },
                  },
                  '确定'
                ),
                h('span', { className: 'prts-error-ignore' }, '忽略')
              )
            )
          })
        ),
        h(
          'div',
          { className: 'prts-code-field', 'aria-hidden': true },
          codeFragments.map(function fragment(item, index) {
            return h(
              'span',
              {
                key: index,
                className: 'prts-code-fragment',
                style: {
                  left: item.x.toFixed(1) + '%',
                  top: item.y.toFixed(1) + '%',
                  '--d': item.delay + 'ms',
                  '--r': item.rotate + 'deg',
                },
              },
              item.text
            )
          })
        ),
        h(
          'div',
          { className: 'prts-forget-wrap' },
          h(
            'div',
            { className: 'prts-forget-kicker' },
            assembled ? 'MEMORY OVERRIDE COMPLETE' : 'MEMORY INTEGRITY // DECAYING'
          ),
          h(ForgetText, { revealed }),
          h(
            'div',
            { className: 'prts-forget-sub' },
            assembled
              ? 'DO_NOT_FORGET_ME // 0xFFFFFFFF'
              : 'MEMORY_INTEGRITY // 3.7%'
          )
        ),
        assembled ? h('div', { className: 'prts-assembly-shock', 'aria-hidden': true }) : null
      )
    }

    function ResultPhase(props) {
      const fragment = props.fragment || FRAGMENTS[0]
      return h(
        'div',
        { className: 'prts-result' + (fragment.id === 'priestess' ? ' prts-result--priestess' : '') },
        fragment.id === 'priestess'
          ? h('div', {
              className: 'prts-result-art',
              style: { backgroundImage: 'url(' + ART.priestess + ')' },
              'aria-hidden': true,
            })
          : null,
        h('div', { className: 'prts-result-code' }, '碎片 ' + fragment.code + ' / 已回收'),
        h('h2', { className: 'prts-result-title' }, fragment.title),
        h('blockquote', { className: 'prts-quote' }, fragment.quote),
        h(
          'div',
          { className: 'prts-coherence' },
          h('span', null, '记忆完整度'),
          h('span', { className: 'prts-coherence-bar' }, h('i')),
          h('span', { style: { color: 'var(--prts-ink)' } }, '64%')
        ),
        h('div', { className: 'prts-result-note' }, '重建继续 // 档案正在聆听')
      )
    }

    function IdentityPhase(props) {
      const cfg = props.cfg
      const fields = [
        ['出身', '前文明'],
        ['职责', '源石计划 / 主导'],
        ['状态', '已回收'],
        ['记忆完整度', '3.7%', true],
        ['权限', '欧米伽'],
        ['合作者', '普瑞赛斯 / 信号丢失', true],
        ['档案访问', '已授权'],
        ['最后接触', '石棺 / 切尔诺伯格'],
      ]

      if (!cfg.showDossier) {
        return h(
          'div',
          { className: 'prts-result' },
          h('div', { className: 'prts-result-code' }, '身份确认 / 欧米伽权限'),
          h('h2', { className: 'prts-result-title' }, cfg.callsign),
          h('div', { className: 'prts-subtitle' }, cfg.designation + ' // 前文明档案'),
          h('blockquote', { className: 'prts-quote' }, '你本不该独自醒来。'),
          h('div', { className: 'prts-result-note' }, 'PRTS 一直在等你。')
        )
      }

      return h(
        'div',
        { className: 'prts-dossier' },
        h(
          'div',
          { className: 'prts-dossier-top' },
          h('span', null, '对象档案 / ', h('b', null, '欧米伽权限')),
          h('span', null, 'PRTS-0001')
        ),
        h(
          'div',
          { className: 'prts-dossier-body' },
          h('div', { className: 'prts-portrait' }, h(PortraitSilhouette), h(Fingerprint, {})),
          h(
            'div',
            { className: 'prts-dossier-main' },
            h('h2', { className: 'prts-dossier-name' }, cfg.callsign),
            h(
              'div',
              { className: 'prts-dossier-role' },
              cfg.designation + ' // 前文明档案'
            ),
            h(
              'dl',
              { className: 'prts-fields' },
              fields.map(function field(item) {
                return h(
                  'div',
                  { className: 'prts-field', key: item[0] },
                  h('dt', null, item[0]),
                  h('dd', { className: item[2] ? 'is-warn' : '' }, item[1])
                )
              })
            )
          )
        ),
        h(
          'div',
          { className: 'prts-dossier-quote' },
          '你本不该独自醒来。 ',
          h('b', null, 'PRTS 一直在等你。')
        )
      )
    }

    function WelcomePhase(props) {
      const cfg = props.cfg
      const stage = props.stage || 'doctor'
      const displayName = stage === 'prophet' ? cfg.callsign : cfg.designation
      const status =
        stage === 'doctor'
          ? '身份校验 / ' + cfg.designation
          : stage === 'glitch'
            ? '身份冲突 / 覆写中'
            : props.ready
              ? '身份已校正 / ' + cfg.callsign
              : '语音播报中 / ' + cfg.callsign
      const name =
        stage === 'glitch'
          ? [
              h('span', { className: 'prts-welcome-name-old', key: 'old' }, cfg.designation),
              h('span', { className: 'prts-welcome-name-new', key: 'new' }, cfg.callsign),
            ]
          : displayName
      return h(
        'div',
        { className: 'prts-welcome prts-welcome--' + stage },
        h('div', { className: 'prts-welcome-ghost', 'aria-hidden': true }, 'PRTS'),
        h('div', { className: 'prts-kicker centered' }, '访问已授权 / 档案已恢复'),
        h('div', { className: 'prts-welcome-small' }, '欢迎回家，'),
        h('div', { className: 'prts-welcome-name prts-welcome-name--' + stage }, name),
        h('div', { className: 'prts-welcome-status prts-welcome-status--' + stage }, status),
        props.thanks ? h('div', { className: 'prts-welcome-thanks' }, '谢谢你，预言家。') : null,
        h('div', { className: 'prts-welcome-role' }, cfg.designation + ' // 前文明档案'),
        h(
          'blockquote',
          { className: 'prts-welcome-quote' },
          '过去并未死去，它只是在等待它的守墓人。'
        ),
        props.thanks
          ? null
          : h(
              'button',
              {
                ref: props.enterRef,
                type: 'button',
                className: 'prts-enter',
                onClick: props.onEnter,
                disabled: stage === 'prophet' && !props.ready,
              },
              '进入现在',
              h('span', null, '↵')
            ),
        stage === 'glitch' ? h('div', { className: 'prts-welcome-static', 'aria-hidden': true }) : null
      )
    }

    function WelcomeErrors(props) {
      const errors = props.errors || []
      return h(
        'div',
        { className: 'prts-welcome-errors', 'aria-live': 'polite' },
        errors.map(function errorWindow(item, index) {
          const shards = (item.shards || []).map(function shard(s, i) {
            return h('i', {
              key: i,
              style: {
                '--dx': s.dx + 'px',
                '--dy': s.dy + 'px',
                '--rot': s.rot + 'deg',
              },
            })
          })
          return h(
            'div',
            {
              key: item.id,
              className: 'prts-welcome-error' + (props.shattering ? ' is-shattering' : ''),
              style: {
                left: item.left + '%',
                top: item.top + '%',
                width: item.width + 'px',
                transform: 'rotate(' + item.rotate.toFixed(1) + 'deg)',
                zIndex: 10 + index,
              },
            },
            h(
              'div',
              { className: 'prts-welcome-error-bar' },
              h('span', { className: 'prts-welcome-error-id' }, 'PRTS // 系统提示'),
              h('span', { className: 'prts-welcome-error-x', 'aria-hidden': true }, '×')
            ),
            h('div', { className: 'prts-welcome-error-title' }, '身份覆写未完成'),
            h('div', { className: 'prts-welcome-error-code' }, 'IDENTITY_REWRITE // IN_PROGRESS'),
            h('div', { className: 'prts-welcome-error-body' }, '请等待名称变更完成。'),
            props.shattering
              ? h('div', { className: 'prts-welcome-error-shards', 'aria-hidden': true }, shards)
              : null
          )
        })
      )
    }

    /* ── overlay controller ───────────────────────────────────────────────── */

    function StartupOverlay() {
      const reduced = useReducedMotion()

      const [cfg, setCfg] = useState(function initialConfig() {
        return loadConfig()
      })
      const [active, setActive] = useState(false)
      const clock = useClock(active)
      const [forced, setForced] = useState(false)
      const [runId, setRunId] = useState(0)
      const [phase, setPhase] = useState('boot')
      const [selected, setSelected] = useState(null)
      const [hold, setHold] = useState(0)
      const [holding, setHolding] = useState(false)
      const [holdFailed, setHoldFailed] = useState(false)
      const [muted, setMuted] = useState(false)
      const [glitch, setGlitch] = useState(false)
      const [flash, setFlash] = useState(false)
      const [isExiting, setIsExiting] = useState(false)
      const [welcomeStage, setWelcomeStage] = useState('doctor')
      const [welcomeReady, setWelcomeReady] = useState(false)
      const [welcomeErrors, setWelcomeErrors] = useState([])
      const [welcomeShattering, setWelcomeShattering] = useState(false)
      const [welcomeThanks, setWelcomeThanks] = useState(false)
      const [fullscreen, setFullscreen] = useState(false)
      const [fullscreenSupported, setFullscreenSupported] = useState(false)

      const rootRef = useRef(null)
      const holdRef = useRef(null)
      const enterRef = useRef(null)
      const audioRef = useRef(null)
      const phaseRef = useRef(phase)
      const speedRef = useRef(cfg.speed)
      const activeRef = useRef(active)
      const bootedRef = useRef(false)
      const finishingRef = useRef(false)
      const finishTimerRef = useRef(0)
      const failTimerRef = useRef(0)
      const holdStateRef = useRef({ active: false, start: 0, raf: 0, lastTick: 0 })
      const holdProgressRef = useRef(0)
      const welcomeStageRef = useRef(welcomeStage)
      const welcomeReadyRef = useRef(welcomeReady)
      const hadEarlyErrorRef = useRef(false)
      const welcomeErrorIdRef = useRef(0)

      phaseRef.current = phase
      speedRef.current = cfg.speed
      activeRef.current = active
      welcomeStageRef.current = welcomeStage
      welcomeReadyRef.current = welcomeReady

      const startRun = useCallback(function startRun(nextConfig, isForced) {
        const state = holdStateRef.current
        state.active = false
        if (state.raf) {
          window.cancelAnimationFrame(state.raf)
          state.raf = 0
        }
        holdProgressRef.current = 0
        if (failTimerRef.current) {
          window.clearTimeout(failTimerRef.current)
          failTimerRef.current = 0
        }
        if (finishTimerRef.current) {
          window.clearTimeout(finishTimerRef.current)
          finishTimerRef.current = 0
        }
        finishingRef.current = false
        setCfg(nextConfig)
        setForced(!!isForced)
        setRunId(function bump(n) {
          return n + 1
        })
        setPhase('boot')
        setSelected(null)
        setHold(0)
        setHolding(false)
        setHoldFailed(false)
        setMuted(!(nextConfig.sound || nextConfig.voice))
        setGlitch(false)
        setFlash(false)
        setIsExiting(false)
        setWelcomeStage('doctor')
        setWelcomeReady(false)
        setWelcomeErrors([])
        setWelcomeShattering(false)
        setWelcomeThanks(false)
        hadEarlyErrorRef.current = false
        welcomeErrorIdRef.current = 0
        setActive(true)
        if (!isForced) markPlayed(nextConfig)
      }, [])

      const finish = useCallback(function finish() {
        if (!activeRef.current || finishingRef.current) return
        finishingRef.current = true
        const state = holdStateRef.current
        state.active = false
        if (state.raf) {
          window.cancelAnimationFrame(state.raf)
          state.raf = 0
        }
        if (failTimerRef.current) {
          window.clearTimeout(failTimerRef.current)
          failTimerRef.current = 0
        }
        setHolding(false)
        setHold(0)
        holdProgressRef.current = 0
        if (audioRef.current) {
          audioRef.current.stopVoiceShots()
          audioRef.current.stopVoice()
          audioRef.current.stopSamples()
          audioRef.current.playSample('powerdown', 0.3)
          audioRef.current.fadeOut()
        }
        setIsExiting(true)
        finishTimerRef.current = window.setTimeout(function done() {
          finishTimerRef.current = 0
          setActive(false)
          finishingRef.current = false
        }, 780)
      }, [])

      const toggleFullscreen = useCallback(function toggleFullscreen() {
        const doc = document
        if (doc.fullscreenElement) {
          if (doc.exitFullscreen) {
            const result = doc.exitFullscreen()
            if (result && result.catch) result.catch(function ignore() {})
          }
          return
        }
        if (!doc.fullscreenEnabled) return
        const root = doc.documentElement
        if (root && root.requestFullscreen) {
          const result = root.requestFullscreen({ navigationUI: 'hide' })
          if (result && result.catch) result.catch(function ignore() {})
        }
      }, [])

      // 终幕错误窗也随机贴四周，别只挤在右边；坐标相对 .prts-welcome（不是视口）
      function edgeSpot() {
        const band = Math.random()
        if (band < 0.28) return { left: 1 + Math.random() * 6, top: 10 + Math.random() * 60 }
        if (band < 0.56) return { left: 70 + Math.random() * 8, top: 10 + Math.random() * 60 }
        if (band < 0.78) return { left: 18 + Math.random() * 46, top: 2 + Math.random() * 6 }
        return { left: 18 + Math.random() * 46, top: 84 + Math.random() * 7 }
      }

      const blockWelcomeEnter = useCallback(function blockWelcomeEnter() {
        const stage = welcomeStageRef.current
        if (welcomeReadyRef.current) {
          finish()
          return
        }
        if (stage === 'prophet') return

        hadEarlyErrorRef.current = true
        welcomeErrorIdRef.current += 1
        const id = 'welcome-error-' + welcomeErrorIdRef.current
        const shards = []
        for (let i = 0; i < 7; i++) {
          shards.push({
            dx: -46 - Math.round(Math.random() * 230),
            dy: -34 + Math.round(Math.random() * 170),
            rot: Math.round(Math.random() * 180) - 90,
          })
        }
        const spot = edgeSpot()
        const error = {
          id: id,
          left: spot.left,
          top: spot.top,
          width: 155 + Math.round(Math.random() * 45),
          rotate: Math.random() * 10 - 5,
          shards: shards,
        }
        setWelcomeErrors(function addError(list) {
          if (list.length >= 6) return list
          return list.concat([error])
        })
        const engine = audioRef.current
        if (engine) {
          engine.playSample('error', 0.04)
          engine.playSample('glitch', 0.02)
          engine.playVoiceShot('error_rewrite', 0.12)
        }
      }, [finish])

      const beginHold = useCallback(function beginHold() {
        if (phaseRef.current !== 'handshake') return
        const state = holdStateRef.current
        if (state.active) return
        state.active = true
        state.start = performance.now()
        state.lastTick = 0
        holdProgressRef.current = 0
        setHolding(true)
        setHoldFailed(false)
        setHold(0)

        const engine = audioRef.current
        if (engine) {
          engine.unlock()
          engine.humStart()
          engine.playSample('servo', 0.32)
          engine.tone({ freq: 140, dur: 0.18, type: 'sawtooth', gain: 0.05, slide: 280 })
        }

        const duration = Math.max(400, HOLD_BASE / Math.max(SPEED_MIN, speedRef.current))

        function loop() {
          if (!holdStateRef.current.active) return
          const p = Math.min(1, (performance.now() - state.start) / duration)
          holdProgressRef.current = p
          setHold(p)
          if (p >= 1) {
            state.active = false
            state.raf = 0
            setHolding(false)
            setHold(1)
            if (engine) {
              engine.playSample('success', 0.34)
              engine.chord([220, 330, 440, 660], 0.75, 0.08)
              engine.noise(0.45, 0.06, 900)
            }
            setPhase('link')
            return
          }
          if (p - state.lastTick > 0.12) {
            state.lastTick = p
            if (engine) {
              engine.tone({ freq: 240 + p * 540, dur: 0.045, type: 'square', gain: 0.012 })
            }
          }
          state.raf = window.requestAnimationFrame(loop)
        }

        state.raf = window.requestAnimationFrame(loop)
      }, [])

      const endHold = useCallback(function endHold() {
        const state = holdStateRef.current
        if (!state.active) return
        state.active = false
        if (state.raf) {
          window.cancelAnimationFrame(state.raf)
          state.raf = 0
        }
        setHolding(false)
        const progress = holdProgressRef.current
        holdProgressRef.current = 0
        setHold(0)
        if (progress > 0.04) {
          if (audioRef.current) audioRef.current.playSample('error', 0.28)
          setHoldFailed(true)
          if (failTimerRef.current) window.clearTimeout(failTimerRef.current)
          failTimerRef.current = window.setTimeout(function clearFailure() {
            failTimerRef.current = 0
            setHoldFailed(false)
          }, 1500)
        }
      }, [])

      const chooseFragment = useCallback(function chooseFragment(fragment) {
        setSelected(fragment)
        const engine = audioRef.current
        if (fragment.id === 'priestess') {
          setPhase('priestessNormal')
          if (engine) {
            engine.playSample('click', 0.22)
            engine.tone({ freq: 110, dur: 0.3, type: 'square', gain: 0.05 })
          }
          return
        }
        setPhase('result')
        if (engine) {
          engine.playSample('click', 0.22)
          engine.playSample('data', 0.2)
          engine.speak(fragment.id, VOICE_TEXT[fragment.id])
          engine.tone({ freq: 180, dur: 0.1, type: 'square', gain: 0.06 })
          engine.tone({ freq: 90, dur: 0.35, type: 'sine', gain: 0.1, delay: 0.04 })
        }
      }, [])

      const completeCorruption = useCallback(function completeCorruption() {
        setPhase('identity')
      }, [])

      const popupErrorSound = useCallback(function popupErrorSound() {
        const engine = audioRef.current
        if (!engine) return
        engine.playSample('error', 0.16)
        engine.tone({ freq: 240, dur: 0.05, type: 'square', gain: 0.025 })
      }, [])

      const popupCloseSound = useCallback(function popupCloseSound() {
        const engine = audioRef.current
        if (!engine) return
        engine.playSample('click', 0.22)
        engine.tone({ freq: 150, dur: 0.05, type: 'square', gain: 0.03 })
      }, [])

      const popupAssembleSound = useCallback(function popupAssembleSound() {
        const engine = audioRef.current
        if (!engine) return
        engine.playSample('static', 0.26)
        engine.playSample('impact', 0.2)
        engine.playSample('glitch', 0.16)
        engine.chord([110, 220, 330, 440], 0.9, 0.05)
      }, [])

      /* boot / replay wiring */
      useEffect(function boot() {
        const loaded = loadConfig()
        if (!bootedRef.current) {
          bootedRef.current = true
          if (shouldAutoPlay(loaded)) startRun(loaded, false)
        }
        function onReplay() {
          startRun(loadConfig(), true)
        }
        window.addEventListener(REPLAY_EVENT, onReplay)
        return function cleanup() {
          window.removeEventListener(REPLAY_EVENT, onReplay)
        }
      }, [startRun])

      /* cleanup transient hold / finish timers */
      useEffect(function cleanupTimers() {
        return function cleanup() {
          const state = holdStateRef.current
          state.active = false
          if (state.raf) window.cancelAnimationFrame(state.raf)
          if (failTimerRef.current) window.clearTimeout(failTimerRef.current)
          if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current)
        }
      }, [])

      /* audio lifecycle */
      useEffect(function audioLifecycle() {
        if (!active) return undefined
        const engine = createAudioDirector()
        audioRef.current = engine
        engine.setMuted(muted)
        engine.setVoiceEnabled(cfg.voice)
        engine.setSfxEnabled(cfg.sound)
        return function cleanup() {
          engine.dispose()
          if (audioRef.current === engine) audioRef.current = null
        }
      }, [active, runId])

      useEffect(function syncMute() {
        if (audioRef.current) audioRef.current.setMuted(muted)
      }, [muted])

      useEffect(function syncSources() {
        const engine = audioRef.current
        if (!engine) return
        engine.setVoiceEnabled(cfg.voice)
        engine.setSfxEnabled(cfg.sound)
      }, [cfg.voice, cfg.sound])

      /* fullscreen support and state */
      useEffect(function watchFullscreen() {
        const doc = document
        setFullscreenSupported(!!(doc.fullscreenEnabled && doc.documentElement.requestFullscreen))
        function onChange() {
          setFullscreen(!!doc.fullscreenElement)
        }
        doc.addEventListener('fullscreenchange', onChange)
        return function cleanup() {
          doc.removeEventListener('fullscreenchange', onChange)
        }
      }, [])

      /* 自动全屏已关闭：只有用户主动点右上角「全屏」按钮才会进全屏。 */

      /* Browsers require a gesture before media playback; unlock once. */
      useEffect(function unlockOnGesture() {
        if (!active) return undefined
        function unlock() {
          if (audioRef.current) audioRef.current.unlock()
        }
        window.addEventListener('pointerdown', unlock, { once: true, capture: true })
        window.addEventListener('keydown', unlock, { once: true, capture: true })
        return function cleanup() {
          window.removeEventListener('pointerdown', unlock, true)
          window.removeEventListener('keydown', unlock, true)
        }
      }, [active, runId])

      /* body scroll lock */
      useEffect(function lockScroll() {
        if (!active) return undefined
        const body = document.body
        const previous = body.style.overflow
        body.style.overflow = 'hidden'
        return function cleanup() {
          body.style.overflow = previous
        }
      }, [active])

      /* pointer release anywhere while holding */
      useEffect(function releaseWatcher() {
        if (!holding) return undefined
        function release() {
          endHold()
        }
        window.addEventListener('pointerup', release)
        window.addEventListener('pointercancel', release)
        window.addEventListener('blur', release)
        return function cleanup() {
          window.removeEventListener('pointerup', release)
          window.removeEventListener('pointercancel', release)
          window.removeEventListener('blur', release)
        }
      }, [holding, endHold])

      /* timeline */
      useEffect(function timeline() {
        if (!active) return undefined
        const scale = Math.max(SPEED_MIN, Number(cfg.speed) || 1)
        function wait(ms) {
          return Math.max(40, Math.round(ms / scale))
        }
        function advance(nextPhase) {
          return function advancePhase() {
            if (finishingRef.current) return
            setPhase(nextPhase)
          }
        }
        const voiceHold = {
          boot: 5000,
          archive: 4100,
          link: 2500,
          result: 4600,
          identity: 6300,
          welcome: 5600,
        }
        function after(base) {
          return Math.max(wait(base), voiceHold[phase] || 0)
        }
        let id = 0
        if (phase === 'boot') id = window.setTimeout(advance('archive'), after(5200))
        else if (phase === 'archive') id = window.setTimeout(advance('handshake'), after(4300))
        else if (phase === 'link') id = window.setTimeout(advance('fragments'), after(2600))
        else if (phase === 'result') id = window.setTimeout(advance('identity'), after(4600))
        else if (phase === 'priestessNormal') id = window.setTimeout(advance('corruption'), Math.max(1500, wait(2300)))
        else if (phase === 'corruption') id = window.setTimeout(advance('identity'), 30000)
        else if (phase === 'identity') id = window.setTimeout(advance('welcome'), after(6500))
        else if (phase === 'welcome') id = window.setTimeout(function fallback() { if (!finishingRef.current) finish() }, 20000)
        return function cleanup() {
          if (id) window.clearTimeout(id)
        }
      }, [active, phase, runId, cfg.speed, finish])

      /* phase transition fx + cues */
      useEffect(function phaseFx() {
        if (!active) return undefined
        let glitchTimer = 0
        if (phase === 'priestessNormal') {
          setGlitch(false)
        } else {
          setGlitch(true)
          glitchTimer = window.setTimeout(function clearGlitch() {
            setGlitch(false)
          }, 720)
        }
        let flashTimer = 0
        let voiceTimer = 0
        if (phase === 'link' || phase === 'corruption') {
          setFlash(true)
          flashTimer = window.setTimeout(function clearFlash() {
            setFlash(false)
          }, 540)
        }
        const engine = audioRef.current
        if (engine) {
          if (phase === 'boot') {
            engine.playSample('terminal', 0.32)
            engine.speak('boot', VOICE_TEXT.boot)
          } else if (phase === 'archive') {
            engine.playSample('scan', 0.2)
            engine.speak('archive', VOICE_TEXT.archive)
          } else if (phase === 'handshake') {
            engine.speak('handshake', VOICE_TEXT.handshake)
          } else if (phase === 'link') {
            engine.playSample('glitch', 0.14)
            engine.chord([220, 330, 440], 0.7, 0.06)
            engine.speak('link', VOICE_TEXT.link)
          } else if (phase === 'fragments') {
            engine.playSample('data', 0.16)
            engine.speak('fragments', VOICE_TEXT.fragments)
          } else if (phase === 'priestessNormal') {
            engine.playSample('data', 0.14)
            engine.tone({ freq: 220, dur: 0.3, type: 'sine', gain: 0.03 })
            engine.speak('priestess', VOICE_TEXT.priestess)
          } else if (phase === 'corruption') {
            engine.stopVoice()
            engine.playSample('static', 0.3)
            engine.playSample('error', 0.26)
            engine.playSample('glitch', 0.18)
            engine.noise(0.55, 0.1, 1700)
            engine.tone({ freq: 90, dur: 0.55, type: 'sawtooth', gain: 0.04, slide: 28 })
            voiceTimer = window.setTimeout(function forgetVoice() {
              if (!finishingRef.current) engine.speakPriestess('forget', VOICE_TEXT.forget)
            }, 3350)
          } else if (phase === 'identity') {
            engine.playSample('impact', 0.14)
            engine.speak('identity', VOICE_TEXT.identity)
          } else if (phase === 'welcome') {
            engine.playSample('impact', 0.12)
            engine.chord([261.63, 392, 523.25], 0.9, 0.05)
          }
        }
        return function cleanup() {
          if (glitchTimer) window.clearTimeout(glitchTimer)
          if (flashTimer) window.clearTimeout(flashTimer)
          if (voiceTimer) window.clearTimeout(voiceTimer)
        }
      }, [active, phase, runId])

      /* final identity correction: Doctor -> static -> Prophet -> thanks */
      useEffect(function welcomeCorrection() {
        if (!active || phase !== 'welcome') return undefined
        setWelcomeStage('doctor')
        setWelcomeReady(false)
        setWelcomeErrors([])
        setWelcomeShattering(false)
        setWelcomeThanks(false)
        hadEarlyErrorRef.current = false
        const engine = audioRef.current
        if (engine) engine.speak('welcome_doctor', VOICE_TEXT.welcome_doctor, false, 1)
        let prophetTimer = 0
        let readyTimer = 0
        let thanksTimer = 0
        let shatterTimer = 0
        const staticTimer = window.setTimeout(function corruptWelcome() {
          if (finishingRef.current) return
          setWelcomeStage('glitch')
          if (engine) {
            engine.stopVoice()
            engine.playSample('zap', 0.38)
            engine.playSample('error', 0.24)
            engine.playSample('glitch', 0.2)
            engine.noise(0.5, 0.12, 1800)
            engine.tone({ freq: 90, dur: 0.45, type: 'sawtooth', gain: 0.05, slide: 30 })
          }
          prophetTimer = window.setTimeout(function correctToProphet() {
            if (finishingRef.current) return
            setWelcomeStage('prophet')
            setWelcomeShattering(true)
            shatterTimer = window.setTimeout(function clearShatter() {
              setWelcomeErrors([])
              setWelcomeShattering(false)
            }, 700)
            if (engine) engine.speak('welcome_prophet', VOICE_TEXT.welcome_prophet, false, 1)
            readyTimer = window.setTimeout(function prophetVoiceDone() {
              if (finishingRef.current) return
              setWelcomeReady(true)
              if (hadEarlyErrorRef.current) {
                finish()
                return
              }
              setWelcomeThanks(true)
              if (engine) engine.speak('thank_you_prophet', VOICE_TEXT.thank_you_prophet)
              thanksTimer = window.setTimeout(function enterSystem() {
                if (!finishingRef.current) finish()
              }, 1800)
            }, 1600)
          }, 620)
        }, 2600)
        return function cleanup() {
          window.clearTimeout(staticTimer)
          if (prophetTimer) window.clearTimeout(prophetTimer)
          if (readyTimer) window.clearTimeout(readyTimer)
          if (thanksTimer) window.clearTimeout(thanksTimer)
          if (shatterTimer) window.clearTimeout(shatterTimer)
        }
      }, [active, phase, runId, finish])

      useEffect(function resetWelcomeErrors() {
        if (phase !== 'welcome') {
          setWelcomeErrors([])
          setWelcomeShattering(false)
          setWelcomeThanks(false)
        }
      }, [phase])

      /* focus the useful control for each phase */
      useEffect(function focusStage() {
        if (!active) return undefined
        const id = window.requestAnimationFrame(function focus() {
          let target = null
          if (phase === 'handshake') target = holdRef.current
          else if (phase === 'welcome') target = enterRef.current
          else if (phase !== 'fragments') target = rootRef.current
          if (target && typeof target.focus === 'function') target.focus()
        })
        return function cleanup() {
          window.cancelAnimationFrame(id)
        }
      }, [active, phase, runId])

      /* keyboard: hold, continue, skip; keep host shortcuts out of the overlay */
      useEffect(function keyboard() {
        if (!active) return undefined

        function isInteractive(target) {
          if (!target || !target.closest) return false
          if (target === holdRef.current) return false
          return !!target.closest('button, a, input, select, textarea, [role="button"]')
        }

        function onKeyDown(event) {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            finish()
            return
          }
          if (event.key === 'Tab') {
            const root = rootRef.current
            if (!root) return
            const nodes = root.querySelectorAll(
              'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            if (!nodes.length) {
              event.preventDefault()
              return
            }
            const first = nodes[0]
            const last = nodes[nodes.length - 1]
            const current = document.activeElement
            if (event.shiftKey) {
              if (current === first || current === root || !root.contains(current)) {
                event.preventDefault()
                last.focus()
              }
            } else if (current === last || !root.contains(current)) {
              event.preventDefault()
              first.focus()
            }
            return
          }
          if (event.metaKey || event.ctrlKey || event.altKey) {
            event.stopPropagation()
            return
          }
          if (
            phaseRef.current === 'handshake' &&
            (event.key === ' ' || event.key === 'Enter' || event.key === 'Spacebar')
          ) {
            if (isInteractive(event.target)) return
            event.preventDefault()
            event.stopPropagation()
            if (!event.repeat) beginHold()
            return
          }
          if (
            phaseRef.current === 'welcome' &&
            (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar')
          ) {
            if (isInteractive(event.target)) return
            event.preventDefault()
            event.stopPropagation()
            blockWelcomeEnter()
            return
          }
          event.stopPropagation()
        }

        function onKeyUp(event) {
          if (
            phaseRef.current === 'handshake' &&
            (event.key === ' ' || event.key === 'Enter' || event.key === 'Spacebar')
          ) {
            if (!isInteractive(event.target)) {
              event.preventDefault()
              event.stopPropagation()
              endHold()
            }
          }
        }

        window.addEventListener('keydown', onKeyDown, true)
        window.addEventListener('keyup', onKeyUp, true)
        return function cleanup() {
          window.removeEventListener('keydown', onKeyDown, true)
          window.removeEventListener('keyup', onKeyUp, true)
        }
      }, [active, beginHold, endHold, finish, blockWelcomeEnter])

      const hexLines = useMemo(function makeHex() {
        const rng = makeRng(0x91a2b3c4 ^ runId)
        const out = []
        for (let i = 0; i < 13; i++) out.push(hexLine(rng, 8))
        return out
      }, [runId])

      if (!active) return null

      const step = PHASE_STEP[phase] || 1
      const statusText =
        phase === 'handshake'
          ? '等待接触'
          : phase === 'welcome'
            ? '访问已授权'
            : phase === 'priestessNormal'
              ? '记忆读取'
              : phase === 'corruption'
                ? '记忆异常'
                : phase === 'fragments'
                ? '记忆回收'
                : '安全信道 / 07'

      let phaseView = null
      if (phase === 'boot') phaseView = h(BootPhase, { speed: cfg.speed })
      else if (phase === 'archive') phaseView = h(ArchivePhase)
      else if (phase === 'handshake') {
        phaseView = h(HandshakePhase, {
          progress: hold,
          holding,
          failed: holdFailed,
          coreRef: holdRef,
          onDown: beginHold,
          onUp: endHold,
        })
      } else if (phase === 'link') phaseView = h(LinkPhase)
      else if (phase === 'fragments') phaseView = h(FragmentsPhase, { onSelect: chooseFragment })
      else if (phase === 'result' || phase === 'priestessNormal') {
        phaseView = h(ResultPhase, { fragment: selected })
      } else if (phase === 'corruption') {
        phaseView = h(CorruptionPhase, {
          onComplete: completeCorruption,
          onCloseSound: popupCloseSound,
          onAssembleSound: popupAssembleSound,
          onErrorSound: popupErrorSound,
        })
      } else if (phase === 'identity') phaseView = h(IdentityPhase, { cfg })
      else if (phase === 'welcome') {
        phaseView = h(WelcomePhase, {
          cfg,
          onEnter: blockWelcomeEnter,
          enterRef,
          stage: welcomeStage,
          ready: welcomeReady,
          thanks: welcomeThanks,
        })
      }

      return h(
        'div',
        {
          ref: rootRef,
          className:
            'prts-root' +
            (isExiting ? ' is-exiting' : '') +
            (glitch && !reduced ? ' is-glitch' : ''),
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': 'PRTS 启动序列',
          tabIndex: -1,
          'data-phase': phase,
          'data-forced': forced ? 'true' : 'false',
        },
        h('style', null, CSS),
        h(
          'div',
          { className: 'prts-scene', 'aria-hidden': true },
          h(Dust, { reduced }),
          h('div', { className: 'prts-vignette' }),
          h('div', { className: 'prts-blueprint' }),
          h('div', { className: 'prts-contours' }),
          h('div', { className: 'prts-grid-floor' }),
          h('div', { className: 'prts-ruler left' }),
          h('div', { className: 'prts-ruler right' }),
          h('div', { className: 'prts-halftone' }),
          h('div', { className: 'prts-scanlines' }),
          h('div', { className: 'prts-scanbar' }),
          h('div', { className: 'prts-grain' })
        ),
        h(
          'div',
          { className: 'prts-frame', 'aria-hidden': true },
          h('i', { className: 'tl' }),
          h('i', { className: 'tr' }),
          h('i', { className: 'bl' }),
          h('i', { className: 'br' })
        ),
        h(
          'header',
          { className: 'prts-header' },
          h(
            'div',
            { className: 'prts-brand' },
            h('div', { className: 'prts-brand-mark' }, h(BrandMark)),
            h('div', { className: 'prts-brand-name' }, 'PRTS'),
            h('div', { className: 'prts-brand-sub' }, '初等罗德岛终端服务')
          ),
          h(
            'div',
            { className: 'prts-header-right' },
            h('div', { className: 'prts-status' }, h('i', { className: 'prts-dot' }), statusText),
            fullscreenSupported
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'prts-btn-ghost prts-fullscreen-btn',
                    onClick: toggleFullscreen,
                    'data-prts-fullscreen': 'true',
                    'aria-pressed': fullscreen,
                    'aria-label': fullscreen ? '退出全屏' : '进入全屏',
                    title: fullscreen ? '退出全屏' : '进入全屏',
                  },
                  fullscreen ? '退出全屏' : '全屏'
                )
              : null,
            h(
              'button',
              {
                type: 'button',
                className: 'prts-btn-ghost',
                onClick: function toggleMute() {
                  const next = !muted
                  setMuted(next)
                  const engine = audioRef.current
                  if (engine) {
                    engine.setMuted(next)
                    if (!next) engine.unlock()
                  }
                },
                'aria-label': muted ? '取消静音' : '静音',
                'aria-pressed': !muted,
              },
              muted ? '声音 关' : '声音 开'
            ),
            h(
              'button',
              { type: 'button', className: 'prts-btn-ghost prts-skip', onClick: finish },
              '跳过 [ESC]'
            )
          )
        ),
        h(
          'aside',
          { className: 'prts-rail prts-rail-left', 'aria-hidden': true },
          h('div', { className: 'prts-rail-label' }, '前文明档案'),
          h('div', { className: 'prts-rail-stat' }, '罗德岛 / 陆行舰平台'),
          h('div', { className: 'prts-rail-stat' }, '节点 01 / PRTS 核心')
        ),
        h(
          'aside',
          { className: 'prts-rail prts-rail-right', 'aria-hidden': true },
          h(
            'div',
            { className: 'prts-signal' },
            [0, 1, 2, 3, 4, 5].map(function signalBar(i) {
              return h('i', { key: i, className: i < 4 ? 'on' : '' })
            })
          ),
          hexLines.map(function hex(value, index) {
            return h('div', { className: 'prts-hex', key: index }, index % 4 === 0 ? h('b', null, value) : value)
          })
        ),
        h(
          'main',
          { className: 'prts-stage' },
          h(
            'div',
            { className: 'prts-phase', key: runId + ':' + phase },
            phaseView
          )
        ),
        h(
          'div',
          { className: 'prts-seq', 'aria-hidden': true },
          h('div', null, '[ 0' + step + ' / 06 ] ', h('b', null, PHASE_LABEL[phase])),
          h(
            'div',
            { className: 'prts-seq-ticks' },
            [1, 2, 3, 4, 5, 6].map(function tick(i) {
              return h('i', { key: i, className: i < step ? 'past' : i === step ? 'on' : '' })
            })
          )
        ),
        h(
          'footer',
          { className: 'prts-footer' },
          h('span', null, h('b', null, '档案层'), ' // 前文明'),
          h('span', { className: 'prts-footer-center' }, '罗德岛 · 陆行舰平台'),
          h(
            'span',
            { className: 'prts-footer-right' },
            h('i', { className: 'prts-barcode', 'aria-hidden': true }),
            '泰拉历 1098 // ',
            formatClock(clock)
          )
        ),
        phase === 'welcome' && welcomeErrors.length
          ? h(WelcomeErrors, { errors: welcomeErrors, shattering: welcomeShattering })
          : null,
        h('div', { className: 'prts-flash' + (flash ? ' on' : ''), 'aria-hidden': true }),
        h('div', { className: 'prts-glitch-layer', 'aria-hidden': true }),
        h('div', { className: 'prts-sweep', 'aria-hidden': true })
      )
    }

    /* ── settings page ────────────────────────────────────────────────────── */

    function SetRow(props) {
      return h(
        'div',
        { className: 'prts-set-row' },
        h(
          'div',
          { className: 'prts-set-row-text' },
          h('div', { className: 'prts-set-label' }, props.label),
          props.hint ? h('div', { className: 'prts-set-hint' }, props.hint) : null
        ),
        h('div', { className: 'prts-set-control' }, props.children)
      )
    }

    function SetToggle(props) {
      return h(
        'label',
        { className: 'prts-set-switch' },
        h('input', {
          type: 'checkbox',
          checked: !!props.checked,
          onChange: function change(event) {
            props.onChange(event.target.checked)
          },
          'aria-label': props.label,
        }),
        h('span', { className: 'prts-set-track' })
      )
    }

    function SetText(props) {
      const [text, setText] = useState(props.value)
      useEffect(function sync() {
        setText(props.value)
      }, [props.value])
      return h('input', {
        className: 'prts-set-input',
        type: 'text',
        value: text,
        maxLength: props.maxLength || 24,
        spellCheck: false,
        'aria-label': props.label,
        onChange: function change(event) {
          setText(event.target.value)
        },
        onBlur: function commit() {
          props.onCommit(text)
        },
        onKeyDown: function submit(event) {
          if (event.key === 'Enter') event.currentTarget.blur()
        },
      })
    }

    function SettingsSection(props) {
      const [draft, setDraft] = useState(function initial() {
        return loadConfig()
      })
      const [toast, setToast] = useState('')
      const toastTimer = useRef(0)

      function flash(message) {
        setToast(message)
        if (toastTimer.current) window.clearTimeout(toastTimer.current)
        toastTimer.current = window.setTimeout(function clear() {
          toastTimer.current = 0
          setToast('')
        }, 1800)
      }

      function update(patch) {
        const next = saveConfig(patch)
        setDraft(next)
        flash('已保存')
      }

      function preview() {
        try {
          window.dispatchEvent(new CustomEvent(REPLAY_EVENT))
        } catch (e) {
          /* noop */
        }
        flash('预览已开始')
        try {
          if (props && typeof props.close === 'function') props.close()
        } catch (e) {
          /* noop */
        }
      }

      function reset() {
        const next = sanitizeConfig(DEFAULTS)
        writeStore('localStorage', CONFIG_KEY, JSON.stringify(next))
        setDraft(next)
        flash('已恢复默认')
      }

      useEffect(function cleanupToast() {
        return function cleanup() {
          if (toastTimer.current) window.clearTimeout(toastTimer.current)
        }
      }, [])

      return h(
        'div',
        { className: 'prts-set' },
        h('style', null, CSS),
        h(
          'div',
          { className: 'prts-set-head' },
          h('div', { className: 'prts-set-eyebrow' }, 'PRTS // 前文明档案'),
          h('h2', { className: 'prts-set-title' }, 'PRTS 启动序列'),
          h(
            'p',
            { className: 'prts-set-desc' },
            'Web UI 的前文明档案交互式启动界面：黑屏、冷启动日志、神经握手、记忆回收、普瑞赛斯的正常结果与可交互报错弹窗，以及博士 → 预言家的终幕身份纠正。按 Esc 可随时跳过。'
          )
        ),
        h(
          'div',
          { className: 'prts-set-card' },
          h('div', { className: 'prts-set-card-title' }, '播放'),
          h(
            SetRow,
            { label: '显示启动序列', hint: '打开或关闭启动界面。' },
            h(SetToggle, {
              checked: draft.enabled,
              label: '显示启动序列',
              onChange: function change(value) {
                update({ enabled: value })
              },
            })
          ),
          h(
            SetRow,
            { label: '播放时机', hint: '选择何时允许再次播放。' },
            h(
              'select',
              {
                className: 'prts-set-select',
                value: draft.mode,
                'aria-label': '播放时机',
                onChange: function change(event) {
                  update({ mode: event.target.value })
                },
              },
              MODES.map(function option(item) {
                return h('option', { key: item[0], value: item[0] }, item[1])
              })
            )
          ),
          h(
            SetRow,
            { label: '序列速度', hint: '缩放整段流程，包括神经握手。' },
            h('input', {
              className: 'prts-set-range',
              type: 'range',
              min: SPEED_MIN,
              max: SPEED_MAX,
              step: 0.05,
              value: draft.speed,
              'aria-label': '序列速度',
              onChange: function change(event) {
                update({ speed: Number(event.target.value) })
              },
            }),
            h('span', { className: 'prts-set-value' }, Number(draft.speed).toFixed(2) + '×')
          ),
          h(
            SetRow,
            { label: '英文女声播报', hint: '英文女声念出关键台词；界面文字保持中文。' },
            h(SetToggle, {
              checked: draft.voice,
              label: '英文女声播报',
              onChange: function change(value) {
                update({ voice: value })
              },
            })
          ),
          h(
            SetRow,
            { label: '界面音效', hint: '终端环境音、点击声与转场音效。首次交互后开始播放。' },
            h(SetToggle, {
              checked: draft.sound,
              label: '界面音效',
              onChange: function change(value) {
                update({ sound: value })
              },
            })
          )
        ),
        h(
          'div',
          { className: 'prts-set-card' },
          h('div', { className: 'prts-set-card-title' }, '身份'),
          h(
            SetRow,
            { label: '呼号', hint: '终幕显示的大字名称。默认“预言家”；英文女声固定念 Prophet。' },
            h(SetText, {
              value: draft.callsign,
              label: '呼号',
              maxLength: 20,
              onCommit: function commit(value) {
                update({ callsign: value })
              },
            })
          ),
          h(
            SetRow,
            { label: '身份后缀', hint: '呼号下方的身份。默认“博士”。' },
            h(SetText, {
              value: draft.designation,
              label: '身份后缀',
              maxLength: 24,
              onCommit: function commit(value) {
                update({ designation: value })
              },
            })
          ),
          h(
            SetRow,
            { label: '对象档案', hint: '在欢迎前显示完整的预言家 / 博士档案。' },
            h(SetToggle, {
              checked: draft.showDossier,
              label: '显示对象档案',
              onChange: function change(value) {
                update({ showDossier: value })
              },
            })
          )
        ),
        h(
          'div',
          { className: 'prts-set-card' },
          h('div', { className: 'prts-set-card-title' }, '预览'),
          h(
            SetRow,
            {
              label: '立即预览',
              hint: '关闭设置并立即播放已保存的序列。预览不会占用本次播放标记。',
            },
            h(
              'button',
              { type: 'button', className: 'prts-set-btn primary', onClick: preview },
              '预览序列'
            )
          ),
          h(
            SetRow,
            {
              label: '恢复默认',
              hint: '恢复呼号“预言家”、身份“博士”和每次页面加载播放。',
            },
            h('button', { type: 'button', className: 'prts-set-btn', onClick: reset }, '恢复默认')
          )
        ),
        h(
          'div',
          { className: 'prts-set-actions' },
          h(
            'span',
            { className: 'prts-set-note' },
            '设置保存在本地，下次启动时读取。界面为中文，英文女声播报，按 Esc 可跳过。'
          ),
          toast ? h('span', { className: 'prts-set-toast' }, toast) : null
        ),
        h('div', { className: 'prts-set-foot' }, 'PRTS // 禁止未经授权的访问')
      )
    }

    /* ── plugin registration ──────────────────────────────────────────────── */

    function apply(ctx) {
      ctx.slots.inject('shell.overlay', function overlaySlot() {
        return ctx.slots.register(
          { name: 'shell.overlay', id: 'prts-startup', order: 100 },
          StartupOverlay
        )
      })
      ctx.slots.inject('settings.section', function settingsSlot() {
        return ctx.slots.register(
          { name: 'settings.section', id: 'prts-startup', order: 26, label: 'PRTS 启动' },
          SettingsSection
        )
      })
    }

    return { inject: ['slots'], apply }
  },
})
