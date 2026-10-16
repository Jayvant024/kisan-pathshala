import { useEffect, useId, useRef, useState } from 'react'

let iframeApiPromise

function loadIframeApi() {
	if (window.YT?.Player) return Promise.resolve(window.YT)
	if (iframeApiPromise) return iframeApiPromise
	iframeApiPromise = new Promise((resolve, reject) => {
		const previousReady = window.onYouTubeIframeAPIReady
		window.onYouTubeIframeAPIReady = () => {
			previousReady?.()
			resolve(window.YT)
		}
		let script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
		if (!script) {
			script = document.createElement('script')
			script.src = 'https://www.youtube.com/iframe_api'
			script.async = true
			script.onerror = () => reject(new Error('Unable to load the YouTube player'))
			document.head.append(script)
		}
	})
	return iframeApiPromise
}

function getVideoId(value) {
	if (typeof value !== 'string') return ''
	if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value
	try {
		const url = new URL(value)
		const host = url.hostname.replace(/^www\./, '').toLowerCase()
		if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || ''
		if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
			return url.searchParams.get('v')
				|| url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1]
				|| ''
		}
	} catch {
		return ''
	}
	return ''
}

function YouTubePlayer({ videoUrl, initialPosition = 0, content, onPosition }) {
	const playerId = `youtube-player-${useId().replace(/:/g, '')}`
	const onPositionRef = useRef(onPosition)
	const playerRef = useRef(null)
	const initialPositionRef = useRef(initialPosition)
	const contentRef = useRef(content)
	const [ready, setReady] = useState(false)
	const [playerError, setPlayerError] = useState('')
	const videoId = getVideoId(videoUrl)
	const error = videoId ? playerError : content.invalidYouTubeUrl

	useEffect(() => { onPositionRef.current = onPosition }, [onPosition])
	useEffect(() => { contentRef.current = content }, [content])

	useEffect(() => {
		if (!videoId) return undefined
		let active = true
		let progressTimer
		loadIframeApi().then((youtube) => {
			if (!active) return
			const player = new youtube.Player(playerId, {
				videoId,
				playerVars: { controls: 1, enablejsapi: 1, origin: window.location.origin, playsinline: 1, rel: 0 },
				events: {
					onReady(event) {
						playerRef.current = event.target
						if (initialPositionRef.current > 0) event.target.seekTo(Number(initialPositionRef.current), true)
						if (active) setReady(true)
					},
					onStateChange(event) {
						if (progressTimer) window.clearInterval(progressTimer)
						const flush = () => {
							const position = Math.floor(event.target.getCurrentTime())
							if (Number.isFinite(position) && position >= 0) onPositionRef.current?.(position)
						}
						if (event.data === youtube.PlayerState.PLAYING) progressTimer = window.setInterval(flush, 10000)
						else if (event.data === youtube.PlayerState.PAUSED || event.data === youtube.PlayerState.ENDED) flush()
					},
					onError() { if (active) setPlayerError(contentRef.current.youtubePlaybackError) },
				},
			})
			playerRef.current = player
		}).catch(() => { if (active) setPlayerError(contentRef.current.youtubePlaybackError) })
		return () => {
			active = false
			if (progressTimer) window.clearInterval(progressTimer)
			const player = playerRef.current
			if (player?.getCurrentTime) {
				const position = Math.floor(player.getCurrentTime())
				if (Number.isFinite(position) && position >= 0) onPositionRef.current?.(position)
				player.destroy()
			}
			playerRef.current = null
		}
	}, [playerId, videoId])

	return (
		<div className="youtube-player-shell">
			<div className="youtube-player-frame"><div id={playerId} /></div>
			{!ready && !error && <p className="youtube-player-status">{content.loadingVideo}</p>}
			{error && <p className="form-message" role="alert">{error}</p>}
		</div>
	)
}

export default YouTubePlayer