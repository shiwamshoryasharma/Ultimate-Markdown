import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import type { ExtraProps } from 'react-markdown'
import { Download, Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { Select } from '@/components/common/Select'
import { resolveLocalAsset, releaseLocalAsset } from '@/services/filesystem'
import { isRemoteUrl } from '@/services/markdown/documentLinks'
import { usePreviewContext } from './PreviewContext'
import './PreviewMedia.css'

function useMediaSource(src?: string) {
  const { workspace, documentPath } = usePreviewContext()
  const [result, setResult] = useState<{ source: string; path: string; workspace: typeof workspace; url: string }>()
  useEffect(() => {
    if (!src || isRemoteUrl(src) || !workspace) return
    let cancelled = false, acquired = false
    void resolveLocalAsset(workspace, documentPath, src).then(url => {
      if (!url) return
      if (cancelled) { releaseLocalAsset(workspace, documentPath, src); return }
      acquired = true
      setResult({ source: src, path: documentPath, workspace, url })
    }).catch(() => { /* The player reports unavailable local media. */ })
    return () => { cancelled = true; if (acquired) releaseLocalAsset(workspace, documentPath, src) }
  }, [workspace, documentPath, src])
  return src && isRemoteUrl(src) ? src : result && result.source === src && result.path === documentPath && result.workspace === workspace ? result.url : undefined
}
const clock = (seconds: number) => Number.isFinite(seconds) ? Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0') : '0:00'
function MediaPlayer({ src, poster, node: _node, children, audioOnly = false, ...props }: ComponentPropsWithoutRef<'video'> & ExtraProps & { audioOnly?: boolean }) {
  const Element = audioOnly ? 'audio' : 'video'
  const kind = audioOnly ? 'audio' : 'video'
  const resolved = useMediaSource(src), resolvedPoster = useMediaSource(poster)
  const video = useRef<HTMLMediaElement>(null), root = useRef<HTMLSpanElement>(null)
  const [playing, setPlaying] = useState(false), [duration, setDuration] = useState(0), [time, setTime] = useState(0)
  const [volume, setVolume] = useState(1), [muted, setMuted] = useState(!!props.muted), [speed, setSpeed] = useState('1'), [error, setError] = useState('')
  const toggle = async () => {
    if (!video.current) return
    if (!video.current.paused) video.current.pause()
    else try { await video.current.play(); setError('') } catch { setError('Video cannot play. Check its file path and browser format support.') }
  }
  const fullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.current?.requestFullscreen() }
    catch { setError('Fullscreen is unavailable in this browser.') }
  }
  const updateVolume = () => { if (video.current) { setVolume(video.current.volume); setMuted(video.current.muted) } }
  return <span ref={root} className="um-video" role="group" aria-label={audioOnly ? 'Audio player' : 'Video player'}>
    <Element {...props} ref={element => { video.current = element }} src={resolved} poster={resolvedPoster} controls={false} autoPlay={false} playsInline preload="metadata" onClick={() => void toggle()} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onLoadedMetadata={event => { setDuration(event.currentTarget.duration); setTime(0); setError(''); event.currentTarget.playbackRate = Number(speed) }} onTimeUpdate={event => setTime(event.currentTarget.currentTime)} onDurationChange={event => setDuration(event.currentTarget.duration)} onVolumeChange={updateVolume} onError={() => setError('Video unavailable. Open its source folder or check the video URL and format.')}>{children}</Element>
    <span className="um-video__controls">
      <input className="um-video__timeline" type="range" aria-label={(audioOnly ? 'Audio' : 'Video') + ' position'} min={0} max={Number.isFinite(duration) && duration > 0 ? duration : 1} step={0.1} value={time} disabled={!Number.isFinite(duration) || duration <= 0} onChange={event => { if (video.current) video.current.currentTime = Number(event.target.value) }} />
      <button type="button" aria-label={(playing ? 'Pause ' : 'Play ') + kind} onClick={() => void toggle()}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
      <time>{clock(time)} / {clock(duration)}</time>
      <button type="button" aria-label={(muted ? 'Unmute ' : 'Mute ') + kind} onClick={() => { if (video.current) video.current.muted = !video.current.muted }}>{muted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
      <input className="um-video__volume" type="range" aria-label={(audioOnly ? 'Audio' : 'Video') + ' volume'} min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={event => { if (video.current) { video.current.volume = Number(event.target.value); video.current.muted = false } }} />
      <span className="um-video__speed"><Select aria-label="Playback speed" value={speed} onChange={event => { setSpeed(event.target.value); if (video.current) video.current.playbackRate = Number(event.target.value) }}>{['0.5','0.75','1','1.25','1.5','2'].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</Select></span>
      {resolved && <a href={resolved} download target="_blank" rel="noopener noreferrer" aria-label={'Download ' + kind}><Download size={16} /></a>}
      {!audioOnly && <button type="button" aria-label="Toggle video fullscreen" onClick={() => void fullscreen()}><Maximize2 size={17} /></button>}
    </span>
    {(error || (src && !resolved)) && <span className="um-video__notice" role="status">{error || 'Open the folder containing this video to load local media.'}</span>}
  </span>
}
export function PreviewVideo(props: ComponentPropsWithoutRef<'video'> & ExtraProps) { return <MediaPlayer key={props.src} {...props} /> }
export function PreviewAudio(props: ComponentPropsWithoutRef<'audio'> & ExtraProps) { return <MediaPlayer key={props.src} {...props} audioOnly /> }
export function PreviewSource({ src, node: _node, ...props }: ComponentPropsWithoutRef<'source'> & ExtraProps) {
  const resolved = useMediaSource(src), source = useRef<HTMLSourceElement>(null)
  useEffect(() => { const media = source.current?.parentElement; if (resolved && media instanceof HTMLMediaElement) media.load() }, [resolved])
  return <source {...props} ref={source} src={resolved} />
}
